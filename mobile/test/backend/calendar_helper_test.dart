import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/backend/calendar_helper.dart';

void main() {
  group('CalendarHelper.formatCapacity', () {
    test('清理含有 HTML 換行標籤之名額字串', () {
      final row = {'appnum': '12<br/>50'};
      expect(CalendarHelper.formatCapacity(row), equals('12 50'));

      final rowWithBr = {'appnum': '10<br>30'};
      expect(CalendarHelper.formatCapacity(rowWithBr), equals('10 30'));
    });

    test('移除多餘 HTML 標籤與連續空白', () {
      final row = {'appnum': '<span>20</span>   <strong>100</strong>'};
      expect(CalendarHelper.formatCapacity(row), equals('20 100'));
    });

    test('當缺少 appnum 時，使用 selnum 與 total 組合名額格式', () {
      final row = {
        'selnum': '15',
        'webstd': '50',
      };
      expect(CalendarHelper.formatCapacity(row), equals('15/50'));
    });

    test('當只有已選人數且無總額時，顯示人數文字', () {
      final row = {'selnum': '35'};
      expect(CalendarHelper.formatCapacity(row), equals('35 人'));
    });

    test('輸入為 null 或無效資料時回傳預設破折號', () {
      expect(CalendarHelper.formatCapacity(null), equals('-'));
      expect(CalendarHelper.formatCapacity({}), equals('-'));
      expect(CalendarHelper.formatCapacity('invalid'), equals('-'));
    });
  });

  group('CalendarHelper.extractTitle', () {
    test('輸入為 null 時回傳空字串', () {
      expect(CalendarHelper.extractTitle(null), equals(''));
    });

    test('輸入為 String 時去除頭尾空白並回傳', () {
      expect(CalendarHelper.extractTitle('  人工智慧講座  '), equals('人工智慧講座'));
    });

    test('依優先序解析各欄位標題', () {
      expect(CalendarHelper.extractTitle({'rescnm': '健康職場講座'}), equals('健康職場講座'));
      expect(CalendarHelper.extractTitle({'act_name': '永續發展講座'}), equals('永續發展講座'));
      expect(CalendarHelper.extractTitle({'name': '創新科技實務'}), equals('創新科技實務'));
      expect(CalendarHelper.extractTitle({'title': '國際視野與領導力'}), equals('國際視野與領導力'));
      expect(CalendarHelper.extractTitle({'reseid_name': '校園職涯輔導'}), equals('校園職涯輔導'));
      expect(CalendarHelper.extractTitle({'eid01': 'CS101'}), equals('CS101'));
    });

    test('所有標題欄位皆為空時回傳未命名講座', () {
      expect(CalendarHelper.extractTitle({}), equals('未命名講座'));
      expect(CalendarHelper.extractTitle({'rescnm': '   '}), equals('未命名講座'));
    });
  });

  group('CalendarHelper.extractLiteracies 與 detectLiteracies', () {
    test('正確解析布林值旗標', () {
      final row = {
        'chk4': true,
        'chk5': false,
        'chk6': true,
        'chk7': false,
      };
      final literacies = CalendarHelper.extractLiteracies(row);
      expect(literacies, containsAll(['健康力', '創新力']));
      expect(literacies, isNot(contains('關懷力')));
      expect(literacies, isNot(contains('卓越力')));
    });

    test('正確解析字串與數字旗標', () {
      final row = {
        'chk4_flg': 'Y',
        'chk5_flg': '1',
        'chk6_flg': 1,
        'chk7_flg': 'true',
      };
      final literacies = CalendarHelper.extractLiteracies(row);
      expect(literacies, containsAll(['健康力', '關懷力', '創新力', '卓越力']));
    });

    test('依講座標題關鍵字預測素養分類', () {
      expect(CalendarHelper.detectLiteraciesFromTitle('校園心理健康與衛教講座'), contains('健康力'));
      expect(CalendarHelper.detectLiteraciesFromTitle('偏鄉志工弱勢人權關懷服務'), contains('關懷力'));
      expect(CalendarHelper.detectLiteraciesFromTitle('AI 人工智慧與數位創業科技'), contains('創新力'));
      expect(CalendarHelper.detectLiteraciesFromTitle('國際領導人才與英語職涯就業卓越'), contains('卓越力'));
    });

    test('detectLiteracies 整合欄位旗標與標題關鍵字且不重複', () {
      final row = {
        'rescnm': '心理健康衛教宣導',
        'chk4': true,
        'chk6': true,
      };
      final lits = CalendarHelper.detectLiteracies(row);
      expect(lits, containsAll(['健康力', '創新力']));
      expect(lits.where((x) => x == '健康力').length, equals(1));
    });
  });

  group('CalendarHelper.parseYmd', () {
    test('正確解析民國年格式斜線與連字符號', () {
      expect(CalendarHelper.parseYmd('115/03/24'), equals('2026-03-24'));
      expect(CalendarHelper.parseYmd('115-3-5'), equals('2026-03-05'));
      expect(CalendarHelper.parseYmd('99/12/31'), equals('2010-12-31'));
    });

    test('正確解析西元年格式', () {
      expect(CalendarHelper.parseYmd('2026/03/24'), equals('2026-03-24'));
      expect(CalendarHelper.parseYmd('2026-3-9'), equals('2026-03-09'));
    });

    test('無法解析之格式或空值回傳 null', () {
      expect(CalendarHelper.parseYmd(null), isNull);
      expect(CalendarHelper.parseYmd(''), isNull);
      expect(CalendarHelper.parseYmd('   '), isNull);
      expect(CalendarHelper.parseYmd('invalid-date'), isNull);
    });
  });

  group('CalendarHelper.parseHm', () {
    test('正確解析半形冒號時間', () {
      expect(CalendarHelper.parseHm('14:30'), equals('14:30'));
      expect(CalendarHelper.parseHm('9:5'), equals('09:05'));
    });

    test('正確解析全形冒號時間', () {
      expect(CalendarHelper.parseHm('18：00'), equals('18:00'));
      expect(CalendarHelper.parseHm('8：30'), equals('08:30'));
    });

    test('無效或空值時回傳空字串', () {
      expect(CalendarHelper.parseHm(null), equals(''));
      expect(CalendarHelper.parseHm(''), equals(''));
      expect(CalendarHelper.parseHm('下午兩點'), equals(''));
    });
  });

  group('CalendarHelper.buildCalendar', () {
    test('過濾重複代碼並依開始時間升冪排序', () {
      final rows = [
        {
          'eid01': 'LEC02',
          'rescnm': '第二場講座',
          'sdate': '115/05/20',
          'stime': '15:00',
          'etime': '17:00',
        },
        {
          'eid01': 'LEC01',
          'rescnm': '第一場講座',
          'sdate': '115/05/20',
          'stime': '10:00',
          'etime': '12:00',
        },
        {
          'eid01': 'LEC02',
          'rescnm': '第二場講座重複項',
          'sdate': '115/05/20',
          'stime': '15:00',
          'etime': '17:00',
        },
      ];

      final calendar = CalendarHelper.buildCalendar(rows);
      expect(calendar.length, equals(2));
      expect(calendar[0]['eid01'], equals('LEC01'));
      expect(calendar[1]['eid01'], equals('LEC02'));
      expect(calendar[0]['date'], equals('2026-05-20'));
      expect(calendar[0]['start'], equals('10:00'));
      expect(calendar[0]['end'], equals('12:00'));
      expect(calendar[0]['startAt'], isNotNull);
    });
  });

  group('CalendarHelper.hasConflict 與 findConflicts', () {
    test('同一代碼之講座不判定為衝突', () {
      final a = {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'};
      final b = {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'};
      expect(CalendarHelper.hasConflict(a, b), isFalse);
    });

    test('不同日期之講座不判定為衝突', () {
      final a = {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'};
      final b = {'eid01': 'L02', 'date': '2026-05-21', 'start': '10:00', 'end': '12:00'};
      expect(CalendarHelper.hasConflict(a, b), isFalse);
    });

    test('同日連續接續但未重疊不判定為衝突', () {
      final a = {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'};
      final b = {'eid01': 'L02', 'date': '2026-05-20', 'start': '12:00', 'end': '14:00'};
      expect(CalendarHelper.hasConflict(a, b), isFalse);
    });

    test('同日時段部分重疊判定為衝堂衝突', () {
      final a = {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'};
      final b = {'eid01': 'L02', 'date': '2026-05-20', 'start': '11:00', 'end': '13:00'};
      expect(CalendarHelper.hasConflict(a, b), isTrue);
    });

    test('findConflicts 正確收集所有衝突講座代碼', () {
      final list = [
        {'eid01': 'L01', 'date': '2026-05-20', 'start': '10:00', 'end': '12:00'},
        {'eid01': 'L02', 'date': '2026-05-20', 'start': '11:00', 'end': '13:00'},
        {'eid01': 'L03', 'date': '2026-05-20', 'start': '15:00', 'end': '17:00'},
      ];
      final conflicts = CalendarHelper.findConflicts(list);
      expect(conflicts, containsAll(['L01', 'L02']));
      expect(conflicts, isNot(contains('L03')));
    });
  });

  group('CalendarHelper.formatScheduleText', () {
    test('清單為空時回傳提示訊息', () {
      expect(CalendarHelper.formatScheduleText([]), equals('目前尚無已報名講座行程。'));
    });

    test('清單存在資料時產出格式化課表內容', () {
      final rows = [
        {
          'eid01': 'CS999',
          'rescnm': '人工智慧應用與實務',
          'sdate': '115/06/10',
          'stime': '13:30',
          'etime': '15:30',
          'place': '安藤忠雄美術館',
          'chk6': true,
        }
      ];
      final text = CalendarHelper.formatScheduleText(rows);
      expect(text, contains('亞洲大學 通識講座個人課表'));
      expect(text, contains('人工智慧應用與實務'));
      expect(text, contains('安藤忠雄美術館'));
      expect(text, contains('創新力'));
      expect(text, contains('CS999'));
    });
  });

  group('CalendarHelper iCalendar (.ics) 生成', () {
    test('formatIcsDate 正確產出 UTC 格式', () {
      final dt = DateTime.utc(2026, 10, 22, 8, 30, 0);
      expect(CalendarHelper.formatIcsDate(dt), equals('20261022T083000Z'));
    });

    test('escapeIcsText 逸出特殊保留字元', () {
      const input = '標題;含逗號,與反斜線\\換行\n新的一行';
      final escaped = CalendarHelper.escapeIcsText(input);
      expect(escaped, contains(r'\;'));
      expect(escaped, contains(r'\,'));
      expect(escaped, contains(r'\\'));
      expect(escaped, contains(r'\n'));
    });

    test('generateIcs 產出合法之 VCALENDAR 規格內容', () {
      final rows = [
        {
          'eid01': 'LECA1',
          'rescnm': '健康促進與防疫新知',
          'sdate': '115/09/15',
          'stime': '09:00',
          'etime': '11:00',
          'locale': '管理大樓 M001',
          'chk4': true,
        }
      ];

      final ics = CalendarHelper.generateIcs(rows, calName: '我的亞大課表');
      expect(ics, startsWith('BEGIN:VCALENDAR'));
      expect(ics, contains('VERSION:2.0'));
      expect(ics, contains('X-WR-CALNAME:我的亞大課表'));
      expect(ics, contains('BEGIN:VEVENT'));
      expect(ics, contains('SUMMARY:健康促進與防疫新知 [健康力]'));
      expect(ics, contains('LOCATION:管理大樓 M001'));
      expect(ics, contains('END:VEVENT'));
      expect(ics, endsWith('END:VCALENDAR\r\n'));
    });
  });
}
