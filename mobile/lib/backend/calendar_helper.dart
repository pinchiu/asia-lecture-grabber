/// 提供亞洲大學通識講座日曆解析、名額排版、衝堂檢測與 iCalendar 匯出之工具函式集。
class CalendarHelper {
  CalendarHelper._();

  /// 格式化講座報名名額與容納人數顯示文字。
  ///
  /// 優先清理 [row] 中的 `appnum` 欄位 HTML 標籤（如 `<br/>`）；若無則解析已選人數
  /// 與上限人數組合為「已報名/名額」字串。若傳入之 [row] 為 `null` 或非 [Map] 則回傳 `'-'`。
  static String formatCapacity(dynamic row) {
    if (row == null || row is! Map) return '-';
    final rawAppnum = (row['appnum'] ?? '').toString();
    final cleaned = rawAppnum
        .replaceAll(RegExp(r'<br\s*/?>', caseSensitive: false), ' ')
        .replaceAll(RegExp(r'<[^>]+>'), '')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    if (cleaned.isNotEmpty && cleaned != '-') {
      return cleaned;
    }

    final selnum = (row['selnum'] ?? row['cnt_10'] ?? '').toString().trim();
    final total = (row['webstd'] ?? row['maxstd'] ?? row['appmax'] ?? '').toString().trim();
    if (total.isNotEmpty && total != '0') {
      return '${selnum.isNotEmpty ? selnum : "0"}/$total';
    }

    if (selnum.isNotEmpty && selnum != '0') {
      return '$selnum 人';
    }

    return '-';
  }

  /// 擷取講座之繁體中文名稱或代表識別標題。
  ///
  /// 依序從 [row] 中解析 `rescnm`、`act_name`、`name`、`title`、`reseid_name` 或代碼 `eid01`。
  /// 若傳入之 [row] 為字串則直接去除頭尾空白回傳；若無匹配標題則回傳預設字串 `'未命名講座'`。
  static String extractTitle(dynamic row) {
    if (row == null) return '';
    if (row is String) return row.trim();
    if (row is Map) {
      final rescnm = (row['rescnm'] ?? '').toString().trim();
      if (rescnm.isNotEmpty) return rescnm;
      final actName = (row['act_name'] ?? '').toString().trim();
      if (actName.isNotEmpty) return actName;
      final name = (row['name'] ?? '').toString().trim();
      if (name.isNotEmpty) return name;
      final title = (row['title'] ?? '').toString().trim();
      if (title.isNotEmpty) return title;
      final reseidName = (row['reseid_name'] ?? '').toString().trim();
      if (reseidName.isNotEmpty) return reseidName;
      final eid01 = (row['eid01'] ?? row['id'] ?? '').toString().trim();
      return eid01.isNotEmpty ? eid01 : '未命名講座';
    }
    return '';
  }

  /// 依據講座欄位旗標擷取所屬的四大基本素養清單。
  ///
  /// 檢查 [row] 中的 `chk4`（健康力）、`chk5`（關懷力）、`chk6`（創新力）與 `chk7`（卓越力）旗標。
  /// 回傳包含符合素養名稱的 [List]。
  static List<String> extractLiteracies(Map row) {
    final list = <String>[];
    bool checkFlag(dynamic val) {
      if (val == true) return true;
      if (val == 1 || val == '1' || val == 'Y' || val == 'y' || val == 'true') return true;
      return false;
    }

    if (checkFlag(row['chk4']) || checkFlag(row['chk4_flg'])) list.add('健康力');
    if (checkFlag(row['chk5']) || checkFlag(row['chk5_flg'])) list.add('關懷力');
    if (checkFlag(row['chk6']) || checkFlag(row['chk6_flg'])) list.add('創新力');
    if (checkFlag(row['chk7']) || checkFlag(row['chk7_flg'])) list.add('卓越力');
    return list;
  }

  /// 綜合分析資料列或講座標題以偵測所屬的四大基本素養。
  ///
  /// 當 [input] 為 [Map] 時，結合 [extractLiteracies] 旗標與 [detectLiteraciesFromTitle] 標題關鍵字；
  /// 當 [input] 為 [String] 時，直接透過 [detectLiteraciesFromTitle] 分析。
  static List<String> detectLiteracies(dynamic input) {
    if (input is Map) {
      final set = <String>{};
      set.addAll(extractLiteracies(input));
      final title = extractTitle(input);
      set.addAll(detectLiteraciesFromTitle(title));
      return set.toList();
    } else if (input is String) {
      return detectLiteraciesFromTitle(input);
    }
    return [];
  }

