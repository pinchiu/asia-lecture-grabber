import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseJsonObject,
  sanitizeSchedule,
  parseScheduleText,
  planTargets
} from '../src/ai.mjs';

describe('ai.mjs 智慧解析與本機規則測試', () => {
  describe('parseJsonObject JSON 提取', () => {
    it('應解析標準 JSON', () => {
      const obj = parseJsonObject('{"status":"ok","value":42}');
      assert.deepEqual(obj, { status: 'ok', value: 42 });
    });

    it('應自動自 Markdown 代碼塊中提取 JSON', () => {
      const md = '```json\n{"reply":"完成","count":3}\n```';
      const obj = parseJsonObject(md);
      assert.equal(obj.reply, '完成');
      assert.equal(obj.count, 3);
    });

    it('應自前後夾帶自然語言中擷取 JSON 括號內容', () => {
      const text = '這是說明：{"picks":[{"eid01":"101"}]} 謝謝使用。';
      const obj = parseJsonObject(text);
      assert.equal(obj.picks[0].eid01, '101');
    });
  });

  describe('sanitizeSchedule 排程正規化', () => {
    it('mode=open 應保留 leadSec', () => {
      const res = sanitizeSchedule({ mode: 'open', leadSec: 30 });
      assert.equal(res.mode, 'open');
      assert.equal(res.leadSec, 30);
    });

    it('mode=window 應過濾無效星期與時間字串', () => {
      const res = sanitizeSchedule({
        mode: 'window',
        days: [0, 1, 99],
        startTime: '10:00',
        stopTime: '12:00'
      });
      assert.equal(res.mode, 'window');
      assert.deepEqual(res.days, [0, 1]);
      assert.equal(res.startTime, '10:00');
    });
  });

  describe('parseScheduleText 本機規則中文自然語言解析', () => {
    it('解析「開放前 20 秒」應轉換為 mode=open', () => {
      const res = parseScheduleText('我想在開放前 20 秒自動開搶');
      assert.ok(res);
      assert.equal(res.mode, 'open');
      assert.equal(res.leadSec, 20);
    });

    it('解析「每週三下午兩點到四點」應轉換為 mode=window', () => {
      const res = parseScheduleText('請在每週三下午2點到4點搶課');
      assert.ok(res);
      assert.equal(res.mode, 'window');
      assert.deepEqual(res.days, [3]);
      assert.equal(res.startTime, '14:00');
      assert.equal(res.stopTime, '16:00');
    });
  });

  describe('planTargets 本機離線篩選與防幻覺', () => {
    const mockLectures = [
      { eid01: '101', rescnm: '健康大師講座', chk4: 'Y', chk5: 'N', chk6: 'N', chk7: 'N', canapp: 'Y' },
      { eid01: '102', rescnm: 'AI創新應用實務', chk4: 'N', chk5: 'N', chk6: 'Y', chk7: 'N', canapp: 'Y' },
      { eid01: '103', rescnm: '關懷社會與偏鄉教育', chk4: 'N', chk5: 'Y', chk6: 'N', chk7: 'N', canapp: 'N2' } // 已截止
    ];

    it('本機規則應過濾掉已截止(N2)場次，並精準匹配關鍵字', async () => {
      const plan = await planTargets({ enabled: false }, mockLectures, '我要健康力講座 1 場');
      assert.equal(plan.ok, true);
      assert.equal(plan.source, 'heuristic');
      assert.equal(plan.picks.length, 1);
      assert.equal(plan.picks[0].eid01, '101');
    });

    it('即便要求關懷力，若場次已截止(N2)亦不應挑選', async () => {
      const plan = await planTargets({ enabled: false }, mockLectures, '幫我選偏鄉教育');
      assert.equal(plan.picks.length, 0);
    });
  });
});
