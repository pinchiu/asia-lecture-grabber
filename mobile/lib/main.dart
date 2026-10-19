import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'backend/grab_engine.dart';
import 'config/constants.dart';
import 'screens/lectures_screen.dart';
import 'screens/targets_screen.dart';
import 'screens/calendar_screen.dart';
import 'screens/settings_screen.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Android 沉浸式透明狀態列與虛擬導覽列適配
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: CupertinoColors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: AppColors.background,
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // 初始化純 Dart 搶課引擎
  final engine = GrabEngine();
  await engine.initFromStorage();

  // 背景嘗試自動登入並載入清冊（不阻塞主畫面渲染）
  engine.autoLoginIfRemembered();

  runApp(AsiaLectureGrabberApp(engine: engine));
}

class AsiaLectureGrabberApp extends StatelessWidget {
  final GrabEngine engine;

  const AsiaLectureGrabberApp({super.key, required this.engine});

  @override
  Widget build(BuildContext context) {
    return CupertinoApp(
      title: AppConstants.appTitle,
      debugShowCheckedModeBanner: false,
      theme: const CupertinoThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: AppColors.background,
        barBackgroundColor: AppColors.glassBar,
        primaryColor: CupertinoColors.white,
        primaryContrastingColor: CupertinoColors.black,
        textTheme: CupertinoTextThemeData(
          primaryColor: CupertinoColors.white,
          textStyle: TextStyle(
            color: AppColors.textPrimary,
            fontFamily: '.SF Pro Text',
          ),
        ),
      ),
      home: HomeScreen(engine: engine),
    );
  }
}

class HomeScreen extends StatefulWidget {
  final GrabEngine engine;

  const HomeScreen({super.key, required this.engine});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final PageController _pageController;
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _onTabTapped(int index) {
    if (_currentIndex == index) return;
    HapticFeedback.selectionClick();
    setState(() {
      _currentIndex = index;
    });
    _pageController.animateToPage(
      index,
      duration: const Duration(milliseconds: 320),
      curve: Curves.easeInOutCubic,
    );
  }

  void _onPageChanged(int index) {
    if (_currentIndex == index) return;
    HapticFeedback.selectionClick();
    setState(() {
      _currentIndex = index;
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.engine,
      builder: (context, _) {
        final targetCount = widget.engine.activeTargets().length;

        return CupertinoPageScaffold(
          backgroundColor: AppColors.background,
          child: Column(
            children: [
              // 支援 iOS 阻尼左右平滑滑動換頁之 PageView
              Expanded(
                child: PageView(
                  controller: _pageController,
                  physics: const BouncingScrollPhysics(),
                  onPageChanged: _onPageChanged,
                  children: [
                    _KeepAlivePage(child: LecturesScreen(engine: widget.engine)),
                    _KeepAlivePage(child: TargetsScreen(engine: widget.engine)),
                    _KeepAlivePage(child: CalendarScreen(engine: widget.engine)),
                    _KeepAlivePage(child: SettingsScreen(engine: widget.engine)),
                  ],
                ),
              ),

              // iOS 原生貼底導覽列（與 PageView 左右滑動即時雙向聯動）
              CupertinoTabBar(
                currentIndex: _currentIndex,
                onTap: _onTabTapped,
                backgroundColor: AppColors.glassBar,
                border: const Border(
                  top: BorderSide(color: AppColors.hairline, width: 0.5),
                ),
                activeColor: CupertinoColors.white,
                inactiveColor: AppColors.textMuted,
                iconSize: 22,
                items: [
                  const BottomNavigationBarItem(
                    icon: Icon(CupertinoIcons.book),
                    activeIcon: Icon(CupertinoIcons.book_fill),
                    label: '講座情報',
                  ),
                  BottomNavigationBarItem(
                    icon: _buildBadgeIcon(CupertinoIcons.alarm, targetCount),
                    activeIcon: _buildBadgeIcon(CupertinoIcons.alarm_fill, targetCount),
                    label: '搶課排程',
                  ),
                  const BottomNavigationBarItem(
                    icon: Icon(CupertinoIcons.calendar),
                    activeIcon: Icon(CupertinoIcons.calendar_today),
                    label: '個人行程',
                  ),
                  const BottomNavigationBarItem(
                    icon: Icon(CupertinoIcons.gear_alt),
                    activeIcon: Icon(CupertinoIcons.gear_alt_fill),
                    label: '系統設定',
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBadgeIcon(IconData iconData, int count) {
    if (count <= 0) {
      return Icon(iconData);
    }
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Icon(iconData),
        Positioned(
          top: -3,
          right: -8,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
            decoration: BoxDecoration(
              color: AppColors.accentRed,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.background, width: 1.2),
            ),
            constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
            child: Text(
              count > 99 ? '99+' : count.toString(),
              style: const TextStyle(
                color: CupertinoColors.white,
                fontSize: 9,
                fontWeight: FontWeight.bold,
              ),
              textAlign: TextAlign.center,
            ),
          ),
        ),
      ],
    );
  }
}

class _KeepAlivePage extends StatefulWidget {
  final Widget child;

  const _KeepAlivePage({required this.child});

  @override
  State<_KeepAlivePage> createState() => _KeepAlivePageState();
}

class _KeepAlivePageState extends State<_KeepAlivePage> with AutomaticKeepAliveClientMixin {
  @override
  bool get wantKeepAlive => true;

  @override
  Widget build(BuildContext context) {
    super.build(context);
    return widget.child;
  }
}
