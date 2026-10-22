import 'dart:ui';
import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import 'backend/grab_engine.dart';
import 'backend/update_service.dart';
import 'config/constants.dart';
import 'config/i18n.dart';
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

  // 初始化多語言系統
  await I18n.init();

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
    return ValueListenableBuilder<String>(
      valueListenable: I18n.currentLang,
      builder: (context, currentLang, _) {
        return CupertinoApp(
          title: I18n.t('app_title'),
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
      },
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
  ReleaseInfo? _availableUpdate;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);

    // 啟動 3 秒後背景靜默檢查是否有新版
    Future.delayed(const Duration(seconds: 3), () async {
      try {
        final info = await UpdateService.checkUpdate();
        if (mounted && info != null && info.hasUpdate) {
          setState(() {
            _availableUpdate = info;
          });
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
        title: Text(I18n.t('update_found_title', params: {'version': info.tagName})),
        content: Padding(
          padding: const EdgeInsets.only(top: 8),
          child: Text(
            '${info.name}\n\n${I18n.t('update_found_desc', params: {
                  'title': info.name,
                  'size': info.apkSize > 0 ? '${(info.apkSize / (1024 * 1024)).toStringAsFixed(1)} MB' : '—',
                })}',
          ),
        ),
        actions: [
          CupertinoDialogAction(
            child: Text(I18n.t('btn_later')),
            onPressed: () => Navigator.pop(ctx),
          ),
          if (info.apkUrl.isNotEmpty)
            CupertinoDialogAction(
              isDefaultAction: true,
              child: Text(I18n.t('btn_update_now')),
              onPressed: () {
                Navigator.pop(ctx);
                _startInAppDownload(context, info);
              },
            ),
        ],
      ),
    );
  }

  void _startInAppDownload(BuildContext context, ReleaseInfo info) {
    double progressValue = 0.0;
    String statusText = I18n.t('downloading_status');
    StateSetter? dialogSetState;

    showCupertinoDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          dialogSetState = setDialogState;
          final percent = (progressValue * 100).clamp(0, 100).toStringAsFixed(0);

          return CupertinoAlertDialog(
            title: Text(I18n.t('downloading_title')),
            content: Padding(
              padding: const EdgeInsets.symmetric(vertical: 16),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    height: 6,
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(3),
                    ),
                    child: FractionallySizedBox(
                      alignment: Alignment.centerLeft,
                      widthFactor: progressValue.clamp(0.01, 1.0),
                      child: Container(
                        decoration: BoxDecoration(
                          color: CupertinoColors.white,
                          borderRadius: BorderRadius.circular(3),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  Text('$statusText ($percent%)', style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                ],
              ),
            ),
          );
        },
      ),
    );

    UpdateService.downloadApk(
      info.apkUrl,
      onProgress: (p, received, total) {
        if (dialogSetState != null) {
          dialogSetState!(() {
            progressValue = p;
            final recMb = (received / (1024 * 1024)).toStringAsFixed(1);
            final totMb = (total / (1024 * 1024)).toStringAsFixed(1);
            statusText = '$recMb MB / $totMb MB';
          });
        }
      },
    ).then((filePath) async {
      if (mounted) Navigator.of(context, rootNavigator: true).pop();
      HapticFeedback.mediumImpact();
      try {
        await UpdateService.installApk(filePath);
      } catch (e) {
        if (mounted) {
          showCupertinoDialog(
            context: context,
            builder: (ctx) => CupertinoAlertDialog(
              title: Text(I18n.t('install_hint_title')),
              content: Text(I18n.t('install_hint_msg', params: {'error': e.toString()})),
              actions: [
                CupertinoDialogAction(
                  child: Text(I18n.t('btn_ok')),
                  onPressed: () => Navigator.pop(ctx),
                ),
              ],
            ),
          );
        }
      }
    }).catchError((err) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        showCupertinoDialog(
          context: context,
          builder: (ctx) => CupertinoAlertDialog(
            title: Text(I18n.t('download_failed_title')),
            content: Text(err.toString().replaceAll('Exception: ', '')),
            actions: [
              CupertinoDialogAction(
                child: Text(I18n.t('btn_ok')),
                onPressed: () => Navigator.pop(ctx),
              ),
            ],
          ),
        );
      }
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

              // 底部新版本在線更新提示列 (Bottom in-app update banner)
              if (_availableUpdate != null && _availableUpdate!.hasUpdate)
                Positioned(
                  left: 16,
                  right: 16,
                  bottom: 66,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xE61D2027),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.6), width: 0.8),
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x33000000),
                          blurRadius: 10,
                          offset: Offset(0, 3),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            I18n.t('update_found_title', params: {'version': _availableUpdate!.tagName}),
                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                          ),
                        ),
                        CupertinoButton(
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
                          color: AppColors.accentBlue,
                          borderRadius: BorderRadius.circular(8),
                          minSize: 28,
                          onPressed: () => _startInAppDownload(context, _availableUpdate!),
                          child: Text(
                            I18n.t('btn_update_now'),
                            style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: CupertinoColors.white),
                          ),
                        ),
                      ],
                    ),
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

  List<_TabItemData> _getTabs() => [
    _TabItemData(icon: CupertinoIcons.book, activeIcon: CupertinoIcons.book_fill, label: I18n.t('tab_lectures')),
    _TabItemData(icon: CupertinoIcons.alarm, activeIcon: CupertinoIcons.alarm_fill, label: I18n.t('tab_targets')),
    _TabItemData(icon: CupertinoIcons.calendar, activeIcon: CupertinoIcons.calendar_today, label: I18n.t('tab_calendar')),
    _TabItemData(icon: CupertinoIcons.gear_alt, activeIcon: CupertinoIcons.gear_alt_fill, label: I18n.t('tab_settings')),
  ];

  @override
  Widget build(BuildContext context) {
    final tabs = _getTabs();

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
                final tabWidth = totalWidth / tabs.length;
                final gliderWidth = tabWidth - 10;

                return GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  onHorizontalDragStart: (details) {
                    _isDragging = true;
                    HapticFeedback.selectionClick();
                    _updateDrag(details.localPosition.dx, totalWidth, tabWidth, tabs.length);
                  },
                  onHorizontalDragUpdate: (details) {
                    _updateDrag(details.localPosition.dx, totalWidth, tabWidth, tabs.length);
                  },
                  onHorizontalDragEnd: (details) {
                    _isDragging = false;
                    final targetIndex = _dragPage.round().clamp(0, tabs.length - 1);
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
                              children: List.generate(tabs.length, (idx) {
                                final tab = tabs[idx];
                                final isSelected = widget.currentIndex == idx;
                                final isTarget = idx == 1 && widget.targetCount > 0;

                                return Expanded(
                                  child: GestureDetector(
                                    behavior: HitTestBehavior.opaque,
                                    onTap: () {
                                      HapticFeedback.selectionClick();
                                      widget.onTabSelected(idx);
                                    },
                                    child: Container(
                                      color: CupertinoColors.transparent,
                                      child: Column(
                                        mainAxisAlignment: MainAxisAlignment.center,
                                        children: [
                                          Stack(
                                            clipBehavior: Clip.none,
                                            children: [
                                              Icon(
                                                isSelected ? tab.activeIcon : tab.icon,
                                                size: 21,
                                                color: isSelected ? CupertinoColors.white : const Color(0x8AFFFFFF),
                                              ),
                                              if (isTarget)
                                                Positioned(
                                                  right: -7,
                                                  top: -3,
                                                  child: Container(
                                                    padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 1),
                                                    decoration: BoxDecoration(
                                                      color: AppColors.accentBlue,
                                                      borderRadius: BorderRadius.circular(8),
                                                    ),
                                                    constraints: const BoxConstraints(minWidth: 14, minHeight: 14),
                                                    child: Text(
                                                      '${widget.targetCount}',
                                                      textAlign: TextAlign.center,
                                                      style: const TextStyle(
                                                        color: CupertinoColors.white,
                                                        fontSize: 9,
                                                        fontWeight: FontWeight.bold,
                                                      ),
                                                    ),
                                                  ),
                                                ),
                                            ],
                                          ),
                                          const SizedBox(height: 2),
                                          Text(
                                            tab.label,
                                            style: TextStyle(
                                              fontSize: 10,
                                              fontWeight: isSelected ? FontWeight.w600 : FontWeight.normal,
                                              color: isSelected ? CupertinoColors.white : const Color(0x8AFFFFFF),
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

  void _updateDrag(double dx, double totalWidth, double tabWidth, int tabCount) {
    final raw = (dx / tabWidth) - 0.5;
    final clamped = raw.clamp(0.0, (tabCount - 1).toDouble());

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
