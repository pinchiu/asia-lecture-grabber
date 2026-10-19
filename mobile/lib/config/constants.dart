import 'package:flutter/cupertino.dart';

class AppColors {
  // 曜石深色背景底層
  static const Color background = Color(0xFF0C0D10);
  static const Color surface = Color(0xFF16181E);
  static const Color surfaceElevated = Color(0xFF1D2027);
  static const Color surfaceBorder = Color(0x1FFFFFFF);
  static const Color hairline = Color(0x14FFFFFF);

  // 頂部與底部毛玻璃
  static const Color glassBar = Color(0xE0121418);

  // 蘋果高階單色與操作高對比
  static const Color primary = Color(0xFFFFFFFF);
  static const Color primaryText = Color(0xFF000000);
  static const Color textPrimary = Color(0xFFF5F5F7);
  static const Color textSecondary = Color(0xFFA1A1A6);
  static const Color textMuted = Color(0xFF71717A);

  // 狀態與素養標籤
  static const Color accentGreen = Color(0xFF30D158); // 成功已報名
  static const Color accentBlue = Color(0xFF0A84FF);  // 可報名 / 提示
  static const Color accentOrange = Color(0xFFFF9F0A);// 監控中
  static const Color accentRed = Color(0xFFFF453A);   // 錯誤 / 截止 / 退選
  static const Color accentPurple = Color(0xFFBF5AF2);// 卓越力
  static const Color accentTeal = Color(0xFF64D2FF);  // 創新力
}

class AppConstants {
  static const String appTitle = '亞洲大學講座助手';
}
