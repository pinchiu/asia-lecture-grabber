
class CalendarHelper {
  static String extractTitle(dynamic row) {
    if (row == null) return '';
    if (row is String) return row.trim();
    if (row is Map<String, dynamic>) {
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

  static List<String> extractLiteracies(Map<String, dynamic> row) {
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

  static List<String> detectLiteracies(dynamic input) {
    if (input is Map<String, dynamic>) {
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

  static List<Map<String, dynamic>> buildCalendar(List<Map<String, dynamic>> rows) {
    final events = <Map<String, dynamic>>[];
    final seen = <String>{};

    for (final row in rows) {
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

  static String escapeIcsText(String text) {
    return text
        .replaceAll(r'\', r'\\')
        .replaceAll(';', r'\;')
        .replaceAll(',', r'\,')
        .replaceAll('\r\n', r'\n')
        .replaceAll('\n', r'\n');
  }

  static String generateIcs(List<Map<String, dynamic>> rows, {String calName = '亞洲大學通識講座'}) {
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
