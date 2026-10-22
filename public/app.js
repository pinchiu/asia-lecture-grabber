/* 亞洲大學講座自動報名助手與畢業素養門檻追蹤 — 前端邏輯（vanilla JS，無外部建置依賴） */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const STATUS_LABEL = {
  Y: '可報名',
  F: '已額滿',
  N1: '未開放',
  N2: '已截止',
  C: '現場報名',
  D: '其他方式'
};

const I18N = {
  zh: {
    brand_title: '亞洲大學講座助手',
    brand_sub_badge: '四力門檻',
    server_connecting: '本機服務 · 連線中…',
    server_connected: '本機服務 · ',
    tab_lectures: '講座情報',
    tab_targets: '搶課排程',
    tab_calendar: '個人行程',
    tab_settings: '系統設定',
    pill_not_logged_in: '未登入',
    pill_logged_in: '已登入：',
    pill_standby: '待機中',
    pill_running: '搶課中',
    pill_error: '待機（錯誤）',
    pill_no_schedule: '無排程',
    pill_sched_running: '排程執行中',
    pill_sched_disabled: '排程已關閉',
    btn_pwa: '安裝 App',
    btn_start: '開始搶課',
    btn_stop: '停止',
    lang_btn: 'EN',

    grad_tag: '畢業指標',
    grad_title: '通識講座畢業門檻進度',
    grad_desc: '在學期間必須累積至少 <b>8 場次</b>，且四大基本素養各至少符合 2 次：健康力 ≥ 2、關懷力 ≥ 2、創新力 ≥ 2、卓越力 ≥ 2。',
    btn_recommend: '智慧推薦補齊缺額 ›',
    btn_past_records: '歷年累計補登',
    btn_view_calendar: '查看個人行程 ›',
    grad_fulfilled: '通識講座畢業門檻：已達成',
    grad_total_title: '總累積場次',
    grad_threshold_sub: '畢業門檻底限 8 場',
    grad_met: '已達標',
    grad_met_total: '已達標 (≥8)',
    grad_need_times: '尚缺 {n} 次',
    grad_need_lectures: '尚缺 {n} 場',
    filter_lit_btn: '只看{lit}講座 ›',

    hall_title: '講座情報大廳',
    search_placeholder: '搜尋課程 / 講者 / 地點',
    lit_filter_all: '全部基本素養',
    lit_filter_none: '一般（無素養標示）',
    status_filter_all: '全部報名狀態',
    status_filter_y: '可報名（目前能選的課程）',
    status_filter_n1: '未開放',
    status_filter_n2: '已截止',
    status_filter_f: '已額滿',
    status_filter_other: '現場 / 其他方式',
    show_full: '顯示已額滿',
    missing_only: '只看我缺少的素養',
    btn_refresh: '重新整理',
    manual_tag: '快捷操作',
    manual_code_placeholder: '直接輸入課程代號（例如 1151074）',
    btn_manual_register: '手動報名',
    btn_manual_cancel: '取消報名',
    manual_hint: '純本機直呼校方 API，自動帶入身份驗證，後端不查圖形驗證碼，全程不需 AI。',

    th_status: '狀態',
    th_title: '課程名稱 / 主辦單位',
    th_lit: '基本素養 (四力)',
    th_speaker: '演講者 / 主持人',
    th_time: '活動時間',
    th_place: '活動地點',
    th_capacity: '報名人數',
    th_reg_period: '報名期間',
    th_action: '操作',

    btn_add_target: '＋加入目標',
    btn_waitlist_target: '＋候補搶票',
    btn_in_queue: '已在監控',
    btn_registered: '已報名',
    btn_cancel: '取消報名',
    conflict_warn: '時段衝突',
    conflict_title: '與已報名【{title}】時間重疊',

    telem_engine_state: '引擎運作狀態',
    telem_state_standby: '待命',
    telem_state_polling: '輪詢中',
    telem_state_burst: '爆速中',
    telem_state_grabbing: '搶課中',
    telem_interval: '輪詢間隔',
    telem_targets: '監控目標數',
    telem_countdown: '最近開放報名倒數',
    telem_no_open_target: '無待開放目標',
    targets_title: '我的搶課目標',
    btn_go_hall: '＋ 前往大廳挑選',
    btn_clear_finished: '清除已完成',
    btn_remove: '移除',

    sched_title: '排程定時自動啟動',
    sched_enable: '啟用排程功能',
    sched_trigger_type: '觸發方式',
    sched_mode_open: '開放瞬間（依報名開放時間）',
    sched_mode_at: '指定日期時間（單次）',
    sched_mode_window: '每週固定時段',
    sched_add: '＋ 新增排程',

    cal_title: '我的行事曆與已報名行程',
    btn_export_ics: '匯出行事曆 (.ics)',
    btn_copy_ics_url: '訂閱網址',
    btn_copy_schedule: '複製課表',
    btn_today: '今天',
    upcoming_title: '近期已報名場次',
    upcoming_hint: '可直接在此點擊取消報名（退選）',

    settings_lang_title: '系統語言偏好',
    settings_lang_label: '選擇顯示語言 (Interface Language)',
    sec_account_title: '學生登入與身份驗證',
    label_username: '學號',
    label_password: '密碼',
    label_idlast4: '身分證字號末四碼',
    label_remember: '記住帳密（以純文字存於本機 data/config.json）',
    btn_login: '登入校方系統並驗證身份',
    sec_settings_title: '搶課設定與無障礙需求',
    label_interval: '監控頻率（秒／次）',
    label_bfree: '無障礙空間需求（報名預設值）',
    bfree_n: '無需求／否（通常選此項）',
    bfree_y: '有需求／是',
    label_sound: '搶到時播放提示音',
    label_notify: '搶到時發送桌面通知',
    label_stop_done: '目標全部完成後自動停止',
    btn_save_settings: '儲存設定',
    sec_ai_title: '語言模型連線設定',
    btn_save_ai: '儲存 AI 設定',
    sec_logs_title: '系統執行紀錄',
    btn_clear_log: '清空紀錄',
    footnote: '僅供個人學術與自主報名使用。系統以約 2.5 秒禮貌間隔輪詢，避免對校方系統產生負擔。請遵守學校規範。',

    lit_health: '健康力',
    lit_care: '關懷力',
    lit_innovation: '創新力',
    lit_excellence: '卓越力',
    lit_none: '一般',

    st_Y: '可報名',
    st_F: '已額滿',
    st_N1: '未開放',
    st_N2: '已截止',
    st_C: '現場報名',
    st_D: '其他方式',

    day_0: '日', day_1: '一', day_2: '二', day_3: '三', day_4: '四', day_5: '五', day_6: '六'
  },
  en: {
    brand_title: 'AU Lecture Grabber',
    brand_sub_badge: '4 Literacies',
    server_connecting: 'Local Service · Connecting…',
    server_connected: 'Local Service · ',
    tab_lectures: 'Lectures',
    tab_targets: 'Targets',
    tab_calendar: 'Schedule',
    tab_settings: 'Settings',
    pill_not_logged_in: 'Not Logged In',
    pill_logged_in: 'Logged in: ',
    pill_standby: 'Standby',
    pill_running: 'Grabbing',
    pill_error: 'Standby (Error)',
    pill_no_schedule: 'No Schedule',
    pill_sched_running: 'Schedule Running',
    pill_sched_disabled: 'Schedule Disabled',
    btn_pwa: 'Install App',
    btn_start: 'Start Engine',
    btn_stop: 'Stop',
    lang_btn: '中文',

    grad_tag: 'Graduation Metric',
    grad_title: 'General Lecture Graduation Progress',
    grad_desc: 'Requires at least <b>8 lectures</b> total and >= 2 in each of the 4 literacies: Health >= 2, Care >= 2, Innovation >= 2, Excellence >= 2.',
    btn_recommend: 'Smart Recommendation ›',
    btn_past_records: 'Past Credits',
    btn_view_calendar: 'View My Schedule ›',
    grad_fulfilled: 'Graduation Requirement: Fulfilled',
    grad_total_title: 'Total Lectures',
    grad_threshold_sub: 'Minimum 8 lectures required',
    grad_met: 'Met',
    grad_met_total: 'Met (≥8)',
    grad_need_times: 'Need {n}',
    grad_need_lectures: 'Need {n}',
    filter_lit_btn: 'Only {lit} ›',

    hall_title: 'Lecture Hall',
    search_placeholder: 'Search course, speaker, or venue',
    lit_filter_all: 'All Literacies',
    lit_filter_none: 'General (No Literacy Tag)',
    status_filter_all: 'All Statuses',
    status_filter_y: 'Open (Currently Available)',
    status_filter_n1: 'Upcoming',
    status_filter_n2: 'Closed',
    status_filter_f: 'Full',
    status_filter_other: 'On-site / Other',
    show_full: 'Show Full',
    missing_only: 'Only Missing Literacies',
    btn_refresh: 'Refresh',
    manual_tag: 'Quick Action',
    manual_code_placeholder: 'Enter course code directly (e.g. 1151074)',
    btn_manual_register: 'Register',
    btn_manual_cancel: 'Drop',
    manual_hint: 'Direct API call with student auth. Zero CAPTCHA latency, completely AI-independent.',

    th_status: 'Status',
    th_title: 'Course Name / Organizer',
    th_lit: 'Literacies (4 Skills)',
    th_speaker: 'Speaker / Host',
    th_time: 'Event Time',
    th_place: 'Venue',
    th_capacity: 'Capacity',
    th_reg_period: 'Registration Period',
    th_action: 'Action',

    btn_add_target: '＋ Add Target',
    btn_waitlist_target: '＋ Waitlist',
    btn_in_queue: 'In Queue',
    btn_registered: 'Registered',
    btn_cancel: 'Drop',
    conflict_warn: 'Time Conflict',
    conflict_title: 'Overlaps with registered lecture [{title}]',

    telem_engine_state: 'Engine State',
    telem_state_standby: 'Standby',
    telem_state_polling: 'Polling',
    telem_state_burst: 'Burst',
    telem_state_grabbing: 'Grabbing',
    telem_interval: 'Polling Interval',
    telem_targets: 'Monitored Targets',
    telem_countdown: 'Next Opening In',
    telem_no_open_target: 'No upcoming target',
    targets_title: 'My Grab Targets',
    btn_go_hall: '＋ Browse Lectures',
    btn_clear_finished: 'Clear Finished',
    btn_remove: 'Remove',

    sched_title: 'Scheduled Auto-Trigger',
    sched_enable: 'Enable Scheduler',
    sched_trigger_type: 'Trigger Mode',
    sched_mode_open: 'At Opening (Based on start time)',
    sched_mode_at: 'Specific Date & Time (One-time)',
    sched_mode_window: 'Weekly Time Window',
    sched_add: '＋ Add Schedule',

    cal_title: 'My Schedule & Registered Events',
    btn_export_ics: 'Export iCal (.ics)',
    btn_copy_ics_url: 'Subscribe URL',
    btn_copy_schedule: 'Copy Schedule',
    btn_today: 'Today',
    upcoming_title: 'Upcoming Registered Lectures',
    upcoming_hint: 'Click cancel to drop registration directly',

    settings_lang_title: 'Interface Language',
    settings_lang_label: 'Select Display Language',
    sec_account_title: 'Student Login & Verification',
    label_username: 'Student ID',
    label_password: 'Password',
    label_idlast4: 'ID Last 4 Digits',
    label_remember: 'Remember Credentials (Plaintext in local data/config.json)',
    btn_login: 'Login & Verify Identity',
    sec_settings_title: 'Grab Settings & Accessibility',
    label_interval: 'Poll Interval (sec/cycle)',
    label_bfree: 'Barrier-free Space Requirement',
    bfree_n: 'No Need / False (Default)',
    bfree_y: 'Need / True',
    label_sound: 'Play sound when grabbed',
    label_notify: 'Send desktop notification when grabbed',
    label_stop_done: 'Auto-stop when all targets finished',
    btn_save_settings: 'Save Settings',
    sec_ai_title: 'LLM Connection Settings',
    btn_save_ai: 'Save AI Config',
    sec_logs_title: 'System Execution Logs',
    btn_clear_log: 'Clear Logs',
    footnote: 'For personal academic and registration use only. Operates on ~2.5s polite polling to prevent server overload. Please follow school rules.',

    lit_health: 'Health',
    lit_care: 'Care',
    lit_innovation: 'Innovation',
    lit_excellence: 'Excellence',
    lit_none: 'General',

    st_Y: 'Open',
    st_F: 'Full',
    st_N1: 'Upcoming',
    st_N2: 'Closed',
    st_C: 'On-site',
    st_D: 'Other',

    day_0: 'Sun', day_1: 'Mon', day_2: 'Tue', day_3: 'Wed', day_4: 'Thu', day_5: 'Fri', day_6: 'Sat'
  }
};

