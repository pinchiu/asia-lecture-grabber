/**
 * 可選的 AI 智慧層。
 *
 * 設計原則：
 *   - 沒有 API Key 時整個 App 功能完整，改用「本機規則」挑課；
 *   - 有 Key 時用 OpenAI 相容 /chat/completions 讓模型從講座清單挑選場次；
 *   - 模型只能從清單裡挑，回傳的 eid01 一律以本地清單驗證，杜絕幻覺；
 *   - 金鑰只存在於本機伺服器，不會送到瀏覽器。
 */

import { ApiError } from './asia.mjs';
import { DAY_LABELS, describeEntry, normalizeEntry } from './schedule.mjs';

export function isAiReady(aiConfig) {
  return Boolean(aiConfig && aiConfig.enabled && aiConfig.apiKey);
}

/** 給使用者看的狀態摘要（不含金鑰）。 */
export function aiSummary(aiConfig) {
  return {
    enabled: Boolean(aiConfig?.enabled),
    ready: isAiReady(aiConfig),
    model: aiConfig?.model || '',
    baseUrl: aiConfig?.baseUrl || ''
  };
}

/**
 * 依自然語言描述挑課。
 * @returns {{ok:boolean, source:'ai'|'heuristic', reply:string, picks:Array<{eid01:string,reason:string}>}}
 */
export async function planTargets(aiConfig, lectures, text) {
  if (!isAiReady(aiConfig)) {
    return heuristicPlan(lectures, text);
  }
  try {
    return await remotePlan(aiConfig, lectures, text);
  } catch (err) {
    const fallback = heuristicPlan(lectures, text);
    fallback.ok = false;
    fallback.reply = `AI 暫時無法使用（${err.message}），已改用本機規則：\n${fallback.reply}`;
    return fallback;
  }
}

async function remotePlan(aiConfig, lectures, text) {
  const catalog = lectures.slice(0, 150).map((row) => {
    const lits = [];
    if (row.chk4 === 'Y') lits.push('健康力');
    if (row.chk5 === 'Y') lits.push('關懷力');
    if (row.chk6 === 'Y') lits.push('創新力');
    if (row.chk7 === 'Y') lits.push('卓越力');
    return {
      eid01: row.eid01,
      code: row.reseid,
      name: row.rescnm,
      speaker: row.teachm,
      place: row.locale,
      date: row.rescsd,
      time: `${row.stime || ''}-${row.etime || ''}`,
      status: row.canapp,
      registrationPeriod: row.apptim,
      capacity: row.maxstd,
      registrants: row.selnum,
      organizer: row.sponsr,
      audience: row.object,
      basicLiteracy: lits.join('、') || '一般'
    };
  });

  const system = [
    '你是一位校園活動報名助理，負責依使用者需求，從「講座清單」挑選最適合報名的場次。',
    '規則：',
    '1. 只能從提供的清單挑選，eid01 必須是清單中存在的值，不得編造。',
    '2. 忽略狀態為 N2（已截止）的場次。',
    '3. 使用者的描述可能包含：主題關鍵字、日期範圍、時段、地點、主辦單位、場數上限、四大基本素養（健康力、關懷力、創新力、卓越力）。',
    '4. 若使用者沒有限制場數，最多挑 3 場，依符合程度排序。',
    '5. 請用繁體中文回覆。',
    '輸出必須是 JSON 物件，格式：',
    '{"reply":"一句話總結挑選結果", "picks":[{"eid01":"...","reason":"挑選理由，30字內"}]}'
  ].join('\n');

  const user = JSON.stringify({ request: text, lectures: catalog });

  const content = await chat(aiConfig, [
    { role: 'system', content: system },
    { role: 'user', content: user }
  ]);

  const data = parseJsonObject(content);
  const byId = new Map(lectures.map((row) => [row.eid01, row]));
  const maxPicks = clampNumber(aiConfig.maxTargets, 1, 10, 3);

  const picks = (Array.isArray(data.picks) ? data.picks : [])
    .map((pick) => ({
      eid01: String(pick?.eid01 ?? ''),
      reason: String(pick?.reason ?? '').slice(0, 80)
    }))
    .filter((pick) => byId.has(pick.eid01))
    .slice(0, maxPicks);

  return {
    ok: true,
    source: 'ai',
    reply: String(data.reply || '').slice(0, 300) || `已挑選 ${picks.length} 場。`,
    picks
  };
}