  /// 透過講座名稱關鍵字比對預測所屬素養分類。
  ///
  /// 分析 [title] 中是否包含衛教、志工、AI 或職涯等特徵詞彙。
  static List<String> detectLiteraciesFromTitle(String title) {
    final list = <String>[];
    if (title.contains('健康') || title.contains('衛教') || title.contains('心理') || title.contains('體育') || title.contains('防疫')) {
      list.add('健康力');
    }
    if (title.contains('關懷') || title.contains('服務') || title.contains('志工') || title.contains('社會') || title.contains('弱勢') || title.contains('人權')) {
      list.add('關懷力');
    }
    if (title.contains('創新') || title.contains('科技') || title.contains('AI') || title.contains('數位') || title.contains('人工智慧') || title.contains('創業')) {
      list.add('創新力');
    }
    if (title.contains('卓越') || title.contains('國際') || title.contains('領導') || title.contains('就業') || title.contains('職涯') || title.contains('英語')) {
      list.add('卓越力');
    }
    return list;
  }

  /// 解析民國年或西元年字串並統一轉換為 ISO-8601 日期格式（`YYYY-MM-DD`）。
  ///
  /// 支援民國年格式如 `115/03/24`、`115-03-24` 與西元年格式 `2026/03/24`。
  /// 若 [str] 為 `null`、空白或無法解析之格式，則回傳 `null`。
  static String? parseYmd(String? str) {
    if (str == null || str.trim().isEmpty) return null;
    final s = str.trim();

    // 民國年格式：115/03/24 或 115-03-24
    final rocMatch = RegExp(r'^(\d{2,3})[/-](\d{1,2})[/-](\d{1,2})$').firstMatch(s);
    if (rocMatch != null) {
      final y = int.parse(rocMatch.group(1)!) + 1911;
      final m = rocMatch.group(2)!.padLeft(2, '0');
      final d = rocMatch.group(3)!.padLeft(2, '0');
      return '$y-$m-$d';
    }

    // 西元年格式：2026/03/24 或 2026-03-24
    final adMatch = RegExp(r'^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$').firstMatch(s);
    if (adMatch != null) {
      final y = adMatch.group(1)!;
      final m = adMatch.group(2)!.padLeft(2, '0');
      final d = adMatch.group(3)!.padLeft(2, '0');
      return '$y-$m-$d';
    }

    return null;
  }

  /// 解析並標準化時間字串為 24 小時制（`HH:mm`）格式。
  ///
  /// 支援全形冒號 `：` 與半形冒號 `:` 之時分表示法。
  /// 若 [str] 為 `null` 或無法解析，則回傳空字串。
  static String parseHm(String? str) {
    if (str == null || str.trim().isEmpty) return '';
    final match = RegExp(r'(\d{1,2})[:：](\d{1,2})').firstMatch(str);
    if (match != null) {
      final h = match.group(1)!.padLeft(2, '0');
      final m = match.group(2)!.padLeft(2, '0');
      return '$h:$m';
    }
    return '';
  }

  /// 將原始講座資料列建構為具備時間戳記與排序之行事曆事件清單。
  ///
  /// 排除重疊代碼之 [rows]，並依照事件開始毫秒時間戳記進行遞增排序。
  static List<Map<String, dynamic>> buildCalendar(List rows) {
    final events = <Map<String, dynamic>>[];
    final seen = <String>{};

    for (final rawRow in rows) {
      if (rawRow is! Map) continue;
      final row = rawRow;
      final eid01 = (row['eid01'] ?? '').toString();
      if (eid01.isNotEmpty && seen.contains(eid01)) continue;
      if (eid01.isNotEmpty) seen.add(eid01);

      final dateStr = parseYmd((row['rescsd'] ?? row['sdate'] ?? '').toString());
      final startHm = parseHm((row['stime'] ?? '').toString());
      final endHm = parseHm((row['etime'] ?? '').toString());

      int? startAt;
      int? endAt;
      if (dateStr != null && startHm.isNotEmpty) {
        final dt = DateTime.tryParse('${dateStr}T$startHm:00');
        if (dt != null) startAt = dt.millisecondsSinceEpoch;
      }
      if (dateStr != null && endHm.isNotEmpty) {
        final dt = DateTime.tryParse('${dateStr}T$endHm:00');
        if (dt != null) endAt = dt.millisecondsSinceEpoch;
      }

      events.add({
        'eid01': eid01,
        'reseid': (row['reseid'] ?? '').toString(),
        'eid': (row['eid'] ?? '').toString(),
        'title': extractTitle(row),
        'date': dateStr ?? '',
        'start': startHm,
        'end': endHm,
        'startAt': startAt,
        'endAt': endAt,
        'place': (row['locale'] ?? row['place'] ?? '').toString(),
        'literacies': detectLiteracies(row),
        'status': (row['cnt_10'] != null && int.tryParse(row['cnt_10'].toString()) != null && int.parse(row['cnt_10'].toString()) > 0)
            ? 'registered'
            : (row['status'] ?? 'registered').toString(),
      });
    }

    events.sort((a, b) => ((a['startAt'] as int?) ?? 0).compareTo((b['startAt'] as int?) ?? 0));
    return events;
  }