function t(key, fallback = '') {
  const lang = S.lang || 'zh';
  const langMap = I18N[lang] || I18N.zh;
  return langMap[key] ?? I18N.zh[key] ?? fallback;
}

function getStatusLabel(code) {
  return t('st_' + code, STATUS_LABEL[code] || code);
}

const LITERACIES = [
  { id: 'health', key: 'chk4', label: '健康力', en: 'Health', min: 2 },
  { id: 'care', key: 'chk5', label: '關懷力', en: 'Care', min: 2 },
  { id: 'innovation', key: 'chk6', label: '創新力', en: 'Innovation', min: 2 },
  { id: 'excellence', key: 'chk7', label: '卓越力', en: 'Excellence', min: 2 }
];

const DAY_SHORT = ['日', '一', '二', '三', '四', '五', '六'];

const S = {
  snap: null,
  lectures: [],
  query: '',
  statusFilter: 'all',
  literacyFilter: 'all',
  missingOnly: false,
  cursor: 0,
  logs: [],
  logDirty: false,
  filled: false,
  busy: false,
  lastRegistrations: null,
  agent: null,
  showFull: false,
  calEvents: null,
  calYear: null,
  calMonth: null,
  deferredInstallPrompt: null,
  lang: localStorage.getItem('au_lang') || (typeof navigator !== 'undefined' && navigator.language && navigator.language.toLowerCase().startsWith('en') ? 'en' : 'zh')
};

function applyLanguage(lang) {
  S.lang = lang === 'en' ? 'en' : 'zh';
  localStorage.setItem('au_lang', S.lang);
  document.documentElement.lang = S.lang === 'en' ? 'en' : 'zh-Hant';

  const btnLang = $('#btnLang');
  if (btnLang) {
    btnLang.textContent = S.lang === 'en' ? '中文' : 'EN';
  }
  const langSelect = $('#langSelect');
  if (langSelect) {
    langSelect.value = S.lang;
  }

  $$('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const txt = t(key);
    if (txt) {
      if (txt.includes('<') && txt.includes('>')) {
        el.innerHTML = txt;
      } else {
        el.textContent = txt;
      }
    }
  });

  $$('[data-i18n-placeholder]').forEach((el) => {
    const key = el.dataset.i18nPlaceholder;
    const txt = t(key);
    if (txt) el.setAttribute('placeholder', txt);
  });

  $$('[data-i18n-title]').forEach((el) => {
    const key = el.dataset.i18nTitle;
    const txt = t(key);
    if (txt) el.setAttribute('title', txt);
  });

  lectureSig = '';
  if (S.snap) {
    render();
  }
}

/* ------------------------------ 工具函式 ------------------------------ */

const esc = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[ch]);

const cleanHtml = (value) =>
  String(value ?? '')
    .replace(/<br\s*\/?>/gi, ' · ')
    .replace(/<[^>]+>/g, '')
    .replace(/(?:\s*·\s*)+$/, '')
    .replace(/\s+/g, ' ')
    .trim();

function formatAppNum(value, row) {
  const cleaned = cleanHtml(value);
  if (cleaned && cleaned !== '-') return cleaned;
  if (row) {
    const total = row.webstd || row.maxstd;
    if (total) {
      return `${row.selnum || 0}/${total}`;
    }
  }
  return '-';
}

const hhmmss = (ts) => new Date(ts).toLocaleTimeString('zh-TW', { hour12: false });

function countdown(ts) {
  const diff = ts - Date.now();
  if (diff <= 0) return '';
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d) return `${d} 天 ${h} 小時`;
  if (h) return `${h} 小時 ${m} 分`;
  return `${Math.max(1, m)} 分`;
}

const pad2 = (n) => String(n).padStart(2, '0');

function dateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function fmtStamp(ts) {
  if (!ts) return '（未設定）';
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}（週${DAY_SHORT[d.getDay()]}） ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function shorten(text, max = 8) {
  const str = String(text || '');
  return str.length > max ? str.slice(0, max) + '…' : str;
}

function getLectureLiteracies(row) {
  const list = [];
  const isChecked = (val) => val === 'Y' || val === 'y' || val === true || val === 1 || val === '1';
  if (isChecked(row?.chk4) || isChecked(row?.chk4_flg)) list.push('健康力');
  if (isChecked(row?.chk5) || isChecked(row?.chk5_flg)) list.push('關懷力');
  if (isChecked(row?.chk6) || isChecked(row?.chk6_flg)) list.push('創新力');
  if (isChecked(row?.chk7) || isChecked(row?.chk7_flg)) list.push('卓越力');
  return list;
}

function renderLiteracyBadges(literacies) {
  const list = Array.isArray(literacies) ? literacies : [];
  if (!list.length) {
    return `<span class="lit-tag l-none">${t('lit_none', '一般')}</span>`;
  }
  return `<div class="lit-tags-wrap">${list
    .map((lit) => {
      let cls = 'l-none';
      let name = lit;
      if (lit === '健康力') { cls = 'l-health'; name = t('lit_health', '健康力'); }
      else if (lit === '關懷力') { cls = 'l-care'; name = t('lit_care', '關懷力'); }
      else if (lit === '創新力') { cls = 'l-innovation'; name = t('lit_innovation', '創新力'); }
      else if (lit === '卓越力') { cls = 'l-excellence'; name = t('lit_excellence', '卓越力'); }
      return `<span class="lit-tag ${cls}">${esc(name)}</span>`;
    })
    .join('')}</div>`;
}

function describeScheduleEntry(entry) {
  const prefix = entry.label ? `${entry.label}｜` : '';
  if (entry.mode === 'open') return `${prefix}開放前 ${entry.leadSec ?? 15} 秒自動啟動`;
  if (entry.mode === 'at') {
    return `${prefix}${fmtStamp(entry.startAt)} 自動啟動${entry.stopAt ? `，${fmtStamp(entry.stopAt)} 停止` : ''}`;
  }
  const days = Array.isArray(entry.days) ? entry.days : [];
  const label = days.length === 7 ? '每天' : days.length ? days.map((d) => `週${DAY_SHORT[d]}`).join('、') : '未選星期';
  return `${prefix}${label} ${entry.startTime || '--:--'}–${entry.stopTime || '--:--'}`;
}

function toast(message, kind = '') {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 5000);
}

/* ------------------------------ 創意進階功能：時間衝突與素養推薦 ------------------------------ */

function parseYmd(value) {
  const text = String(value || '');
  const full = /(\d{3,4})[\/.\-](\d{1,2})[\/.\-](\d{1,2})/.exec(text);
  if (full) {
    let year = Number(full[1]);
    if (year < 1900) year += 1911;
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

function parseHm(value) {
  const match = /(\d{1,2})\s*[:：]\s*(\d{2})/.exec(String(value || ''));
  if (!match) return '';
  const hour = Math.min(23, Math.max(0, Number(match[1])));
  return `${pad2(hour)}:${match[2]}`;
}

function getLectureTimeRange(row) {
  const date = parseYmd(row?.rescsd) || parseYmd(row?.resdat);
  if (!date) return null;
  const start = parseHm(row?.stime) || parseHm(row?.resdat);
  const end = parseHm(row?.etime);
  const [sh, sm] = start ? start.split(':').map(Number) : [9, 0];
  const [eh, em] = end ? end.split(':').map(Number) : [sh + 2, sm];
  const startAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), sh, sm).getTime();
  const endAt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), eh, em).getTime();
  return { startAt, endAt };
}

function checkScheduleConflict(row, events) {
  const range = getLectureTimeRange(row);
  if (!range) return null;
  const list = Array.isArray(events) ? events : [];
  for (const ev of list) {
    if (String(ev.eid01) === String(row.eid01)) continue;
    if (!ev.startAt) continue;
    const evEnd = ev.endAt || (ev.startAt + 7200000);
    if (Math.max(range.startAt, ev.startAt) < Math.min(range.endAt, evEnd)) {
      return { conflict: true, withTitle: ev.title || '已報名講座', timeText: ev.timeText };
    }
  }
  return null;
}

