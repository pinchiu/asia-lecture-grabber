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
 *   GET  /api/calendar          行事曆 JSON
 *   GET  /api/calendar.ics      行事曆 iCal (.ics) 訂閱與匯出
 *   POST /api/schedule          排程管理
 *   GET  /api/logs?since=N      增量日誌
 *   POST /api/logs/clear        清空日誌
 */

import http from 'node:http';
import net from 'node:net';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as defaultApi from './asia.mjs';
import * as ai from './ai.mjs';
import { Scheduler } from './schedule.mjs';
import { buildCalendar, generateIcs } from './calendar.mjs';
import { GRADUATION_THRESHOLDS } from './contract.mjs';
import { createMcpContext, handleJsonRpcMessage } from './mcp.mjs';
import { autoLoginEngine, bindStatePersistence, createRuntime } from './runtime.mjs';
import { PUBLIC_DIR, defaultStorage } from './storage.mjs';

export const PORT = Number(process.env.PORT || 5199);
// 預設只綁定 loopback；需要手機或區網連線時，使用者必須明確設定 HOST=0.0.0.0。
export const HOST = process.env.HOST || '127.0.0.1';

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

async function readJson(req, { requireJson = true } = {}) {
  const hasBody =
    Number(req.headers['content-length'] || 0) > 0 || Boolean(req.headers['transfer-encoding']);
  if (requireJson && hasBody) {
    const contentType = String(req.headers['content-type'] || '').toLowerCase();
    if (!contentType.startsWith('application/json')) {
      const err = new Error('Content-Type 必須為 application/json');
      err.status = 415;
      throw err;
    }
  }

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
    const err = new Error('請求格式錯誤（需為 JSON）');
    err.jsonRpcParseError = true;
    throw err;
  }
}

function resolveErrorStatus(err, apiAdapter) {
  if (err?.status && typeof err.status === 'number' && err.status >= 400 && err.status < 600) {
    return err.status;
  }
  if (err instanceof apiAdapter.ApiError || err?.name === 'ApiError') {
    return 502;
  }
  return 400;
}

function isLoopbackHostname(hostname) {
  return hostname === '127.0.0.1' || hostname === 'localhost' || hostname === '[::1]' || hostname === '::1';
}

/**
 * 所有變更狀態的 API 只允許：
 * 1. 無 Origin 的非瀏覽器客戶端（curl、AI Agent）。
 * 2. loopback 來源（本機網頁）。
 * 3. 同源且 Host 為 IP 的區網來源（HOST=0.0.0.0 時的手機 PWA）。
 *
 * 瀏覽器跨站請求必定帶 Origin；以 IP 判斷可避免 DNS rebinding
 * 將攻擊者網域解析到 127.0.0.1 後冒充同源。
 */
function assertAllowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return;

  let url;
  try {
    url = new URL(origin);
  } catch {
    const err = new Error('Origin 格式不正確');
    err.status = 403;
    throw err;
  }

  const host = String(req.headers.host || '');
  const sameLanOrigin = url.host === host && net.isIP(url.hostname) !== 0;
  if (isLoopbackHostname(url.hostname) || sameLanOrigin) return;

  const err = new Error('僅允許本機或同源區網請求呼叫 API');
  err.status = 403;
  throw err;
}

/**
 * 建立 HTTP 服務應用程式。
 */
