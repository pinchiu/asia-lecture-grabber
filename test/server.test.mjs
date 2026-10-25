import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp } from '../src/server.mjs';
import { createStorage } from '../src/storage.mjs';
import { Engine } from '../src/engine.mjs';
import { Scheduler } from '../src/schedule.mjs';

function requestHttp(server, method, pathname, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const addr = server.address();
    const port = addr.port;
    const reqHeaders = { 'Content-Type': 'application/json', ...headers };
    let payload = null;

    if (body !== null) {
      payload = typeof body === 'string' ? body : JSON.stringify(body);
      reqHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path: pathname,
        method,
        headers: reqHeaders
      },
      (res) => {
        const chunks = [];
        res.on('data', (chunk) => chunks.push(chunk));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf8');
          let json = null;
          try {
            json = JSON.parse(raw);
          } catch {}
          resolve({ status: res.statusCode, headers: res.headers, body: raw, json });
        });
        res.on('error', reject);
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('server.mjs HTTP 服務與路由整合測試', () => {
  let testDir = '';
  let server = null;
  let app = null;

  before(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'server-test-'));
    const storage = createStorage({ dataDir: testDir });
    const config = await storage.loadConfig();

    const mockApi = {
      BASE_URL: 'https://mock.asia.edu.tw/',
      ApiError: class ApiError extends Error {},
      login: async () => ({ token: 'mock-token', emp_id: 'test_user', emp_rl: 'Student' }),
      listLectures: async () => [
        { eid01: 'S01', rescnm: '服務端測試講座', canapp: 'Y', cnt_10: 1, rescsd: '2026/11/01', stime: '10:00' }
      ],
      listRegistered: async () => [],
      verifyIdentity: async () => ({ chi_name: '測試生' })
    };

    const engine = new Engine({
      api: mockApi,
      settings: config.engine,
      targets: []
    });

    const scheduler = new Scheduler({
      enabled: true,
      entries: [],
      engine
    });

    app = createApp({
      engine,
      scheduler,
      storage,
      config,
      api: mockApi
    });

    server = app.server;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('GET /api/state 應回傳完整系統狀態快照', async () => {
    const res = await requestHttp(server, 'GET', '/api/state');
    assert.equal(res.status, 200);
    assert.ok(res.json);
    assert.equal(typeof res.json.now, 'number');
    assert.ok(res.json.baseUrl);
    assert.ok(res.json.graduation);
    assert.equal(res.json.graduation.threshold.total, 8);
    assert.equal(res.json.session.loggedIn, false);
  });

  test('GET /api/calendar.ics 應回傳標準 iCalendar 格式', async () => {
    const res = await requestHttp(server, 'GET', '/api/calendar.ics');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/calendar'));
    assert.ok(res.body.includes('BEGIN:VCALENDAR'));
    assert.ok(res.body.includes('END:VCALENDAR'));
  });

  test('POST /api/login 缺少密碼應回報 400 與錯誤訊息', async () => {
    const res = await requestHttp(server, 'POST', '/api/login', { username: 'testuser', password: '' });
    assert.equal(res.status, 400);
    assert.ok(res.json.error.includes('請輸入學號與密碼'));
  });

  test('POST /api/config 應支援局部設定更新', async () => {
    const res = await requestHttp(server, 'POST', '/api/config', {
      engine: { intervalMs: 3000, stopWhenAllDone: true },
      notify: { sound: false }
    });
    assert.equal(res.status, 200);
    assert.equal(res.json.engine.intervalMs, 3000);
    assert.equal(res.json.config.notify.sound, false);
  });

  test('GET / 應正確回傳 index.html 靜態首頁', async () => {
    const res = await requestHttp(server, 'GET', '/');
    assert.equal(res.status, 200);
    assert.ok(res.headers['content-type'].includes('text/html'));
    assert.ok(res.body.includes('亞洲大學'));
  });

  test('serveStatic 靜態路徑穿透攻擊應被拒絕並回傳 403 Forbidden', async () => {
    let statusCode = 0;
    let bodyText = '';
    const mockRes = {
      writeHead: (code) => {
        statusCode = code;
      },
      end: (data) => {
        bodyText = String(data || '');
      }
    };

    await app.serveStatic(mockRes, '../package.json');
    assert.equal(statusCode, 403);
    assert.ok(bodyText.includes('Forbidden'));

    await app.serveStatic(mockRes, '/%ff');
    assert.equal(statusCode, 400);
    assert.ok(bodyText.includes('Bad Request'));
  });

  test('未定義之 API 端點應回傳 404 Not Found', async () => {
    const res = await requestHttp(server, 'GET', '/api/nonexistent_endpoint');
    assert.equal(res.status, 404);
  });
});
