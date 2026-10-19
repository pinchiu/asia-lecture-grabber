import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'backend/in_app_server.dart';
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

  // 啟動本機獨立內嵌伺服器（免電腦 Node.js 伺服器）
  final inAppServer = InAppServer();
  await inAppServer.start();

  // 讀取設定：預設直接使用手機本機獨立伺服器
  final prefs = await SharedPreferences.getInstance();
  final savedUrl = prefs.getString(AppConstants.prefKeyHostUrl);
  final initialUrl = (savedUrl != null && savedUrl.isNotEmpty) ? savedUrl : inAppServer.localUrl;

  runApp(AsiaLectureGrabberApp(
    initialUrl: initialUrl,
    inAppServer: inAppServer,
  ));
}

class AsiaLectureGrabberApp extends StatelessWidget {
  final String initialUrl;
  final InAppServer inAppServer;

  const AsiaLectureGrabberApp({
    super.key,
    required this.initialUrl,
    required this.inAppServer,
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
      home: WebViewScreen(
        initialUrl: initialUrl,
        inAppServer: inAppServer,
      ),
    );
  }
}
