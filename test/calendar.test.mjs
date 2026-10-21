import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseYmd,
  parseHm,
  weekdayLabel,
  extractLiteracies,
  eventFromRow,
  buildCalendar,
  formatIcsDate,
  generateIcs,
  checkConflict,
  findConflicts,
  formatCapacity
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

  describe('generateIcs 行事曆匯出與格式化', () => {
    it('formatIcsDate 應產出 RFC 5545 標準 UTC 格式', () => {
      const d = new Date(Date.UTC(2026, 9, 21, 14, 30, 0));
      const str = formatIcsDate(d);
      assert.equal(str, '20261021T143000Z');
    });

    it('generateIcs 應包含 VCALENDAR 標頭、時區與 VEVENT 事件', () => {
      const mockEvents = [
        {
          id: '101',
          eid01: '101',
          title: '現代生物技術, 與生活',
          speaker: '林教授; 專家',
          place: 'A101教室',
          startAt: new Date(2026, 10, 5, 13, 0).getTime(),
          endAt: new Date(2026, 10, 5, 15, 0).getTime(),
          literacies: ['創新力']
        }
      ];

      const ics = generateIcs(mockEvents);
      assert.ok(ics.includes('BEGIN:VCALENDAR'));
      assert.ok(ics.includes('PRODID:-//Asia University//Lecture Grabber//ZH-TW'));
      assert.ok(ics.includes('X-WR-CALNAME:亞洲大學通識講座'));
      assert.ok(ics.includes('BEGIN:VEVENT'));
      assert.ok(ics.includes('UID:au-lecture-101@asia.edu.tw'));
      // 驗證特殊字元跳脫
      assert.ok(ics.includes('現代生物技術\\, 與生活'));
      assert.ok(ics.includes('林教授\\; 專家'));
      assert.ok(ics.includes('END:VEVENT'));
      assert.ok(ics.includes('END:VCALENDAR'));
    });
  });

  describe('checkConflict 與 findConflicts 衝堂判定測試', () => {
    it('相鄰時段（如 10:00~12:00 與 12:00~14:00）不應判定為衝堂', () => {
      const a = { eid01: '101', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' };
      const b = { eid01: '102', rescsd: '2026/11/04', stime: '12:00', etime: '14:00' };
      assert.equal(checkConflict(a, b), false);
    });

    it('重疊時段（如 10:00~12:00 與 11:30~13:30）應判定為衝堂', () => {
      const a = { eid01: '101', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' };
      const b = { eid01: '102', rescsd: '2026/11/04', stime: '11:30', etime: '13:30' };
      assert.equal(checkConflict(a, b), true);
    });

    it('同課程代碼（同場次）不應視為衝堂', () => {
      const a = { eid01: '101', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' };
      const b = { eid01: '101', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' };
      assert.equal(checkConflict(a, b), false);
    });

    it('不同日期之重疊時間不應判定為衝堂', () => {
      const a = { eid01: '101', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' };
      const b = { eid01: '102', rescsd: '2026/11/05', stime: '10:00', etime: '12:00' };
      assert.equal(checkConflict(a, b), false);
    });

    it('findConflicts 應回傳所有衝堂之代號集合', () => {
      const list = [
        { eid01: 'A', rescsd: '2026/11/04', stime: '10:00', etime: '12:00' },
        { eid01: 'B', rescsd: '2026/11/04', stime: '11:00', etime: '13:00' },
        { eid01: 'C', rescsd: '2026/11/04', stime: '14:00', etime: '16:00' }
      ];
      const conflicts = findConflicts(list);
      assert.equal(conflicts.size, 2);
      assert.ok(conflicts.has('A'));
      assert.ok(conflicts.has('B'));
      assert.ok(!conflicts.has('C'));
    });
  });

  describe('formatCapacity 已選人數與名額格式化測試', () => {
    it('應直接保留並清理 appnum 中的字串與 HTML 標籤', () => {
      assert.equal(formatCapacity({ appnum: '35/50' }), '35/50');
      assert.equal(formatCapacity({ appnum: '<font color=red>120/120</font>' }), '120/120');
      assert.equal(formatCapacity({ appnum: '15<br/>15' }), '15 15');
    });

    it('appnum 為空時應利用 selnum 與 webstd 組合名額比例', () => {
      assert.equal(formatCapacity({ selnum: 45, webstd: 60 }), '45/60');
      assert.equal(formatCapacity({ cnt_10: 1, maxstd: 100 }), '1/100');
    });

    it('無任何名額資料時應回傳橫槓', () => {
      assert.equal(formatCapacity({}), '-');
      assert.equal(formatCapacity(null), '-');
    });
  });
});
