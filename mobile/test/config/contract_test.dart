import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/config/contract.g.dart';

void main() {
  group('Node 與 Dart 共用契約', () {
    test('退選成功字串包含空字串與雙引號字串', () {
      expect(isCancelSuccessText(''), isTrue);
      expect(isCancelSuccessText('""'), isTrue);
      expect(isCancelSuccessText('   '), isTrue);
      expect(isCancelSuccessText('退選失敗'), isFalse);
    });

    test('缺少結束時間的預設長度為 2 小時', () {
      expect(missingEndFallbackMs, equals(2 * 60 * 60 * 1000));
    });

    test('畢業門檻與 AGENTS.md 一致', () {
      expect(graduationTotalThreshold, equals(8));
      expect(graduationLiteracyThreshold, equals(2));
    });
  });
}
