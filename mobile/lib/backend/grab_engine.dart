import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'asia_api.dart';
import 'calendar_helper.dart';

class GrabEngine extends ChangeNotifier {
  final AsiaApi api;
  Map<String, dynamic>? session;
  Map<String, dynamic>? stdInfo;

  List<Map<String, dynamic>> lectures = [];
  List<Map<String, dynamic>> targets = [];
  final List<Map<String, dynamic>> logs = [];
  int _logSeq = 0;

  bool running = false;
  Timer? _timer;
  bool _ticking = false;
  int _errorStreak = 0;

  Map<String, dynamic> settings = {
    'intervalMs': 2500,
    'burstIntervalMs': 800,
    'burstLeadMs': 60000,
    'postOpenBurstMs': 30000,
    'retryGapMs': 1500,
    'minRequestGapMs': 400,
    'stopWhenAllDone': true,
    'bfree': 'N',
  };

  Map<String, dynamic> graduation = {
    'history': {
      'health': 0,
      'care': 0,
      'innovation': 0,
      'excellence': 0,
      'total': 0,
    }
  };

  Map<String, dynamic> schedule = {
    'enabled': true,
    'entries': [],
  };

  Map<String, dynamic> stats = {
    'requests': 0,
    'registrations': 0,
    'ticks': 0,
    'startedAt': 0,
    'lastSyncAt': 0,
    'lastError': '',
  };

  GrabEngine({AsiaApi? apiInstance}) : api = apiInstance ?? AsiaApi();

  void log(String level, String message) {
    _logSeq++;
    final entry = {
      'seq': _logSeq,
      'time': DateTime.now().toIso8601String(),
      'level': level,
      'message': message,
    };
    logs.add(entry);
    if (logs.length > 500) {
      logs.removeRange(0, logs.length - 500);
    }
  }

  List<Map<String, dynamic>> logsSince(int sinceSeq) {
    if (sinceSeq <= 0) return List.from(logs);
    return logs.where((l) => (l['seq'] as int) > sinceSeq).toList();
  }

  Future<void> initFromStorage() async {
    final prefs = await SharedPreferences.getInstance();
    final configStr = prefs.getString('engine_config');
    if (configStr != null && configStr.isNotEmpty) {
      try {
        final cfg = jsonDecode(configStr);
        if (cfg is Map) {
          if (cfg['engine'] is Map) settings.addAll(Map<String, dynamic>.from(cfg['engine']));
          if (cfg['graduation'] is Map) graduation.addAll(Map<String, dynamic>.from(cfg['graduation']));
          if (cfg['schedule'] is Map) schedule.addAll(Map<String, dynamic>.from(cfg['schedule']));
          if (cfg['account'] is Map) {
            final acc = Map<String, dynamic>.from(cfg['account']);
            if (acc['username'] != null && acc['username'].toString().isNotEmpty) {
              session = {
                'username': acc['username'],
                'password': acc['password'] ?? '',
                'idLast4': acc['idLast4'] ?? '',
                'emp_id': acc['username'],
                'emp_nm': acc['emp_nm'] ?? '',
                'emp_rl': acc['emp_rl'] ?? 'Student',
              };
            }
          }
        }
      } catch (_) {}
    }
  }

  Future<void> persistConfig([Map<String, dynamic>? patch]) async {
    final prefs = await SharedPreferences.getInstance();
    final data = {
      'engine': settings,
      'graduation': graduation,
      'schedule': schedule,
      'account': {
        'username': session?['username'] ?? '',
        'password': session?['password'] ?? '',
        'idLast4': session?['idLast4'] ?? '',
        'emp_nm': session?['emp_nm'] ?? '',
        'emp_rl': session?['emp_rl'] ?? 'Student',
      }
    };
    await prefs.setString('engine_config', jsonEncode(data));
  }

  void setSession(Map<String, dynamic>? newSession) {
    session = newSession != null ? Map<String, dynamic>.from(newSession) : null;
    stdInfo = null;
    if (session == null) {
      if (running) stop('使用者登出');
    } else {
      log('info', '已登入：${session!['emp_nm'] ?? session!['emp_id']}');
    }
    notifyListeners();
  }

