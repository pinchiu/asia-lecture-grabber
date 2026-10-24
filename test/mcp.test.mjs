import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  handleJsonRpcMessage,
  MCP_TOOLS,
  MCP_SERVER_INFO,
  MCP_PROTOCOL_VERSION,
  SUPPORTED_PROTOCOL_VERSIONS
} from '../src/mcp.mjs';
import { createApp } from '../src/server.mjs';
import { createStorage } from '../src/storage.mjs';
import { Engine } from '../src/engine.mjs';
import { Scheduler } from '../src/schedule.mjs';

function createMockApi(overrides = {}) {
  const lectures = [
    {
      eid01: 'L01',
      reseid: 'RES01',
      rescnm: '人工智慧倫理與實踐',
      teachm: '張教授',
      rescsd: '2026/10/25',
      resdat: '2026/10/25 10:00~12:00',
      stime: '10:00',
      etime: '12:00',
      locale: 'A101',
      canapp: 'Y',
      maxstd: 100,
      selnum: 45,
      chk4: 'Y',
      chk6: 'Y',
      cnt_10: 1
    },
    {
      eid01: 'L02',
      reseid: 'RES02',
      rescnm: '關懷社會創新講座',
      teachm: '李講師',
      rescsd: '2026/10/26',
      resdat: '2026/10/26 14:00~16:00',
      stime: '14:00',
      etime: '16:00',
      locale: 'M001',
      canapp: 'F',
      maxstd: 80,
      selnum: 80,
      chk5: 'Y',
      cnt_10: 0
    }
  ];

  return {
    BASE_URL: 'https://mock.asia.edu.tw/',
    STATUS_LABEL: { Y: '可報名', F: '已額滿', N1: '未開放', N2: '已截止', C: '現場報名', D: '其他方式' },
    listLectures: async () => lectures,
    getLecture: async (token, eid) => lectures.find((l) => l.eid01 === eid) || null,
    listRegistered: async () => [lectures[0]],
    registerLecture: async () => ({ ok: true, message: '報名成功' }),
    cancelLecture: async () => ({ ok: true, message: '已成功取消報名' }),
    verifyIdentity: async () => ({ chi_name: '王小明', dept_name_s: '資工系', email: 'test@asia.edu.tw' }),
    ...overrides
  };
}

