import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// 提供行動端完整繁體中文與英文雙語國際化切換支援之服務類別。
/// 支援「跟隨系統語言（System）」自動適配，並允許使用者在設定中手動覆寫。
class I18n {
  I18n._();

  /// 儲存語言模式設定之本地偏好鍵名。
  static const String prefKey = 'app_language_mode';

  /// 舊版單一語言鍵名（用於平滑遷移相容）。
  static const String legacyPrefKey = 'app_language';

  /// 當前語言模式監聽器（'system' 為跟隨系統，'zh' 為手動中文，'en' 為手動英文）。
  static final ValueNotifier<String> mode = ValueNotifier<String>('system');

  /// 當前實際生效之語言代碼監聽器（'zh' 為繁體中文，'en' 為英文）。
  static final ValueNotifier<String> currentLang = ValueNotifier<String>('zh');

  /// 當前生效語言代碼。
  static String get lang => currentLang.value;

  /// 當前語言模式（'system' / 'zh' / 'en'）。
  static String get currentMode => mode.value;

  /// 是否處於跟隨系統模式。
  static bool get isSystemMode => mode.value == 'system';

  /// 是否為英文語系。
  static bool get isEn => currentLang.value == 'en';

  /// 偵測作業系統目前主要語言代碼，回傳 'en' 或 'zh'。
  static String detectSystemLanguage() {
    try {
      final code = PlatformDispatcher.instance.locale.languageCode.toLowerCase();
      return code.startsWith('en') ? 'en' : 'zh';
    } catch (_) {
      return 'zh';
    }
  }

  /// 取得系統語言的人類可讀名稱。
  static String get detectedSystemLanguageName {
    final sys = detectSystemLanguage();
    if (isEn) {
      return sys == 'en' ? 'English' : 'Traditional Chinese';
    } else {
      return sys == 'en' ? '英文' : '繁體中文';
    }
  }

  /// 依據當前模式更新生效語言。
  static void updateEffectiveLanguage() {
    if (mode.value == 'en') {
      currentLang.value = 'en';
    } else if (mode.value == 'zh') {
      currentLang.value = 'zh';
    } else {
      currentLang.value = detectSystemLanguage();
    }
  }

  /// 初始化語言設定，自本地儲存還原偏好，並註冊系統語言變更回呼。
  static Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedMode = prefs.getString(prefKey) ?? prefs.getString(legacyPrefKey);