/* 匯出標準 iCalendar (.ics) 行事曆檔案，可直接同步 Apple Calendar / Google 日曆 */
function exportCalendarICS() {
  const events = Array.isArray(S.calEvents) && S.calEvents.length ? S.calEvents : S.snap?.calendar || [];
  if (!events.length) {
    return toast('目前尚無已報名講座，報名後即可匯出行事曆', 'err');
  }

  // 優先觸發伺服器標準 RFC 5545 iCal 端點下載
  try {
    const a = document.createElement('a');
    a.href = '/api/calendar.ics';
    a.download = `亞洲大學通識講座行程_${dateKey(new Date())}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast('已匯出行事曆檔（.ics），可直接開啟同步至 Apple 日曆或 Google 日曆！', 'ok');
    return;
  } catch {
    /* 若背景下載失敗則降級為本地產生 */
  }

  const formatIcsDate = (date) => {
    return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  };

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Asia University//Lecture Grabber//ZH-TW',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:亞洲大學通識講座',
    'X-WR-TIMEZONE:Asia/Taipei'
  ];

  for (const ev of events) {
    const start = ev.startAt ? new Date(ev.startAt) : new Date();
    const end = ev.endAt ? new Date(ev.endAt) : new Date(start.getTime() + 7200000);
    const lits = (ev.literacies || []).join('、') || '一般';
    const summary = `${ev.title} [${lits}]`;
    const desc = `講者：${ev.speaker || '校方講師'}\n地點：${ev.place || '亞大校園'}\n基本素養：${lits}\n課程代號：${ev.eid01 || ''}`;

    lines.push(
      'BEGIN:VEVENT',
      `UID:au-lecture-${ev.eid01 || Math.random().toString(36).slice(2)}@asia.edu.tw`,
      `DTSTAMP:${formatIcsDate(new Date())}`,
      `DTSTART:${formatIcsDate(start)}`,
      `DTEND:${formatIcsDate(end)}`,
      `SUMMARY:${summary}`,
      `LOCATION:${ev.place || '亞洲大學'}`,
      `DESCRIPTION:${desc.replace(/\n/g, '\\n')}`,
      'STATUS:CONFIRMED',
      'END:VEVENT'
    );
  }

  lines.push('END:VCALENDAR');

  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `亞洲大學通識講座行程_${dateKey(new Date())}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('已匯出行事曆檔（.ics），可直接開啟同步至 Apple 日曆或 Google 日曆！', 'ok');
}

/* 複製行事曆訂閱網址 (可加入 Google Calendar 或 Apple 日曆實現自動同步) */
async function copyCalendarIcsUrl() {
  const url = `${window.location.origin}/api/calendar.ics`;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
    } else {
      const input = document.createElement('input');
      input.value = url;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    toast('已複製行事曆訂閱網址！可貼入 Apple 日曆或 Google 日曆「訂閱行事曆」保持即時同步', 'ok');
  } catch {
    toast(`日曆訂閱網址：${url}`, 'info');
  }
}

/* 複製純文字行程表 */
async function copyScheduleText() {
  const events = Array.isArray(S.calEvents) && S.calEvents.length ? S.calEvents : S.snap?.calendar || [];
  if (!events.length) {
    return toast('目前尚無已報名講座可供複製', 'err');
  }
  const lines = ['【亞洲大學通識講座行程表】'];
  events
    .sort((a, b) => a.startAt - b.startAt)
    .forEach((ev, idx) => {
      const lits = (ev.literacies || []).join('、');
      const litStr = lits ? ` [${lits}]` : '';
      lines.push(`${idx + 1}. ${ev.dateLabel}（${ev.weekdayLabel}）${ev.timeText}｜${ev.title}${litStr}｜${ev.place || ''}`);
    });
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('已複製通識課表至剪貼簿，可直接貼入備忘錄或通訊軟體', 'ok');
  } catch {
    toast('複製失敗，請確認瀏覽器剪貼簿權限', 'err');
  }
}

/* 智慧分析缺少素養並推薦最優選課路線 */
function recommendOptimalLectures() {
  const stats = computeGraduationStats(S.snap);
  if (stats.isAllMet) {
    return toast('恭喜！你的四大基本素養與總累積場次已全部達標！', 'ok');
  }

  const panel = $('#gradRecommendPanel');
  const descEl = $('#gradRecommendDesc');
  const listEl = $('#gradRecommendList');
  if (!panel || !descEl || !listEl) return;

  const defMap = new Map();
  for (const def of stats.deficiencies) {
    defMap.set(def.name, def.need);
  }

  const registeredEids = new Set(
    (S.snap?.calendar || []).map((e) => String(e.eid01))
  );

  const candidates = S.lectures.filter((row) => {
    if (registeredEids.has(String(row.eid01))) return false;
    if (Number(row.cnt_10 || 0) > 0) return false;
    if (row.canapp === 'N2' || row.canapp === 'C' || row.canapp === 'D') return false;
    const lits = getLectureLiteracies(row);
    const hasNeeded = lits.some((l) => defMap.has(l));
    if (!hasNeeded && stats.totalCompleted >= 8) return false;
    return true;
  });

  const picks = [];
  const currentDef = new Map(defMap);
  let neededTotal = Math.max(0, 8 - stats.totalCompleted);

  const sorted = [...candidates].sort((a, b) => {
    const litsA = getLectureLiteracies(a).filter((l) => currentDef.get(l) > 0).length;
    const litsB = getLectureLiteracies(b).filter((l) => currentDef.get(l) > 0).length;
    if (litsB !== litsA) return litsB - litsA;
    return (a.canapp === 'Y' ? 0 : 1) - (b.canapp === 'Y' ? 0 : 1);
  });

  for (const row of sorted) {
    const lits = getLectureLiteracies(row);
    const helpsWith = lits.filter((l) => (currentDef.get(l) || 0) > 0);
    if (!helpsWith.length && neededTotal <= 0) continue;

    const pickEvents = picks.map((p) => {
      const tr = getLectureTimeRange(p);
      return {
        ...p,
        eid01: String(p.eid01 || ''),
        title: p.rescnm || '',
        startAt: tr?.startAt || 0,
        endAt: tr?.endAt || 0,
        timeText: cleanHtml(p.resdat)
      };
    });
    const conflict = checkScheduleConflict(row, [...(S.snap?.calendar || []), ...pickEvents]);
    if (conflict) continue;

    picks.push(row);
    helpsWith.forEach((l) => {
      currentDef.set(l, Math.max(0, currentDef.get(l) - 1));
    });
    if (neededTotal > 0) neededTotal -= 1;

    const allDefsFilled = [...currentDef.values()].every((v) => v === 0);
    if (allDefsFilled && neededTotal <= 0) break;
  }

  S.recommendedPicks = picks;

  if (!picks.length) {
    descEl.textContent = '目前開放的講座中，暫時沒有能補齊你缺少素養的場次，建議稍後再查看新開放講座。';
    listEl.innerHTML = '<p class="hint">暫無符合推薦條件的講座。</p>';
    $('#btnApplyRecommend').disabled = true;
  } else {
    const neededSummary = stats.deficiencies.map((d) => `${d.name}缺${d.need}次`).join('、');
    descEl.textContent = `針對你目前的缺額（${neededSummary}），系統已精選出以下 ${picks.length} 場最速畢業選課路線：`;
    listEl.innerHTML = picks
      .map((row) => {
        const lits = getLectureLiteracies(row);
        const when = cleanHtml(row.resdat);
        const canapp = row.canapp === 'Y' ? '可報名' : '已額滿（候補搶票）';
        return `
          <div class="rec-item">
            <div class="rec-item-title">${esc(row.rescnm)}</div>
            <div class="rec-item-sub">代號 ${esc(row.reseid || row.eid01)} · ${esc(when)} · ${renderLiteracyBadges(lits)} <span class="tag">${canapp}</span></div>
          </div>`;
      })
      .join('');
    $('#btnApplyRecommend').disabled = false;
  }

  panel.hidden = false;
  panel.scrollIntoView({ behavior: 'smooth' });
}

async function applyGradRecommend() {
  if (!S.recommendedPicks?.length) return;
  const eids = S.recommendedPicks.map((r) => r.eid01);
  await post('/api/targets', { eid01s: eids });
  $('#gradRecommendPanel').hidden = true;
  toast(`已成功將推薦的 ${eids.length} 場講座加入搶課監控！`, 'ok');
  await poll();
  switchView('targets');
}

/* 搶課即時戰情儀表更新 */
function renderTelemetry(snap) {
  const engine = snap?.engine || {};
  const isRunning = Boolean(engine.running);
  const dot = $('#telemDot');
  const state = $('#telemState');
  const sub = $('#telemSub');
  const interval = $('#telemInterval');
  const targets = $('#telemTargets');
  const done = $('#telemDone');
  const countdownEl = $('#telemCountdown');
  const nearestTarget = $('#telemNearestTarget');

  if (dot && state && sub) {
    if (isRunning) {
      dot.className = 'telem-dot active';
      state.textContent = '毫秒監控中';
      sub.textContent = '持續輪詢搶票中';
    } else {
      dot.className = 'telem-dot';
      state.textContent = '待機中';
      sub.textContent = '等待啟動搶課';
    }
  }

  if (interval) {
    const sec = (Number(engine.settings?.intervalMs || 2500) / 1000).toFixed(1);
    interval.textContent = `${sec}s / 次`;
  }

  const list = engine.targets || [];
  if (targets) targets.textContent = `${list.length} 場目標`;
  const finished = list.filter((t) => t.status === 'registered').length;
  if (done) done.textContent = `已成功搶到 ${finished} 場`;

  const waitingTargets = list.filter((t) => t.openAt && t.openAt > Date.now());
  if (waitingTargets.length && countdownEl) {
    waitingTargets.sort((a, b) => a.openAt - b.openAt);
    const nearest = waitingTargets[0];
    countdownEl.textContent = countdown(nearest.openAt) || '即將開放';
    if (nearestTarget) nearestTarget.textContent = shorten(nearest.rescnm || nearest.eid01, 10);
  } else if (countdownEl) {
    countdownEl.textContent = '—';
    if (nearestTarget) nearestTarget.textContent = '無待開放目標';
  }
}

async function getJSON(path, options = {}) {
  const res = await fetch(path, {
    method: options.method || 'GET',
    headers: options.body ? { 'Content-Type': 'application/json' } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { error: text.slice(0, 200) };
  }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

const post = (path, body) => getJSON(path, { method: 'POST', body: body || {} });

async function guard(fn) {
  if (S.busy) return;
  S.busy = true;
  try {
    await fn();
  } catch (err) {
    toast(err.message, 'err');
  } finally {
    S.busy = false;
  }
}

/* ------------------------------ 提示音 / 桌面通知 ------------------------------ */

function beep() {
  if (!$('#soundToggle')?.checked) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.42);
    osc.onended = () => ctx.close();
  } catch {
    /* 忽略音訊初始化失敗 */
  }
}

function desktopNotify(title, body) {
  if (!$('#notifyToggle')?.checked) return;
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  } else if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

/* ------------------------------ 畫面渲染主流程 ------------------------------ */

function render() {
  const snap = S.snap;
  if (!snap) return;

  renderHeader(snap);
  renderGraduation(snap);
  renderAccount(snap);
  renderSchedule(snap);
  renderCalendar(snap);
  renderAgent(snap);
  renderTargets(snap);
  renderTelemetry(snap);
  renderLectures(snap);
  renderLogs();
}

