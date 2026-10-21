import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createStorage, merge, clampNumber, DEFAULT_CONFIG } from '../src/storage.mjs';

describe('storage.mjs 儲存層與序列化測試', () => {
  let testDir = '';
  let storage = null;

  before(async () => {
    testDir = await mkdtemp(path.join(tmpdir(), 'storage-test-'));
    storage = createStorage({ dataDir: testDir });
  });

  after(async () => {
    if (testDir) {
      await rm(testDir, { recursive: true, force: true }).catch(() => {});
    }
  });

  test('clampNumber 邊界數值約束', () => {
    assert.equal(clampNumber(500, 1000, 30000, 2500), 1000);
    assert.equal(clampNumber(40000, 1000, 30000, 2500), 30000);
    assert.equal(clampNumber(5000, 1000, 30000, 2500), 5000);
    assert.equal(clampNumber('invalid', 1000, 30000, 2500), 2500);
    assert.equal(clampNumber(NaN, 1000, 30000, 2500), 2500);
  });

  test('merge 深度物件合併與陣列覆寫', () => {
    const base = { a: 1, sub: { x: 10, y: 20 }, arr: [1, 2] };
    const patch = { b: 2, sub: { y: 30, z: 40 }, arr: [3] };
    const res = merge(base, patch);

    assert.equal(res.a, 1);
    assert.equal(res.b, 2);
    assert.equal(res.sub.x, 10);
    assert.equal(res.sub.y, 30);
    assert.equal(res.sub.z, 40);
    assert.deepEqual(res.arr, [3]);
  });

  test('初始讀取應回傳預設設定與空目標', async () => {
    const conf = await storage.loadConfig();
    assert.equal(conf.engine.intervalMs, DEFAULT_CONFIG.engine.intervalMs);
    assert.equal(conf.graduation.history.total, 0);

    const st = await storage.loadState();
    assert.deepEqual(st.targets, []);
  });

  test('儲存設定並支援自動約束數值', async () => {
    const updated = await storage.saveConfig({
      account: { username: 'testuser', idLast4: '1234' },
      engine: { intervalMs: 50, burstIntervalMs: 50000, bfree: 'y' }
    });

    assert.equal(updated.account.username, 'testuser');
    assert.equal(updated.account.idLast4, '1234');
    assert.equal(updated.engine.intervalMs, 1000); // 最小 1000
    assert.equal(updated.engine.burstIntervalMs, 10000); // 最大 10000
    assert.equal(updated.engine.bfree, 'Y');

    const reloaded = await storage.loadConfig();
    assert.equal(reloaded.account.username, 'testuser');
    assert.equal(reloaded.engine.intervalMs, 1000);
    assert.equal(reloaded.engine.bfree, 'Y');
  });

  test('saveState 與 loadState 寫入與回讀', async () => {
    const targetObj = {
      eid01: '12345',
      reseid: 'RES001',
      rescnm: '資訊科技專題',
      status: 'waiting'
    };

    await storage.saveState({ targets: [targetObj] });
    const loaded = await storage.loadState();
    assert.equal(loaded.targets.length, 1);
    assert.equal(loaded.targets[0].eid01, '12345');
    assert.equal(loaded.targets[0].rescnm, '資訊科技專題');
  });

  test('並行寫入狀態不應發生競爭損壞', async () => {
    const promises = [];
    for (let i = 0; i < 10; i++) {
      promises.push(
        storage.saveState({
          targets: [{ eid01: `item_${i}`, status: 'waiting' }]
        })
      );
    }
    await Promise.all(promises);

    const finalState = await storage.loadState();
    assert.ok(Array.isArray(finalState.targets));
    assert.equal(finalState.targets.length, 1);
    assert.ok(finalState.targets[0].eid01.startsWith('item_'));
  });

  test('損毀的 JSON 檔案應自動優雅恢復為預設結構', async () => {
    // 刻意寫入損毀之 JSON 內容
    await writeFile(storage.configFile, '{ "broken": json ... ', 'utf8');
    const recoveredConfig = await storage.loadConfig();
    assert.equal(recoveredConfig.engine.intervalMs, DEFAULT_CONFIG.engine.intervalMs);

    await writeFile(storage.stateFile, 'INVALID DATA', 'utf8');
    const recoveredState = await storage.loadState();
    assert.deepEqual(recoveredState.targets, []);
  });
});
