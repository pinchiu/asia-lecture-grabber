import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, parseOpenAt } from '../src/engine.mjs';

function createMockApi(overrides = {}) {
  return {
    verifyIdentity: async (token, params) => ({
      chi_name: '測試生',
      dept_name_s: '資工系',
      email: 'test@asia.edu.tw',
      ...(overrides.verifyIdentity ? await overrides.verifyIdentity(token, params) : {})
    }),
    listLectures: async (token) => {
      if (overrides.listLectures) return overrides.listLectures(token);
      return [];
    },
    registerLecture: async (token, params) => {
      if (overrides.registerLecture) return overrides.registerLecture(token, params);
      return { ok: true, message: '報名成功' };
    },
    cancelLecture: async (token, cancelEid) => {
      if (overrides.cancelLecture) return overrides.cancelLecture(token, cancelEid);
      return { ok: true, message: '已成功取消報名' };
    },
    listRegistered: async (token) => {
      if (overrides.listRegistered) return overrides.listRegistered(token);
      return [];
    },
    login: async (username, password) => {
      if (overrides.login) return overrides.login(username, password);
      return { token: 'new-token', emp_id: username, emp_nm: '自動登入者', emp_rl: 'Student' };
    }
  };
}

describe('engine.mjs 搶課引擎狀態機測試', () => {
  test('parseOpenAt 時間字串解析', () => {
    assert.equal(parseOpenAt(''), 0);
    assert.equal(parseOpenAt('invalid'), 0);
    const ts = parseOpenAt('2026/10/25-2026/10/30');
    assert.ok(ts > 0);
    const date = new Date(ts);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth() + 1, 10);
    assert.equal(date.getDate(), 25);
  });

  test('引擎初始化與目標正規化', () => {
    const rawTarget = {
      eid01: 'L01',
      reseid: 'RES01',
      rescnm: '人工智慧倫理',
      chk4: 'Y',
      chk6_flg: true
    };

    const engine = new Engine({
      settings: { intervalMs: 500, burstIntervalMs: 100 },
      targets: [rawTarget]
    });

    assert.equal(engine.settings.intervalMs, 1000); // 下限 1000
    assert.equal(engine.settings.burstIntervalMs, 300); // 下限 300
    assert.equal(engine.targets.length, 1);
    assert.equal(engine.targets[0].eid01, 'L01');
    assert.equal(engine.targets[0].status, 'waiting');
    assert.ok(engine.targets[0].literacies.includes('健康力'));
    assert.ok(engine.targets[0].literacies.includes('創新力'));
  });

  test('setSession 與 sessionView 狀態切換', () => {
    const engine = new Engine();
    assert.equal(engine.sessionView().loggedIn, false);

    engine.setSession({
      token: 'jwt-token-123',
      emp_id: '11000001',
      emp_nm: '王小明',
      emp_rl: 'Student',
      idLast4: '5678'
    });

    const view = engine.sessionView();
    assert.equal(view.loggedIn, true);
    assert.equal(view.emp_id, '11000001');
    assert.equal(view.emp_nm, '王小明');
    assert.equal(view.idLast4Set, true);

    engine.setSession(null);
    assert.equal(engine.sessionView().loggedIn, false);
  });

  test('addTargets 與 clearFinished', () => {
    const engine = new Engine();
    const rows = [
      { eid01: 'T1', rescnm: '講座1', canapp: 'Y' },
      { eid01: 'T2', rescnm: '講座2', canapp: 'N1' },
      { eid01: 'T1', rescnm: '講座1重複' }
    ];

    const added = engine.addTargets(rows, 3);
    assert.equal(added.length, 2);
    assert.equal(engine.targets.length, 2);

    // 將 T1 標記為完成
    engine.targets[0].status = 'registered';
    assert.equal(engine.activeTargets().length, 1);

    engine.clearFinished();
    assert.equal(engine.targets.length, 1);
    assert.equal(engine.targets[0].eid01, 'T2');
  });

  test('tick 狀態機輪詢：講座開放時自動觸發報名並累加成功計數', async () => {
    let registerCalled = false;
    const mockApi = createMockApi({
      listLectures: async () => [
        { eid01: 'T_GRAB', reseid: 'R_GRAB', rescnm: '秒殺講座', canapp: 'Y', cnt_10: 0 }
      ],
      registerLecture: async (token, params) => {
        registerCalled = true;
        assert.equal(params.eid01, 'T_GRAB');
        return { ok: true, message: '報名成功！' };
      }
    });

    const engine = new Engine({
      api: mockApi,
      settings: { minRequestGapMs: 0, retryGapMs: 0 },
      targets: [{ eid01: 'T_GRAB', rescnm: '秒殺講座' }]
    });

    engine.setSession({
      token: 'valid-token',
      emp_id: '11000001',
      emp_nm: '搶課生',
      emp_rl: 'Student',
      idLast4: '1234'
    });

    let eventEmitted = false;
    engine.on('registered', (data) => {
      eventEmitted = true;
      assert.equal(data.eid01, 'T_GRAB');
      assert.equal(data.status, 'registered');
    });

    engine.running = true;
    await engine.tick();
    engine.stop();

    assert.equal(registerCalled, true);
    assert.equal(eventEmitted, true);
    assert.equal(engine.targets[0].status, 'registered');
    assert.equal(engine.stats.registrations, 1);
    assert.equal(engine.stats.ticks, 1);
  });

  test('tick 狀態機：已截止(N2)與現場報名(C)場次狀態收斂', async () => {
    const mockApi = createMockApi({
      listLectures: async () => [
        { eid01: 'T_CLOSED', rescnm: '截止場次', canapp: 'N2', cnt_10: 0 },
        { eid01: 'T_MANUAL', rescnm: '現場報名場次', canapp: 'C', cnt_10: 0 }
      ]
    });

    const engine = new Engine({
      api: mockApi,
      settings: { minRequestGapMs: 0 },
      targets: [
        { eid01: 'T_CLOSED', rescnm: '截止場次' },
        { eid01: 'T_MANUAL', rescnm: '現場報名場次' }
      ]
    });

    engine.setSession({ token: 't', emp_id: 'u', idLast4: '0000', emp_rl: 'Student' });
    engine.running = true;
    await engine.tick();
    engine.stop();

    assert.equal(engine.targets[0].status, 'closed');
    assert.equal(engine.targets[1].status, 'manual');
    assert.equal(engine.activeTargets().length, 0);
  });

  test('可報名切換時觸發高速輪詢 (Burst Mode)', () => {
    const engine = new Engine({
      settings: { intervalMs: 2500, burstIntervalMs: 500, postOpenBurstMs: 20000 },
      targets: [{ eid01: 'BURST_TARGET', rescnm: '突發測試' }]
    });

    // 初始模擬前一次狀態為 N1（未開放）
    engine.applyRows([{ eid01: 'BURST_TARGET', rescnm: '突發測試', canapp: 'N1' }]);
    assert.equal(engine.interval(), 2500);

    // 狀態轉為 Y（可報名），應啟動高速模式
    engine.applyRows([{ eid01: 'BURST_TARGET', rescnm: '突發測試', canapp: 'Y' }]);
    assert.equal(engine.interval(), 500);
  });

  test('連續失敗時 interval 指數退避', async () => {
    const engine = new Engine({
      settings: { intervalMs: 1000 }
    });

    assert.equal(engine.interval(), 1000);

    await engine.handleError(new Error('連線中斷 1'));
    assert.equal(engine.interval(), 2000);

    await engine.handleError(new Error('連線中斷 2'));
    assert.equal(engine.interval(), 4000);
  });

  test('手動報名未預先在目標清單之講座亦應正確累加統計', async () => {
    const mockApi = createMockApi({
      listLectures: async () => [
        { eid01: 'MANUAL_01', reseid: 'R_MANUAL', rescnm: '手動報名測試', canapp: 'Y', cnt_10: 0 }
      ],
      registerLecture: async () => ({ ok: true, message: '報名成功' })
    });

    const engine = new Engine({ api: mockApi });
    engine.setSession({ token: 'tok', emp_id: '123', idLast4: '9999', emp_rl: 'Student' });

    assert.equal(engine.stats.registrations, 0);
    const msg = await engine.manualRegister('MANUAL_01');
    assert.equal(msg, '報名成功');
    assert.equal(engine.stats.registrations, 1);
  });

  test('退選講座 cancelTarget 應呼叫 API 並重設本機狀態', async () => {
    let cancelCalledWith = '';
    const mockApi = createMockApi({
      listRegistered: async () => [
        { eid01: 'DEL_01', reseid: 'ID1234567890=', rescnm: '退選測試' }
      ],
      cancelLecture: async (token, cancelEid) => {
        cancelCalledWith = cancelEid;
        return { ok: true, message: '已成功取消報名' };
      }
    });

    const engine = new Engine({
      api: mockApi,
      targets: [{ eid01: 'DEL_01', reseid: 'ID1234567890=', rescnm: '退選測試', status: 'registered' }]
    });

    engine.setSession({ token: 'tok', emp_id: '123', idLast4: '9999', emp_rl: 'Student' });
    const canceledTitle = await engine.cancelTarget('DEL_01');

    assert.equal(cancelCalledWith, 'ID1234567890=');
    assert.equal(canceledTitle, '退選測試');
    assert.equal(engine.targets[0].status, 'waiting');
    assert.equal(engine.targets[0].note, '已退選');
  });

  test('stopWhenAllDone 開關在全數搶完時自動停止引擎', () => {
    const engine = new Engine({
      settings: { stopWhenAllDone: true },
      targets: [{ eid01: 'TARGET_FINAL', rescnm: '最後一場' }]
    });

    engine.running = true;
    engine.finish(engine.targets[0], 'registered', '搶到了');

    assert.equal(engine.running, false);
  });
});