function renderHeader(snap) {
  const session = snap.session || {};
  const engine = snap.engine || {};

  const pillSession = $('#pillSession');
  pillSession.textContent = session.loggedIn ? `${t('pill_logged_in', '已登入：')}${session.emp_nm || session.emp_id || ''}` : t('pill_not_logged_in', '未登入');
  pillSession.className = 'pill' + (session.loggedIn ? ' on' : '');

  const pillEngine = $('#pillEngine');
  if (engine.running) {
    pillEngine.textContent = t('pill_running', '搶課中');
    pillEngine.className = 'pill run';
  } else if (engine.stats?.lastError) {
    pillEngine.textContent = t('pill_error', '待機（錯誤）');
    pillEngine.className = 'pill err';
  } else {
    pillEngine.textContent = t('pill_standby', '待機中');
    pillEngine.className = 'pill';
  }

  const hasActiveTarget = (engine.targets || []).some((t) => !['registered', 'closed', 'manual', 'error'].includes(t.status));
  const canStart = Boolean(session.loggedIn && hasActiveTarget && !engine.running);
  $('#btnStart').disabled = !canStart;
  $('#btnStop').disabled = !engine.running;

  $('#serverInfo').textContent = `${t('server_connected', '本機服務 · ')}${snap.baseUrl || ''}`;

  const schedule = snap.schedule || {};
  const pillSchedule = $('#pillSchedule');
  if (schedule.nextStartAt && schedule.nextStartLabel) {
    pillSchedule.textContent = (S.lang === 'en' ? 'Sched: ' : '排程：') + String(schedule.nextStartLabel).split('・')[0];
    pillSchedule.className = 'pill sched';
  } else if (schedule.driverId) {
    pillSchedule.textContent = t('pill_sched_running', '排程執行中');
    pillSchedule.className = 'pill sched';
  } else if (schedule.enabled === false) {
    pillSchedule.textContent = t('pill_sched_disabled', '排程已關閉');
    pillSchedule.className = 'pill';
  } else {
    pillSchedule.textContent = t('pill_no_schedule', '無排程');
    pillSchedule.className = 'pill';
  }
}

/* ------------------------------ 四大素養畢業門檻計算 ------------------------------ */

function computeGraduationStats(snap) {
  const events = Array.isArray(S.calEvents) ? S.calEvents : snap?.calendar || [];
  const history = snap?.graduation?.history || { health: 0, care: 0, innovation: 0, excellence: 0 };

  const current = {
    health: 0,
    care: 0,
    innovation: 0,
    excellence: 0,
    total: 0
  };

  // 累計本學期已完成報名場次
  for (const ev of events) {
    const lits = ev.literacies || getLectureLiteracies(ev);
    if (lits.includes('健康力')) current.health += 1;
    if (lits.includes('關懷力')) current.care += 1;
    if (lits.includes('創新力')) current.innovation += 1;
    if (lits.includes('卓越力')) current.excellence += 1;
    current.total += 1;
  }

  const totals = {
    health: (Number(history.health) || 0) + current.health,
    care: (Number(history.care) || 0) + current.care,
    innovation: (Number(history.innovation) || 0) + current.innovation,
    excellence: (Number(history.excellence) || 0) + current.excellence
  };

  const historyTotal = (history.total !== undefined && Number(history.total) > 0)
    ? Number(history.total)
    : (Number(history.health) || 0) +
      (Number(history.care) || 0) +
      (Number(history.innovation) || 0) +
      (Number(history.excellence) || 0);

  // 總場次：歷年補登總場次 + 當期已報名場次（單場多素養各指標分別累計，但總場次不灌水）
  const totalCompleted = historyTotal + current.total;

  const deficiencies = [];
  if (totals.health < 2) deficiencies.push({ id: 'health', name: '健康力', need: 2 - totals.health });
  if (totals.care < 2) deficiencies.push({ id: 'care', name: '關懷力', need: 2 - totals.care });
  if (totals.innovation < 2) deficiencies.push({ id: 'innovation', name: '創新力', need: 2 - totals.innovation });
  if (totals.excellence < 2) deficiencies.push({ id: 'excellence', name: '卓越力', need: 2 - totals.excellence });

  const isTotalMet = totalCompleted >= 8;
  const isAllMet = isTotalMet && deficiencies.length === 0;

  return {
    current,
    history,
    totals,
    totalCompleted,
    deficiencies,
    isTotalMet,
    isAllMet
  };
}

function renderGraduation(snap) {
  const stats = computeGraduationStats(snap);

  // 總場次
  $('#gradTotalCount').textContent = String(stats.totalCompleted);
  const totalPercent = Math.min(100, Math.round((stats.totalCompleted / 8) * 100));
  $('#gradTotalProgress').style.width = `${totalPercent}%`;
  const totalBadge = $('#gradTotalBadge');
  if (stats.totalCompleted >= 8) {
    totalBadge.textContent = t('grad_met_total', '已達標 (≥8)');
    totalBadge.className = 'metric-state ok';
  } else {
    totalBadge.textContent = t('grad_need_lectures', '尚缺 {n} 場').replace('{n}', 8 - stats.totalCompleted);
    totalBadge.className = 'metric-state';
  }

  // 四大素養細項
  const setMetric = (prefix, val, min) => {
    $(`#grad${prefix}Count`).textContent = String(val);
    const pct = Math.min(100, Math.round((val / min) * 100));
    $(`#grad${prefix}Progress`).style.width = `${pct}%`;
    const badge = $(`#grad${prefix}Badge`);
    if (val >= min) {
      badge.textContent = t('grad_met', '已達標');
      badge.className = 'metric-state ok';
    } else {
      badge.textContent = t('grad_need_times', '尚缺 {n} 次').replace('{n}', min - val);
      badge.className = 'metric-state';
    }
  };

  setMetric('Health', stats.totals.health, 2);
  setMetric('Care', stats.totals.care, 2);
  setMetric('Innovation', stats.totals.innovation, 2);
  setMetric('Excellence', stats.totals.excellence, 2);

  // 整體門檻狀態徽章
  const overallBadge = $('#gradOverallStatus');
  if (stats.isAllMet) {
    overallBadge.textContent = t('grad_fulfilled', '通識講座畢業門檻：已達成');
    overallBadge.className = 'grad-status-badge ok';
  } else {
    const missingItems = stats.deficiencies.map((d) => `${t('lit_' + d.id, d.name)}${S.lang === 'en' ? ' missing ' : '缺'}${d.need}`).join('、');
    const msg = stats.isTotalMet ? (S.lang === 'en' ? `Total met, but: ${missingItems}` : `總數達標，但${missingItems}`) : (S.lang === 'en' ? `Incomplete (${missingItems || 'insufficient total'})` : `未達標（${missingItems || '總場次不足'}）`);
    overallBadge.textContent = msg;
    overallBadge.className = 'grad-status-badge pending';
  }

  // 填寫歷年補登輸入框（若尚未手動聚焦）
  const h = stats.history;
  const healthIn = $('#gradHistHealth');
  const careIn = $('#gradHistCare');
  const innIn = $('#gradHistInnovation');
  const excIn = $('#gradHistExcellence');
  const totalIn = $('#gradHistTotal');

  if (document.activeElement !== healthIn) healthIn.value = h.health || 0;
  if (document.activeElement !== careIn) careIn.value = h.care || 0;
  if (document.activeElement !== innIn) innIn.value = h.innovation || 0;
  if (document.activeElement !== excIn) excIn.value = h.excellence || 0;
  if (totalIn && document.activeElement !== totalIn) totalIn.value = h.total || 0;
}

function renderAccount(snap) {
  const session = snap.session || {};
  const account = snap.account || {};
  const parts = [];
  if (session.loggedIn) {
    const verified = session.identityVerified ? '身分末四碼已驗證' : '尚未驗證身分末四碼';
    parts.push(`已登入：${esc(session.emp_nm || '-') }（${esc(session.emp_id || '')}，${esc(session.emp_rl || '-')}） · ${verified}`);
    if (account.saved) {
      parts.push('本機已記住密碼（伺服器重啟將自動登入）');
    }
  } else if (account.username) {
    parts.push(`已記住帳號：${esc(account.username)}${account.saved ? '（已記住密碼，可直接點擊登入）' : ''}`);
  }
  const infoEl = $('#accountInfo');
  if (infoEl) {
    const logoutBtn = session.loggedIn ? ' · <button class="btn ghost sm" type="button" data-action="logout" style="margin-left: 6px;">登出</button>' : '';
    infoEl.innerHTML = (parts.join('<br>') || '') + logoutBtn;
  }

  const loginForm = $('#loginForm');
  if (loginForm && document.activeElement !== loginForm.password && !loginForm.password.value) {
    if (account.saved && loginForm.username.value.trim() === account.username) {
      loginForm.password.placeholder = '●●●●●●●●（已儲存，留空＝使用記住密碼）';
      loginForm.password.removeAttribute('required');
    } else {
      loginForm.password.placeholder = '';
      loginForm.password.setAttribute('required', '');
    }
  }
}

function renderSchedule(snap) {
  const schedule = snap.schedule || { entries: [] };
  const entries = Array.isArray(schedule.entries) ? schedule.entries : [];
  const list = $('#scheduleList');
  const hint = $('#scheduleHint');
  const next = $('#scheduleNext');

  if (schedule.nextStartAt && schedule.nextStartLabel) {
    next.textContent = schedule.nextStartLabel;
    next.className = 'tag live';
  } else {
    next.textContent = schedule.enabled === false ? '已關閉' : '無排程';
    next.className = 'tag';
  }

  const enabledEl = $('#scheduleEnabled');
  if (document.activeElement !== enabledEl) enabledEl.checked = schedule.enabled !== false;

  if (!entries.length) {
    list.innerHTML = '';
    hint.style.display = '';
    return;
  }
  hint.style.display = 'none';

  list.innerHTML = entries
    .map((entry) => {
      const driving = entry.id === schedule.driverId;
      const cls = ['sched-item', entry.enabled ? '' : 'off', driving ? 'active' : ''].filter(Boolean).join(' ');
      const sub = entry.lastStartAt ? `<div class="cell-sub">上次啟動 ${hhmmss(entry.lastStartAt)}</div>` : '';
      return `
        <div class="${cls}">
          <div class="sched-text">
            <div class="sched-desc">${esc(describeScheduleEntry(entry))}</div>
            ${sub}
          </div>
          <div class="sched-actions">
            <button class="btn sm ghost" data-action="schedule-toggle" data-id="${esc(entry.id)}">${entry.enabled ? '停用' : '啟用'}</button>
            <button class="btn sm ghost icon" data-action="schedule-remove" data-id="${esc(entry.id)}" aria-label="刪除排程"><svg viewBox="0 0 16 16" width="10" height="10" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 3l10 10M13 3L3 13"/></svg></button>
          </div>
        </div>`;
    })
    .join('');
}