  /// 是否兩場講座的上課時間產生衝堂重疊。
  ///
  /// 比對 [a] 與 [b] 之日期與起訖時間區間。若兩者代碼相同、日期不同或任一場次未載明起訖時間，
  /// 則判定為不衝突並回傳 `false`。
  static bool hasConflict(Map a, Map b) {
    final eidA = (a['eid01'] ?? a['eid'] ?? '').toString();
    final eidB = (b['eid01'] ?? b['eid'] ?? '').toString();
    if (eidA.isNotEmpty && eidB.isNotEmpty && eidA == eidB) return false;

    // 若兩者均已解析為具備數值時間戳記之事件物件，優先直接比對時間戳
    final num? startAtA = a['startAt'] as num?;
    final num? endAtA = (a['endAt'] as num?) ?? (startAtA != null ? startAtA + 7200000 : null);
    final num? startAtB = b['startAt'] as num?;
    final num? endAtB = (b['endAt'] as num?) ?? (startAtB != null ? startAtB + 7200000 : null);

    if (startAtA != null && endAtA != null && startAtB != null && endAtB != null) {
      return startAtA < endAtB && startAtB < endAtA;
    }

    final rawDateA = a['rescsd'] ?? a['sdate'] ?? a['date'];
    final rawDateB = b['rescsd'] ?? b['sdate'] ?? b['date'];
    if (rawDateA == null || rawDateB == null) return false;

    final dateA = parseYmd(rawDateA.toString()) ?? rawDateA.toString().trim();
    final dateB = parseYmd(rawDateB.toString()) ?? rawDateB.toString().trim();
    if (dateA.isEmpty || dateB.isEmpty || dateA != dateB) return false;

    final stimeA = parseHm((a['stime'] ?? a['start'] ?? '').toString());
    String etimeA = parseHm((a['etime'] ?? a['end'] ?? '').toString());
    final stimeB = parseHm((b['stime'] ?? b['start'] ?? '').toString());
    String etimeB = parseHm((b['etime'] ?? b['end'] ?? '').toString());

    if (stimeA.isEmpty || stimeB.isEmpty) return false;

    // 缺少結束時間時，回退依開始時間預設加 2 小時
    if (etimeA.isEmpty) {
      final h = int.tryParse(stimeA.substring(0, 2)) ?? 0;
      etimeA = '${(h + 2).toString().padLeft(2, '0')}:${stimeA.substring(3)}';
    }
    if (etimeB.isEmpty) {
      final h = int.tryParse(stimeB.substring(0, 2)) ?? 0;
      etimeB = '${(h + 2).toString().padLeft(2, '0')}:${stimeB.substring(3)}';
    }

    return stimeA.compareTo(etimeB) < 0 && stimeB.compareTo(etimeA) < 0;
  }

  /// 交叉比對講座清單並找出所有產生衝堂的講座代碼集合。
  ///
  /// 遍歷 [list] 中所有講座配對並使用 [hasConflict] 檢驗，回傳包含衝突代碼的 [Set]。
  static Set<String> findConflicts(List list) {
    final conflictSet = <String>{};
    for (int i = 0; i < list.length; i++) {
      final a = list[i];
      if (a is! Map) continue;
      for (int j = i + 1; j < list.length; j++) {
        final b = list[j];
        if (b is! Map) continue;
        if (hasConflict(a, b)) {
          final idA = (a['eid01'] ?? a['eid'] ?? '').toString();
          final idB = (b['eid01'] ?? b['eid'] ?? '').toString();
          if (idA.isNotEmpty) conflictSet.add(idA);
          if (idB.isNotEmpty) conflictSet.add(idB);
        }
      }
    }
    return conflictSet;
  }