  Future<Map<String, dynamic>> ensureIdentity() async {
    if (stdInfo != null) return stdInfo!;
    final token = session?['token']?.toString();
    if (token == null || token.isEmpty) throw Exception('請先登入');
    final idLast4 = session?['idLast4']?.toString() ?? '';
    if (!RegExp(r'^\d{4}$').hasMatch(idLast4)) {
      throw Exception('請先填寫身分證字號末四碼（報名時需要身分驗證）');
    }

    final info = await api.verifyIdentity(
      token,
      pNo: session!['emp_id'].toString(),
      pId: idLast4,
      pType: session!['emp_rl'] == 'Student' ? 'S' : 'T',
    );
    stdInfo = info;
    log('info', '身分驗證成功：${info['chi_name'] ?? session!['emp_nm'] ?? session!['emp_id']}');
    return info;
  }

  List<Map<String, dynamic>> activeTargets() {
    return targets.where((t) {
      final s = (t['status'] ?? '').toString();
      return s != 'registered' && s != 'closed' && s != 'error';
    }).toList();
  }

  Future<void> start() async {
    if (running) return;
    if (session?['token'] == null) throw Exception('請先登入再啟動');
    final active = activeTargets();
    if (active.isEmpty) throw Exception('請先加入至少一個目標講座');

    await ensureIdentity();
    running = true;
    _errorStreak = 0;
    stats['startedAt'] = DateTime.now().millisecondsSinceEpoch;
    stats['lastError'] = '';
    log('info', '開始監控 ${active.length} 場目標講座（一般間隔 ${settings['intervalMs']} ms）');
    notifyListeners();
    _scheduleTick(0);
  }

  void stop([String reason = '']) {
    final wasRunning = running;
    running = false;
    _timer?.cancel();
    _timer = null;
    if (wasRunning) {
      log('info', '停止監控${reason.isNotEmpty ? "：$reason" : ""}');
      stats['startedAt'] = 0;
    }
    notifyListeners();
  }

  void _scheduleTick(int delayMs) {
    if (!running) return;
    _timer?.cancel();
    _timer = Timer(Duration(milliseconds: max(0, delayMs)), () {
      _timer = null;
      tick().catchError((err) {
        _handleTickError(err);
      });
    });
  }

  void _handleTickError(dynamic err) {
    if (!running) return;
    _errorStreak++;
    final msg = err.toString().replaceAll('Exception: ', '');
    stats['lastError'] = msg;
    log('error', '輪詢發生異常（第 $_errorStreak 次）：$msg');
    final backoff = min(30000, (2500 * pow(1.5, _errorStreak)).toInt());
    _scheduleTick(backoff);
    notifyListeners();
  }

  Future<void> tick() async {
    if (!running || _ticking) return;
    _ticking = true;
    try {
      final token = session?['token']?.toString();
      final rows = await api.listLectures(token);
      stats['ticks'] = ((stats['ticks'] as int?) ?? 0) + 1;
      stats['lastSyncAt'] = DateTime.now().millisecondsSinceEpoch;
      stats['lastError'] = '';
      _errorStreak = 0;
      lectures = rows;

      bool needBurst = false;
      final active = activeTargets();

      for (final target in active) {
        final eid01 = target['eid01']?.toString();
        final row = lectures.firstWhere((r) => r['eid01']?.toString() == eid01, orElse: () => {});
        if (row.isEmpty) continue;

        final canapp = (row['canapp'] ?? '').toString();
        final count = int.tryParse((row['cnt_10'] ?? '0').toString()) ?? 0;

        if (count > 0) {
          target['status'] = 'registered';
          target['message'] = '系統顯示已完成報名';
          log('info', '目標【${target['title']}】已成功報名');
          continue;
        }

        if (canapp == 'Y') {
          needBurst = true;
          log('info', '目標【${target['title']}】開放報名，立即送出請求！');
          await _attemptRegister(target);
        } else if (canapp == 'F') {
          // 已額滿，維持監控搶釋出名額
          target['status'] = 'waiting';
          target['message'] = '已額滿，持續監控等待退選釋出';
        } else if (canapp == 'N1') {
          // 檢查距離開放時間是否小於 burstLeadMs
          final openTimeMs = _parseOpenTime(row);
          if (openTimeMs != null) {
            final diff = openTimeMs - DateTime.now().millisecondsSinceEpoch;
            if (diff > 0 && diff <= ((settings['burstLeadMs'] as int?) ?? 60000)) {
              needBurst = true;
            }
          }
          target['status'] = 'waiting';
          target['message'] = '尚未開放報名';
        } else if (canapp == 'N2') {
          target['status'] = 'closed';
          target['message'] = '報名已截止';
        }
      }

      if (settings['stopWhenAllDone'] == true && activeTargets().isEmpty) {
        stop('所有目標皆已處理完成');
        return;
      }

      final nextDelay = needBurst
          ? ((settings['burstIntervalMs'] as int?) ?? 800)
          : ((settings['intervalMs'] as int?) ?? 2500);
      _scheduleTick(nextDelay);
    } finally {
      _ticking = false;
      notifyListeners();
    }
  }

