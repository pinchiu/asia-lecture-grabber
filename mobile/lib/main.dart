import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'config/constants.dart';
import 'screens/webview_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // 設定系統狀態列為透明黑底風格
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // 讀取先前儲存的伺服器網址
  final prefs = await SharedPreferences.getInstance();
  final savedUrl = prefs.getString(AppConstants.prefKeyHostUrl) ?? AppConstants.defaultUrl;

  runApp(AsiaLectureGrabberApp(initialUrl: savedUrl));
}

class AsiaLectureGrabberApp extends StatelessWidget {
  final String initialUrl;

  const AsiaLectureGrabberApp({
    super.key,
    required this.initialUrl,
  });

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: AppConstants.appTitle,
      debugShowCheckedModeBanner: false,
      themeMode: ThemeMode.dark,
      theme: ThemeData.dark().copyWith(
        scaffoldBackgroundColor: AppColors.background,
        primaryColor: AppColors.primary,
        colorScheme: const ColorScheme.dark(
          primary: AppColors.primary,
          secondary: AppColors.accentCyan,
          surface: AppColors.surface,
          error: AppColors.error,
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: AppColors.surface,
          foregroundColor: AppColors.textPrimary,
          elevation: 0,
        ),
      ),
      home: WebViewScreen(initialUrl: initialUrl),
    );
  }
}