/** 呼叫 OpenAI 相容 chat/completions，回傳純文字內容。 */
async function chat(aiConfig, messages) {
  const base = String(aiConfig.baseUrl || 'https://api.openai.com/v1');
  const url = new URL('chat/completions', base.endsWith('/') ? base : base + '/');

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + aiConfig.apiKey
      },
      body: JSON.stringify({
        model: aiConfig.model || 'gpt-4o-mini',
        messages,
        temperature: 0.2,
        response_format: { type: 'json_object' }
      }),
      signal: AbortSignal.timeout(45_000)
    });
  } catch (err) {
    throw new ApiError(`連線 AI 服務失敗：${err?.message || err}`, { status: 0, transient: true });
  }

  const text = await res.text();
  if (!res.ok) {
    let detail = text.slice(0, 240);
    try {
      const parsed = JSON.parse(text);
      detail = parsed?.error?.message || parsed?.message || detail;
    } catch {
      /* 保持原始片段 */
    }
    throw new ApiError(`AI 服務回應 ${res.status}：${detail}`, { status: res.status });
  }

  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new ApiError('AI 服務回應不是合法 JSON', { status: 502 });
  }
  const content = body?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new ApiError('AI 服務沒有回傳內容', { status: 502 });
  }
  return content;
}

export function parseJsonObject(text) {
  const str = String(text || '').trim();
  try {
    const parsed = JSON.parse(str);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    const mdMatch = /```(?:json)?\s*([\s\S]*?)\s*```/i.exec(str);
    if (mdMatch) {
      try {
        const parsed = JSON.parse(mdMatch[1].trim());
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        /* 繼續嘗試括號裁切 */
      }
    }
    const start = str.indexOf('{');
    const end = str.lastIndexOf('}');
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(str.slice(start, end + 1));
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        /* 落空 */
      }
    }
    throw new ApiError('AI 回覆無法解析為 JSON', { status: 502 });
  }
}

/* ------------------------------------------------------------------ */
/* 無 AI 時的本機規則                                                    */
/* ------------------------------------------------------------------ */

const FILLER = /(幫我|請幫|請|我要|我想要|我想|想要|需要|幫|找|尋找|搜尋|挑|選|搶|報名|報|卡|講座|演講|課程|活動|場次|幾場|場|的|跟|與|和|還有|有關|相關|之類|那一類|類|大概|左右|最多|至少|可以|麻煩|一個|一直|然後|就|是|在|對|我|你|他|她|它)/g;
const SEPARATOR = /[、,，;；/或及\s]+/;

const EVENING = /(晚上|夜間|傍晚)/;
const AFTERNOON = /(下午)/;
const MORNING = /(早上|上午|清晨)/;
const NOON = /(中午)/;