  int? _parseOpenTime(Map<String, dynamic> row) {
    final sdate = (row['sdate'] ?? row['rescsd'] ?? '').toString();
    final stime = (row['stime'] ?? '').toString();
    final ymd = CalendarHelper.parseYmd(sdate);
    final hm = CalendarHelper.parseHm(stime);
    if (ymd != null && hm.isNotEmpty) {
      final dt = DateTime.tryParse('${ymd}T$hm:00');
      return dt?.millisecondsSinceEpoch;
    }
    return null;
  }

  Future<void> _attemptRegister(Map<String, dynamic> target) async {
    final token = session?['token']?.toString();
    if (token == null) return;
    try {
      final info = await ensureIdentity();
      final infoWithBfree = Map<String, dynamic>.from(info);
      infoWithBfree['bfree'] = (settings['bfree'] ?? 'N').toString().toUpperCase() == 'Y' ? 'Y' : 'N';

      final res = await api.registerLecture(
        token,
        stdInfo: infoWithBfree,
        eid01: target['eid01'].toString(),
        reseid: target['reseid']?.toString() ?? '',
      );

      stats['requests'] = ((stats['requests'] as int?) ?? 0) + 1;
      if (res['ok'] == true) {
        stats['registrations'] = ((stats['registrations'] as int?) ?? 0) + 1;
        target['status'] = 'registered';
        target['message'] = res['message']?.toString() ?? '報名成功';
        for (final lec in lectures) {
          if (lec['eid01']?.toString() == target['eid01']?.toString()) {
            lec['cnt_10'] = 1;
          }
        }
        log('info', '恭喜！【${target['title']}】報名成功！');
      } else {
        target['message'] = res['message']?.toString() ?? '報名未成功';
        log('warn', '【${target['title']}】報名回應：${target['message']}');
      }
    } catch (e) {
      target['message'] = '送出失敗：$e';
      log('error', '【${target['title']}】報名失敗：$e');
    }
  }

  Future<String> manualRegister(String eid01) async {
    final token = session?['token']?.toString();
    if (token == null) throw Exception('請先登入');
    final info = await ensureIdentity();
    final infoWithBfree = Map<String, dynamic>.from(info);
    infoWithBfree['bfree'] = (settings['bfree'] ?? 'N').toString().toUpperCase() == 'Y' ? 'Y' : 'N';

    final row = lectures.firstWhere((r) => r['eid01']?.toString() == eid01, orElse: () => {});
    final reseid = (row['reseid'] ?? '').toString();

    final res = await api.registerLecture(
      token,
      stdInfo: infoWithBfree,
      eid01: eid01,
      reseid: reseid,
    );
    final msg = res['message']?.toString() ?? '完成';
    if (res['ok'] != true) {
      throw Exception(msg);
    }

    stats['registrations'] = ((stats['registrations'] as int?) ?? 0) + 1;
    row['cnt_10'] = 1;
    final target = targets.firstWhere((t) => t['eid01']?.toString() == eid01, orElse: () => {});
    if (target.isNotEmpty) {
      target['status'] = 'registered';
      target['message'] = msg;
    }
    log('info', '手動報名 [$eid01] 成功：$msg');
    notifyListeners();
    return msg;
  }