  /// 將已報名講座清單格式化為易於閱讀與複製的純文字課表。
  ///
  /// 呼叫 [buildCalendar] 解析 [rows]，若清單為空則回傳提示訊息。
  static String formatScheduleText(List rows) {
    final events = buildCalendar(rows);
    if (events.isEmpty) return '目前尚無已報名講座行程。';

    final buffer = StringBuffer();
    buffer.writeln('亞洲大學 通識講座個人課表');
    buffer.writeln('總場次：${events.length} 場');
    buffer.writeln('----------------------------------------');

    for (int i = 0; i < events.length; i++) {
      final ev = events[i];
      final litsList = ev['literacies'] as List?;
      final lits = litsList != null && litsList.isNotEmpty ? litsList.join('、') : '一般';
      buffer.writeln('${i + 1}. 【${ev['title']}】');
      buffer.writeln('   時間：${ev['date']} ${ev['start']} ~ ${ev['end']}');
      buffer.writeln('   地點：${ev['place'] ?? "亞洲大學"}');
      buffer.writeln('   素養：$lits');
      buffer.writeln('   代碼：${ev['eid01']}');
      if (i < events.length - 1) buffer.writeln();
    }
    return buffer.toString();
  }

  /// 將 [DateTime] 轉換為 iCalendar 標準 UTC 時間字串格式。
  ///
  /// 產出格式為 `YYYYMMDDTHHMMSSZ`。
  static String formatIcsDate(DateTime dt) {
    final utc = dt.toUtc();
    final y = utc.year.toString().padLeft(4, '0');
    final m = utc.month.toString().padLeft(2, '0');
    final d = utc.day.toString().padLeft(2, '0');
    final h = utc.hour.toString().padLeft(2, '0');
    final min = utc.minute.toString().padLeft(2, '0');
    final s = utc.second.toString().padLeft(2, '0');
    return '${y}${m}${d}T${h}${min}${s}Z';
  }

  /// 逸出 iCalendar 格式中之保留字元。
  ///
  /// 處理 [text] 中的反斜線、分號、逗號以及換行符號。
  static String escapeIcsText(String text) {
    return text
        .replaceAll(r'\', r'\\')
        .replaceAll(';', r'\;')
        .replaceAll(',', r'\,')
        .replaceAll('\r\n', r'\n')
        .replaceAll('\n', r'\n');
  }

  /// 產出符合 RFC 5545 規範之標準 iCalendar（`.ics`）行事曆檔案內容。
  ///
  /// 根據 [rows] 產生對應之 `VEVENT` 事件，並以 [calName] 作為行事曆標題。
  static String generateIcs(List rows, {String calName = '亞洲大學通識講座'}) {
    final events = buildCalendar(rows);
    final lines = <String>[
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Asia University//Lecture Grabber Mobile//ZH-TW',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:${escapeIcsText(calName)}',
      'X-WR-TIMEZONE:Asia/Taipei',
    ];

    final nowStamp = formatIcsDate(DateTime.now());

    for (final ev in events) {
      final startAtMs = ev['startAt'] as int?;
      final endAtMs = ev['endAt'] as int?;
      final start = startAtMs != null ? DateTime.fromMillisecondsSinceEpoch(startAtMs) : DateTime.now();
      final end = endAtMs != null ? DateTime.fromMillisecondsSinceEpoch(endAtMs) : start.add(const Duration(hours: 2));

      final litsList = ev['literacies'] as List?;
      final lits = litsList != null && litsList.isNotEmpty ? litsList.join('、') : '一般';
      final summary = '${ev['title'] ?? '校園講座'} [$lits]';
      final desc = '地點：${ev['place'] ?? '亞大校園'}\n基本素養：$lits\n課程代號：${ev['eid01'] ?? ''}';

      lines.addAll([
        'BEGIN:VEVENT',
        'UID:au-lecture-mobile-${ev['eid01'] ?? ev['eid'] ?? DateTime.now().millisecondsSinceEpoch}@asia.edu.tw',
        'DTSTAMP:$nowStamp',
        'DTSTART:${formatIcsDate(start)}',
        'DTEND:${formatIcsDate(end)}',
        'SUMMARY:${escapeIcsText(summary)}',
        'LOCATION:${escapeIcsText((ev['place'] ?? '亞洲大學').toString())}',
        'DESCRIPTION:${escapeIcsText(desc)}',
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ]);
    }

    lines.add('END:VCALENDAR');
    return lines.join('\r\n') + '\r\n';
  }
}