function heuristicPlan(lectures, text) {
  const src = String(text || '');
  const keywords = extractKeywords(src);
  const { days, months } = extractDates(src);
  const wants = {
    evening: EVENING.test(src),
    afternoon: AFTERNOON.test(src),
    morning: MORNING.test(src),
    noon: NOON.test(src)
  };
  const wantsLiteracy = {
    health: /(健康|健康力)/.test(src),
    care: /(關懷|關懷力)/.test(src),
    innovation: /(創新|創新力)/.test(src),
    excellence: /(卓越|卓越力)/.test(src)
  };
  const hasLiteracyFilter = wantsLiteracy.health || wantsLiteracy.care || wantsLiteracy.innovation || wantsLiteracy.excellence;
  const hasTimeFilter = wants.evening || wants.afternoon || wants.morning || wants.noon;
  const hasDateFilter = days.length > 0 || months.length > 0;
  const limit = clampNumber(/(\d+)\s*場/.exec(src)?.[1], 1, 5, 3);

  const scored = [];
  for (const row of lectures) {
    if (row.canapp === 'N2') continue;

    const hay = [row.rescnm, row.teachm, row.sponsr, row.locale, row.object ?? '']
      .join(' ')
      .toLowerCase();

    let score = 0;
    let matched = 0;
    for (const kw of keywords) {
      if (hay.includes(kw.toLowerCase())) {
        score += 3;
        matched += 1;
      }
    }
    if (keywords.length && matched === 0 && !hasLiteracyFilter) continue;

    if (hasLiteracyFilter) {
      let litHit = false;
      if (wantsLiteracy.health && row.chk4 === 'Y') { score += 4; litHit = true; }
      if (wantsLiteracy.care && row.chk5 === 'Y') { score += 4; litHit = true; }
      if (wantsLiteracy.innovation && row.chk6 === 'Y') { score += 4; litHit = true; }
      if (wantsLiteracy.excellence && row.chk7 === 'Y') { score += 4; litHit = true; }
      if (!litHit && !matched && !hasDateFilter) continue;
    }

    if (days.length) {
      const date = parseDate(row.rescsd);
      if (!date || !days.some((d) => sameDay(d, date))) continue;
      score += 2;
    } else if (months.length) {
      const date = parseDate(row.rescsd);
      if (!date || !months.includes(date.getMonth() + 1)) continue;
      score += 1;
    }

    if (hasTimeFilter) {
      const hour = hourOf(row.stime);
      let hit = false;
      if (wants.evening && hour >= 17) hit = true;
      if (wants.afternoon && hour >= 12 && hour < 17) hit = true;
      if (wants.morning && hour < 12) hit = true;
      if (wants.noon && hour === 12) hit = true;
      if (!hit) continue;
      score += 1;
    }

    scored.push({ row, score });
  }

  if (!keywords.length && !hasDateFilter && !hasTimeFilter && !hasLiteracyFilter) {
    return {
      ok: true,
      source: 'heuristic',
      reply: '描述太模糊，無法判斷。可以補充主題關鍵字、四大素養、日期或時段，例如：「健康力或創新力、11 月晚上，最多 2 場」。',
      picks: []
    };
  }

  scored.sort((a, b) => b.score - a.score || String(a.row.rescsd).localeCompare(String(b.row.rescsd)));
  const picks = scored.slice(0, limit).map((item) => ({
    eid01: item.row.eid01,
    reason: [
      keywords.length ? `關鍵字：${keywords.slice(0, 3).join('/')}` : '',
      days.length ? `日期符合：${days.map(formatDay).join('、')}` : months.length ? `月份：${months.join('、')} 月` : ''
    ]
      .filter(Boolean)
      .join('；')
  }));

  return {
    ok: true,
    source: 'heuristic',
    reply: picks.length
      ? `依描述挑出 ${picks.length} 場（本機規則篩選，未使用 AI）。`
      : '沒有找到符合條件的講座，換個描述試試。',
    picks
  };
}

function extractKeywords(text) {
  const cleaned = String(text || '')
    .replace(FILLER, ' ')
    .replace(/[0-9]{4}[\/-][0-9]{1,2}[\/-][0-9]{1,2}/g, ' ')
    .replace(/[0-9]{1,2}\s*月/g, ' ')
    .replace(/[0-9]{1,2}\s*[日號]/g, ' ');
  const tokens = cleaned
    .split(SEPARATOR)
    .map((token) => token.trim())
    .filter((token) => token.length >= 2 && !/^[0-9]+$/.test(token));
  return [...new Set(tokens)].slice(0, 6);
}