describe('mcp.mjs Model Context Protocol (MCP 2026-07-28 規範) 伺服器模組測試', () => {
  let engine;
  let mockApi;
  let mockStorage;
  let context;

  before(async () => {
    mockApi = createMockApi();
    const tempDir = await mkdtemp(path.join(tmpdir(), 'mcp-test-'));
    mockStorage = createStorage({ dataDir: tempDir });
    await mockStorage.saveConfig({
      graduation: {
        history: { health: 1, care: 1, innovation: 0, excellence: 1, total: 3 }
      }
    });

    engine = new Engine({
      api: mockApi,
      targets: [
        { eid01: 'L01', reseid: 'RES01', rescnm: '人工智慧倫理與實踐', chk4: 'Y', chk6: 'Y' }
      ]
    });

    engine.setSession({
      token: 'mock-jwt-token',
      emp_id: '11000001',
      emp_nm: '王小明',
      emp_rl: 'Student',
      idLast4: '5678'
    });

    engine.applyRows(await mockApi.listLectures());

    context = {
      api: mockApi,
      storage: mockStorage,
      engine
    };
  });

  test('MCP 2026-07-28 協定握手與中繼資料驗證', async () => {
    // 1) initialize (相容性與無狀態宣告)
    const initRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: MCP_PROTOCOL_VERSION }
    }, context);

    assert.equal(initRes.id, 1);
    assert.equal(initRes.result.protocolVersion, '2026-07-28');
    assert.equal(initRes.result.serverInfo.name, MCP_SERVER_INFO.name);
    assert.ok(initRes.result.capabilities.tools);
    assert.ok(initRes.result.capabilities.tasks);
    assert.equal(initRes.result._meta.stateless, true);

    // 2) notifications/initialized (無回傳內容)
    const notifRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      method: 'notifications/initialized'
    }, context);
    assert.equal(notifRes, null);

    // 3) ping
    const pingRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 2,
      method: 'ping'
    }, context);
    assert.equal(pingRes.id, 2);
    assert.equal(pingRes.result.status, 'ok');
  });

  test('MCP 2026-07-28 無狀態直接調用與快取中繼資料（無需前置 initialize）', async () => {
    // 無需 handshake 直接查詢 tools/list
    const listRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 'stateless-query',
      method: 'tools/list'
    }, context);

    assert.equal(listRes.id, 'stateless-query');
    const tools = listRes.result.tools;
    assert.equal(tools.length, 8);
    assert.equal(listRes.result._meta.protocolVersion, '2026-07-28');
    assert.equal(listRes.result._meta.ttlMs, 60000);
    assert.equal(listRes.result._meta.cacheScope, 'global');
  });

  test('tools/call: asia_list_lectures 支援關鍵字與素養過濾', async () => {
    // 依關鍵字篩選
    const res = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {
        name: 'asia_list_lectures',
        arguments: { keyword: '人工智慧' }
      }
    }, context);

    const payload = JSON.parse(res.result.content[0].text);
    assert.equal(payload.totalMatches, 1);
    assert.equal(payload.lectures[0].eid01, 'L01');
    assert.ok(payload.lectures[0].literacies.includes('健康力'));

    // 依素養篩選
    const resCare = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: {
        name: 'asia_list_lectures',
        arguments: { literacy: '關懷力' }
      }
    }, context);

    const payloadCare = JSON.parse(resCare.result.content[0].text);
    assert.equal(payloadCare.totalMatches, 1);
    assert.equal(payloadCare.lectures[0].eid01, 'L02');
  });

  test('tools/call: asia_get_lecture 查詢單場明細與例外處理', async () => {
    const res = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: {
        name: 'asia_get_lecture',
        arguments: { eid01: 'L01' }
      }
    }, context);

    const detail = JSON.parse(res.result.content[0].text);
    assert.equal(detail.eid01, 'L01');
    assert.equal(detail.rescnm, '人工智慧倫理與實踐');

    // 查無資料拋出錯誤訊息
    const notFoundRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 7,
      method: 'tools/call',
      params: {
        name: 'asia_get_lecture',
        arguments: { eid01: 'NOT_EXIST' }
      }
    }, context);
    assert.equal(notFoundRes.result.isError, true);
    assert.ok(notFoundRes.result.content[0].text.includes('找不到代號為'));
  });

  test('tools/call: asia_check_graduation 計算四力達成率與缺額', async () => {
    const res = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 8,
      method: 'tools/call',
      params: {
        name: 'asia_check_graduation'
      }
    }, context);

    const grad = JSON.parse(res.result.content[0].text);
    assert.equal(grad.isGraduationReady, false);
    assert.ok(grad.progress.health.current >= 2); // 歷史 1 + L01 累計 1 = 2
    assert.ok(grad.deficiencies.length > 0);
  });

  test('tools/call: asia_get_calendar 取得個人行程與衝堂警報', async () => {
    const res = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 9,
      method: 'tools/call',
      params: {
        name: 'asia_get_calendar'
      }
    }, context);

    const cal = JSON.parse(res.result.content[0].text);
    assert.equal(cal.totalEvents, 1);
    assert.equal(cal.events[0].eid01, 'L01');
  });

  test('tools/call: asia_manage_targets 搶課目標管理與 asia_get_engine_status', async () => {
    // 1) list
    const listRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 10,
      method: 'tools/call',
      params: {
        name: 'asia_manage_targets',
        arguments: { action: 'list' }
      }
    }, context);
    const targets = JSON.parse(listRes.result.content[0].text);
    assert.equal(targets.targets.length, 1);

    // 2) add L02
    const addRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 11,
      method: 'tools/call',
      params: {
        name: 'asia_manage_targets',
        arguments: { action: 'add', eid01: 'L02' }
      }
    }, context);
    const afterAdd = JSON.parse(addRes.result.content[0].text);
    assert.equal(afterAdd.ok, true);

    // 3) status
    const statusRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 12,
      method: 'tools/call',
      params: {
        name: 'asia_get_engine_status',
        arguments: { logLimit: 5 }
      }
    }, context);
    const status = JSON.parse(statusRes.result.content[0].text);
    assert.equal(status.session.emp_id, '11000001');
    assert.ok(Array.isArray(status.recentLogs));
  });

  test('2026-07-28 Tasks 原語生命週期測試（tasks/list, tasks/get, tasks/cancel）', async () => {
    // 1) tasks/list
    const listRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 20,
      method: 'tasks/list'
    }, context);
    assert.equal(listRes.id, 20);
    assert.ok(Array.isArray(listRes.result.tasks));
    assert.equal(listRes.result.tasks[0].taskId, 'grab-engine-poller');

    // 2) tasks/get
    const getRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 21,
      method: 'tasks/get',
      params: { taskId: 'grab-engine-poller' }
    }, context);
    assert.equal(getRes.id, 21);
    assert.equal(getRes.result.taskId, 'grab-engine-poller');
    assert.ok(getRes.result.stats);

    // 3) tasks/cancel
    const cancelRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 22,
      method: 'tasks/cancel',
      params: { taskId: 'grab-engine-poller' }
    }, context);
    assert.equal(cancelRes.id, 22);
    assert.equal(cancelRes.result.cancelled, true);

    // 4) tasks 參數缺少錯誤碼 -32602
    const errRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 23,
      method: 'tasks/get',
      params: {}
    }, context);
    assert.equal(errRes.error.code, -32602);
  });

  test('2026-07-28 Header-Based Routing 標頭導向測試', async () => {
    const res = await handleJsonRpcMessage(
      {
        jsonrpc: '2.0',
        id: 30,
        params: {
          arguments: { keyword: '人工智慧' }
        }
      },
      {
        ...context,
        headers: {
          'mcp-method': 'tools/call',
          'mcp-name': 'asia_list_lectures'
        }
      }
    );

    assert.equal(res.id, 30);
    const payload = JSON.parse(res.result.content[0].text);
    assert.equal(payload.totalMatches, 1);
    assert.equal(payload.lectures[0].eid01, 'L01');
  });

  test('JSON-RPC 協定異常處理（未知方法與未預期格式）', async () => {
    // 未知方法
    const errRes = await handleJsonRpcMessage({
      jsonrpc: '2.0',
      id: 13,
      method: 'unknown_method'
    }, context);
    assert.equal(errRes.error.code, -32601);

    // 非物件 payload
    const invalidRes = await handleJsonRpcMessage('not-an-object', context);
    assert.equal(invalidRes.error.code, -32600);
  });

  test('HTTP POST /api/mcp 與 GET /api/mcp 端點整合測試（含 2026-07-28 標頭）', async () => {
    const testDir = await mkdtemp(path.join(tmpdir(), 'mcp-http-test-'));
    const storage = createStorage({ dataDir: testDir });
    const scheduler = new Scheduler({ engine });
    const app = createApp({
      engine,
      scheduler,
      storage,
      config: { engine: {}, graduation: {}, account: {}, notify: {}, ai: {} },
      api: mockApi
    });

    const server = app.server;
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    try {
      // 1) GET /api/mcp 探索清單
      const getRes = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
        headers: { Connection: 'close' }
      });
      assert.equal(getRes.status, 200);
      assert.equal(getRes.headers.get('mcp-protocol-version'), '2026-07-28');
      const getData = await getRes.json();
      assert.equal(getData.result.tools.length, 8);

      // 2) POST /api/mcp 透過 HTTP 發送 JSON-RPC tools/list
      const res = await fetch(`http://127.0.0.1:${port}/api/mcp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Connection: 'close' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 100,
          method: 'tools/list'
        })
      });

      assert.equal(res.status, 200);
      assert.equal(res.headers.get('mcp-protocol-version'), '2026-07-28');
      const data = await res.json();
      assert.equal(data.id, 100);
      assert.equal(data.result.tools.length, 8);
    } finally {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });
});
