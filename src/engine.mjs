/**
 * 搶課引擎。
 *
 * 策略：
 *   1. 定期（預設 2.5 秒）抓一次講座清單，追蹤每個目標的 canapp / cnt_10 狀態。
 *   2. 只要目標狀態變成「可報名(Y)」且自己尚未報名(cnt_10=0)，立刻送出報名。
 *   3. 「已額滿(F)」不停手——名額隨時可能因他人退選而釋出，這是搶課的主戰場。
 *   4. 報名開放瞬間 / 名額釋出瞬間切換成高速輪詢（burst），其它時間維持禮貌間隔。
 *   5. 所有請求都有最小間隔與退避，避免對學校伺服器造成壓力。
 */

import { EventEmitter } from 'node:events';
import * as api from './asia.mjs';
import { extractLiteracies } from './calendar.mjs';

const TERMINAL = new Set(['registered', 'closed', 'manual', 'error']);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));

export class Engine extends EventEmitter {
  constructor({ settings = {}, targets = [] } = {}) {
    super();
    this.settings = normalizeSettings(settings);
    this.targets = (Array.isArray(targets) ? targets : []).map(normalizeTarget);

    this.lectures = [];
    this.session = null;
    this.stdInfo = null;
    this.running = false;
    this.timer = null;
    this.logs = [];
    this.logSeq = 0;

    this.stats = {
      requests: 0,
      registrations: 0,
      ticks: 0,
      startedAt: 0,
      lastSyncAt: 0,
      lastError: ''
    };

    /** 由 server 指派：狀態需要保存到磁碟時呼叫。 */
    this.onChange = () => {};

    this._ticking = false;
    this._lastRequestAt = 0;
    this._attemptAt = new Map();
    this._burstUntil = 0;
    this._lastCanapp = new Map();
    this._lastRelogin = 0;
    this._errorStreak = 0;
    this._lastErrorKey = '';
  }

  /* ---------------------------- 生命週期 ---------------------------- */

  setSession(session) {
    const wasRunning = this.running;
    this.session = session ? { ...session } : null;
    this.stdInfo = null;
    if (!session) {
      if (wasRunning) this.stop('已登出');
      return;
    }
    this.log('info', `已登入：${session.emp_nm || session.emp_id}（${session.emp_rl || '?'}）`);
    this.onChange();
    this.emit('state');
  }

  async start() {
    if (this.running) return;
    if (!this.session?.token) throw new Error('請先登入再開始');
    const active = this.activeTargets();
    if (!active.length) throw new Error('請先加入至少一個目標講座');

    await this.ensureIdentity();

    this.running = true;
    this.stats.startedAt = Date.now();
    this.stats.lastError = '';
    this._errorStreak = 0;
    this.log('info', `開始監控 ${active.length} 場講座（一般間隔 ${this.settings.intervalMs} ms）`);
    this.emit('state');
    this.scheduleTick(0);
  }

  stop(reason = '') {
    const wasRunning = this.running;
    this.running = false;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (wasRunning) {
      this.log('info', '停止監控' + (reason ? `：${reason}` : ''));
      this.stats.startedAt = 0;
    }
    this.emit('state');
  }

  async ensureIdentity() {
    if (this.stdInfo) return this.stdInfo;
    const session = this.session;
    if (!session?.token) throw new Error('請先登入');
    if (!/^\d{4}$/.test(String(session.idLast4 || ''))) {
      throw new Error('請先填寫身分證字號末四碼（報名時需要驗證）');
    }
    const info = await api.verifyIdentity(session.token, {
      p_no: session.emp_id,
      p_id: session.idLast4,
      p_type: session.emp_rl === 'Student' ? 'S' : 'T'
    });
    this.stdInfo = info;
    this.log('info', `身分驗證成功：${info.chi_name || session.emp_nm || session.emp_id}`);
    this.emit('state');
    return info;
  }

  /* ---------------------------- 排程與主迴圈 ---------------------------- */

