/**
 * 本機 HTTP 服務：提供靜態 UI 與 JSON API。
 *
 *   GET  /                      前端頁面
 *   GET  /api/state             目前狀態快照（給 UI 輪詢）
 *   POST /api/login             登入（可選擇記住帳密）
 *   POST /api/logout            登出
 *   POST /api/identity          只做身份驗證
 *   GET  /api/lectures          講座清單
 *   GET  /api/registered        已報名清單
 *   POST /api/targets           加入目標
 *   POST /api/targets/remove    移除目標
 *   POST /api/targets/clear     清除已完成目標
 *   POST /api/engine/start      開始搶課
 *   POST /api/engine/stop       停止搶課
 *   POST /api/config            儲存設定
 *   POST /api/ai/plan           AI / 規則挑課
 *   POST /api/register          手動報名
 *   POST /api/cancel            退選
 *   GET  /api/logs?since=N      增量日誌
 *   POST /api/logs/clear        清空日誌
 */

import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import * as api from './asia.mjs';
import * as ai from './ai.mjs';
import { Engine } from './engine.mjs';
import { Scheduler } from './schedule.mjs';
import { buildCalendar } from './calendar.mjs';
import { PUBLIC_DIR, loadConfig, loadState, saveConfig, saveState } from './storage.mjs';

const PORT = Number(process.env.PORT || 5199);
const HOST = process.env.HOST || '0.0.0.0';

let config = await loadConfig();
const savedState = await loadState();

const engine = new Engine({ settings: config.engine, targets: savedState.targets });

let saveTimer = null;
engine.onChange = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveState({ targets: engine.targets }).catch((err) => console.error('[state] 保存失敗：', err.message));
  }, 800);
};

const scheduler = new Scheduler({
  enabled: config.schedule?.enabled !== false,
  entries: config.schedule?.entries || [],
  engine,
  log: (level, message) => engine.log(level, message),
  onSave: (schedule) => {
    saveConfig({ schedule })
      .then((next) => {
        config = next;
      })
      .catch((err) => console.error('[schedule] 儲存失敗：', err.message));
  }
});

setInterval(() => {
  scheduler.tick().catch((err) => console.error('[schedule] tick 失敗：', err.message));
}, 10_000).unref();

/* ------------------------------ helpers ------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon'
};

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function ok(res, data) {
  return sendJson(res, 200, data);
}

function fail(res, message, status = 400) {
  return sendJson(res, status, { error: String(message || '未知錯誤') });
}

async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) throw new Error('請求內容過大');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  const text = Buffer.concat(chunks).toString('utf8').trim();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('請求格式錯誤（需為 JSON）');
  }
}

function errorStatus(err) {
  if (err instanceof api.ApiError) {
    if (err.status >= 400 && err.status < 600) return err.status;
    return 502;
  }
  return 400;
}

function publicConfig() {
  const aiConfig = config.ai || {};
  const key = String(aiConfig.apiKey || '');
  return {
    engine: { ...config.engine },
    notify: { ...config.notify },
    ai: {
      ...aiConfig,
      apiKey: key ? '••••' + key.slice(-4) : ''
    },
    account: {
      username: String(config.account?.username || ''),
      idLast4: String(config.account?.idLast4 || ''),
      saved: Boolean(config.account?.password)
    },
    graduation: {
      history: {
        health: Math.max(0, Number(config.graduation?.history?.health || 0)),
        care: Math.max(0, Number(config.graduation?.history?.care || 0)),
        innovation: Math.max(0, Number(config.graduation?.history?.innovation || 0)),
        excellence: Math.max(0, Number(config.graduation?.history?.excellence || 0))
      }
    }
  };
}

function snapshot() {
  return {
    now: Date.now(),
    baseUrl: api.BASE_URL,
    session: engine.sessionView(),
    engine: engine.getState(),
    notify: { ...config.notify },
    account: {
      username: String(config.account?.username || ''),
      idLast4: String(config.account?.idLast4 || ''),
      saved: Boolean(config.account?.password)
    },
    graduation: {
      threshold: {
        total: 8,
        health: 2,
        care: 2,
        innovation: 2,
        excellence: 2
      },
      history: {
        health: Math.max(0, Number(config.graduation?.history?.health || 0)),
        care: Math.max(0, Number(config.graduation?.history?.care || 0)),
        innovation: Math.max(0, Number(config.graduation?.history?.innovation || 0)),
        excellence: Math.max(0, Number(config.graduation?.history?.excellence || 0))
      }
    },
    ai: ai.aiSummary(config.ai),
    schedule: scheduler.view(),
    calendar: api_calendarRows()
  };
}

/** 已報名講座的原始資料列：清單中 cnt_10>0 者 ＋ 已報名目標。 */
function api_calendarRows() {
  const rows = [];
  for (const row of engine.lectures) {
    if (Number(row.cnt_10 || 0) > 0) rows.push(row);
  }
  for (const target of engine.targets) {
    if (target.status === 'registered') rows.push(target);
  }
  return buildCalendar(rows);
}

