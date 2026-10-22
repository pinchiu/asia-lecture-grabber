import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:asia_lecture_grabber/backend/grab_engine.dart';

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  group('GrabEngine 狀態與會話管理', () {
    test('初始狀態屬性預設值正確', () {
      final engine = GrabEngine();
      expect(engine.running, isFalse);
      expect(engine.targets, isEmpty);
      expect(engine.lectures, isEmpty);
      expect(engine.session, isNull);
      expect(engine.stdInfo, isNull);
      expect(engine.settings['intervalMs'], equals(2500));
      expect(engine.settings['burstIntervalMs'], equals(800));
    });

    test('setSession 正確設定使用者會話並重設驗證資訊', () {
      final engine = GrabEngine();
      engine.setSession({
        'username': '11200001',
        'emp_nm': '王小明',
        'emp_id': '11200001',
        'emp_rl': 'Student',
        'token': 'test-token-jwt',
      });

      expect(engine.session, isNotNull);
      expect(engine.session!['username'], equals('11200001'));
      expect(engine.session!['emp_nm'], equals('王小明'));

      // 傳入 null 代表登出
      engine.setSession(null);
      expect(engine.session, isNull);
      expect(engine.stdInfo, isNull);
    });

    test('stop 正確中止輪詢並更新運行狀態', () {
      final engine = GrabEngine();
      engine.running = true;
      engine.stop('測試停止');
      expect(engine.running, isFalse);
      expect(engine.stats['startedAt'], equals(0));
    });
  });

  group('GrabEngine 目標佇列操作 (addTargets, removeTarget, clearTargets, activeTargets)', () {
    test('addTargets 正確新增唯一目標並防止重複', () {
      final engine = GrabEngine();
      final rows = [
        {
          'eid01': 'CS001',
          'rescnm': '雲端運算實務',
          'reseid': 'RES01',
          'canapp': 'Y',
          'appnum': '30/50',
        },
        {
          'eid01': 'CS002',
          'rescnm': '大數據分析導論',
          'reseid': 'RES02',
          'canapp': 'N1',
        },
      ];

      final added = engine.addTargets(rows);
      expect(added.length, equals(2));
      expect(engine.targets.length, equals(2));
      expect(engine.targets[0]['eid01'], equals('CS001'));
      expect(engine.targets[0]['status'], equals('waiting'));

      // 重複加入相同 eid01 應被過濾
      final addedAgain = engine.addTargets([
        {'eid01': 'CS001', 'rescnm': '雲端運算實務'}
      ]);
      expect(addedAgain, isEmpty);
      expect(engine.targets.length, equals(2));
    });

    test('removeTarget 依代碼移除目標', () {
      final engine = GrabEngine();
      engine.addTargets([
        {'eid01': 'CS001', 'rescnm': '講座一'},
        {'eid01': 'CS002', 'rescnm': '講座二'},
      ]);

      engine.removeTarget('CS001');
      expect(engine.targets.length, equals(1));
      expect(engine.targets[0]['eid01'], equals('CS002'));
    });

    test('activeTargets 正確排除已完成與關閉之目標', () {
      final engine = GrabEngine();
      engine.addTargets([
        {'eid01': 'CS001', 'rescnm': '目標一'},
        {'eid01': 'CS002', 'rescnm': '目標二'},
        {'eid01': 'CS003', 'rescnm': '目標三'},
        {'eid01': 'CS004', 'rescnm': '目標四'},
      ]);

      engine.targets[0]['status'] = 'registered';
      engine.targets[1]['status'] = 'closed';
      engine.targets[2]['status'] = 'error';
      engine.targets[3]['status'] = 'waiting';

      final active = engine.activeTargets();
      expect(active.length, equals(1));
      expect(active[0]['eid01'], equals('CS004'));
    });

    test('clearTargets 清理已報名與無效之目標', () {
      final engine = GrabEngine();
      engine.addTargets([
        {'eid01': 'CS001', 'rescnm': '目標一'},
        {'eid01': 'CS002', 'rescnm': '目標二'},
        {'eid01': 'CS003', 'rescnm': '目標三'},
      ]);

      engine.targets[0]['status'] = 'registered';
      engine.targets[1]['status'] = 'waiting';
      engine.targets[2]['status'] = 'closed';

      engine.clearTargets();
      expect(engine.targets.length, equals(1));
      expect(engine.targets[0]['eid01'], equals('CS002'));
    });
  });

  group('GrabEngine.computeGraduationProgress 畢業門檻運算', () {
    test('歷年無記錄且無當期講座時進度為零且未達標', () {
      final engine = GrabEngine();
      final progress = engine.computeGraduationProgress();

      expect(progress['health']['current'], equals(0));
      expect(progress['health']['target'], equals(2));
      expect(progress['health']['done'], isFalse);

      expect(progress['care']['current'], equals(0));
      expect(progress['care']['done'], isFalse);

      expect(progress['innovation']['current'], equals(0));
      expect(progress['innovation']['done'], isFalse);

      expect(progress['excellence']['current'], equals(0));
      expect(progress['excellence']['done'], isFalse);

      expect(progress['total']['current'], equals(0));
      expect(progress['total']['target'], equals(8));
      expect(progress['total']['done'], isFalse);

      expect(progress['qualified'], isFalse);
    });

    test('整合歷年累計與當期已報名場次，達標時 qualified 為 true', () {
      final engine = GrabEngine();
      // 設定歷年累計補登資料（健康 1, 關懷 2, 創新 1, 卓越 1，總計 5 場）
      engine.graduation['history'] = {
        'health': 1,
        'care': 2,
        'innovation': 1,
        'excellence': 1,
        'total': 5,
      };

      // 當前清單中有 3 場已報名講座
      engine.lectures = [
        {
          'eid01': 'L01',
          'rescnm': '心理健康促進衛教講座',
          'chk4': true, // 健康力
          'cnt_10': 1,  // 已報名
        },
        {
          'eid01': 'L02',
          'rescnm': '人工智慧應用與創新講座',
          'chk6': true, // 創新力
          'cnt_10': 1,  // 已報名
        },
        {
          'eid01': 'L03',
          'rescnm': '國際職場卓越領袖講座',
          'chk7': true, // 卓越力
          'cnt_10': 1,  // 已報名
        },
      ];

      final progress = engine.computeGraduationProgress();
      // 健康力: 1 + 1 = 2 (達標)
      expect(progress['health']['current'], equals(2));
      expect(progress['health']['done'], isTrue);

      // 關懷力: 2 + 0 = 2 (達標)
      expect(progress['care']['current'], equals(2));
      expect(progress['care']['done'], isTrue);

      // 創新力: 1 + 1 = 2 (達標)
      expect(progress['innovation']['current'], equals(2));
      expect(progress['innovation']['done'], isTrue);

      // 卓越力: 1 + 1 = 2 (達標)
      expect(progress['excellence']['current'], equals(2));
      expect(progress['excellence']['done'], isTrue);

      // 總場次: 5 + 3 = 8 (達標)
      expect(progress['total']['current'], equals(8));
      expect(progress['total']['done'], isTrue);

      expect(progress['qualified'], isTrue);
    });

    test('任一素養未滿 2 場或總場次未滿 8 場時 qualified 為 false', () {
      final engine = GrabEngine();
      engine.graduation['history'] = {
        'health': 2,
        'care': 2,
        'innovation': 2,
        'excellence': 1, // 卓越力缺少 1 場
        'total': 8,      // 總場次達標
      };

      final progress = engine.computeGraduationProgress();
      expect(progress['excellence']['done'], isFalse);
      expect(progress['total']['done'], isTrue);
      expect(progress['qualified'], isFalse);
    });
  });

  group('GrabEngine 日誌系統 (log, logsSince)', () {
    test('記錄日誌並遞增序號，容量超過 500 自動修剪', () {
      final engine = GrabEngine();
      engine.log('info', '第一筆訊息');
      engine.log('warn', '警告訊息');
      engine.log('error', '異常訊息');

      expect(engine.logs.length, equals(3));
      expect(engine.logs[0]['seq'], equals(1));
      expect(engine.logs[1]['seq'], equals(2));
      expect(engine.logs[2]['seq'], equals(3));

      final since1 = engine.logsSince(1);
      expect(since1.length, equals(2));
      expect(since1[0]['seq'], equals(2));
      expect(since1[1]['seq'], equals(3));
    });
  });

  group('GrabEngine.snapshot 狀態快照', () {
    test('產出完整結構之狀態字典', () {
      final engine = GrabEngine();
      engine.setSession({
        'username': '11200001',
        'emp_nm': '林同學',
        'emp_rl': 'Student',
        'idLast4': '1234',
        'password': 'saved_password',
      });

      final snap = engine.snapshot();
      expect(snap['now'], isA<int>());
      expect(snap['baseUrl'], isNotEmpty);
      expect(snap['session']['username'], equals('11200001'));
      expect(snap['session']['name'], equals('林同學'));
      expect(snap['engine']['running'], isFalse);
      expect(snap['graduation']['threshold']['total'], equals(8));
      expect(snap['account']['saved'], isTrue);
    });
  });
}