function renderCalendar(snap) {
  const events = Array.isArray(S.calEvents) ? S.calEvents : snap.calendar || [];
  const grid = $('#calGrid');
  const hint = $('#calendarHint');
  const upcoming = $('#calUpcoming');

  const now = new Date();
  if (S.calYear === null || S.calMonth === null) {
    S.calYear = now.getFullYear();
    S.calMonth = now.getMonth();
  }

  $('#calendarCount').textContent = String(events.length);
  $('#calMonth').textContent = `${S.calYear} 年 ${S.calMonth + 1} 月`;

  const byDate = new Map();
  for (const ev of events) {
    if (!byDate.has(ev.date)) byDate.set(ev.date, []);
    byDate.get(ev.date).push(ev);
  }

  const first = new Date(S.calYear, S.calMonth, 1);
  const padDays = first.getDay();
  const daysInMonth = new Date(S.calYear, S.calMonth + 1, 0).getDate();
  const todayKey = dateKey(now);

  let html = DAY_SHORT.map((d) => `<div class="cal-dow">${d}</div>`).join('');
  for (let i = 0; i < padDays; i += 1) html += '<div class="cal-cell blank"></div>';
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = `${S.calYear}-${pad2(S.calMonth + 1)}-${pad2(day)}`;
    const list = (byDate.get(key) || []).sort((a, b) => a.startAt - b.startAt);
    const chips = list
      .map(
        (ev) => {
          const lits = (ev.literacies || []).join('/');
          const litSuffix = lits ? ` [${lits}]` : '';
          return `<button class="cal-chip" data-action="cal-open" data-eid="${esc(ev.eid01)}" title="${esc(`${ev.title}${litSuffix}｜${ev.place || ''}`)}"><b>${esc(ev.time || '')}</b>${esc(shorten(ev.title, 6))}</button>`;
        }
      )
      .join('');
    html += `<div class="cal-cell${key === todayKey ? ' today' : ''}"><span class="cal-day">${day}</span><div class="cal-events">${chips}</div></div>`;
  }
  grid.innerHTML = html;

  hint.style.display = events.length ? 'none' : '';

  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const nextUp = events
    .filter((ev) => ev.startAt >= startOfToday)
    .sort((a, b) => a.startAt - b.startAt)
    .slice(0, 6);

  const badge = $('#navCalBadge');
  const mobBadge = $('#mobCalBadge');
  const calCountStr = String(events.length);
  if (badge) {
    badge.textContent = calCountStr;
    badge.hidden = events.length === 0;
  }
  if (mobBadge) {
    mobBadge.textContent = calCountStr;
    mobBadge.hidden = events.length === 0;
  }

  upcoming.innerHTML = nextUp
    .map(
      (ev) => `
      <li class="up-item">
        <div class="up-time-col">
          <span class="up-date">${esc(ev.dateLabel)}<b>${esc(ev.weekdayLabel)}</b></span>
          <span class="up-time">${esc(ev.timeText)}</span>
        </div>
        <div class="up-main-col">
          <span class="up-title">${esc(ev.title)}</span>
          <div class="up-meta">${renderLiteracyBadges(ev.literacies)} <span class="up-place">${esc(ev.place || '')}</span></div>
        </div>
        <div class="up-action-col">
          <button class="btn sm danger" data-action="cancel-target" data-reseid="${esc(ev.reseid || '')}" data-eid01="${esc(ev.eid01 || '')}" data-eid="${esc(ev.eid || '')}" title="取消報名（退選）">取消報名</button>
        </div>
      </li>`
    )
    .join('');
}

function renderAgent(snap) {
  const ai = snap?.ai || {};
  const tag = $('#agentSource');
  if (S.agent?.source === 'ai') tag.textContent = 'AI 智慧規劃';
  else if (S.agent?.source === 'heuristic') tag.textContent = '本機素養規則';
  else tag.textContent = ai.ready ? `AI · ${ai.model || 'model'}` : '本機素養規則';

  const box = $('#agentPlan');
  const plan = S.agent;
  if (!plan) {
    box.hidden = true;
    return;
  }
  box.hidden = false;

  $('#agentSchedule').textContent = plan.schedule ? describeScheduleEntry(plan.schedule) : '這次不建立排程';

  const picks = Array.isArray(plan.picks) ? plan.picks : [];
  $('#agentPickCount').textContent = String(picks.length);
  $('#agentPicks').innerHTML = picks.length
    ? picks
        .map((pick) => {
          const row = S.lectures.find((item) => item.eid01 === pick.eid01);
          const name = row ? row.rescnm : pick.eid01;
          const when = row ? cleanHtml(row.resdat) : '';
          const lits = row ? getLectureLiteracies(row) : [];
          return `<li><span class="pick-name">${esc(name)}</span>${renderLiteracyBadges(lits)}${
            when ? `<span class="pick-when">${esc(when)}</span>` : ''
          }${pick.reason ? `<span class="pick-why">${esc(pick.reason)}</span>` : ''}</li>`;
        })
        .join('')
    : '<li class="muted">沒有挑到符合條件的講座</li>';

  $('#agentNote').textContent = plan.reply || '';
}

function renderTargets(snap) {
  const targets = snap.engine?.targets || [];
  const body = $('#targetBody');
  const hint = $('#targetHint');
  $('#targetCount').textContent = String(targets.length);
  const badgeEl = $('#navTargetBadge');
  const mobTargetBadgeEl = $('#mobTargetBadge');
  const targetCountStr = String(targets.length);
  if (badgeEl) {
    badgeEl.textContent = targetCountStr;
    badgeEl.hidden = targets.length === 0;
  }
  if (mobTargetBadgeEl) {
    mobTargetBadgeEl.textContent = targetCountStr;
    mobTargetBadgeEl.hidden = targets.length === 0;
  }

  if (!targets.length) {
    body.innerHTML = '';
    hint.style.display = '';
    return;
  }
  hint.style.display = 'none';

  body.innerHTML = targets
    .map((target) => {
      const badge = `<span class="badge-status k-${esc(target.kind)}">${esc(target.statusText)}</span>`;
      const openHint =
        target.openAt && target.openAt > Date.now() && target.kind === 'muted'
          ? `<div class="cell-sub">${esc(countdown(target.openAt))}${S.lang === 'en' ? ' until registration opens' : '後開放報名'}</div>`
          : '';
      const note = target.note ? `<div class="cell-sub">${esc(target.note)}</div>` : '';

      const lits = target.literacies || [];
      const litHtml = renderLiteracyBadges(lits);

      const actions = [];
      if (target.status !== 'registered') {
        actions.push(`<button class="btn sm primary" data-action="register-target" data-eid="${esc(target.eid01)}" title="${t('btn_manual_register', '手動報名')}">${t('btn_manual_register', '手動報名')}</button>`);
      } else {
        actions.push(`<button class="btn sm danger" data-action="cancel-target" data-reseid="${esc(target.reseid || '')}" data-eid01="${esc(target.eid01 || '')}" data-eid="${esc(target.eid || '')}" title="${t('btn_cancel', '取消報名')}">${t('btn_cancel', '取消報名')}</button>`);
      }
      actions.push(`<button class="btn sm ghost" data-action="remove-target" data-eid="${esc(target.eid01)}">${t('btn_remove', '移除')}</button>`);

      return `
        <tr>
          <td>
            <div class="cell-name">${esc(target.rescnm)}</div>
            <div class="cell-sub">${esc(target.reseid)}</div>
          </td>
          <td>${litHtml}</td>
          <td><div class="cell-time">${esc(cleanHtml(target.resdat))}</div>${openHint}</td>
          <td>${esc(target.locale || '-')}</td>
          <td>${badge}${note}</td>
          <td>${esc(formatAppNum(target.appnum, target))}</td>
          <td class="right"><div class="btn-group">${actions.join(' ')}</div></td>
        </tr>`;
    })
    .join('');
}

function visibleLectures() {
  const query = S.query.trim().toLowerCase();
  const gradStats = computeGraduationStats(S.snap);
  const deficientLiteracyNames = new Set(gradStats.deficiencies.map((d) => d.name));

  return S.lectures.filter((row) => {
    const canapp = String(row.canapp || '');
    const lits = getLectureLiteracies(row);

    // 已額滿預設不顯示，除非勾選「顯示已額滿」或特定篩選狀態
    if (canapp === 'F' && !S.showFull && S.statusFilter !== 'F') return false;

    // 狀態篩選
    if (S.statusFilter !== 'all') {
      if (S.statusFilter === 'other') {
        if (canapp !== 'C' && canapp !== 'D') return false;
      } else if (canapp !== S.statusFilter) {
        return false;
      }
    }

    // 基本素養篩選
    if (S.literacyFilter !== 'all') {
      if (S.literacyFilter === 'none') {
        if (lits.length > 0) return false;
      } else if (!lits.includes(S.literacyFilter)) {
        return false;
      }
    }

    // 只看缺少的素養
    if (S.missingOnly) {
      const satisfiesDeficiency = lits.some((l) => deficientLiteracyNames.has(l));
      if (!satisfiesDeficiency) return false;
    }

    // 關鍵字搜尋
    if (!query) return true;
    const hay = [row.rescnm, row.teachm, row.locale, row.sponsr, ...lits].join(' ').toLowerCase();
    return hay.includes(query);
  });
}

let lectureSig = '';

