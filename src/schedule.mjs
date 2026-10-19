/**
 * 排程器：依使用者的排程自動啟動／停止搶課引擎。
 *
 * 三種模式：
 *   open   依目標講座的「報名開放時間」自動提前 leadSec 秒啟動（搶開放瞬間）
 *   at     單次指定日期時間啟動，可選自動停止時間
 *   window 每週固定星期 ＋ 時段，進入時段自動啟動、離開時段自動停止
 *
 * 設計原則：
 *   - 只在「已登入」且「有進行中的目標」時才自動啟動，避免空轉與無聲失敗。
 *   - 以邊緣觸發（進入 → 動作、離開 → 動作）判斷，不會每個 tick 重複啟動。
 *   - 所有自動動作都寫入引擎日誌，透明可追蹤。
 */

const DAY_LABELS = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const GRACE_MS = 10 * 60 * 1000;       // 錯過起點後的寬限
const OPEN_TAIL_MS = 3 * 60 * 1000;    // 開放後仍在範圍內可啟動
const WARN_COOLDOWN_MS = 60 * 1000;
const MODES = new Set(['open', 'at', 'window']);

export function makeId() {
  return 's_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value || ''));
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}

function normalizeTime(value, fallback) {
  const minutes = toMinutes(value);
  if (minutes === null) return fallback;
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

export function normalizeEntry(raw = {}) {
  const mode = MODES.has(raw.mode) ? raw.mode : 'at';
  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [1, 2, 3, 4, 5];
  return {
    id: String(raw.id || '') || makeId(),
    enabled: raw.enabled !== false,
    mode,
    label: String(raw.label || '').slice(0, 48),
    startAt: Math.max(0, Number(raw.startAt || 0)),
    stopAt: Math.max(0, Number(raw.stopAt || 0)),
    days: mode === 'window' ? (days.length ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5]) : days,
    startTime: normalizeTime(raw.startTime, '09:00'),
    stopTime: normalizeTime(raw.stopTime, '18:00'),
    leadSec: clampInt(raw.leadSec ?? 15, 0, 600, 15),
    lastStartAt: Math.max(0, Number(raw.lastStartAt || 0))
  };
}

export function describeEntry(entry) {
  const prefix = entry.label ? `${entry.label}｜` : '';
  if (entry.mode === 'open') return `${prefix}開放前 ${entry.leadSec} 秒自動啟動`;
  if (entry.mode === 'at') return `${prefix}${formatStamp(entry.startAt)} 自動啟動`;
  const days = entry.days.length === 7 ? '每天' : entry.days.map((d) => DAY_LABELS[d]).join('、');
  return `${prefix}${days} ${entry.startTime}–${entry.stopTime}`;
}