  scheduleTick(delay) {
    if (!this.running) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.tick().catch((err) => this.handleError(err));
    }, Math.max(0, delay));
  }

  async tick() {
    if (!this.running || this._ticking) return;
    this._ticking = true;
    try {
      const rows = await this.paced(() => api.listLectures(this.session.token));
      this.stats.ticks += 1;
      this.stats.lastSyncAt = Date.now();
      this.applyRows(rows);
      this._errorStreak = 0;

      for (const target of this.activeTargets()) {
        const row = this.lectures.find((item) => item.eid01 === target.eid01);
        if (!row) continue;

        const canapp = String(row.canapp || '');
        const count = Number(row.cnt_10 || 0);

        if (count > 0) {
          this.finish(target, 'registered', '系統顯示已完成報名');
          continue;
        }
        if (canapp === 'N2') {
          this.finish(target, 'closed', '報名已截止');
          continue;
        }
        if (canapp === 'C' || canapp === 'D') {
          this.finish(target, 'manual', '此場次為現場/表單報名，需人工處理');
          continue;
        }
        if (canapp === 'Y') {
          const lastAttempt = this._attemptAt.get(target.eid01) || 0;
          if (Date.now() - lastAttempt < this.settings.retryGapMs) continue;
          await this.tryRegister(target, row);
        }
      }
    } catch (err) {
      await this.handleError(err);
    } finally {
      this._ticking = false;
      if (this.running) this.scheduleTick(this.interval());
      this.emit('state');
    }
  }

  applyRows(rows) {
    if (!Array.isArray(rows)) return;
    if (rows.length === 0 && this.lectures.length > 0) {
      this.log('warn', '校方端點回傳空講座清單，保留現存快取以維持搶課目標監控');
      return;
    }
    const now = Date.now();
    const nextCanapp = new Map();

    for (const row of rows) {
      const canapp = String(row.canapp || '');
      nextCanapp.set(row.eid01, canapp);
      const was = this._lastCanapp.get(row.eid01);
      if (was !== undefined && was !== 'Y' && canapp === 'Y') {
        const watched = this.targets.some((t) => t.eid01 === row.eid01 && !TERMINAL.has(t.status));
        if (watched) {
          this._burstUntil = now + this.settings.postOpenBurstMs;
          this.log('info', `「${row.rescnm}」變成可報名，切換高速模式`);
        }
      }
    }

    this._lastCanapp = nextCanapp;
    this.lectures = rows;

    for (const target of this.targets) {
      const row = rows.find((item) => item.eid01 === target.eid01);
      if (!row) continue;
      target.lastCanapp = String(row.canapp || '');
      target.appnum = row.appnum || target.appnum || '';
      target.maxstd = row.maxstd ?? target.maxstd;
      target.selnum = row.selnum ?? target.selnum;
      target.openAt = parseOpenAt(row.apptim) || target.openAt;
      target.chk4 = String(row.chk4 || target.chk4 || '');
      target.chk5 = String(row.chk5 || target.chk5 || '');
      target.chk6 = String(row.chk6 || target.chk6 || '');
      target.chk7 = String(row.chk7 || target.chk7 || '');
      const lits = extractLiteracies(row);
      target.literacies = lits.length ? lits : (target.literacies || []);
    }
  }

  interval() {
    let ms = this.settings.intervalMs;
    const now = Date.now();

    if (now < this._burstUntil) ms = Math.min(ms, this.settings.burstIntervalMs);

    for (const target of this.activeTargets()) {
      if (!target.openAt) continue;
      if (now >= target.openAt - this.settings.burstLeadMs && now <= target.openAt + 180_000) {
        ms = Math.min(ms, this.settings.burstIntervalMs);
      }
    }

    if (this._errorStreak > 0) ms = Math.min(30_000, ms * 2 ** Math.min(this._errorStreak, 4));
    return Math.max(250, Math.round(ms));
  }

  async paced(fn) {
    const gap = this.settings.minRequestGapMs;
    const wait = this._lastRequestAt + gap - Date.now();
    if (wait > 0) await sleep(wait);
    this._lastRequestAt = Date.now();
    this.stats.requests += 1;
    return fn();
  }

  /* ---------------------------- 報名 ---------------------------- */

  async tryRegister(target, row) {
    this._attemptAt.set(target.eid01, Date.now());

    let std;
    try {
      std = await this.ensureIdentity();
    } catch (err) {
      this.log('error', `身份驗證失敗：${err.message}`);
      target.note = err.message;
      return;
    }

    target.status = 'waiting';
    target.note = '送出報名中…';

    try {
      const stdWithBfree = { ...std, bfree: this.settings.bfree || 'N' };
      const res = await this.paced(() =>
        api.registerLecture(this.session.token, { std_info: stdWithBfree, eid01: target.eid01, reseid: row.reseid })
      );
      if (res.ok) this.finish(target, 'registered', res.message);
      else {
        target.note = res.message;
        this.log('warn', `「${target.rescnm}」報名未成功：${res.message}`);
      }
    } catch (err) {
      if (err?.status === 401) {
        await this.relogin();
      } else {
        target.note = err.message;
        this.log('warn', `「${target.rescnm}」報名失敗：${err.message}`);
      }
    }
  }

  async manualRegister(queryId) {
    if (!this.session?.token) throw new Error('請先登入');
    const id = String(queryId || '').trim();
    if (!id) throw new Error('請提供講座識別碼或課程代號');

    let row = this.lectures.find((item) => item.eid01 === id || item.reseid === id);
    if (!row) {
      this.lectures = await api.listLectures(this.session.token);
      row = this.lectures.find((item) => item.eid01 === id || item.reseid === id);
    }
    if (!row) throw new Error('找不到該講座，請確認課程代號或重新整理清單');
    if (String(row.canapp) !== 'Y') {
      throw new Error(`目前狀態為「${api.STATUS_LABEL[row.canapp] || row.canapp}」，無法報名`);
    }

    const std = await this.ensureIdentity();
    const stdWithBfree = { ...std, bfree: this.settings.bfree || 'N' };
    const res = await api.registerLecture(this.session.token, { std_info: stdWithBfree, eid01: row.eid01, reseid: row.reseid });
    if (!res.ok) throw new Error(res.message);

    let target = this.targets.find((item) => item.eid01 === row.eid01);
    if (!target) {
      target = normalizeTarget({
        ...row,
        status: 'waiting',
        addedAt: Date.now()
      });
      this.targets.push(target);
    }
    this.finish(target, 'registered', res.message);
    return res.message;
  }

  async cancelTarget(reseid) {
    if (!this.session?.token) throw new Error('請先登入');
    await api.cancelLecture(this.session.token, reseid);
    const target = this.targets.find((item) => item.reseid === reseid);
    if (target) {
      target.status = 'waiting';
      target.note = '已退選';
      target.doneAt = 0;
    }
    this.log('info', `已退選：${target?.rescnm || reseid}`);
    this.onChange();
    this.emit('state');
  }

  finish(target, status, note) {
    const changed = target.status !== status;
    target.status = status;
    target.note = note || '';
    target.doneAt = Date.now();

    if (status === 'registered') {
      this.stats.registrations += 1;
      this.log('success', `[報名成功] 搶到「${target.rescnm}」${note ? `（${note}）` : ''}`);
    } else if (status === 'closed') {
      this.log('warn', `「${target.rescnm}」已截止報名，停止追蹤`);
    } else if (status === 'manual') {
      this.log('info', `「${target.rescnm}」需人工處理：${note}`);
    } else {
      this.log('error', `「${target.rescnm}」失敗：${note}`);
    }

    if (changed) {
      this.onChange();
      this.emit('registered', { eid01: target.eid01, rescnm: target.rescnm, status, note });
    }
    if (
      status === 'registered' &&
      this.settings.stopWhenAllDone &&
      this.activeTargets().length === 0
    ) {
      this.stop('所有目標已完成');
    }
  }

  async relogin() {
    if (!this.session?.username || !this.session?.password) return false;
    if (Date.now() - this._lastRelogin < 30_000) return false;
    this._lastRelogin = Date.now();
    try {
      const user = await api.login(this.session.username, this.session.password);
      this.session.token = user.token;
      this.stdInfo = null;
      this.log('info', '登入憑證已自動更新');
      return true;
    } catch (err) {
      this.log('error', `自動重新登入失敗：${err.message}`);
      return false;
    }
  }

  async handleError(err) {
    if (!err) return;
    this.stats.lastError = err?.message || String(err);

    if (err?.status === 401) {
      const ok = await this.relogin();
      if (!ok) {
        this.stop('登入逾時，請重新登入後再啟動');
      }
      return;
    }

    this._errorStreak += 1;
    const key = `${err?.status || 0}:${err?.message || ''}`;
    if (key !== this._lastErrorKey || this._errorStreak % 5 === 0) {
      this.log(err?.transient ? 'warn' : 'error', `監控請求失敗：${err?.message || err}`);
      this._lastErrorKey = key;
    }
    this.emit('state');
  }

  /* ---------------------------- 目標管理 ---------------------------- */

  activeTargets() {
    return this.targets.filter((target) => !TERMINAL.has(target.status));
  }

  addTargets(rows, limit = 3) {
    const list = Array.isArray(rows) ? rows : [];
    const added = [];

    for (const row of list) {
      if (added.length >= limit) break;
      if (!row?.eid01) continue;
      if (this.targets.some((target) => target.eid01 === row.eid01)) continue;

      this.targets.push(
        normalizeTarget({
          eid01: row.eid01,
          reseid: row.reseid,
          rescnm: row.rescnm,
          teachm: row.teachm || '',
          locale: row.locale || '',
          resdat: row.resdat || '',
          apptim: row.apptim || '',
          appnum: row.appnum || '',
          maxstd: Number(row.maxstd || 0),
          selnum: Number(row.selnum || 0),
          lastCanapp: String(row.canapp || ''),
          cnt_10: Number(row.cnt_10 || 0),
          openAt: parseOpenAt(row.apptim),
          chk4: String(row.chk4 || ''),
          chk5: String(row.chk5 || ''),
          chk6: String(row.chk6 || ''),
          chk7: String(row.chk7 || ''),
          literacies: extractLiteracies(row),
          addedAt: Date.now()
        })
      );
      added.push(row.eid01);
    }

    if (added.length) {
      const names = added
        .map((id) => this.targets.find((target) => target.eid01 === id)?.rescnm || id)
        .join('、');
      this.log('info', `已加入目標：${names}`);
      this.onChange();
    }
    this.emit('state');
    return added;
  }

  removeTarget(eid01) {
    const before = this.targets.length;
    this.targets = this.targets.filter((target) => target.eid01 !== eid01);
    if (this.targets.length !== before) {
      this.log('info', '已移除 1 個目標');
      this.onChange();
      this.emit('state');
    }
  }

  clearFinished() {
    this.targets = this.targets.filter((target) => !TERMINAL.has(target.status));
    this.onChange();
    this.emit('state');
  }

  /* ---------------------------- 對外快照 ---------------------------- */

  targetsView() {
    return this.targets.map((target) => {
      const row = this.lectures.find((item) => item.eid01 === target.eid01) || null;
      const canapp = row ? String(row.canapp || '') : target.lastCanapp || '';
      const count = Number((row?.cnt_10 ?? target.cnt_10) || 0);

      let kind = 'unknown';
      let text = '—';

      if (target.status === 'registered' || count > 0) {
        kind = 'done';
        text = '已報名';
      } else if (target.status === 'closed' || canapp === 'N2') {
        kind = 'dead';
        text = '已截止';
      } else if (target.status === 'manual' || canapp === 'C' || canapp === 'D') {
        kind = 'manual';
        text = canapp === 'C' ? '現場報名' : '其他方式';
      } else if (canapp === 'Y') {
        kind = 'ok';
        text = '可報名';
      } else if (canapp === 'F') {
        kind = 'warn';
        text = '已額滿';
      } else if (canapp === 'N1') {
        kind = 'muted';
        text = '未開放';
      } else if (!row) {
        kind = 'unknown';
        text = '找不到（可能已下架）';
      }

      return {
        eid01: target.eid01,
        reseid: target.reseid,
        rescnm: target.rescnm,
        teachm: target.teachm || '',
        locale: target.locale || '',
        resdat: target.resdat || '',
        apptim: target.apptim || '',
        appnum: target.appnum || '',
        maxstd: target.maxstd ?? 0,
        selnum: target.selnum ?? 0,
        canapp,
        count,
        openAt: target.openAt || 0,
        status: target.status,
        kind,
        statusText: text,
        note: target.note || '',
        addedAt: target.addedAt || 0,
        doneAt: target.doneAt || 0,
        chk4: row ? String(row.chk4 || target.chk4 || '') : target.chk4,
        chk5: row ? String(row.chk5 || target.chk5 || '') : target.chk5,
        chk6: row ? String(row.chk6 || target.chk6 || '') : target.chk6,
        chk7: row ? String(row.chk7 || target.chk7 || '') : target.chk7,
        literacies: target.literacies || []
      };
    });
  }

  getState() {
    return {
      running: this.running,
      stats: { ...this.stats },
      settings: { ...this.settings },
      targets: this.targetsView(),
      lectureCount: this.lectures.length,
      logCursor: this.logSeq
    };
  }

  sessionView() {
    const session = this.session;
    if (!session?.token) return { loggedIn: false };
    return {
      loggedIn: true,
      emp_id: session.emp_id,
      emp_nm: session.emp_nm,
      emp_rl: session.emp_rl,
      idLast4Set: /^\d{4}$/.test(String(session.idLast4 || '')),
      identityVerified: Boolean(this.stdInfo)
    };
  }

  logsSince(sinceId = 0) {
    return this.logs.filter((entry) => entry.id > sinceId);
  }

  log(level, message) {
    const entry = { id: ++this.logSeq, ts: Date.now(), level, message: String(message) };
    this.logs.push(entry);
    if (this.logs.length > 400) this.logs.splice(0, this.logs.length - 400);
    this.emit('log', entry);
  }
}