function renderLectures(snap) {
  const rows = visibleLectures();
  const body = $('#lectureBody');
  const hint = $('#lectureHint');
  const watched = new Set((snap.engine?.targets || []).map((target) => target.eid01));

  const sig = JSON.stringify([
    S.statusFilter,
    S.literacyFilter,
    S.missingOnly,
    S.query,
    S.showFull,
    S.lectures.length,
    [...watched],
    rows.map((row) => [row.eid01, row.canapp, row.appnum, row.cnt_10, row.chk4, row.chk5, row.chk6, row.chk7])
  ]);
  if (sig === lectureSig && body.children.length) return;
  lectureSig = sig;

  $('#lectureCount').textContent = `${rows.length}/${S.lectures.length}`;
  const bridge = $('#lecturesBridgeBar');
  const bridgeText = $('#lecturesBridgeText');
  if (bridge && bridgeText) {
    if (watched.size > 0) {
      bridgeText.textContent = `目前已選取 ${watched.size} 場搶課目標，可點擊切換至排程中心設定啟動時機。`;
      bridge.hidden = false;
    } else {
      bridge.hidden = true;
    }
  }

  if (!rows.length) {
    body.innerHTML = '';
    hint.style.display = '';
    hint.textContent = S.lectures.length ? '沒有符合篩選條件的講座。' : '尚未取得講座清單，請稍候或點擊重新整理。';
    return;
  }
  hint.style.display = 'none';

  body.innerHTML = rows
    .map((row) => {
      const canapp = String(row.canapp || '');
      const kind =
        canapp === 'Y' ? 'ok' : canapp === 'F' ? 'warn' : canapp === 'N1' ? 'muted' : canapp === 'N2' ? 'dead' : canapp === 'C' || canapp === 'D' ? 'manual' : 'unknown';
      const label = getStatusLabel(canapp);
      const actions = [];
      const isWatched = watched.has(row.eid01);
      const isRegistered = Number(row.cnt_10 || 0) > 0;
      const conflict = !isRegistered && checkScheduleConflict(row, S.calEvents || S.snap?.calendar || []);
      const conflictHtml = conflict
        ? `<span class="badge-status k-conflict" title="${t('conflict_title', '與已報名【{title}】時間重疊').replace('{title}', conflict.withTitle)}">${t('conflict_warn', '時段衝突')}</span>`
        : '';

      if (isRegistered) {
        actions.push(`<span class="tag live">${t('btn_registered', '已報名')}</span>`);
        actions.push(`<button class="btn sm danger" data-action="cancel-target" data-reseid="${esc(row.reseid || '')}" data-eid01="${esc(row.eid01 || '')}" data-eid="${esc(row.eid || '')}" title="${t('btn_cancel', '取消報名')}">${t('btn_cancel', '取消報名')}</button>`);
      } else {
        actions.push(`<button class="btn sm primary" data-action="quick-register" data-eid="${esc(row.eid01)}" title="${t('btn_manual_register', '手動報名')}">${t('btn_manual_register', '手動報名')}</button>`);
        if (isWatched) {
          actions.push(`<span class="cell-sub">${t('btn_in_queue', '已在監控')}</span>`);
        } else {
          const addLabel = canapp === 'F' ? t('btn_waitlist_target', '＋候補搶票') : t('btn_add_target', '＋加入目標');
          actions.push(`<button class="btn sm ghost" data-action="add-target" data-eid="${esc(row.eid01)}">${addLabel}</button>`);
        }
      }
      const actionHtml = `<div class="btn-group">${actions.join(' ')}</div>`;

      const lits = getLectureLiteracies(row);
      const litBadges = renderLiteracyBadges(lits);

      return `
        <tr>
          <td>
            <div class="status-wrap">
              <span class="badge-status k-${kind}">${esc(label)}</span>
              ${conflictHtml}
            </div>
          </td>
          <td>
            <div class="cell-name">${esc(row.rescnm)}</div>
            <div class="cell-sub">${esc(row.sponsr || '')} · 代號 ${esc(row.reseid || '')}</div>
          </td>
          <td>${litBadges}</td>
          <td>${esc(row.teachm || '-')}</td>
          <td><div class="cell-time">${esc(cleanHtml(row.resdat) || '-')}</div></td>
          <td>${esc(row.locale || '-')}</td>
          <td>${esc(formatAppNum(row.appnum, row))}</td>
          <td class="cell-sub">${esc(row.apptim || '-')}</td>
          <td class="right">${actionHtml}</td>
        </tr>`;
    })
    .join('');
}

function renderLogs() {
  if (!S.logDirty) return;
  S.logDirty = false;
  const box = $('#logBox');
  if (!S.logs.length) {
    box.innerHTML = '<p class="placeholder">尚無執行紀錄。</p>';
    return;
  }
  box.innerHTML = S.logs
    .map(
      (entry) => `
      <div class="row ${esc(entry.level)}">
        <span class="t">${hhmmss(entry.ts)}</span>
        <span class="m">${esc(entry.message)}</span>
      </div>`
    )
    .join('');
  box.scrollTop = box.scrollHeight;
}

/* ------------------------------ 資料輪詢與同步 ------------------------------ */

function applySnapshot(snap) {
  const regs = Number(snap.engine?.stats?.registrations || 0);
  const prev = S.lastRegistrations;
  S.snap = snap;

  if (prev !== null && regs > prev) {
    const done = (snap.engine.targets || []).filter((t) => t.status === 'registered');
    const latest = done[done.length - 1];
    const name = latest?.rescnm || '目標講座';
    beep();
    desktopNotify('[搶到講座]', name);
    toast(`[報名成功] 已搶到：${name}`, 'ok');
  }
  S.lastRegistrations = regs;
}

async function pollLogs(snap) {
  const cursor = Number(snap.engine?.logCursor || 0);
  if (cursor < S.cursor) {
    S.cursor = 0;
    S.logs = [];
    S.logDirty = true;
  }
  if (cursor <= S.cursor) return;
  const data = await getJSON('/api/logs?since=' + S.cursor);
  if (Array.isArray(data.logs) && data.logs.length) {
    S.logs.push(...data.logs);
    if (S.logs.length > 400) S.logs.splice(0, S.logs.length - 400);
    S.logDirty = true;
  }
  S.cursor = Number.isFinite(Number(data.cursor)) ? Number(data.cursor) : cursor;
}

async function poll() {
  try {
    const snap = await getJSON('/api/state');
    applySnapshot(snap);
    fillForms(snap);
    await pollLogs(snap);
    render();
  } catch (err) {
    $('#serverInfo').textContent = '[警告] 本機服務未連線（請確認伺服器是否正常運行）';
  }
}

async function refreshLectures() {
  const data = await getJSON('/api/lectures');
  S.lectures = Array.isArray(data.lectures) ? data.lectures : [];
  if (data.warning) toast('清單更新警告：' + data.warning, 'err');
  render();
}

async function fillForms(snap) {
  if (S.filled) return;
  const engineSettings = snap.engine?.settings || {};
  const notify = snap.notify || {};
  $('#intervalSec').value = (Number(engineSettings.intervalMs || 2500) / 1000).toFixed(1);
  if ($('#bfreeSelect')) {
    $('#bfreeSelect').value = engineSettings.bfree === 'Y' ? 'Y' : 'N';
  }
  $('#stopDoneToggle').checked = Boolean(engineSettings.stopWhenAllDone);
  $('#soundToggle').checked = notify.sound !== false;
  $('#notifyToggle').checked = notify.desktop !== false;

  const aiConfig = snap.ai || {};
  $('#aiEnabled').checked = Boolean(aiConfig.enabled);
  $('#aiBaseUrl').value = aiConfig.baseUrl || '';
  $('#aiModel').value = aiConfig.model || '';
  $('#aiKey').placeholder = aiConfig.ready ? '已設定金鑰（留空＝不變更）' : 'sk-…（留空＝不變更）';

  const history = snap.graduation?.history || {};
  $('#gradHistHealth').value = history.health || 0;
  $('#gradHistCare').value = history.care || 0;
  $('#gradHistInnovation').value = history.innovation || 0;
  $('#gradHistExcellence').value = history.excellence || 0;
  if ($('#gradHistTotal')) $('#gradHistTotal').value = history.total || 0;

  const account = snap.account || {};
  const loginForm = $('#loginForm');
  if (loginForm) {
    if (account.username) loginForm.username.value = account.username;
    if (account.idLast4) loginForm.idLast4.value = account.idLast4;
    loginForm.remember.checked = Boolean(account.saved);
    if (account.saved) {
      loginForm.password.placeholder = '●●●●●●●●（已儲存，留空＝使用記住密碼）';
      loginForm.password.removeAttribute('required');
    } else {
      loginForm.password.placeholder = '';
      loginForm.password.setAttribute('required', '');
    }
  }

  S.filled = true;
}

/* ------------------------------ 分層視圖導覽切換與 iOS 滑動塊 ------------------------------ */

function updateGlider(viewName, animate = true) {
  const nav = $('#navSegments');
  const glider = $('#navGlider');
  if (!nav || !glider) return;

  const currentView = viewName || document.body.dataset.view || 'lectures';
  const btn = nav.querySelector(`.nav-segment-btn[data-view="${currentView}"]`);
  if (!btn) return;

  const navRect = nav.getBoundingClientRect();
  const btnRect = btn.getBoundingClientRect();

  if (btnRect.width === 0) {
    requestAnimationFrame(() => updateGlider(viewName, animate));
    return;
  }

  const offsetLeft = btnRect.left - navRect.left;
  const width = btnRect.width;

  if (!animate) {
    glider.style.transition = 'none';
  } else {
    glider.style.transition = '';
  }

  glider.style.width = `${Math.round(width)}px`;
  glider.style.transform = `translateX(${Math.round(offsetLeft)}px)`;
}

function initSegmentDrag() {
  const nav = $('#navSegments');
  const glider = $('#navGlider');
  if (!nav || !glider) return;

  let isDragging = false;
  let startX = 0;
  let startLeft = 0;
  let currentLeft = 0;
  let gliderWidth = 0;
  let minLeft = 3;
  let maxLeft = 0;
  let activePointerId = null;
  const dragThreshold = 4;
  let hasMovedPastThreshold = false;
  let rafId = null;

  const buttons = () => [...nav.querySelectorAll('.nav-segment-btn')];

  nav.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    const navRect = nav.getBoundingClientRect();
    const currentBtn = nav.querySelector('.nav-segment-btn.active') || buttons()[0];
    if (!currentBtn) return;

    const btnRect = currentBtn.getBoundingClientRect();
    startX = e.clientX;
    startLeft = btnRect.left - navRect.left;
    currentLeft = startLeft;
    gliderWidth = btnRect.width;

    const allBtns = buttons();
    if (!allBtns.length) return;
    const firstRect = allBtns[0].getBoundingClientRect();
    const lastRect = allBtns[allBtns.length - 1].getBoundingClientRect();
    minLeft = firstRect.left - navRect.left;
    maxLeft = lastRect.left - navRect.left;

    activePointerId = e.pointerId;
    isDragging = true;
    hasMovedPastThreshold = false;

    // 立即捕獲指標，避免被瀏覽器滾動或手勢攔截
    try {
      nav.setPointerCapture(activePointerId);
    } catch {}
  });

  window.addEventListener('pointermove', (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;

    const dx = e.clientX - startX;
    if (!hasMovedPastThreshold) {
      if (Math.abs(dx) > dragThreshold) {
        hasMovedPastThreshold = true;
        nav.classList.add('is-dragging');
        if (navigator.vibrate) navigator.vibrate(6);
      } else {
        return;
      }
    }

    let targetLeft = startLeft + dx;
    if (targetLeft < minLeft) {
      const over = minLeft - targetLeft;
      targetLeft = minLeft - Math.pow(over, 0.75);
    } else if (targetLeft > maxLeft) {
      const over = targetLeft - maxLeft;
      targetLeft = maxLeft + Math.pow(over, 0.75);
    }

    currentLeft = targetLeft;
    const stretchRatio = Math.min(1.08, 1 + Math.abs(dx) / 1200);

    if (rafId) cancelAnimationFrame(rafId);
    rafId = requestAnimationFrame(() => {
      glider.style.width = `${Math.round(gliderWidth * stretchRatio)}px`;
      glider.style.transform = `translate3d(${Math.round(currentLeft)}px, 0, 0)`;
    });
  });

  const onPointerEnd = (e) => {
    if (!isDragging || e.pointerId !== activePointerId) return;

    isDragging = false;
    activePointerId = null;
    nav.classList.remove('is-dragging');
    if (rafId) cancelAnimationFrame(rafId);
    try {
      nav.releasePointerCapture(e.pointerId);
    } catch {}

    if (hasMovedPastThreshold) {
      const gliderCenter = currentLeft + gliderWidth / 2;
      const navRect = nav.getBoundingClientRect();
      const allBtns = buttons();

      let closestBtn = allBtns[0];
      let minDistance = Infinity;

      allBtns.forEach((btn) => {
        const bRect = btn.getBoundingClientRect();
        const btnCenter = (bRect.left - navRect.left) + bRect.width / 2;
        const dist = Math.abs(btnCenter - gliderCenter);
        if (dist < minDistance) {
          minDistance = dist;
          closestBtn = btn;
        }
      });

      if (closestBtn && closestBtn.dataset.view) {
        if (navigator.vibrate) navigator.vibrate(8);
        switchView(closestBtn.dataset.view);
      } else {
        updateGlider(document.body.dataset.view, true);
      }
    } else {
      // 點擊觸發
      const targetBtn = e.target.closest('.nav-segment-btn');
      if (targetBtn && targetBtn.dataset.view) {
        if (navigator.vibrate) navigator.vibrate(6);
        switchView(targetBtn.dataset.view);
      } else {
        updateGlider(document.body.dataset.view, true);
      }
    }
  };

  window.addEventListener('pointerup', onPointerEnd);
  window.addEventListener('pointercancel', onPointerEnd);
}