function formatStamp(ts) {
  if (!ts) return '（未設定）';
  const date = new Date(ts);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export class Scheduler {
  constructor({ entries = [], enabled = true, engine, onSave = () => {}, log = () => {} } = {}) {
    this.engine = engine;
    this.enabled = enabled !== false;
    this.entries = (Array.isArray(entries) ? entries : []).map(normalizeEntry);
    this.onSave = onSave;
    this.log = log;
    this.driverId = '';
    this._runtime = new Map();
    this._busy = false;
    this._warnAt = new Map();
  }

  /* ------------------------------ 對外 ------------------------------ */

  view() {
    return {
      enabled: this.enabled,
      entries: this.entries.map((entry) => ({ ...entry })),
      driverId: this.driverId,
      nextStartAt: this.nextStartAt(),
      nextStartLabel: this.nextStartLabel()
    };
  }

  toConfig() {
    return { enabled: this.enabled, entries: this.entries.map((entry) => ({ ...entry })) };
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    if (!this.enabled) this.releaseDriver();
  }

  replace(entries) {
    this.entries = (Array.isArray(entries) ? entries : []).map(normalizeEntry);
    this._runtime.clear();
    if (!this.entries.some((entry) => entry.id === this.driverId)) this.driverId = '';
  }

  add(rawEntry) {
    const entry = normalizeEntry({ ...rawEntry, id: '' });
    this.entries.push(entry);
    return entry;
  }

  ensureOpenSchedule() {
    let openEntry = this.entries.find((entry) => entry.mode === 'open');
    if (!openEntry) {
      openEntry = this.add({
        mode: 'open',
        leadSec: 15,
        label: '目標開放瞬間自動搶課',
        enabled: true
      });
      this.log('info', '已自動為搶課目標建立「開放瞬間」自動排程（開放前 15 秒啟動）');
    } else if (!openEntry.enabled) {
      openEntry.enabled = true;
      this.log('info', '已重新啟用「開放瞬間」自動搶課排程');
    }
    // 尊重使用者全域排程開關設定，不強行將已手動停用的排程覆寫為啟用
    this.persist();
    return openEntry;
  }

  remove(id) {
    this.entries = this.entries.filter((entry) => entry.id !== id);
    this._runtime.delete(id);
    if (this.driverId === id) this.driverId = '';
  }

  /* ------------------------------ 主迴圈 ------------------------------ */

  async tick(now = Date.now()) {
    if (this._busy) return;
    this._busy = true;
    try {
      if (!this.enabled) return;

      if (this.engine.running) {
        const driver = this.entries.find((entry) => entry.id === this.driverId);
        if (driver && this.shouldStop(driver, now)) this.stopRun(driver);
        return;
      }

      // 引擎停止後解除駕駛權
      this.driverId = '';

      if (!this.entries.length) return;
      const next = this.entries.find((entry) => entry.enabled && this.shouldStart(entry, now));
      if (next) await this.startRun(next, now);
    } catch (err) {
      this.log('error', `排程處理失敗：${err?.message || err}`);
    } finally {
      this._busy = false;
    }
  }

  shouldStart(entry, now) {
    const rt = this.runtime(entry);
    if (entry.mode === 'open') {
      const openAt = this.earliestOpenAt(now);
      if (!openAt) return false;
      const triggerAt = openAt - entry.leadSec * 1000;
      if (rt.openFiredFor === openAt) return false;
      if (now >= triggerAt && now <= openAt + OPEN_TAIL_MS) {
        rt.openFiredFor = openAt;
        return true;
      }
      return false;
    }

    if (entry.mode === 'at') {
      if (rt.atFired || !entry.startAt) return false;
      if (now < entry.startAt) return false;
      rt.atFired = true;
      if (now - entry.startAt > GRACE_MS) {
        this.log('warn', `排程「${describeEntry(entry)}」已錯過（超過 10 分鐘），略過`);
        return false;
      }
      return true;
    }

    // window：邊緣觸發
    const inside = this.inWindow(entry, now);
    const wasInside = Boolean(rt.inside);
    rt.inside = inside;
    return inside && !wasInside;
  }

  shouldStop(entry, now) {
    if (entry.mode === 'window') return !this.inWindow(entry, now);
    if (entry.mode === 'at') return Boolean(entry.stopAt) && now >= entry.stopAt;
    return false;
  }

  inWindow(entry, now) {
    if (!entry.days.length) return false;
    const date = new Date(now);
    if (!entry.days.includes(date.getDay())) return false;
    const start = toMinutes(entry.startTime);
    const stop = toMinutes(entry.stopTime);
    if (start === null || stop === null) return false;
    const minutes = date.getHours() * 60 + date.getMinutes();
    if (stop <= start) return minutes >= start || minutes < stop; // 跨午夜
    return minutes >= start && minutes < stop;
  }

  earliestOpenAt(now = Date.now()) {
    let min = 0;
    for (const target of this.engine.activeTargets()) {
      if (!target.openAt) continue;
      // 忽略已開放超過寬限期的過去時間，鎖定尚未開放或即將開放的目標
      if (target.openAt + OPEN_TAIL_MS < now) continue;
      if (!min || target.openAt < min) min = target.openAt;
    }
    return min;
  }

  async startRun(entry, now) {
    const session = this.engine.session;
    if (!session?.token) {
      this.warnOnce(entry, now, '排程時間到，但尚未登入，略過自動啟動');
      return;
    }
    if (!this.engine.activeTargets().length) {
      this.warnOnce(entry, now, '排程時間到，但沒有進行中的目標，略過自動啟動');
      return;
    }
    try {
      await this.engine.start();
      entry.lastStartAt = now;
      this.driverId = entry.id;
      this.log('success', `排程啟動：${describeEntry(entry)}`);
      this.persist();
    } catch (err) {
      this.log('error', `排程啟動失敗：${err?.message || err}`);
    }
  }

  stopRun(entry) {
    this.engine.stop(`排程結束：${describeEntry(entry)}`);
    this.releaseDriver();
  }

  releaseDriver() {
    this.driverId = '';
  }

  warnOnce(entry, now, message) {
    const last = this._warnAt.get(entry.id) || 0;
    if (now - last < WARN_COOLDOWN_MS) return;
    this._warnAt.set(entry.id, now);
    this.log('warn', message);
  }

  runtime(entry) {
    let rt = this._runtime.get(entry.id);
    if (!rt) {
      rt = {};
      this._runtime.set(entry.id, rt);
    }
    return rt;
  }

  persist() {
    try {
      this.onSave(this.toConfig());
    } catch (err) {
      this.log('error', `排程儲存失敗：${err?.message || err}`);
    }
  }

  /* ------------------------------ 下次啟動 ------------------------------ */

  nextStartAt(now = Date.now()) {
    let best = 0;
    for (const entry of this.entries) {
      if (!entry.enabled) continue;
      let candidate = 0;

      if (entry.mode === 'open') {
        const openAt = this.earliestOpenAt(now);
        if (openAt) candidate = openAt - entry.leadSec * 1000;
      } else if (entry.mode === 'at') {
        if (entry.startAt > now) candidate = entry.startAt;
      } else {
        candidate = this.nextWindowStart(entry, now);
      }

      if (candidate > now && (!best || candidate < best)) best = candidate;
    }
    return best;
  }

  nextStartLabel(now = Date.now()) {
    const at = this.nextStartAt(now);
    if (!at) return '無排程';
    const diff = at - now;
    const days = Math.floor(diff / 86_400_000);
    const hours = Math.floor((diff % 86_400_000) / 3_600_000);
    const minutes = Math.floor((diff % 3_600_000) / 60_000);
    const when = days ? `${days} 天 ${hours} 小時` : hours ? `${hours} 小時 ${minutes} 分` : `${Math.max(1, minutes)} 分`;
    const date = new Date(at);
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}（${DAY_LABELS[date.getDay()]}）・還有 ${when}`;
  }

  nextWindowStart(entry, now) {
    const start = toMinutes(entry.startTime);
    if (start === null) return 0;
    for (let offset = 0; offset < 14; offset += 1) {
      const day = new Date(now);
      day.setDate(day.getDate() + offset);
      day.setHours(0, 0, 0, 0);
      if (!entry.days.includes(day.getDay())) continue;
      const candidate = day.getTime() + start * 60_000;
      if (candidate > now) return candidate;
    }
    return 0;
  }
}

export { DAY_LABELS };