async function ensureLectures() {
  if (!engine.lectures.length) {
    engine.lectures = await api.listLectures(engine.session?.token || null);
    engine.stats.lastSyncAt = Date.now();
  }
  return engine.lectures;
}

/* ------------------------------ routes ------------------------------ */

async function handleApi(req, res, url) {
  const method = req.method;
  const pathname = url.pathname;
  const route = `${method} ${pathname}`;

  try {
    switch (route) {
      case 'GET /api/state':
        return ok(res, snapshot());

      case 'POST /api/login': {
        const body = await readJson(req);
        const username = String(body.username || '').trim();
        const password = String(body.password || '');
        const idLast4 = String(body.idLast4 || '').trim();

        if (!username || !password) return fail(res, '請輸入學號與密碼');
        if (idLast4 && !/^\d{4}$/.test(idLast4)) return fail(res, '身分證字號末四碼需為 4 位數字');

        const user = await api.login(username, password);
        engine.setSession({
          token: user.token,
          emp_id: String(user.emp_id || username),
          emp_nm: String(user.emp_nm || ''),
          emp_rl: String(user.emp_rl || ''),
          idLast4,
          username,
          password
        });

        if (body.remember) {
          config = await saveConfig({ account: { username, password, idLast4 } });
        }

        let identity = null;
        if (idLast4) {
          try {
            const info = await engine.ensureIdentity();
            identity = {
              name: info.chi_name || '',
              dept: info.dept_name_s || info.dept_dept || '',
              email: info.email || ''
            };
          } catch (err) {
            engine.log('warn', `身份驗證失敗：${err.message}`);
          }
        }

        return ok(res, { session: engine.sessionView(), identity });
      }

      case 'POST /api/logout': {
        engine.stop('使用者登出');
        engine.setSession(null);
        return ok(res, { ok: true });
      }

      case 'POST /api/identity': {
        const body = await readJson(req);
        const idLast4 = String(body.idLast4 || '').trim();
        if (!/^\d{4}$/.test(idLast4)) return fail(res, '請輸入 4 位數字');
        if (!engine.session) return fail(res, '請先登入', 401);
        engine.session.idLast4 = idLast4;
        engine.stdInfo = null;
        const info = await engine.ensureIdentity();
        return ok(res, {
          identity: { name: info.chi_name || '', dept: info.dept_name_s || '', email: info.email || '' }
        });
      }

      case 'GET /api/lectures': {
        try {
          const rows = await api.listLectures(engine.session?.token || null);
          engine.applyRows(rows);
          engine.stats.lastSyncAt = Date.now();
          engine.emit('state');
          return ok(res, { lectures: rows, fetchedAt: Date.now() });
        } catch (err) {
          if (engine.lectures.length) {
            return ok(res, {
              lectures: engine.lectures,
              fetchedAt: engine.stats.lastSyncAt,
              warning: err.message
            });
          }
          throw err;
        }
      }

      case 'GET /api/registered': {
        if (!engine.session) return fail(res, '請先登入', 401);
        const rows = await api.listRegistered(engine.session.token);
        return ok(res, { rows });
      }

      case 'POST /api/targets': {
        const body = await readJson(req);
        const ids = Array.isArray(body.eid01s)
          ? body.eid01s.map(String)
          : body.eid01
            ? [String(body.eid01)]
            : [];
        if (!ids.length) return fail(res, '請提供要加入的講座');

        const lectures = await ensureLectures();
        const rows = lectures.filter((row) => ids.includes(String(row.eid01)));
        const missing = ids.filter((id) => !rows.some((row) => String(row.eid01) === id));
        const added = engine.addTargets(rows, Math.max(1, ids.length));
        return ok(res, { added, missing });
      }

      case 'POST /api/targets/remove': {
        const body = await readJson(req);
        engine.removeTarget(String(body.eid01 || ''));
        return ok(res, { ok: true });
      }

      case 'POST /api/targets/clear': {
        engine.clearFinished();
        return ok(res, { ok: true });
      }

      case 'POST /api/engine/start': {
        if (!engine.session) return fail(res, '請先登入', 401);
        await engine.start();
        return ok(res, { ok: true });
      }

      case 'POST /api/engine/stop': {
        engine.stop('使用者停止');
        return ok(res, { ok: true });
      }

      case 'POST /api/config': {
        const body = await readJson(req);
        const patch = {};

        if (body.engine && typeof body.engine === 'object') {
          patch.engine = {};
          for (const key of [
            'intervalMs',
            'burstIntervalMs',
            'burstLeadMs',
            'postOpenBurstMs',
            'retryGapMs',
            'minRequestGapMs'
          ]) {
            if (body.engine[key] !== undefined) patch.engine[key] = Number(body.engine[key]);
          }
          if (body.engine.stopWhenAllDone !== undefined) {
            patch.engine.stopWhenAllDone = Boolean(body.engine.stopWhenAllDone);
          }
          if (body.engine.bfree !== undefined) {
            patch.engine.bfree = String(body.engine.bfree || 'N').toUpperCase() === 'Y' ? 'Y' : 'N';
          }
        }

        if (body.notify && typeof body.notify === 'object') {
          patch.notify = {};
          if (body.notify.sound !== undefined) patch.notify.sound = Boolean(body.notify.sound);
          if (body.notify.desktop !== undefined) patch.notify.desktop = Boolean(body.notify.desktop);
        }

        if (body.ai && typeof body.ai === 'object') {
          patch.ai = {};
          if (body.ai.enabled !== undefined) patch.ai.enabled = Boolean(body.ai.enabled);
          if (typeof body.ai.baseUrl === 'string') patch.ai.baseUrl = body.ai.baseUrl.trim();
          if (typeof body.ai.model === 'string') patch.ai.model = body.ai.model.trim();
          if (typeof body.ai.apiKey === 'string') {
            const key = body.ai.apiKey.trim();
            if (key && !key.startsWith('•••')) patch.ai.apiKey = key;
          }
          if (body.ai.maxTargets !== undefined) patch.ai.maxTargets = Number(body.ai.maxTargets);
        }

        if (body.graduation && typeof body.graduation === 'object') {
          patch.graduation = {
            history: {
              health: Math.max(0, Number(body.graduation.history?.health || 0)),
              care: Math.max(0, Number(body.graduation.history?.care || 0)),
              innovation: Math.max(0, Number(body.graduation.history?.innovation || 0)),
              excellence: Math.max(0, Number(body.graduation.history?.excellence || 0))
            }
          };
        }

        if (!Object.keys(patch).length) return fail(res, '沒有可更新的設定');
        config = await saveConfig(patch);
        engine.settings = { ...engine.settings, ...config.engine };
        return ok(res, { config: publicConfig(), engine: engine.settings });
      }

      case 'POST /api/ai/plan': {
        const body = await readJson(req);
        const text = String(body.text || '').trim();
        if (!text) return fail(res, '請先描述想搶的講座');

        const lectures = await ensureLectures();
        const plan = await ai.planTargets(config.ai, lectures, text);

        let added = [];
        if (plan.picks.length) {
          const ids = plan.picks.map((pick) => pick.eid01);
          const rows = lectures.filter((row) => ids.includes(String(row.eid01)));
          added = engine.addTargets(rows, Math.min(config.ai.maxTargets || 3, 10));
        }
        return ok(res, { ...plan, added });
      }

      case 'GET /api/calendar': {
        const rows = [];
        for (const row of engine.lectures) {
          if (Number(row.cnt_10 || 0) > 0) rows.push(row);
        }
        if (engine.session?.token) {
          try {
            rows.push(...(await api.listRegistered(engine.session.token)));
          } catch {
            /* 盡力而為，失敗就沿用清單推斷 */
          }
        }
        for (const target of engine.targets) {
          if (target.status === 'registered') rows.push(target);
        }
        return ok(res, { events: buildCalendar(rows), fetchedAt: Date.now() });
      }

      case 'POST /api/schedule': {
        const body = await readJson(req);
        if (body.enabled !== undefined) scheduler.setEnabled(body.enabled);
        if (Array.isArray(body.entries)) scheduler.replace(body.entries);
        if (body.entry && typeof body.entry === 'object') scheduler.add(body.entry);
        if (body.remove) scheduler.remove(String(body.remove));
        config = await saveConfig({ schedule: scheduler.toConfig() });
        return ok(res, { schedule: scheduler.view() });
      }

      case 'POST /api/ai/agent': {
        const body = await readJson(req);
        const text = String(body.text || '').trim();
        if (!text) return fail(res, '請先描述想搶的講座與時間');
        const lectures = await ensureLectures();
        const plan = await ai.planAgent(config.ai, lectures, text);
        return ok(res, plan);
      }

      case 'POST /api/ai/agent/apply': {
        const body = await readJson(req);
        const lectures = await ensureLectures();
        const picks = Array.isArray(body.picks) ? body.picks : [];
        const ids = picks.map((pick) => String(pick?.eid01 ?? pick ?? '')).filter(Boolean);
        const rows = lectures.filter((row) => ids.includes(String(row.eid01)));
        const added = engine.addTargets(rows, Math.min(Math.max(ids.length, 1), 10));

        let scheduleEntry = null;
        if (body.schedule && typeof body.schedule === 'object') {
          const clean = ai.sanitizeSchedule(body.schedule);
          if (clean) {
            scheduleEntry = scheduler.add(clean);
            config = await saveConfig({ schedule: scheduler.toConfig() });
          }
        }
        return ok(res, { added, schedule: scheduleEntry, scheduleView: scheduler.view() });
      }

      case 'POST /api/register': {
        const body = await readJson(req);
        if (!engine.session) return fail(res, '請先登入', 401);
        const message = await engine.manualRegister(String(body.eid01 || ''));
        return ok(res, { message });
      }

      case 'POST /api/cancel': {
        const body = await readJson(req);
        if (!engine.session) return fail(res, '請先登入', 401);
        const id = String(body.eid || body.reseid || body.eid01 || '');
        if (!id) return fail(res, '請提供要退選的講座代號或編號');
        const title = await engine.cancelTarget(id, {
          eid: body.eid ? String(body.eid) : '',
          reseid: body.reseid ? String(body.reseid) : '',
          eid01: body.eid01 ? String(body.eid01) : ''
        });
        return ok(res, { ok: true, message: `已成功取消報名：${title}` });
      }

      case 'GET /api/logs': {
        const since = Number(url.searchParams.get('since') || 0);
        return ok(res, { logs: engine.logsSince(since), cursor: engine.logSeq });
      }

      case 'POST /api/logs/clear': {
        engine.logs = [];
        return ok(res, { ok: true });
      }

      default:
        return fail(res, 'Not Found', 404);
    }
  } catch (err) {
    const status = errorStatus(err);
    if (status >= 500) console.error(`[api] ${route} ->`, err?.message || err);
    return fail(res, err?.message || '伺服器錯誤', status);
  }
}