function extractDates(text) {
  const src = String(text || '');
  const days = [];
  const months = [];

  for (const raw of src.match(/\d{4}[\/-]\d{1,2}[\/-]\d{1,2}/g) || []) {
    const [y, m, d] = raw.split(/[\/-]/).map(Number);
    const date = new Date(y, m - 1, d);
    if (!Number.isNaN(date.getTime())) days.push(date);
  }

  const year = new Date().getFullYear();
  for (const raw of src.match(/(\d{1,2})\s*月\s*(\d{1,2})?\s*[日號]?/g) || []) {
    const numbers = raw.match(/\d+/g) || [];
    const month = Number(numbers[0]);
    if (!(month >= 1 && month <= 12)) continue;
    if (numbers[1]) days.push(new Date(year, month - 1, Number(numbers[1])));
    else months.push(month);
  }

  return { days: days.slice(0, 4), months: [...new Set(months)].slice(0, 4) };
}

function parseDate(value) {
  const m = /(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/.exec(String(value || ''));
  if (!m) return null;
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function hourOf(value) {
  const m = /^(\d{1,2})/.exec(String(value || ''));
  return m ? Number(m[1]) : -1;
}

function formatDay(date) {
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function clampNumber(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/* ------------------------------------------------------------------ */
/* 代理：一句話 → 挑課 ＋ 排程                                          */
/* ------------------------------------------------------------------ */

/**
 * 代理規劃：解析使用者的自然語言，回傳「要搶哪些課」＋「什麼時候搶」。
 * 有 AI 時交給模型；沒有時用本機規則。回傳的 eid01 一律以本地清單驗證。
 * @returns {{ok:boolean, source:'ai'|'heuristic', reply:string,
 *   picks:Array<{eid01:string,reason:string}>, schedule:object|null, notes:string[]}}
 */
export async function planAgent(aiConfig, lectures, text, now = Date.now()) {
  if (!isAiReady(aiConfig)) return heuristicAgent(lectures, text, now);
  try {
    return await remoteAgent(aiConfig, lectures, text, now);
  } catch (err) {
    const fallback = heuristicAgent(lectures, text, now);
    fallback.ok = false;
    fallback.reply = `AI 暫時無法使用（${err.message}），已改用本機規則。\n${fallback.reply}`;
    return fallback;
  }
}

const AGENT_SYSTEM = [
  '你是校園講座「自動報名助手」的排程代理。使用者用一句話描述想搶的講座與時間。',
  '只回傳一個 JSON 物件，不要有其他文字，格式：',
  '{"reply":"給使用者看的一句話總結",',
  ' "picks":[{"eid01":"...","reason":"30字內"}],',
  ' "schedule": null 或 {',
  '   "mode":"open|at|window",',
  '   "label":"8字內中文短標籤",',
  '   "startAt":"YYYY-MM-DD HH:MM",',
  '   "stopAt":"YYYY-MM-DD HH:MM 或 空字串",',
  '   "days":[0,1,2,3,4,5,6],',
  '   "startTime":"HH:MM","stopTime":"HH:MM",',
  '   "leadSec":15',
  ' }}',
  '規則：',
  '1. picks 只能從清單挑，eid01 必須存在，不得編造；忽略狀態 N2（已截止）。',
  '2. 「開放瞬間／開搶前 N 秒」→ mode=open（此時只需 leadSec）。',
  '3. 指定某個日期時間（例如「明天晚上八點」）→ mode=at，startAt 用本地時間字串。',
  '4. 「每天／每週幾 ＋ 時段」→ mode=window，填 days/startTime/stopTime。',
  '5. 沒有提到任何時間 → schedule 為 null。',
  '6. 一律使用繁體中文。'
].join('\n');

async function remoteAgent(aiConfig, lectures, text, now) {
  const catalog = lectures.slice(0, 150).map((row) => ({
    eid01: row.eid01,
    code: row.reseid,
    name: row.rescnm,
    speaker: row.teachm,
    place: row.locale,
    date: row.rescsd,
    time: `${row.stime || ''}-${row.etime || ''}`,
    status: row.canapp,
    registrationPeriod: row.apptim,
    organizer: row.sponsr,
    audience: row.object
  }));

  const local = new Date(now);
  const nowInfo = {
    local: `${local.getFullYear()}-${pad2(local.getMonth() + 1)}-${pad2(local.getDate())} ${pad2(local.getHours())}:${pad2(local.getMinutes())}`,
    weekday: DAY_LABELS[local.getDay()],
    epochMs: now
  };

  const content = await chat(aiConfig, [
    { role: 'system', content: AGENT_SYSTEM },
    { role: 'user', content: JSON.stringify({ now: nowInfo, request: text, lectures: catalog }) }
  ]);

  const data = parseJsonObject(content);
  const byId = new Map(lectures.map((row) => [row.eid01, row]));
  const maxPicks = clampNumber(aiConfig.maxTargets, 1, 10, 3);

  const picks = (Array.isArray(data.picks) ? data.picks : [])
    .map((pick) => ({ eid01: String(pick?.eid01 ?? ''), reason: String(pick?.reason ?? '').slice(0, 80) }))
    .filter((pick) => byId.has(pick.eid01))
    .slice(0, maxPicks);

  const schedule = sanitizeSchedule(data.schedule);

  return {
    ok: true,
    source: 'ai',
    reply: String(data.reply || '').slice(0, 400) || describePlan(picks, schedule, lectures),
    picks,
    schedule,
    notes: []
  };
}

function heuristicAgent(lectures, text, now) {
  const plan = heuristicPlan(lectures, text);
  const schedule = parseScheduleText(text, now);
  return {
    ok: true,
    source: 'heuristic',
    reply: describePlan(plan.picks, schedule, lectures) || plan.reply,
    picks: plan.picks,
    schedule,
    notes: []
  };
}

function describePlan(picks, schedule, lectures) {
  const parts = [];
  if (schedule) {
    try {
      parts.push('排程：' + describeEntry(normalizeEntry(schedule)));
    } catch {
      /* 忽略描述失敗 */
    }
  }
  const names = (picks || []).map((pick) => lectures.find((row) => row.eid01 === pick.eid01)?.rescnm || pick.eid01);
  if (names.length) parts.push('目標：' + names.join('、'));
  if (!parts.length) parts.push('沒有解析到明確的時間或講座，請補充時間或主題。');
  return parts.join('\n');
}

/** 將模型／規則產出的排程正規化；不合法回傳 null。 */
export function sanitizeSchedule(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const mode = ['open', 'at', 'window'].includes(raw.mode) ? raw.mode : null;
  if (!mode) return null;
  const out = { mode, label: String(raw.label || '').slice(0, 48) };

  if (mode === 'open') {
    out.leadSec = clampNumber(raw.leadSec, 0, 600, 15);
    return out;
  }

  if (mode === 'at') {
    out.startAt = toStamp(raw.startAt ?? raw.startLocal ?? raw.startAtISO);
    out.stopAt = toStamp(raw.stopAt ?? raw.stopLocal ?? raw.stopAtISO);
    if (!out.startAt) return null;
    if (out.stopAt && out.stopAt <= out.startAt) out.stopAt = 0;
    return out;
  }

  const days = Array.isArray(raw.days)
    ? [...new Set(raw.days.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))]
    : [1, 2, 3, 4, 5];
  out.days = days.length ? days.sort((a, b) => a - b) : [1, 2, 3, 4, 5];
  out.startTime = /^\d{1,2}:\d{2}$/.test(String(raw.startTime || '')) ? String(raw.startTime) : '09:00';
  out.stopTime = /^\d{1,2}:\d{2}$/.test(String(raw.stopTime || '')) ? String(raw.stopTime) : '18:00';
  return out;
}

function toStamp(value) {
  if (value === null || value === undefined || value === '') return 0;
  if (typeof value === 'number') return value > 1_000_000_000_000 ? Math.round(value) : 0;
  const text = String(value).trim();
  if (/^\d{13}$/.test(text)) return Number(text);
  if (/^\d{10}$/.test(text)) return Number(text) * 1000;
  const m = /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2}))?/.exec(text);
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0)).getTime();
  }
  return 0;
}

