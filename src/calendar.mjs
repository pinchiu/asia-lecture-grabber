/**
 * 已報名講座 → 行事曆事件。
 *
 * 校方清單列同時帶有：
 *   rescsd  課程日期（如 2026/11/04）
 *   stime / etime  開始／結束時間（如 18:30）
 *   resdat  顯示用字串（可能夾雜 HTML 與週幾）
 * 這裡以 rescsd + stime/etime 為主、字串解析為輔，
 * 產出「日期＋週幾＋時間」都齊全的事件，供前端月曆與清單使用。
 */

const WEEKDAY = ['週日', '週一', '週二', '週三', '週四', '週五', '週六'];
const pad = (n) => String(n).padStart(2, '0');

/** 解析 YYYY/MM/DD、YYYY-MM-DD 或 M/D，亦支援民國年；失敗回傳 null。 */
export function parseYmd(value) {
  const text = String(value || '');
  const full = /(\d{3,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/.exec(text);
  if (full) {
    let year = Number(full[1]);
    if (year < 1900) year += 1911; // 支援民國年轉換
    const date = new Date(year, Number(full[2]) - 1, Number(full[3]));
    return Number.isNaN(date.getTime()) ? null : date;
  }
  const short = /(\d{1,2})[\/.\-](\d{1,2})/.exec(text);
  if (short) {
    const month = Number(short[1]);
    const day = Number(short[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const date = new Date(new Date().getFullYear(), month - 1, day);
      return Number.isNaN(date.getTime()) ? null : date;
    }
  }
  return null;
}

/** 取出第一個 HH:MM；失敗回傳 ''。 */
export function parseHm(value) {
  const match = /(\d{1,2})\s*[:：]\s*(\d{2})/.exec(String(value || ''));
  if (!match) return '';
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  return `${pad(hour)}:${match[2]}`;
}

export function weekdayLabel(index) {
  return WEEKDAY[((index % 7) + 7) % 7];
}

const isChecked = (val) => val === 'Y' || val === 'y' || val === true || val === 1 || val === '1';

export function extractLiteracies(row) {
  const list = [];
  if (isChecked(row?.chk4) || isChecked(row?.chk4_flg)) list.push('健康力');
  if (isChecked(row?.chk5) || isChecked(row?.chk5_flg)) list.push('關懷力');
  if (isChecked(row?.chk6) || isChecked(row?.chk6_flg)) list.push('創新力');
  if (isChecked(row?.chk7) || isChecked(row?.chk7_flg)) list.push('卓越力');
  return list;
}

/** 把一列清單轉成事件；沒有可解析日期就回傳 null。 */
export function eventFromRow(row) {
  if (!row) return null;
  const date = parseYmd(row.rescsd) || parseYmd(row.resdat);
  if (!date) return null;

  const range = /(\d{1,2}:\d{2})\s*[-–~～]\s*(\d{1,2}:\d{2})/.exec(String(row.resdat || ''));
  const start = parseHm(row.stime) || parseHm(range?.[1]) || parseHm(row.resdat);
  const end = parseHm(row.etime) || parseHm(range?.[2]);

  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const weekday = date.getDay();

  const [sh, sm] = start ? start.split(':').map(Number) : [0, 0];
  const startAt = new Date(year, month - 1, day, sh, sm).getTime();
  let endAt = 0;
  if (end) {
    const [eh, em] = end.split(':').map(Number);
    endAt = new Date(year, month - 1, day, eh, em).getTime();
  }

  const literacies = extractLiteracies(row);

  return {
    id: String(row.eid01 || ''),
    eid01: String(row.eid01 || ''),
    reseid: String(row.reseid || ''),
    eid: String(row.eid || ''),
    title: String(row.rescnm || ''),
    speaker: String(row.teachm || ''),
    place: String(row.locale || ''),
    date: `${year}-${pad(month)}-${pad(day)}`,
    year,
    month,
    day,
    time: start,
    end,
    timeText: start ? (end ? `${start}–${end}` : start) : '全天',
    weekday,
    weekdayLabel: weekdayLabel(weekday),
    dateLabel: `${month}/${day}`,
    startAt,
    endAt,
    chk4: String(row.chk4 || ''),
    chk5: String(row.chk5 || ''),
    chk6: String(row.chk6 || ''),
    chk7: String(row.chk7 || ''),
    literacies
  };
}

/** 去除重複（同 eid01 只留一筆）並依開始時間排序。 */
export function buildCalendar(rows) {
  const byId = new Map();
  for (const row of rows || []) {
    const event = eventFromRow(row);
    if (!event) continue;
    const key = event.eid01 || `${event.date}-${event.title}`;
    if (!byId.has(key)) byId.set(key, event);
  }
  return [...byId.values()].sort((a, b) => a.startAt - b.startAt);
}

export function formatIcsDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function escapeIcsText(text) {
  return String(text || '')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n');
}

/** 依 RFC 5545 產生標準 iCalendar (.ics) 字串，供日曆訂閱與檔案匯出。 */
export function generateIcs(events = [], { calName = '亞洲大學通識講座' } = {}) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Asia University//Lecture Grabber//ZH-TW',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${escapeIcsText(calName)}`,
    'X-WR-TIMEZONE:Asia/Taipei'
  ];

  const nowStamp = formatIcsDate(new Date());

  for (const ev of events) {
    const start = ev.startAt ? new Date(ev.startAt) : new Date();
    const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 7_200_000);
    const lits = (ev.literacies || []).join('、') || '一般';
    const summary = `${ev.title || '校園講座'} [${lits}]`;
    const desc = `講者：${ev.speaker || '校方講師'}\n地點：${ev.place || '亞大校園'}\n基本素養：${lits}\n課程代號：${ev.eid01 || ''}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:au-lecture-${ev.eid01 || Math.random().toString(36).slice(2)}@asia.edu.tw`,
      `DTSTAMP:${nowStamp}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `LOCATION:${escapeIcsText(ev.place || '亞洲大學')}`,
      `DESCRIPTION:${escapeIcsText(desc)}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');
  return lines.join('\r\n') + '\r\n';
}