async function serveStatic(res, pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Bad Request');
    return;
  }
  const rel = pathname === '/' ? 'index.html' : decoded.replace(/^\/+/, '');
  const root = path.resolve(PUBLIC_DIR);
  const file = path.resolve(root, rel);
  if (!file.startsWith(root + path.sep) && file !== root) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }
  try {
    const data = await readFile(file);
    res.writeHead(200, {
      'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    });
    res.end(data);
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  }
}

/* ------------------------------ server ------------------------------ */

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  if (url.pathname.startsWith('/api/')) {
    handleApi(req, res, url).catch((err) => fail(res, err?.message || '伺服器錯誤', 500));
    return;
  }
  serveStatic(res, url.pathname).catch(() => {
    res.writeHead(500);
    res.end('Server error');
  });
});

server.listen(PORT, HOST, () => {
  console.log('');
  console.log('  講座自動報名助手 MVP');
  console.log(`  本機介面：http://${HOST}:${PORT}`);
  console.log(`  目標系統：${api.BASE_URL}`);
  console.log(`  已載入 ${engine.targets.length} 個目標講座`);
  console.log('');
});

async function shutdown() {
  engine.stop('伺服器關閉');
  try {
    await saveState({ targets: engine.targets });
  } catch (err) {
    console.error('[state] 保存失敗：', err.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 1500).unref();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
