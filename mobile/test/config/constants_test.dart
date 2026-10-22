import 'package:flutter/cupertino.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:asia_lecture_grabber/config/constants.dart';

void main() {
  group('AppColors 主題配色定義', () {
    test('曜石深色背景與毛玻璃表面色彩定義正確', () {
      expect(AppColors.background, equals(const Color(0xFF0C0D10)));
      expect(AppColors.surface, equals(const Color(0xFF16181E)));
      expect(AppColors.surfaceElevated, equals(const Color(0xFF1D2027)));
      expect(AppColors.surfaceBorder, equals(const Color(0x1FFFFFFF)));
      expect(AppColors.hairline, equals(const Color(0x14FFFFFF)));
      expect(AppColors.glassBar, equals(const Color(0xE0121418)));
    });

    test('單色層次與文字色彩定義正確', () {
      expect(AppColors.primary, equals(const Color(0xFFFFFFFF)));
      expect(AppColors.primaryText, equals(const Color(0xFF000000)));
      expect(AppColors.textPrimary, equals(const Color(0xFFF5F5F7)));
      expect(AppColors.textSecondary, equals(const Color(0xFFA1A1A6)));
      expect(AppColors.textMuted, equals(const Color(0xFF71717A)));
    });

    test('狀態燈與四大素養標籤色彩定義正確', () {
      expect(AppColors.accentGreen, equals(const Color(0xFF30D158)));
      expect(AppColors.accentBlue, equals(const Color(0xFF0A84FF)));
      expect(AppColors.accentOrange, equals(const Color(0xFFFF9F0A)));
      expect(AppColors.accentRed, equals(const Color(0xFFFF453A)));
      expect(AppColors.accentPurple, equals(const Color(0xFFBF5AF2)));
      expect(AppColors.accentTeal, equals(const Color(0xFF64D2FF)));
    });
  });

  group('AppConstants 靜態常數定義', () {
    test('應用程式標題符合規範', () {
      expect(AppConstants.appTitle, equals('亞洲大學講座助手'));
    });
  });
}