export function createApp({
  engine,
  scheduler,
  storage = defaultStorage,
  config: initialConfig,
  api: apiAdapter = defaultApi,
  publicDir = PUBLIC_DIR
} = {}) {
  let currentConfig = initialConfig;

  function publicConfig() {
    const aiConfig = currentConfig.ai || {};
    const key = String(aiConfig.apiKey || '');
    return {
      engine: { ...currentConfig.engine },
      notify: { ...currentConfig.notify },
      ai: {
        ...aiConfig,
        apiKey: key ? '••••' + key.slice(-4) : ''
      },
      account: {
        username: String(currentConfig.account?.username || ''),
        idLast4: String(currentConfig.account?.idLast4 || ''),
        saved: Boolean(currentConfig.account?.password)
      },
      graduation: {
        history: {
          health: Math.max(0, Number(currentConfig.graduation?.history?.health || 0)),
          care: Math.max(0, Number(currentConfig.graduation?.history?.care || 0)),
          innovation: Math.max(0, Number(currentConfig.graduation?.history?.innovation || 0)),
          excellence: Math.max(0, Number(currentConfig.graduation?.history?.excellence || 0)),
          total: Math.max(0, Number(currentConfig.graduation?.history?.total || 0))
        }
      }
    };
  }

  function api_calendarRows(extraRegistered = []) {
    const rows = [];
    for (const row of engine.lectures) {
      if (Number(row.cnt_10 || 0) > 0) rows.push(row);
    }
    for (const target of engine.targets) {
      if (target.status === 'registered') rows.push(target);
    }
    if (Array.isArray(extraRegistered) && extraRegistered.length) {
      rows.push(...extraRegistered);
    }
    return buildCalendar(rows);
  }

  function snapshot() {
    return {
      now: Date.now(),
      baseUrl: apiAdapter.BASE_URL,
      session: engine.sessionView(),
      engine: engine.getState(),
      notify: { ...currentConfig.notify },
      account: {
        username: String(currentConfig.account?.username || ''),
        idLast4: String(currentConfig.account?.idLast4 || ''),
        saved: Boolean(currentConfig.account?.password)
      },
      graduation: {
        threshold: { ...GRADUATION_THRESHOLDS },
        history: {
          health: Math.max(0, Number(currentConfig.graduation?.history?.health || 0)),
          care: Math.max(0, Number(currentConfig.graduation?.history?.care || 0)),
          innovation: Math.max(0, Number(currentConfig.graduation?.history?.innovation || 0)),
          excellence: Math.max(0, Number(currentConfig.graduation?.history?.excellence || 0)),
          total: Math.max(0, Number(currentConfig.graduation?.history?.total || 0))
        }
      },
      ai: ai.aiSummary(currentConfig.ai),
      schedule: scheduler.view(),
      calendar: api_calendarRows()
    };
  }

  async function ensureLectures() {
    if (!engine.lectures.length) {
      engine.lectures = await apiAdapter.listLectures(engine.session?.token || null);
      engine.stats.lastSyncAt = Date.now();
    }
    return engine.lectures;
  }

  async function handleApi(req, res, url) {
    const method = req.method;
    const pathname = url.pathname;
    const route = `${method} ${pathname}`;

    try {
      // 所有變更狀態的 API 一律檢查 Origin，避免跨站簡單請求代為操作。
      if (method === 'POST') assertAllowedOrigin(req);

      switch (route) {
        case 'GET /api/state':
          return ok(res, snapshot());

        case 'POST /api/login': {
          const body = await readJson(req);
          const username = String(body.username || '').trim();
          let password = String(body.password || '');
          const idLast4 = String(body.idLast4 || '').trim();

          if (!password && currentConfig.account?.password && currentConfig.account?.username === username) {
            password = currentConfig.account.password;
          }

          if (!username || !password) return fail(res, '請輸入學號與密碼');
          if (idLast4 && !/^\d{4}$/.test(idLast4)) return fail(res, '身分證字號末四碼需為 4 位數字');

          const user = await apiAdapter.login(username, password);
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
            currentConfig = await storage.saveConfig({ account: { username, password, idLast4 } });
          } else {
            currentConfig = await storage.saveConfig({ account: { username, password: '', idLast4 } });
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
            const rows = await apiAdapter.listLectures(engine.session?.token || null);
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
          const rows = await apiAdapter.listRegistered(engine.session.token);
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
          if (added.length) {
            scheduler.ensureOpenSchedule();
          }
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
                excellence: Math.max(0, Number(body.graduation.history?.excellence || 0)),
                total: Math.max(0, Number(body.graduation.history?.total || 0))
              }
            };
          }

          if (!Object.keys(patch).length) return fail(res, '沒有可更新的設定');
          currentConfig = await storage.saveConfig(patch);
          engine.settings = { ...engine.settings, ...currentConfig.engine };
          return ok(res, { config: publicConfig(), engine: engine.settings });
        }

        case 'POST /api/ai/plan': {
          const body = await readJson(req);
          const text = String(body.text || '').trim();
          if (!text) return fail(res, '請先描述想搶的講座');

          const lectures = await ensureLectures();
          const plan = await ai.planTargets(currentConfig.ai, lectures, text);

          let added = [];
          if (plan.picks.length) {
            const ids = plan.picks.map((pick) => pick.eid01);
            const rows = lectures.filter((row) => ids.includes(String(row.eid01)));
            added = engine.addTargets(rows, Math.min(currentConfig.ai.maxTargets || 3, 10));
          }
          return ok(res, { ...plan, added });
        }

        case 'GET /api/calendar': {
          let registered = [];
          if (engine.session?.token) {
            try {
              registered = await apiAdapter.listRegistered(engine.session.token);
            } catch {
              /* 盡力而為 */
            }
          }
          return ok(res, { events: api_calendarRows(registered), fetchedAt: Date.now() });
        }

        case 'GET /api/calendar.ics': {
          let registered = [];
          if (engine.session?.token) {
            try {
              registered = await apiAdapter.listRegistered(engine.session.token);
            } catch {
              /* 盡力而為 */
            }
          }
          const events = api_calendarRows(registered);
          const icsText = generateIcs(events);
          res.writeHead(200, {
            'Content-Type': 'text/calendar; charset=utf-8',
            'Content-Disposition': 'inline; filename="asia-lectures.ics"',
            'Cache-Control': 'no-cache',
            'Content-Length': Buffer.byteLength(icsText)
          });
          return res.end(icsText);
        }

        case 'POST /api/schedule': {
          const body = await readJson(req);
          if (body.enabled !== undefined) scheduler.setEnabled(body.enabled);
          if (Array.isArray(body.entries)) scheduler.replace(body.entries);
          if (body.entry && typeof body.entry === 'object') scheduler.add(body.entry);
          if (body.remove) scheduler.remove(String(body.remove));
          currentConfig = await storage.saveConfig({ schedule: scheduler.toConfig() });
          return ok(res, { schedule: scheduler.view() });
        }

        case 'POST /api/ai/agent': {
          const body = await readJson(req);
          const text = String(body.text || '').trim();
          if (!text) return fail(res, '請先描述想搶的講座與時間');
          const lectures = await ensureLectures();
          const plan = await ai.planAgent(currentConfig.ai, lectures, text);
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
              currentConfig = await storage.saveConfig({ schedule: scheduler.toConfig() });
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
          engine.clearLogs();
          return ok(res, { ok: true });
        }

        case 'GET /api/mcp': {
          assertAllowedOrigin(req);
          const response = await handleJsonRpcMessage(
            { jsonrpc: '2.0', id: 'discovery', method: 'tools/list' },
            createMcpContext({ api: apiAdapter, storage, engine, headers: req.headers })
          );
          res.setHeader('Mcp-Protocol-Version', '2026-07-28');
          res.setHeader('Cache-Control', 'public, max-age=60');
          return ok(res, response);
        }

        case 'POST /api/mcp': {
          let body;
          try {
            body = await readJson(req);
          } catch (err) {
            if (!err?.jsonRpcParseError) throw err;
            // 與 stdio 一致：JSON 解析失敗回傳 JSON-RPC -32700。
            res.setHeader('Mcp-Protocol-Version', '2026-07-28');
            return ok(res, {
              jsonrpc: '2.0',
              id: null,
              error: { code: -32700, message: '解析錯誤：JSON 格式不正確' }
            });
          }
          const response = await handleJsonRpcMessage(
            body,
            createMcpContext({ api: apiAdapter, storage, engine, headers: req.headers })
          );
          res.setHeader('Mcp-Protocol-Version', '2026-07-28');
          if (response === null) {
            res.writeHead(204);
            return res.end();
          }
          return ok(res, response);
        }

        default:
          return fail(res, 'Not Found', 404);
      }
    } catch (err) {
      const status = resolveErrorStatus(err, apiAdapter);
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
    const root = path.resolve(publicDir);
    const file = path.resolve(root, rel);
    if (!file.startsWith(root + path.sep) && file !== root) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }
    const targetFile = file === root ? path.join(root, 'index.html') : file;
    try {
      const data = await readFile(targetFile);
      res.writeHead(200, {
        'Content-Type': MIME[path.extname(targetFile).toLowerCase()] || 'application/octet-stream',
        'Cache-Control': 'no-store'
      });
      res.end(data);
    } catch {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
    }
  }

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

  async function autoLogin() {
    await autoLoginEngine({ engine, api: apiAdapter, config: currentConfig });
  }

  return {
    server,
    handleApi,
    serveStatic,
    autoLogin,
    snapshot,
    getConfig: () => currentConfig
  };
}