/* ---- 本機規則：把一句話拆成排程 ---- */

const PERIOD_ALT =
  '凌晨|清晨|早上|上午|早晨|中午|正午|下午|傍晚|黃昏|晚上|今夜|今晚|夜晚|晚';

function applyPeriod(period, hour) {
  if (!period) return hour;
  if (/凌晨|清晨|早上|上午|早晨/.test(period)) return hour === 12 ? 0 : hour;
  if (/中午|正午/.test(period)) return hour >= 1 && hour <= 5 ? hour + 12 : hour;
  if (/下午|傍晚|黃昏|晚上|今夜|今晚|夜晚|晚/.test(period)) return hour === 12 ? 0 : hour < 12 ? hour + 12 : hour;
  return hour;
}

const CN_DIGITS = { 零: 0, 一: 1, 二: 2, 兩: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };

function cnNumber(text) {
  if (text === '十') return 10;
  if (text[0] === '十') return 10 + (CN_DIGITS[text[1]] ?? 0);
  if (text.includes('十')) {
    const [tens, ones] = text.split('十');
    return (CN_DIGITS[tens] ?? 0) * 10 + (ones ? (CN_DIGITS[ones] ?? 0) : 0);
  }
  let value = 0;
  for (const ch of text) value = value * 10 + (CN_DIGITS[ch] ?? 0);
  return value;
}

