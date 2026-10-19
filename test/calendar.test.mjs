import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYmd,
  parseHm,
  weekdayLabel,
  extractLiteracies,
  eventFromRow,
  buildCalendar
} from '../src/calendar.mjs';

describe('calendar.mjs 核心時間與行事曆轉換測試', () => {
  describe('parseYmd 日期解析', () => {
    it('應正確解析標準西元年月日（斜線或橫線分隔）', () => {
      const d1 = parseYmd('2026/11/04');
      assert.ok(d1 instanceof Date);
      assert.equal(d1.getFullYear(), 2026);
      assert.equal(d1.getMonth(), 10);
      assert.equal(d1.getDate(), 4);

      const d2 = parseYmd('2026-10-19');
      assert.equal(d2.getFullYear(), 2026);
      assert.equal(d2.getMonth(), 9);
      assert.equal(d2.getDate(), 19);
    });

    it('應支援民國年轉換（民國 115 年 -> 西元 2026 年）', () => {
      const d = parseYmd('115/10/25');
      assert.ok(d instanceof Date);
      assert.equal(d.getFullYear(), 2026);
      assert.equal(d.getMonth(), 9);
      assert.equal(d.getDate(), 25);
    });

    it('無法解析的字串應回傳 null', () => {
      assert.equal(parseYmd(''), null);
      assert.equal(parseYmd('invalid-date'), null);
    });
  });

  describe('parseHm 時間解析', () => {
    it('應正確提取時與分並補零', () => {
      assert.equal(parseHm('9:30'), '09:30');
      assert.equal(parseHm('18:05'), '18:05');
      assert.equal(parseHm('14：20'), '14:20'); // 全形冒號
    });

    it('無效格式回傳空字串', () => {
      assert.equal(parseHm('無時間'), '');
      assert.equal(parseHm(null), '');
    });
  });

  describe('extractLiteracies 基本素養提取', () => {
    it('應正確自 chk4~chk7 旗標提取四大基本素養', () => {
      const row = { chk4: 'Y', chk5: 'N', chk6: 'Y', chk7: 'N' };
      const lits = extractLiteracies(row);
      assert.deepEqual(lits, ['健康力', '創新力']);
    });

    it('應相容 chk_flg 數值與布林旗標', () => {
      const row = { chk4_flg: 1, chk5_flg: true, chk6: 'y', chk7_flg: 0 };
      const lits = extractLiteracies(row);
      assert.deepEqual(lits, ['健康力', '關懷力', '創新力']);
    });
  });

  describe('eventFromRow 與 buildCalendar', () => {
    it('應正確建立事件物件並計算 startAt', () => {
      const row = {
        eid01: '1074',
        reseid: '1151074',
        rescnm: '基因遺傳與現代醫學',
        rescsd: '2026/11/04',
        stime: '18:30',
        etime: '20:30',
        chk4: 'Y'
      };
      const ev = eventFromRow(row);
      assert.ok(ev);
      assert.equal(ev.id, '1074');
      assert.equal(ev.title, '基因遺傳與現代醫學');
      assert.equal(ev.time, '18:30');
      assert.equal(ev.end, '20:30');
      assert.ok(ev.startAt > 0);
      assert.ok(ev.endAt > ev.startAt);
    });

    it('buildCalendar 應排除重複 eid01 並依時間排序', () => {
      const rows = [
        { eid01: '2', rescnm: '晚場', rescsd: '2026/11/04', stime: '19:00' },
        { eid01: '1', rescnm: '早場', rescsd: '2026/11/04', stime: '09:00' },
        { eid01: '2', rescnm: '重複列', rescsd: '2026/11/04', stime: '19:00' }
      ];
      const events = buildCalendar(rows);
      assert.equal(events.length, 2);
      assert.equal(events[0].eid01, '1');
      assert.equal(events[1].eid01, '2');
    });
  });
});