/** 徹底禁止縮放與橫向手勢干擾，杜絕左右晃動，實現原生 App 堅固體驗 */
function preventUnwantedGestures() {
  // 禁止 iOS Safari / WebView 手勢縮放
  document.addEventListener('gesturestart', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gesturechange', (e) => e.preventDefault(), { passive: false });
  document.addEventListener('gestureend', (e) => e.preventDefault(), { passive: false });

  // 禁止雙指觸控捏合縮放 (Pinch-to-zoom)
  document.addEventListener('touchstart', (e) => {
    if (e.touches && e.touches.length > 1) {
      e.preventDefault();
    }
  }, { passive: false });

  // 禁止雙擊螢幕縮放放大（輸入框除外）
  let lastTouchEndTime = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEndTime <= 320) {
      const tag = e.target?.tagName?.toLowerCase();
      if (tag !== 'input' && tag !== 'textarea') {
        e.preventDefault();
      }
    }
    lastTouchEndTime = now;
  }, { passive: false });
}

function switchView(viewName) {
  const allowed = ['lectures', 'targets', 'calendar', 'settings'];
  if (!allowed.includes(viewName)) viewName = 'lectures';
  document.body.dataset.view = viewName;
  document.querySelectorAll('.view-panel').forEach((el) => {
    el.hidden = el.dataset.view !== viewName;
  });
  document.querySelectorAll('[data-action="switch-view"]').forEach((btn) => {
    const active = btn.dataset.view === viewName;
    btn.classList.toggle('active', active);
    btn.setAttribute('aria-selected', active ? 'true' : 'false');
  });
  document.querySelectorAll('.mob-tab').forEach((tab) => {
    tab.classList.toggle('active', tab.dataset.view === viewName);
  });
  updateGlider(viewName, true);
  try {
    localStorage.setItem('au_lecture_view', viewName);
    history.replaceState(null, '', `#${viewName}`);
  } catch {}
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ------------------------------ 事件監聽與代理 ------------------------------ */

document.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const action = button.dataset.action;

  if (action === 'switch-view' || action === 'mob-tab') {
    const view = button.dataset.view || button.dataset.target?.replace('card', '').toLowerCase();
    if (navigator.vibrate) {
      try { navigator.vibrate(10); } catch {}
    }
    switchView(view);
    return;
  }

  if (action === 'toggle-lang') {
    applyLanguage(S.lang === 'zh' ? 'en' : 'zh');
    toast(S.lang === 'en' ? 'Switched to English' : '已切換為繁體中文', 'ok');
    return;
  }

  if (action === 'start') {
    return guard(async () => {
      await post('/api/engine/start');
      toast('已啟動搶課監控', 'ok');
      await poll();
    });
  }

  if (action === 'stop') {
    return guard(async () => {
      await post('/api/engine/stop');
      toast('已停止搶課監控');
      await poll();
    });
  }

  if (action === 'install-pwa') {
    if (S.deferredInstallPrompt) {
      S.deferredInstallPrompt.prompt();
      S.deferredInstallPrompt.userChoice.then((choice) => {
        if (choice.outcome === 'accepted') {
          toast('正在安裝應用程式...', 'ok');
        }
        S.deferredInstallPrompt = null;
        $('#pwaInstallBtn').hidden = true;
      });
    }
    return;
  }

  if (action === 'toggle-side') {
    const side = $('#sidePanel');
    side.classList.toggle('open');
    return;
  }

  if (action === 'toggle-grad-history') {
    const panel = $('#gradHistoryPanel');
    panel.hidden = !panel.hidden;
    return;
  }

  if (action === 'auto-fill-deficiency') {
    recommendOptimalLectures();
    return;
  }

  if (action === 'close-grad-recommend') {
    const recPanel = $('#gradRecommendPanel');
    if (recPanel) recPanel.hidden = true;
    return;
  }

  if (action === 'apply-grad-recommend') {
    return guard(async () => {
      await applyGradRecommend();
    });
  }

  if (action === 'export-ics') {
    exportCalendarICS();
    return;
  }

  if (action === 'copy-ics-url') {
    copyCalendarIcsUrl();
    return;
  }

  if (action === 'copy-schedule') {
    copyScheduleText();
    return;
  }

  if (action === 'hist-inc' || action === 'hist-dec') {
    const type = button.dataset.type;
    const inputId = {
      health: '#gradHistHealth',
      care: '#gradHistCare',
      innovation: '#gradHistInnovation',
      excellence: '#gradHistExcellence',
      total: '#gradHistTotal'
    }[type];
    if (inputId) {
      const el = $(inputId);
      const curr = Number(el.value) || 0;
      el.value = Math.max(0, action === 'hist-inc' ? curr + 1 : curr - 1);
    }
    return;
  }

  if (action === 'save-grad-history') {
    return guard(async () => {
      const history = {
        health: Math.max(0, Number($('#gradHistHealth').value) || 0),
        care: Math.max(0, Number($('#gradHistCare').value) || 0),
        innovation: Math.max(0, Number($('#gradHistInnovation').value) || 0),
        excellence: Math.max(0, Number($('#gradHistExcellence').value) || 0),
        total: Math.max(0, Number($('#gradHistTotal')?.value) || 0)
      };
      await post('/api/config', { graduation: { history } });
      toast('歷年累計素養場次已儲存', 'ok');
      $('#gradHistoryPanel').hidden = true;
      await poll();
    });
  }

  if (action === 'filter-lit') {
    const lit = button.dataset.val;
    $('#literacyFilter').value = lit;
    S.literacyFilter = lit;
    if (S.snap) renderLectures(S.snap);
    // 平滑滾動至講座清單
    $('#cardLectures').scrollIntoView({ behavior: 'smooth' });
    return;
  }


  if (action === 'save-settings') {
    return guard(async () => {
      const seconds = Number($('#intervalSec').value);
      const bfree = $('#bfreeSelect')?.value === 'Y' ? 'Y' : 'N';
      await post('/api/config', {
        engine: {
          intervalMs: Math.round(Math.min(30, Math.max(1, seconds)) * 1000),
          stopWhenAllDone: $('#stopDoneToggle').checked,
          bfree
        },
        notify: {
          sound: $('#soundToggle').checked,
          desktop: $('#notifyToggle').checked
        }
      });
      toast('設定已儲存', 'ok');
    });
  }

  if (action === 'save-ai') {
    return guard(async () => {
      const apiKey = $('#aiKey').value.trim();
      const aiPatch = {
        enabled: $('#aiEnabled').checked,
        baseUrl: $('#aiBaseUrl').value.trim(),
        model: $('#aiModel').value.trim()
      };
      if (apiKey) aiPatch.apiKey = apiKey;
      await post('/api/config', { ai: aiPatch });
      $('#aiKey').value = '';
      toast('AI 設定已儲存', 'ok');
    });
  }

  if (action === 'agent-examples') {
    const examples = [
      '幫我挑選 2 場創新力與 1 場健康力講座，明天晚上搶課',
      '我還缺關懷力講座，幫我挑週二至週四的場次',
      '每天早上 9 點到下午 5 點搶卓越力相關的課程',
      '幫我補齊通識畢業門檻，挑選尚未達標的素養講座'
    ];
    $('#agentPrompt').value = examples[Math.floor(Math.random() * examples.length)];
    $('#agentPrompt').focus();
    return;
  }

  if (action === 'agent-plan') {
    return guard(async () => {
      const text = $('#agentPrompt').value.trim();
      if (!text) return toast('請先輸入想要挑選的講座與時間描述', 'err');
      const res = await post('/api/ai/agent', { text });
      S.agent = { reply: res.reply || '', picks: res.picks || [], schedule: res.schedule || null, source: res.source || '' };
      renderAgent(S.snap);
      if (!S.agent.picks.length && !S.agent.schedule) toast('沒有解析到相應的目標或時間', 'err');
    });
  }

  if (action === 'agent-apply') {
    return guard(async () => {
      if (!S.agent) return;
      const { picks, schedule } = S.agent;
      if (!picks.length && !schedule) return toast('沒有可加入的內容', 'err');
      const res = await post('/api/ai/agent/apply', { picks, schedule });
      S.agent = null;
      renderAgent(S.snap);
      const n = Array.isArray(res.added) ? res.added.length : 0;
      toast(`已成功加入 ${n} 個搶課目標${res.schedule ? '，並已建立排程' : ''}`, 'ok');
      await poll();
    });
  }

  if (action === 'agent-cancel') {
    S.agent = null;
    renderAgent(S.snap);
    return;
  }

  if (action === 'schedule-add') {
    return guard(async () => {
      const mode = $('#schedMode').value;
      const entry = { mode, label: $('#schedLabel').value.trim() };
      if (mode === 'open') {
        entry.leadSec = Math.max(0, Math.min(600, Number($('#schedLeadSec').value) || 15));
      } else if (mode === 'at') {
        const startVal = $('#schedStartAt').value;
        if (!startVal) return toast('請選擇開始時間', 'err');
        entry.startAt = new Date(startVal).getTime();
        const stopVal = $('#schedStopAt').value;
        if (stopVal) entry.stopAt = new Date(stopVal).getTime();
      } else {
        const days = [...document.querySelectorAll('#schedDays input[data-day]')]
          .filter((el) => el.checked)
          .map((el) => Number(el.dataset.day));
        if (!days.length) return toast('請至少選取一個星期', 'err');
        entry.days = days;
        entry.startTime = $('#schedStartTime').value || '20:00';
        entry.stopTime = $('#schedStopTime').value || '22:00';
      }
      await post('/api/schedule', { entry });
      $('#schedLabel').value = '';
      toast('已成功新增排程', 'ok');
      await poll();
    });
  }

  if (action === 'schedule-toggle') {
    return guard(async () => {
      const id = button.dataset.id;
      const entries = (S.snap?.schedule?.entries || []).map((entry) =>
        entry.id === id ? { ...entry, enabled: !entry.enabled } : entry
      );
      await post('/api/schedule', { entries });
      await poll();
    });
  }

  if (action === 'schedule-remove') {
    return guard(async () => {
      await post('/api/schedule', { remove: button.dataset.id });
      toast('已刪除排程');
      await poll();
    });
  }

  if (action === 'cal-prev' || action === 'cal-next' || action === 'cal-today') {
    if (action === 'cal-today') {
      const today = new Date();
      S.calYear = today.getFullYear();
      S.calMonth = today.getMonth();
    } else {
      const step = action === 'cal-next' ? 1 : -1;
      const cursor = new Date(S.calYear ?? new Date().getFullYear(), (S.calMonth ?? new Date().getMonth()) + step, 1);
      S.calYear = cursor.getFullYear();
      S.calMonth = cursor.getMonth();
    }
    if (S.snap) renderCalendar(S.snap);
    return;
  }

  if (action === 'cal-refresh') {
    return guard(async () => {
      const data = await getJSON('/api/calendar');
      S.calEvents = Array.isArray(data.events) ? data.events : [];
      renderCalendar(S.snap);
      toast(`已更新行事曆（共 ${S.calEvents.length} 筆）`, 'ok');
    });
  }

  if (action === 'cal-open') {
    const events = Array.isArray(S.calEvents) ? S.calEvents : S.snap?.calendar || [];
    const ev = events.find((item) => item.eid01 === button.dataset.eid);
    if (ev) {
      const lits = (ev.literacies || []).join('、');
      const litText = lits ? ` [${lits}]` : '';
      toast(`${ev.title}${litText}｜${ev.dateLabel}（${ev.weekdayLabel}）${ev.timeText}｜${ev.place || ''}`, 'ok');
    }
    return;
  }

  if (action === 'refresh') {
    return guard(async () => {
      await refreshLectures();
      await poll();
    });
  }

  if (action === 'add-target') {
    return guard(async () => {
      const eid01 = button.dataset.eid;
      await post('/api/targets', { eid01s: [eid01] });
      toast('已加入搶課目標，已自動設定開放排程', 'ok');
      await poll();
    });
  }

  if (action === 'remove-target') {
    return guard(async () => {
      await post('/api/targets/remove', { eid01: button.dataset.eid });
      await poll();
    });
  }

  if (action === 'clear-finished') {
    return guard(async () => {
      await post('/api/targets/clear');
      await poll();
    });
  }

  if (action === 'register-target' || action === 'quick-register') {
    return guard(async () => {
      const res = await post('/api/register', { eid01: button.dataset.eid });
      toast(res.message || '已送出報名請求', 'ok');
      await refreshLectures();
      await poll();
    });
  }

  if (action === 'manual-code-register') {
    return guard(async () => {
      const input = $('#manualCourseCode');
      const code = input ? input.value.trim() : '';
      if (!code) return toast('請先輸入課程代號（如 1151074）', 'err');
      const res = await post('/api/register', { eid01: code });
      toast(res.message || '報名成功', 'ok');
      if (input) input.value = '';
      await refreshLectures();
      await poll();
    });
  }

  if (action === 'manual-code-cancel') {
    const input = $('#manualCourseCode');
    const code = input ? input.value.trim() : '';
    if (!code) return toast('請先輸入課程代號（如 1151074）', 'err');
    if (!window.confirm(`確定要取消報名（退選）代號 ${code} 的講座嗎？`)) return;
    return guard(async () => {
      const res = await post('/api/cancel', { reseid: code, eid01: code, eid: code });
      toast(res.message || '已成功取消報名', 'ok');
      if (input) input.value = '';
      await refreshLectures();
      await poll();
    });
  }

  if (action === 'cancel-target') {
    if (!window.confirm('確定要取消報名（退選）這場講座嗎？（若未出席可能累積缺曠紀錄）')) return;
    return guard(async () => {
      const reseid = button.dataset.reseid || '';
      const eid01 = button.dataset.eid01 || '';
      const eid = button.dataset.eid || '';
      const res = await post('/api/cancel', { reseid, eid01, eid });
      toast(res.message || '已成功取消報名', 'ok');
      await refreshLectures();
      await poll();
    });
  }

  if (action === 'logout') {
    if (!window.confirm('確定要登出並清除目前連線階段嗎？')) return;
    return guard(async () => {
      await post('/api/logout');
      toast('已成功登出', 'ok');
      await poll();
    });
  }

  if (action === 'clear-log') {
    return guard(async () => {
      await post('/api/logs/clear');
      S.logs = [];
      S.logDirty = true;
      renderLogs();
    });
  }
});

