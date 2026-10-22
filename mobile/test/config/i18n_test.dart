import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/config/i18n.dart';

void main() {
  group('I18n 多語言國際化測試', () {
    setUp(() {
      I18n.mode.value = 'zh';
      I18n.currentLang.value = 'zh';
    });

    test('繁體中文翻譯', () {
      expect(I18n.isEn, isFalse);
      expect(I18n.t('app_title'), equals('亞洲大學講座助手'));
      expect(I18n.t('tab_lectures'), equals('講座情報'));
      expect(I18n.t('btn_update_now'), equals('立即在 App 內更新'));
      expect(I18n.t('lang_system'), equals('跟隨系統'));
    });

    test('手動切換至英文語系', () {
      I18n.setLanguageMode('en');
      expect(I18n.currentMode, equals('en'));
      expect(I18n.isSystemMode, isFalse);
      expect(I18n.isEn, isTrue);
      expect(I18n.t('app_title'), equals('AU Lecture Grabber'));
      expect(I18n.t('tab_lectures'), equals('Lectures'));
      expect(I18n.t('btn_update_now'), equals('Update In-App Now'));
      expect(I18n.t('lang_system'), equals('System'));
    });

    test('跟隨系統模式運作', () {
      I18n.setLanguageMode('system');
      expect(I18n.currentMode, equals('system'));
      expect(I18n.isSystemMode, isTrue);
      expect(I18n.detectedSystemLanguageName, isNotEmpty);
    });

    test('支援參數替換', () {
      I18n.setLanguageMode('zh');
      expect(
        I18n.t('update_found_title', params: {'version': 'v1.4.0'}),
        equals('發現新版本 v1.4.0'),
      );

      I18n.setLanguageMode('en');
      expect(
        I18n.t('update_found_title', params: {'version': 'v1.4.0'}),
        equals('New Version v1.4.0 Available'),
      );
    });

    test('查無鍵名時優雅回退', () {
      expect(I18n.t('non_existing_key'), equals('non_existing_key'));
    });
  });
}