function normalizeDigits(text) {
  return String(text || '')
    .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/[：]/g, ':')
    .replace(/[－—–~～]/g, '-')
    .replace(/點半/g, '點30')
    .replace(/時半/g, '時30')
    .replace(/([一二三四五六七八九十兩]{1,3})\s*(?=[點時])/g, (m) => String(cnNumber(m)))
    .replace(/([點時])\s*([一二三四五六七八九十]{1,3})\s*(?=[分到至]|\d|$)/g, (m, marker, num) => marker + String(cnNumber(num)));
}

function findTimes(src) {
  const rx = new RegExp(
    `(${PERIOD_ALT})?\\s*(\\d{1,2})\\s*(?:[:：]\\s*(\\d{1,2})|點\\s*(\\d{1,2})?|時\\s*(\\d{1,2})?)`,
    'g'
  );
  const out = [];
  let m;
  while ((m = rx.exec(src))) {
    const token = m[1] || '';
    const rawHour = Number(m[2]);
    const minute = Number(m[3] ?? m[4] ?? m[5] ?? 0);
    if (rawHour > 24 || minute > 59) continue;
    out.push({
      rawHour,
      minute,
      period: token,
      hasPeriod: Boolean(token),
      hour: applyPeriod(token, rawHour),
      index: m.index,
      length: m[0].length
    });
  }
  return out;
}

function findRange(src, times) {
  for (let i = 0; i < times.length - 1; i += 1) {
    const a = times[i];
    const b = times[i + 1];
    const between = src.slice(a.index + a.length, b.index);
    if (/(到|至|-)/.test(between)) {
      if (!b.hasPeriod && a.hasPeriod) b.hour = applyPeriod(a.period, b.rawHour);
      return [a, b];
    }
  }
  return null;
}

function findDays(src) {
  const map = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 日: 0, 天: 0 };
  const rng = /(?:週|周|星期|禮拜)([一二三四五六日天])\s*(?:到|至|-)\s*(?:週|周|星期|禮拜)?([一二三四五六日天])/.exec(src);
  if (rng) {
    const start = map[rng[1]];
    const end = map[rng[2]];
    const out = [];
    let cur = start;
    for (let i = 0; i < 7; i += 1) {
      out.push(cur);
      if (cur === end) break;
      cur = (cur + 1) % 7;
    }
    return out.sort((a, b) => a - b);
  }
  if (/每天|每日|天天|每一天|每晚/.test(src)) return [0, 1, 2, 3, 4, 5, 6];
  if (/平日|上班日/.test(src)) return [1, 2, 3, 4, 5];
  if (/週末|周末|假日/.test(src)) return [0, 6];

  const found = new Set();
  const rx = /(?:週|周|星期|禮拜)([一二三四五六日天])/g;
  let m;
  while ((m = rx.exec(src))) found.add(map[m[1]]);
  return found.size ? [...found].sort((a, b) => a - b) : null;
}