/**
 * 啟動主服務伺服器。
 */
export async function startServer({
  port = PORT,
  host = HOST,
  storage = defaultStorage,
  api: apiAdapter = defaultApi,
  publicDir = PUBLIC_DIR
} = {}) {
  let { engine, config } = await createRuntime({ storage, api: apiAdapter });
  const flushState = bindStatePersistence(engine, storage);

  const scheduler = new Scheduler({
    enabled: config.schedule?.enabled !== false,
    entries: config.schedule?.entries || [],
    engine,
    log: (level, message) => engine.log(level, message),
    onSave: (schedule) => {
      storage
        .saveConfig({ schedule })
        .then((next) => {
          config = next;
        })
        .catch((err) => console.error('[schedule] 儲存失敗：', err.message));
    }
  });

  const schedulerTimer = setInterval(() => {
    scheduler.tick().catch((err) => console.error('[schedule] tick 失敗：', err.message));
  }, 10_000);
  schedulerTimer.unref();

  const app = createApp({
    engine,
    scheduler,
    storage,
    config,
    api: apiAdapter,
    publicDir
  });

  const server = app.server;

  await new Promise((resolve) => {
    server.listen(port, host, () => {
      console.log('');
      console.log('  講座自動報名助手 MVP');
      console.log(`  本機介面：http://${host}:${port}`);
      console.log(`  目標系統：${apiAdapter.BASE_URL}`);
      console.log(`  已載入 ${engine.targets.length} 個目標講座`);
      console.log('');

      if (engine.activeTargets().length > 0) {
        scheduler.ensureOpenSchedule();
      }

      app.autoLogin().catch(() => {});
      resolve();
    });
  });

  async function shutdown() {
    engine.stop('伺服器關閉');
    clearInterval(schedulerTimer);
    try {
      await flushState();
    } catch (err) {
      console.error('[state] 保存失敗：', err.message);
    }
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 1500).unref();
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  return { app, server, engine, scheduler, shutdown };
}

// 若以 node 腳本直接執行，則啟動主服務
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  startServer().catch((err) => {
    console.error('伺服器啟動失敗：', err);
    process.exit(1);
  });
}