  Future<String> cancelTarget(String id, {String? eid, String? reseid, String? eid01}) async {
    final token = session?['token']?.toString();
    if (token == null) throw Exception('請先登入');

    String regEid = '';
    String title = id;

    bool isEncryptedId(dynamic val) {
      if (val == null) return false;
      final s = val.toString().trim();
      return RegExp(r'^ID[A-Za-z0-9+/=]+$').hasMatch(s);
    }

    if (isEncryptedId(id)) {
      regEid = id.trim();
    } else if (isEncryptedId(eid)) {
      regEid = eid!.trim();
    } else if (isEncryptedId(reseid)) {
      regEid = reseid!.trim();
    }

    final registered = await api.listRegistered(token);
    final match = registered.firstWhere((r) {
      final rEid = (r['eid'] ?? '').toString();
      final rEid01 = (r['eid01'] ?? '').toString();
      final rReseid = (r['reseid'] ?? '').toString();
      return (eid != null && eid.isNotEmpty && (rEid == eid || rReseid == eid)) ||
          (eid01 != null && eid01.isNotEmpty && rEid01 == eid01) ||
          (reseid != null && reseid.isNotEmpty && (rReseid == reseid || rEid == reseid)) ||
          rEid == id ||
          rEid01 == id ||
          rReseid == id;
    }, orElse: () => {});

    if (match.isNotEmpty) {
      if (regEid.isEmpty) {
        if (isEncryptedId(match['eid'])) {
          regEid = match['eid'].toString().trim();
        } else if (isEncryptedId(match['reseid'])) {
          regEid = match['reseid'].toString().trim();
        }
      }
      title = CalendarHelper.extractTitle(match);
    }

    if (regEid.isEmpty) {
      throw Exception('在已報名清冊查無可退選代碼，請確認是否已向校方完成報名或已過退選時限');
    }

    await api.cancelLecture(token, regEid);
    targets.removeWhere((t) =>
        (eid01 != null && t['eid01']?.toString() == eid01) ||
        (reseid != null && t['reseid']?.toString() == reseid) ||
        t['eid01']?.toString() == id ||
        t['reseid']?.toString() == id);

    for (final lec in lectures) {
      if ((eid01 != null && lec['eid01']?.toString() == eid01) ||
          (reseid != null && lec['reseid']?.toString() == reseid) ||
          lec['eid01']?.toString() == id) {
        lec['cnt_10'] = 0;
      }
    }

    log('info', '已成功取消報名：$title');
    notifyListeners();
    return title;
  }

  List<Map<String, dynamic>> addTargets(List<Map<String, dynamic>> rows) {
    final added = <Map<String, dynamic>>[];
    for (final row in rows) {
      final eid01 = (row['eid01'] ?? '').toString();
      if (eid01.isEmpty) continue;
      if (targets.any((t) => t['eid01']?.toString() == eid01)) continue;

      final entry = {
        'eid01': eid01,
        'reseid': (row['reseid'] ?? '').toString(),
        'title': CalendarHelper.extractTitle(row),
        'status': 'waiting',
        'message': '已加入目標佇列',
        'canapp': (row['canapp'] ?? '').toString(),
        'cnt_10': (row['cnt_10'] ?? '0').toString(),
        'rescsd': (row['rescsd'] ?? row['sdate'] ?? '').toString(),
        'stime': (row['stime'] ?? '').toString(),
        'etime': (row['etime'] ?? '').toString(),
        'place': (row['locale'] ?? row['place'] ?? '').toString(),
      };
      targets.add(entry);
      added.add(entry);
      log('info', '新增搶課目標：【${entry['title']}】');
    }
    notifyListeners();
    return added;
  }

  void removeTarget(String eid01) {
    targets.removeWhere((t) => t['eid01']?.toString() == eid01);
    log('info', '已移除搶課目標：[$eid01]');
    notifyListeners();
  }

  void clearTargets() {
    targets.removeWhere((t) {
      final s = (t['status'] ?? '').toString();
      return s == 'registered' || s == 'closed' || s == 'error';
    });
    log('info', '已清理已完成之目標');
    notifyListeners();
  }

