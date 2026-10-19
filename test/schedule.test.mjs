import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  Scheduler,
  normalizeEntry,
  describeEntry,
  DAY_LABELS
} from '../src/schedule.mjs';

describe('schedule.mjs 定時排程器測試', () => {
  describe('normalizeEntry 正規化', () => {
    it('預設值應正確套用', () => {
      const entry = normalizeEntry({});
      assert.equal(entry.mode, 'at');
      assert.equal(entry.enabled, true);
      assert.equal(entry.startTime, '09:00');
      assert.equal(entry.stopTime, '18:00');
      assert.equal(entry.leadSec, 15);
      assert.ok(entry.id.startsWith('s_'));
    });

    it('window 模式之 days 應排序且去重', () => {
      const entry = normalizeEntry({ mode: 'window', days: [5, 1, 3, 1] });
      assert.deepEqual(entry.days, [1, 3, 5]);
    });
  });

  describe('describeEntry 描述文字', () => {
    it('應產生易讀的中文排程摘要', () => {
      const openDesc = describeEntry({ mode: 'open', leadSec: 20 });
      assert.equal(openDesc, '開放前 20 秒自動啟動');

      const winDesc = describeEntry({
        mode: 'window',
        days: [1, 2, 3, 4, 5],
        startTime: '10:00',
        stopTime: '12:00'
      });
      assert.ok(winDesc.includes('10:00–12:00'));
    });
  });

  describe('inWindow 跨日與時段判定', () => {
    const mockEngine = { running: false, activeTargets: () => [] };

    it('標準日間時段判定', () => {
      const s = new Scheduler({ engine: mockEngine });
      const entry = normalizeEntry({
        mode: 'window',
        days: [1], // 週一
        startTime: '14:00',
        stopTime: '16:00'
      });
      // 模擬週一 15:00 (符合) 與 17:00 (不符)
      const d = new Date();
      // 調整為週一
      const dayDiff = (1 - d.getDay() + 7) % 7;
      const testMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayDiff);

      testMonday.setHours(15, 0, 0, 0);
      assert.equal(s.inWindow(entry, testMonday.getTime()), true);

      testMonday.setHours(17, 0, 0, 0);
      assert.equal(s.inWindow(entry, testMonday.getTime()), false);
    });

    it('跨午夜時段判定（如 23:00 至 02:00）', () => {
      const s = new Scheduler({ engine: mockEngine });
      const entry = normalizeEntry({
        mode: 'window',
        days: [1], // 週一
        startTime: '23:00',
        stopTime: '02:00'
      });
      const d = new Date();
      const dayDiff = (1 - d.getDay() + 7) % 7;
      const testMonday = new Date(d.getFullYear(), d.getMonth(), d.getDate() + dayDiff);

      testMonday.setHours(23, 30, 0, 0);
      assert.equal(s.inWindow(entry, testMonday.getTime()), true);

      testMonday.setHours(1, 30, 0, 0);
      assert.equal(s.inWindow(entry, testMonday.getTime()), true);

      testMonday.setHours(12, 0, 0, 0);
      assert.equal(s.inWindow(entry, testMonday.getTime()), false);
    });
  });

  describe('ensureOpenSchedule 遵守使用者全域設定', () => {
    it('當使用者手動停用排程時，加入目標不應強制將 enabled 改為 true', () => {
      let savedConfig = null;
      const s = new Scheduler({
        enabled: false, // 使用者已關閉
        entries: [],
        engine: { running: false, activeTargets: () => [] },
        onSave: (cfg) => { savedConfig = cfg; }
      });

      const entry = s.ensureOpenSchedule();
      assert.equal(entry.mode, 'open');
      assert.equal(entry.enabled, true); // 單項排程項目啟用
      assert.equal(s.enabled, false); // 全域排程狀態仍然維持使用者的停用偏好
    });
  });
});