      if (savedMode == 'en' || savedMode == 'zh' || savedMode == 'system') {
        mode.value = savedMode!;
      } else {
        mode.value = 'system';
      }
    } catch (_) {
      mode.value = 'system';
    }

    updateEffectiveLanguage();

    // 註冊作業系統語言變動監聽器
    try {
      PlatformDispatcher.instance.onLocaleChanged = () {
        if (mode.value == 'system') {
          updateEffectiveLanguage();
        }
      };
    } catch (_) {}
  }

  /// 設定語言模式（'system' / 'zh' / 'en'）並持久化至本地。
  static Future<void> setLanguageMode(String newMode) async {
    if (newMode != 'system' && newMode != 'en' && newMode != 'zh') return;
    mode.value = newMode;
    updateEffectiveLanguage();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(prefKey, newMode);
      await prefs.remove(legacyPrefKey);
    } catch (_) {}
  }

  /// 相容舊版呼叫：切換至指定語系或模式。
  static Future<void> setLanguage(String newLang) => setLanguageMode(newLang);

  /// 取得指定鍵名之語系翻譯字串，並支援變數替換。
  static String t(String key, {Map<String, dynamic>? params}) {
    final activeMap = isEn ? _en : _zh;
    var text = activeMap[key] ?? _zh[key] ?? key;

    if (params != null && params.isNotEmpty) {
      params.forEach((paramKey, paramVal) {
        text = text.replaceAll('{$paramKey}', paramVal.toString());
      });
    }

    return text;
  }

  /// 繁體中文語系對照表。
  static final Map<String, String> _zh = {
    // 應用程式基本
    'app_title': '亞洲大學講座助手',
    
    // 底部導覽標籤
    'tab_lectures': '講座情報',
    'tab_targets': '搶課排程',
    'tab_calendar': '個人行程',
    'tab_settings': '系統設定',

    // 講座情報頁
    'lectures_title': '講座情報',
    'search_hint': '搜尋講座名稱、講師或代碼...',
    'filter_all': '全部',
    'filter_health': '健康力',
    'filter_care': '關懷力',
    'filter_innovation': '創新力',
    'filter_excellence': '卓越力',
    'filter_open_only': '僅看可報名',
    'grad_progress_title': '通識講座畢業指標進度',
    'grad_total_count': '累計總場次',
    'grad_completed': '已達標',
    'grad_need_lectures': '缺 {n} 場',
    'grad_need_times': '缺 {n} 次',
    'conflict_warning': '衝堂預警',
    'venue': '地點',
    'speaker': '講師',
    'capacity': '名額',
    'code': '代碼',
    'btn_quick_register': '手動快報',
    'btn_registered': '已報名',
    'btn_add_target': '搶課排程',
    'btn_in_queue': '已在排程',
    'register_success_title': '報名成功',
    'register_failed_title': '報名未成功',
    'target_added_title': '已加入搶課排程',
    'target_added_msg': '已成功將「{title}」加入搶課排程，引擎啟動時將自動進行搶課。',
    'empty_lectures': '查無符合條件的講座',

    // 狀態標籤
    'st_open': '可報名',
    'st_waitlist': '額滿待補',
    'st_closed': '已截止',
    'st_upcoming': '未開放',
    'st_onsite': '現場報名',
    'st_other': '其他方式',

    // 搶課排程頁
    'targets_title': '搶課排程',
    'clear_finished': '清理已完成',
    'telemetry_title': '搶課狀態機即時儀表板',
    'engine_standby': '引擎待命',
    'engine_polling': '輪詢中',
    'engine_burst': '突發搶課中',
    'telemetry_standby_desc': '狀態機處於待命狀態，點擊下方啟動按鈕即可開始執行輪詢。',
    'telemetry_running_desc': '狀態機正在以智慧節流頻率監控目標清單，開放時將以極速爆發秒報。',
    'poll_count': '輪詢次數',
    'grab_count': '搶到場次',
    'btn_start_engine': '啟動搶課狀態機',
    'btn_stop_engine': '停止搶課',
    'empty_targets': '目前搶課排程清單為空\n請至「講座情報」頁面點選「搶課排程」加入目標。',
    'btn_remove': '移除',
    'btn_cancel_drop': '退選',

    // 個人行程頁
    'calendar_title': '個人行程',
    'export_ical': '匯出 iCal',
    'registered_count_desc': '目前已成功取得 {n} 場已報名講座',
    'drop_confirm_title': '確認退選講座',
    'drop_confirm_msg': '確定要取消報名「{title}」嗎？\n此操作將向校方系統送出退選請求，名額將立即釋出。',
    'btn_confirm_drop': '確認退選',
    'drop_success_title': '退選成功',
    'drop_failed_title': '退選失敗',
    'empty_registered': '目前尚無已報名講座紀錄',
    'not_logged_in_cal': '尚未登入，無法取得校方已報名清冊',
    'copy_schedule_url': '複製日曆訂閱網址',
    'copy_schedule_text': '複製課表文字',

    // 系統設定頁
    'settings_header': '系統設定',
    'section_language': '介面語言 / Language',
    'lang_system': '跟隨系統',
    'lang_zh': '繁體中文',
    'lang_en': 'English',
    'lang_system_desc': '依裝置系統語言自動適配是否為英文（目前系統：{lang}）',
    'lang_system_hint': '目前系統語言：{lang}',
    'section_auth': '校園入口帳號驗證',
    'label_username': '學生學號',
    'hint_username': '例如 11234567',
    'label_password': '入口密碼',
    'hint_password': '校園系統密碼',
    'label_idlast4': '身分證末四碼',
    'hint_idlast4': '報名必填',
    'label_remember_pwd': '記住帳號與密碼（本機安全存儲）',
    'btn_login_verify': '登入並驗證身分',
    'login_success_title': '身分驗證成功',
    'login_success_msg': '已成功登入校園入口並完成身分證末四碼驗證。\n學生姓名：{name}',
    'section_past_credits': '歷年基本素養累計補登',
    'desc_past_credits': '若在過去學期已取得部分通識講座素養，可在此手動填入場次，系統將與本期已報名場次自動累計計算：',
    'btn_save_past_credits': '儲存歷年補登資料',
    'saved_credits_msg': '已成功儲存歷年素養補登資料。',
    'section_app_updates': '應用程式更新',
    'current_version_label': '目前版本 v{version}',
    'app_update_desc': '亞洲大學通識講座自動報名助手行動端。支援 GitHub 線上檢查更新，可直接在 App 內下載最新 APK 升級或透過瀏覽器下載。',
    'btn_check_update': '檢查新版本',
    'btn_update_now': '立即在 App 內更新',
    'btn_browser_download': '瀏覽器下載',
    'already_latest_title': '已是最新版本',
    'already_latest_msg': '目前安裝版本 v{version} 已是最新正式發布版本。',
    'update_found_title': '發現新版本 {version}',
    'update_found_desc': '更新標題：{title}\n檔案大小：{size}\n\n是否立即下載並安裝更新？',
    'downloading_title': '正在下載最新版本',
    'downloading_status': '準備下載...',
    'install_hint_title': '安裝提示',
    'install_hint_msg': '下載完成，但啟動安裝失敗：{error}\n您可選擇使用瀏覽器下載安裝。',
    'download_failed_title': '下載失敗',
    'section_logs': '搶課狀態機即時日誌',
    'empty_logs': '目前尚無執行紀錄',

    // 通用按鈕與文字
    'btn_ok': '確定',
    'btn_cancel': '取消',
    'btn_later': '稍後再說',
    'error': '錯誤',
    'in_progress': '處理中...',
    'conflict_with': '與【{title}】時段衝突',
  };

  /// 英文語系對照表。
  static final Map<String, String> _en = {
    // 應用程式基本
    'app_title': 'AU Lecture Grabber',

    // 底部導覽標籤
    'tab_lectures': 'Lectures',
    'tab_targets': 'Targets',
    'tab_calendar': 'Schedule',
    'tab_settings': 'Settings',

    // 講座情報頁
    'lectures_title': 'Lectures',
    'search_hint': 'Search title, speaker, or code...',
    'filter_all': 'All',
    'filter_health': 'Health',
    'filter_care': 'Care',
    'filter_innovation': 'Innovation',
    'filter_excellence': 'Excellence',
    'filter_open_only': 'Open Only',
    'grad_progress_title': 'Graduation Threshold Progress',
    'grad_total_count': 'Total Lectures',
    'grad_completed': 'Fulfilled',
    'grad_need_lectures': 'Need {n}',
    'grad_need_times': 'Need {n}',
    'conflict_warning': 'Time Conflict',
    'venue': 'Venue',
    'speaker': 'Speaker',
    'capacity': 'Spots',
    'code': 'Code',
    'btn_quick_register': 'Register',
    'btn_registered': 'Registered',
    'btn_add_target': 'Add Target',
    'btn_in_queue': 'In Queue',
    'register_success_title': 'Registration Successful',
    'register_failed_title': 'Registration Failed',
    'target_added_title': 'Target Added',
    'target_added_msg': 'Successfully added "{title}" to the grab target queue. The engine will automatically register when open.',
    'empty_lectures': 'No matching lectures found',

    // 狀態標籤
    'st_open': 'Open',
    'st_waitlist': 'Waitlist',
    'st_closed': 'Closed',
    'st_upcoming': 'Upcoming',
    'st_onsite': 'On-site',
    'st_other': 'Other',

    // 搶課排程頁
    'targets_title': 'Grab Targets',
    'clear_finished': 'Clear Done',
    'telemetry_title': 'Realtime Engine Telemetry',
    'engine_standby': 'Standby',
    'engine_polling': 'Polling',
    'engine_burst': 'Burst Grabbing',
    'telemetry_standby_desc': 'Engine is in standby mode. Tap the button below to start monitoring.',
    'telemetry_running_desc': 'Engine is politely polling. It will burst into high-frequency grabbing as soon as slots open.',
    'poll_count': 'Poll Count',
    'grab_count': 'Grabbed',
    'btn_start_engine': 'Start Engine',
    'btn_stop_engine': 'Stop Engine',
    'empty_targets': 'Target queue is currently empty.\nPlease go to "Lectures" and tap "Add Target".',
    'btn_remove': 'Remove',
    'btn_cancel_drop': 'Drop',

    // 個人行程頁
    'calendar_title': 'My Schedule',
    'export_ical': 'Export iCal',
    'registered_count_desc': 'Currently holding {n} registered lectures',
    'drop_confirm_title': 'Confirm Drop Lecture',
    'drop_confirm_msg': 'Are you sure you want to drop "{title}"?\nThis sends a drop request to school API and releases your spot immediately.',
    'btn_confirm_drop': 'Confirm Drop',
    'drop_success_title': 'Dropped Successfully',
    'drop_failed_title': 'Drop Failed',
    'empty_registered': 'No registered lectures found',
    'not_logged_in_cal': 'Not logged in. Unable to fetch registered lectures.',
    'copy_schedule_url': 'Copy Calendar Subscription URL',
    'copy_schedule_text': 'Copy Schedule Text',

    // 系統設定頁
    'settings_header': 'Settings',
    'section_language': 'Interface Language / 介面語言',
    'lang_system': 'System',
    'lang_zh': '繁體中文',
    'lang_en': 'English',
    'lang_system_desc': 'Automatically match device system language (Current: {lang})',
    'lang_system_hint': 'Current system language: {lang}',
    'section_auth': 'Campus Portal Authentication',
    'label_username': 'Student ID',
    'hint_username': 'e.g. 11234567',
    'label_password': 'Password',
    'hint_password': 'Portal password',
    'label_idlast4': 'ID Last 4 Digits',
    'hint_idlast4': 'Required for registration',
    'label_remember_pwd': 'Remember credentials (Secure local storage)',
    'btn_login_verify': 'Login & Verify Identity',
    'login_success_title': 'Authentication Successful',
    'login_success_msg': 'Successfully logged in to campus portal and verified ID.\nStudent Name: {name}',
    'section_past_credits': 'Past Literacy Credits Entry',
    'desc_past_credits': 'If you earned literacy credits in prior semesters, enter them here to combine with current semester registrations:',
    'btn_save_past_credits': 'Save Past Credits',
    'saved_credits_msg': 'Successfully saved past literacy credits.',
    'section_app_updates': 'App Updates',
    'current_version_label': 'Current Version v{version}',
    'app_update_desc': 'AU Lecture Grabber mobile app. Supports online update check via GitHub Releases and direct in-app APK download & install.',
    'btn_check_update': 'Check for Updates',
    'btn_update_now': 'Update In-App Now',
    'btn_browser_download': 'Browser Download',
    'already_latest_title': 'Up to Date',
    'already_latest_msg': 'Installed version v{version} is already the latest official release.',
    'update_found_title': 'New Version {version} Available',
    'update_found_desc': 'Release Title: {title}\nFile Size: {size}\n\nWould you like to download and install this update now?',
    'downloading_title': 'Downloading Latest Version',
    'downloading_status': 'Preparing download...',
    'install_hint_title': 'Installation Notice',
    'install_hint_msg': 'Download completed, but launching installer failed: {error}\nYou can download via browser instead.',
    'download_failed_title': 'Download Failed',
    'section_logs': 'Engine Execution Console',
    'empty_logs': 'No execution logs yet',

    // 通用按鈕與文字
    'btn_ok': 'OK',
    'btn_cancel': 'Cancel',
    'btn_later': 'Later',
    'error': 'Error',
    'in_progress': 'Processing...',
    'conflict_with': 'Conflicts with [{title}]',
  };
}
