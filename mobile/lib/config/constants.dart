import 'package:flutter/cupertino.dart';

/// 定義行動端應用程式之全域主題配色與蘋果毛玻璃色彩系統。
class AppColors {
  AppColors._();

  /// 曜石黑背景底層色彩。
  static const Color background = Color(0xFF0C0D10);

  /// 次級表面卡片底色。
  static const Color surface = Color(0xFF16181E);

  /// 懸浮卡片與對話框背景色彩。
  static const Color surfaceElevated = Color(0xFF1D2027);

  /// 卡片邊框微光線條色彩。
  static const Color surfaceBorder = Color(0x1FFFFFFF);

  /// 極細分隔線色彩。
  static const Color hairline = Color(0x14FFFFFF);

  /// 頂部與底部毛玻璃導覽列底色。
  static const Color glassBar = Color(0xE0121418);

  /// 蘋果高階單色強調主色（白色）。
  static const Color primary = Color(0xFFFFFFFF);

  /// 主要強調按鈕內文色彩（黑色）。
  static const Color primaryText = Color(0xFF000000);

  /// 主要標題與正文字體色彩。
  static const Color textPrimary = Color(0xFFF5F5F7);

  /// 次要文字與補充說明色彩。
  static const Color textSecondary = Color(0xFFA1A1A6);

  /// 第三級輔助文字色彩。
  static const Color textTertiary = Color(0xFF8E8E93);

  /// 弱化提示文字與圖示色彩。
  static const Color textMuted = Color(0xFF71717A);

  /// 報名成功與健康力素養代表色彩。
  static const Color accentGreen = Color(0xFF30D158);

  /// 可報名提示與資訊代表色彩。
  static const Color accentBlue = Color(0xFF0A84FF);

  /// 監控中與待補狀態代表色彩。
  static const Color accentOrange = Color(0xFFFF9F0A);

  /// 錯誤警告、已截止與退選代表色彩。
  static const Color accentRed = Color(0xFFFF453A);

  /// 卓越力素養代表色彩。
  static const Color accentPurple = Color(0xFFBF5AF2);

  /// 創新力素養代表色彩。
  static const Color accentTeal = Color(0xFF64D2FF);
}

/// 儲存行動端應用程式之全域靜態常數設定。
class AppConstants {
  AppConstants._();

  /// 應用程式繁體中文標題。
  static const String appTitle = '亞洲大學講座助手';
}