/* ---------------------------- 工具函式 ---------------------------- */

function normalizeSettings(settings) {
  const merged = {
    intervalMs: 2500,
    burstIntervalMs: 800,
    burstLeadMs: 120_000,
    postOpenBurstMs: 20_000,
    retryGapMs: 5000,
    minRequestGapMs: 600,
    stopWhenAllDone: false,
    bfree: 'N',
    ...(settings || {})
  };
  merged.bfree = String(merged.bfree || 'N').toUpperCase() === 'Y' ? 'Y' : 'N';
  merged.intervalMs = clamp(merged.intervalMs, 1000, 30_000, 2500);
  merged.burstIntervalMs = clamp(merged.burstIntervalMs, 300, 10_000, 800);
  merged.minRequestGapMs = clamp(merged.minRequestGapMs, 300, 5000, 600);
  merged.retryGapMs = clamp(merged.retryGapMs, 1000, 60_000, 5000);
  merged.postOpenBurstMs = clamp(merged.postOpenBurstMs, 2000, 120_000, 20_000);
  merged.burstLeadMs = clamp(merged.burstLeadMs, 0, 900_000, 120_000);
  merged.stopWhenAllDone = Boolean(merged.stopWhenAllDone);
  return merged;
}

function normalizeTarget(target) {
  const chk4 = String(target?.chk4 || '');
  const chk5 = String(target?.chk5 || '');
  const chk6 = String(target?.chk6 || '');
  const chk7 = String(target?.chk7 || '');
  let literacies = Array.isArray(target?.literacies) && target.literacies.length
    ? target.literacies
    : extractLiteracies(target);

  return {
    eid01: String(target?.eid01 || ''),
    reseid: String(target?.reseid || ''),
    rescnm: String(target?.rescnm || ''),
    teachm: String(target?.teachm || ''),
    locale: String(target?.locale || ''),
    resdat: String(target?.resdat || ''),
    apptim: String(target?.apptim || ''),
    appnum: String(target?.appnum || ''),
    maxstd: Number(target?.maxstd || 0),
    selnum: Number(target?.selnum || 0),
    lastCanapp: String(target?.lastCanapp || ''),
    cnt_10: Number(target?.cnt_10 || 0),
    openAt: Number(target?.openAt || 0),
    chk4,
    chk5,
    chk6,
    chk7,
    literacies,
    status: TERMINAL.has(target?.status) ? target.status : 'waiting',
    note: String(target?.note || ''),
    addedAt: Number(target?.addedAt || 0),
    doneAt: Number(target?.doneAt || 0)
  };
}

/** apptim 例："2026/10/13-2026/10/19" -> 當天 00:00 的時間戳。 */
export function parseOpenAt(apptim) {
  const match = /^(\d{4})\/(\d{1,2})\/(\d{1,2})/.exec(String(apptim || ''));
  if (!match) return 0;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]), 0, 0, 0);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function clamp(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