/* ------------------------------ 表單與過濾器輸入 ------------------------------ */

$('#loginForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.target;
  guard(async () => {
    const payload = {
      username: form.username.value.trim(),
      password: form.password.value,
      idLast4: form.idLast4.value.trim(),
      remember: form.remember.checked
    };
    const savedForUser = Boolean(S.snap?.account?.saved && S.snap?.account?.username === payload.username);
    if (!payload.username) return toast('請輸入學號', 'err');
    if (!payload.password && !savedForUser) return toast('請輸入密碼', 'err');
    if (!payload.idLast4) toast('提醒：未填寫身分證末四碼將無法進行自動報名', 'err');
    const res = await post('/api/login', payload);
    if (res.identity) toast(`身分驗證成功：${res.identity.name || ''}`, 'ok');
    else toast('登入成功', 'ok');
    form.password.value = '';
    await poll();
  });
});

$('#loginForm')?.username?.addEventListener('input', (event) => {
  const loginForm = $('#loginForm');
  if (!loginForm) return;
  const typed = event.target.value.trim();
  const isSavedUser = Boolean(S.snap?.account?.saved && S.snap?.account?.username === typed);
  if (isSavedUser) {
    if (!loginForm.password.value) {
      loginForm.password.placeholder = '●●●●●●●●（已儲存，留空＝使用記住密碼）';
      loginForm.password.removeAttribute('required');
      loginForm.remember.checked = true;
    }
  } else {
    loginForm.password.placeholder = '';
    loginForm.password.setAttribute('required', '');
  }
});

$('#searchBox').addEventListener('input', (event) => {
  S.query = event.target.value;
  if (S.snap) renderLectures(S.snap);
});

$('#statusFilter').addEventListener('change', (event) => {
  S.statusFilter = event.target.value;
  if (S.snap) renderLectures(S.snap);
});

$('#literacyFilter').addEventListener('change', (event) => {
  S.literacyFilter = event.target.value;
  if (S.snap) renderLectures(S.snap);
});

$('#missingOnlyToggle').addEventListener('change', (event) => {
  S.missingOnly = event.target.checked;
  if (S.snap) renderLectures(S.snap);
});

$('#schedMode').addEventListener('change', (event) => {
  const mode = event.target.value;
  document.querySelectorAll('.sched-fields').forEach((el) => {
    el.hidden = el.dataset.mode !== mode;
  });
});

$('#scheduleEnabled').addEventListener('change', (event) => {
  const enabled = event.target.checked;
  guard(async () => {
    await post('/api/schedule', { enabled });
    toast(enabled ? '已啟用排程功能' : '已關閉排程功能');
    await poll();
  });
});

$('#showFullToggle').addEventListener('change', (event) => {
  S.showFull = event.target.checked;
  if (S.snap) renderLectures(S.snap);
});

$('#notifyToggle').addEventListener('change', (event) => {
  if (event.target.checked && 'Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
});

/* ------------------------------ PWA Service Worker 註冊 ------------------------------ */

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  S.deferredInstallPrompt = e;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  const pwaBtn = $('#pwaInstallBtn');
  if (pwaBtn && !isStandalone) pwaBtn.hidden = false;
});

window.addEventListener('appinstalled', () => {
  S.deferredInstallPrompt = null;
  const pwaBtn = $('#pwaInstallBtn');
  if (pwaBtn) pwaBtn.hidden = true;
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err) => {
      console.warn('[PWA] Service Worker 註冊失敗：', err);
    });
  });
}
/* ------------------------------ 全域鍵盤快捷鍵系統 ------------------------------ */

window.addEventListener('keydown', (event) => {
  const activeTag = document.activeElement?.tagName?.toLowerCase();
  const isInput = activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select';

  if (event.key === 'Escape') {
    if (isInput) document.activeElement.blur();
    const recPanel = $('#gradRecommendPanel');
    if (recPanel && !recPanel.hidden) recPanel.hidden = true;
    return;
  }

  if (isInput) return;

  if (event.key === '1') {
    switchView('lectures');
  } else if (event.key === '2') {
    switchView('targets');
  } else if (event.key === '3') {
    switchView('calendar');
  } else if (event.key === '4') {
    switchView('settings');
  } else if (event.key === '/') {
    event.preventDefault();
    switchView('lectures');
    const sBox = $('#searchBox');
    if (sBox) {
      sBox.focus();
      sBox.select();
    }
  } else if (event.key === 'r' || event.key === 'R') {
    refreshLectures();
    poll();
    toast('已重新整理講座情報', 'ok');
  }
});

/* ------------------------------ 系統開機初始化 ------------------------------ */

async function boot() {
  preventUnwantedGestures();
  initSegmentDrag();
  window.addEventListener('resize', () => {
    updateGlider(document.body.dataset.view, false);
  });

  $('#langSelect')?.addEventListener('change', (e) => {
    applyLanguage(e.target.value);
    toast(S.lang === 'en' ? 'Switched to English' : '已切換為繁體中文', 'ok');
  });

  applyLanguage(S.lang);

  const hash = window.location.hash.replace('#', '');
  const saved = localStorage.getItem('au_lecture_view');
  switchView(hash || saved || 'lectures');
  setTimeout(() => updateGlider(document.body.dataset.view, false), 60);

  await poll();

  // 若本機已記住密碼但尚未完成登入或身分驗證（如頁面重新整理或 session 逾期），自動發起登入復原
  if (S.snap?.account?.saved && S.snap?.account?.username && (!S.snap?.session?.loggedIn || !S.snap?.session?.identityVerified)) {
    try {
      await post('/api/login', {
        username: S.snap.account.username,
        password: '',
        idLast4: S.snap.account.idLast4 || '',
        remember: true
      });
      await poll();
    } catch (err) {
      console.warn('[auth] 前端自動登入復原失敗：', err.message);
    }
  }

  try {
    await refreshLectures();
  } catch (err) {
    toast('講座清單載入失敗：' + err.message, 'err');
  }
  setInterval(poll, 1200);
  setInterval(() => {
    if (S.snap) renderLectures(S.snap);
  }, 30_000);
}

boot();
