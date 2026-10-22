import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/backend/update_service.dart';

void main() {
  group('ReleaseInfo 模型物件', () {
    test('正確封裝所有版本資訊屬性', () {
      final info = ReleaseInfo(
        tagName: 'v1.3.3',
        name: '版本 1.3.3 更新',
        body: '修復日曆與衝堂問題',
        apkUrl: 'https://example.com/app.apk',
        apkSize: 10485760,
        htmlUrl: 'https://github.com/pinchiu/asia-lecture-grabber/releases/tag/v1.3.3',
        hasUpdate: true,
      );

      expect(info.tagName, equals('v1.3.3'));
      expect(info.name, equals('版本 1.3.3 更新'));
      expect(info.body, equals('修復日曆與衝堂問題'));
      expect(info.apkUrl, equals('https://example.com/app.apk'));
      expect(info.apkSize, equals(10485760));
      expect(info.htmlUrl, equals('https://github.com/pinchiu/asia-lecture-grabber/releases/tag/v1.3.3'));
      expect(info.hasUpdate, isTrue);
    });
  });

  group('UpdateService.parseVersion', () {
    test('正確解析一般與帶有前綴之版本號碼', () {
      expect(UpdateService.parseVersion('1.3.2'), equals([1, 3, 2]));
      expect(UpdateService.parseVersion('v2.0.1'), equals([2, 0, 1]));
      expect(UpdateService.parseVersion('release-3.14.0'), equals([3, 14, 0]));
    });

    test('缺少部分版號時以 0 補齊', () {
      expect(UpdateService.parseVersion('2'), equals([2, 0, 0]));
      expect(UpdateService.parseVersion('2.1'), equals([2, 1, 0]));
    });

    test('空字串或無效字串回傳預設 [0, 0, 0]', () {
      expect(UpdateService.parseVersion(''), equals([0, 0, 0]));
      expect(UpdateService.parseVersion('alpha'), equals([0, 0, 0]));
    });
  });

  group('UpdateService.isNewer', () {
    test('遠端修訂號較大時判定為有更新', () {
      expect(UpdateService.isNewer('1.4.1', '1.4.0'), isTrue);
      expect(UpdateService.isNewer('v1.4.10', '1.4.9'), isTrue);
    });

    test('遠端次版號或主版號較大時判定為有更新', () {
      expect(UpdateService.isNewer('1.5.0', '1.4.0'), isTrue);
      expect(UpdateService.isNewer('2.0.0', '1.4.0'), isTrue);
    });

    test('版本相同判定為無更新', () {
      expect(UpdateService.isNewer('1.4.0', '1.4.0'), isFalse);
      expect(UpdateService.isNewer('v1.4.0', '1.4.0'), isFalse);
    });

    test('遠端版本較舊時判定為無更新', () {
      expect(UpdateService.isNewer('1.3.9', '1.4.0'), isFalse);
      expect(UpdateService.isNewer('1.2.9', '1.4.0'), isFalse);
      expect(UpdateService.isNewer('0.9.9', '1.4.0'), isFalse);
    });
  });
}