function findDate(src, now) {
  const base = new Date(now);
  const ymd = (y, mo, d) => new Date(y, mo - 1, d);

  if (/今天|今日|今晚/.test(src)) return { date: startOfDay(base) };
  const rel = /(大後天|後天|明天|明日)/.exec(src);
  if (rel) {
    const offset = rel[1] === '後天' ? 2 : rel[1] === '大後天' ? 3 : 1;
    const date = new Date(base);
    date.setDate(date.getDate() + offset);
    return { date: startOfDay(date) };
  }
  const full = /(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/.exec(src);
  if (full) return { date: ymd(Number(full[1]), Number(full[2]), Number(full[3])) };
  const md = /(\d{1,2})\s*月\s*(\d{1,2})\s*[日號]/.exec(src);
  if (md) return { date: ymd(base.getFullYear(), Number(md[1]), Number(md[2])) };
  const slash = /(?:^|[^\d:])(\d{1,2})\s*\/\s*(\d{1,2})(?!\d)/.exec(src);
  if (slash) {
    const mo = Number(slash[1]);
    const da = Number(slash[2]);
    if (mo >= 1 && mo <= 12 && da >= 1 && da <= 31) return { date: ymd(base.getFullYear(), mo, da) };
  }
  return null;
}

function startOfDay(date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function atTime(date, time) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), time.hour, time.minute).getTime();
}

function hhmm(time) {
  return `${pad2(time.hour % 24)}:${pad2(time.minute)}`;
}

function findLead(src) {
  const m = /(開放|開搶|開始報名|報名開始)\s*(?:前|提前)?\s*(\d+)\s*(秒|分鐘|分)/.exec(src);
  if (m) {
    const n = Number(m[2]);
    return { leadSec: m[3] === '秒' ? n : n * 60 };
  }
  if (/開放瞬間|一開放|開搶瞬間|開放當下/.test(src)) return { leadSec: 5 };
  return null;
}

/**
 * 本機規則：把一句話解析成排程物件（無 API Key 時使用）。
 * @returns {object|null} 形如 {mode,...}，或 null。
 */
export function parseScheduleText(text, now = Date.now()) {
  const src = normalizeDigits(text);
  const lead = findLead(src);
  if (lead) return { mode: 'open', label: '開放搶課', leadSec: lead.leadSec };

  const times = findTimes(src);
  const range = findRange(src, times);
  const date = findDate(src, now);
  const days = findDays(src);

  if (date && times.length) {
    const startAt = atTime(date.date, times[0]);
    let stopAt = range ? atTime(date.date, range[1]) : 0;
    if (stopAt && stopAt <= startAt) stopAt += 86_400_000;
    return { mode: 'at', startAt, stopAt };
  }

  if (days && times.length) {
    const start = range ? range[0] : times[0];
    const stop = range ? range[1] : { hour: start.hour + 2, minute: 0 };
    return { mode: 'window', days, startTime: hhmm(start), stopTime: hhmm(stop) };
  }

  if (times.length) {
    let startAt = atTime(new Date(now), times[0]);
    if (startAt <= now) startAt += 86_400_000;
    let stopAt = range ? atTime(new Date(now), range[1]) : 0;
    if (stopAt && stopAt <= startAt) stopAt += 86_400_000;
    return { mode: 'at', startAt, stopAt };
  }

  return null;
}

function pad2(value) {
  return String(value).padStart(2, '0');
}
