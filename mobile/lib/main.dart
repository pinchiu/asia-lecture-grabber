import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'backend/grab_engine.dart';
import 'backend/update_service.dart';
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

    // 啟動 3 秒後背景靜默檢查是否有新版
    Future.delayed(const Duration(seconds: 3), () async {
      try {
        final info = await UpdateService.checkUpdate();
        if (mounted && info != null && info.hasUpdate) {
          _showBackgroundUpdatePrompt(info);
        }
      } catch (_) {}
    });
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

  void _showBackgroundUpdatePrompt(ReleaseInfo info) {
    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text('發現新版本 ${info.tagName}'),
        content: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text('新版本已發布：${info.name}\n是否前往「系統設定」下載安裝更新？'),
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('稍後'),
            onPressed: () => Navigator.pop(ctx),
          ),
          CupertinoDialogAction(
            isDefaultAction: true,
            child: const Text('立即前往'),
            onPressed: () {
              Navigator.pop(ctx);
              _onTabTapped(3); // 切換至系統設定
            },
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: widget.engine,
      builder: (context, _) {
        final targetCount = widget.engine.activeTargets().length;

        return CupertinoPageScaffold(
          backgroundColor: AppColors.background,
          child: Stack(
            children: [
              // 全螢幕透底 PageView（內容可滑入底部毛玻璃下方）
              Positioned.fill(
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

              // 底部懸浮貼底之 iOS 原生液態磨砂毛玻璃導覽列（支援左右滑動與直接手指拖拉滑塊特效）
              Positioned(
                left: 0,
                right: 0,
                bottom: 0,
                child: _IosTransparentGlassNavBar(
                  pageController: _pageController,
                  currentIndex: _currentIndex,
                  targetCount: targetCount,
                  onTabSelected: _onTabTapped,
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _IosTransparentGlassNavBar extends StatefulWidget {
  final PageController pageController;
  final int currentIndex;
  final int targetCount;
  final ValueChanged<int> onTabSelected;

  const _IosTransparentGlassNavBar({
    required this.pageController,
    required this.currentIndex,
    required this.targetCount,
    required this.onTabSelected,
  });

  @override
  State<_IosTransparentGlassNavBar> createState() => _IosTransparentGlassNavBarState();
}

class _IosTransparentGlassNavBarState extends State<_IosTransparentGlassNavBar> {
  bool _isDragging = false;
  double _dragPage = 0.0;

  final List<_TabItemData> _tabs = const [
    _TabItemData(icon: CupertinoIcons.book, activeIcon: CupertinoIcons.book_fill, label: '講座情報'),
    _TabItemData(icon: CupertinoIcons.alarm, activeIcon: CupertinoIcons.alarm_fill, label: '搶課排程'),
    _TabItemData(icon: CupertinoIcons.calendar, activeIcon: CupertinoIcons.calendar_today, label: '個人行程'),
    _TabItemData(icon: CupertinoIcons.gear_alt, activeIcon: CupertinoIcons.gear_alt_fill, label: '系統設定'),
  ];

  @override
  Widget build(BuildContext context) {
    return ClipRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
        child: Container(
          decoration: const BoxDecoration(
            color: Color(0x66121212), // 40% 深色液態磨砂毛玻璃
            border: Border(top: BorderSide(color: Color(0x2BFFFFFF), width: 0.5)), // 頂部高光極細邊
          ),
          child: SafeArea(
            top: false,
            child: LayoutBuilder(
              builder: (context, constraints) {
                final totalWidth = constraints.maxWidth;
                final tabWidth = totalWidth / _tabs.length;
                final gliderWidth = tabWidth - 10;

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: (details) {
                    _isDragging = true;
                    HapticFeedback.selectionClick();
                    _updateDrag(details.localPosition.dx, totalWidth, tabWidth);
                  },
                  onHorizontalDragUpdate: (details) {
                    _updateDrag(details.localPosition.dx, totalWidth, tabWidth);
                  },
                  onHorizontalDragEnd: (details) {
                    _isDragging = false;
                    final targetIndex = _dragPage.round().clamp(0, _tabs.length - 1);
                    HapticFeedback.lightImpact();
                    widget.onTabSelected(targetIndex);
                  },
                  onHorizontalDragCancel: () {
                    _isDragging = false;
                  },
                  child: SizedBox(
                    height: 56,
                    child: AnimatedBuilder(
                      animation: widget.pageController,
                      builder: (context, _) {
                        double currentPage = widget.currentIndex.toDouble();
                        if (_isDragging) {
                          currentPage = _dragPage;
                        } else if (widget.pageController.hasClients && widget.pageController.page != null) {
                          currentPage = widget.pageController.page!;
                        }

                        final gliderLeft = (currentPage * tabWidth + 5).clamp(5.0, totalWidth - gliderWidth - 5);

                        return Stack(
                          alignment: Alignment.centerLeft,
                          children: [
                            // iOS 磨砂液態毛玻璃滑塊（帶物理拖拉拉伸反饋）
                            Positioned(
                              left: gliderLeft,
                              top: 6,
                              child: Container(
                                width: gliderWidth,
                                height: 44,
                                decoration: BoxDecoration(
                                  color: const Color(0x26FFFFFF), // 純白 15% 半透明磨砂玻璃
                                  borderRadius: BorderRadius.circular(14),
                                  border: Border.all(color: const Color(0x38FFFFFF), width: 0.6),
                                  boxShadow: const [
                                    BoxShadow(
                                      color: Color(0x1A000000),
                                      blurRadius: 8,
                                      offset: Offset(0, 2),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                            // Tab 按鈕列表
                            Row(
                              children: List.generate(_tabs.length, (idx) {
                                final tab = _tabs[idx];
                                final isSelected = widget.currentIndex == idx;
                                final isTarget = idx == 1 && widget.targetCount > 0;

                                return Expanded(
                                  child: GestureDetector(
                                    behavior: HitTestBehavior.opaque,
                                    onTap: () {
                                      HapticFeedback.selectionClick();
                                      widget.onTabSelected(idx);
                                    },
                                    child: Center(
                                      child: Column(
                                        mainAxisSize: MainAxisSize.min,
                                        children: [
                                          Stack(
                                            clipBehavior: Clip.none,
                                            children: [
                                              Icon(
                                                isSelected ? tab.activeIcon : tab.icon,
                                                size: 21,
                                                color: isSelected ? CupertinoColors.white : AppColors.textMuted,
                                              ),
                                              if (isTarget)
                                                Positioned(
                                                  top: -2,
                                                  right: -7,
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                    decoration: BoxDecoration(
                                                      color: AppColors.accentRed,
                                                      borderRadius: BorderRadius.circular(8),
                                                    ),
                                                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                                                    child: Text(
                                                      widget.targetCount > 99 ? '99+' : widget.targetCount.toString(),
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
                                          ),
                                          const SizedBox(height: 3),
                                          Text(
                                            tab.label,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                              color: isSelected ? CupertinoColors.white : AppColors.textMuted,
                                            ),
                                          ),
                                        ],
                                      ),
                                    ),
                                  ),
                                );
                              }),
                            ),
                          ],
                        );
                      },
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      ),
    );
  }

  void _updateDrag(double localX, double totalWidth, double tabWidth) {
    final page = (localX - tabWidth / 2) / tabWidth;
    final clamped = page.clamp(0.0, (_tabs.length - 1).toDouble());
    if ((clamped - _dragPage).abs() > 0.01) {
      final oldInt = _dragPage.round();
      final newInt = clamped.round();
      if (oldInt != newInt) HapticFeedback.selectionClick();

      setState(() {
        _dragPage = clamped;
      });

      if (widget.pageController.hasClients) {
        widget.pageController.position.jumpTo(clamped * totalWidth);
      }
    }
  }
}

class _TabItemData {
  final IconData icon;
  final IconData activeIcon;
  final String label;

  const _TabItemData({
    required this.icon,
    required this.activeIcon,
    required this.label,
  });
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