  Map<String, dynamic> snapshot() {
    return {
      'now': DateTime.now().millisecondsSinceEpoch,
      'baseUrl': api.baseUrl,
      'session': session != null
          ? {
              'username': session!['username'] ?? session!['emp_id'] ?? '',
              'name': session!['emp_nm'] ?? '',
              'role': session!['emp_rl'] ?? '',
              'idLast4': session!['idLast4'] ?? '',
            }
          : null,
      'engine': {
        'running': running,
        'stats': stats,
        'settings': settings,
        'targets': targets,
        'activeCount': activeTargets().length,
      },
      'notify': {'sound': true, 'desktop': true},
      'account': {
        'username': session?['username'] ?? '',
        'idLast4': session?['idLast4'] ?? '',
        'saved': (session?['password'] ?? '').toString().isNotEmpty,
      },
      'graduation': {
        'threshold': {'total': 8, 'health': 2, 'care': 2, 'innovation': 2, 'excellence': 2},
        'history': graduation['history'] ?? {'health': 0, 'care': 0, 'innovation': 0, 'excellence': 0, 'total': 0},
      },
      'schedule': schedule,
      'calendar': CalendarHelper.buildCalendar(lectures),
    };
  }

  Future<void> refreshLectures() async {
    final token = session?['token']?.toString();
    final rows = await api.listLectures(token);
    lectures = rows;
    stats['lastSyncAt'] = DateTime.now().millisecondsSinceEpoch;
    log('info', '已成功更新講座清單，共 ${rows.length} 場');
    notifyListeners();
  }

  Future<void> autoLoginIfRemembered() async {
    final username = session?['username']?.toString() ?? '';
    final password = session?['password']?.toString() ?? '';
    final idLast4 = session?['idLast4']?.toString() ?? '';

    if (username.isNotEmpty && password.isNotEmpty) {
      try {
        log('info', '偵測到儲存之帳密，自動嘗試登入校方系統...');
        final res = await api.login(username, password);
        final newSession = {
          'token': res['token'],
          'username': username,
          'password': password,
          'emp_id': res['emp_id'] ?? username,
          'emp_nm': res['emp_nm'] ?? '',
          'emp_rl': res['emp_rl'] ?? 'Student',
          'idLast4': idLast4,
        };
        setSession(newSession);

        if (idLast4.isNotEmpty) {
          try {
            await ensureIdentity();
          } catch (_) {}
        }
        await refreshLectures();
      } catch (e) {
        log('warn', '自動登入失敗：$e');
      }
    } else {
      try {
        await refreshLectures();
      } catch (_) {}
    }
  }

  Map<String, dynamic> computeGraduationProgress() {
    final history = Map<String, dynamic>.from(graduation['history'] ?? {});
    final histHealth = int.tryParse(history['health']?.toString() ?? '0') ?? 0;
    final histCare = int.tryParse(history['care']?.toString() ?? '0') ?? 0;
    final histInnovation = int.tryParse(history['innovation']?.toString() ?? '0') ?? 0;
    final histExcellence = int.tryParse(history['excellence']?.toString() ?? '0') ?? 0;
    final histTotal = int.tryParse(history['total']?.toString() ?? '0') ?? (histHealth + histCare + histInnovation + histExcellence);

    int currHealth = 0;
    int currCare = 0;
    int currInnovation = 0;
    int currExcellence = 0;
    int currTotal = 0;

    for (final row in lectures) {
      final cnt = int.tryParse((row['cnt_10'] ?? '0').toString()) ?? 0;
      if (cnt > 0) {
        currTotal++;
        final lits = CalendarHelper.detectLiteracies(row);
        if (lits.contains('健康力')) currHealth++;
        if (lits.contains('關懷力')) currCare++;
        if (lits.contains('創新力')) currInnovation++;
        if (lits.contains('卓越力')) currExcellence++;
      }
    }

    final totalHealth = histHealth + currHealth;
    final totalCare = histCare + currCare;
    final totalInnovation = histInnovation + currInnovation;
    final totalExcellence = histExcellence + currExcellence;
    final totalLectures = histTotal + currTotal;

    return {
      'health': {'current': totalHealth, 'target': 2, 'done': totalHealth >= 2},
      'care': {'current': totalCare, 'target': 2, 'done': totalCare >= 2},
      'innovation': {'current': totalInnovation, 'target': 2, 'done': totalInnovation >= 2},
      'excellence': {'current': totalExcellence, 'target': 2, 'done': totalExcellence >= 2},
      'total': {'current': totalLectures, 'target': 8, 'done': totalLectures >= 8},
      'qualified': totalHealth >= 2 && totalCare >= 2 && totalInnovation >= 2 && totalExcellence >= 2 && totalLectures >= 8,
    };
  }
}
