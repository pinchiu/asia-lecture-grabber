import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/calendar_helper.dart';
import '../config/constants.dart';

class LecturesScreen extends StatefulWidget {
  final GrabEngine engine;

  const LecturesScreen({super.key, required this.engine});

  @override
  State<LecturesScreen> createState() => _LecturesScreenState();
}

class _LecturesScreenState extends State<LecturesScreen> {
  String _searchQuery = '';
  String _selectedLitFilter = '全部';
  bool _isActionInProgress = false;

  final List<String> _literacyFilters = ['全部', '健康力', '關懷力', '創新力', '卓越力', '僅看可報名'];

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: AppColors.background,
      child: AnimatedBuilder(
        animation: widget.engine,
        builder: (context, _) {
          final progress = widget.engine.computeGraduationProgress();
          final allLectures = widget.engine.lectures;

          // 過濾清單
          final filteredLectures = allLectures.where((row) {
            final title = CalendarHelper.extractTitle(row);
            final place = (row['locale'] ?? row['place'] ?? '').toString();
            final speaker = (row['teachm'] ?? row['speaker'] ?? '').toString();
            final sponsor = (row['sponsr'] ?? '').toString();
            final canapp = (row['canapp'] ?? '').toString().trim().toUpperCase();
            final count = int.tryParse((row['cnt_10'] ?? '0').toString()) ?? 0;
            final isRegistered = count > 0;
            final lits = CalendarHelper.detectLiteracies(row);

            if (_searchQuery.isNotEmpty) {
              final query = _searchQuery.toLowerCase();
              final match = title.toLowerCase().contains(query) ||
                  place.toLowerCase().contains(query) ||
                  speaker.toLowerCase().contains(query) ||
                  sponsor.toLowerCase().contains(query) ||
                  lits.any((lit) => lit.toLowerCase().contains(query)) ||
                  row['eid01']?.toString().toLowerCase().contains(query) == true;
              if (!match) return false;
            }

            if (_selectedLitFilter == '僅看可報名') {
              return canapp == 'Y' && !isRegistered;
            } else if (_selectedLitFilter != '全部') {
              return lits.contains(_selectedLitFilter);
            }
            return true;
          }).toList();

          return CustomScrollView(
            physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
            slivers: [
              // iOS 原生大標題導覽列
              CupertinoSliverNavigationBar(
                backgroundColor: AppColors.glassBar,
                border: const Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
                largeTitle: const Text('講座情報', style: TextStyle(color: AppColors.textPrimary)),
                trailing: CupertinoButton(
                  padding: EdgeInsets.zero,
                  child: const Icon(CupertinoIcons.arrow_clockwise, size: 20),
                  onPressed: () async {
                    HapticFeedback.lightImpact();
                    try {
                      await widget.engine.refreshLectures();
                    } catch (e) {
                      _showToast('更新失敗：$e');
                    }
                  },
                ),
              ),

              // iOS 原生下拉回彈重新整理
              CupertinoSliverRefreshControl(
                onRefresh: () async {
                  HapticFeedback.lightImpact();
                  try {
                    await widget.engine.refreshLectures();
                  } catch (e) {
                    _showToast('載入異常：$e');
                  }
                },
              ),

              // 頂部素養畢業門檻進度總覽儀表板
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
                  child: _buildGraduationHeaderCard(progress),
                ),
              ),

              // 搜尋框
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                  child: CupertinoSearchTextField(
                    style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                    placeholder: '搜尋講座名稱、地點、講者或素養',
                    placeholderStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val.trim();
                      });
                    },
                  ),
                ),
              ),

              // 分類過濾晶片橫列（帶 iOS 平滑過渡動效與觸覺震動）
              SliverToBoxAdapter(
                child: SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  physics: const BouncingScrollPhysics(),
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Row(
                    children: _literacyFilters.map((filter) {
                      final isSelected = _selectedLitFilter == filter;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: GestureDetector(
                          onTap: () {
                            HapticFeedback.selectionClick();
                            setState(() {
                              _selectedLitFilter = filter;
                            });
                          },
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            curve: Curves.easeInOutCubic,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
                            decoration: BoxDecoration(
                              color: isSelected ? CupertinoColors.white : AppColors.surface,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected ? CupertinoColors.white : AppColors.surfaceBorder,
                                width: 0.8,
                              ),
                            ),
                            child: Text(
                              filter,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? CupertinoColors.black : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
              ),

              // 講座列表展示
              if (filteredLectures.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(CupertinoIcons.doc_text_search, size: 48, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          Text(
                            allLectures.isEmpty ? '尚無講座資料，請下拉重新整理或先登入' : '查無符合條件的講座',
                            style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
                            textAlign: TextAlign.center,
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, index) {
                        final item = filteredLectures[index];
                        return _buildLectureCard(item);
                      },
                      childCount: filteredLectures.length,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildGraduationHeaderCard(Map<String, dynamic> p) {
    final isQualified = p['qualified'] == true;
    final total = p['total'] as Map<String, dynamic>;
    final health = p['health'] as Map<String, dynamic>;
    final care = p['care'] as Map<String, dynamic>;
    final innov = p['innovation'] as Map<String, dynamic>;
    final excell = p['excellence'] as Map<String, dynamic>;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder, width: 0.8),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '四大素養畢業門檻',
                style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isQualified ? AppColors.accentGreen.withValues(alpha: 0.18) : AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isQualified ? AppColors.accentGreen : AppColors.hairline,
                    width: 0.5,
                  ),
                ),
                child: Text(
                  isQualified ? '已達標' : '總計 ${total['current']}/${total['target']} 場',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isQualified ? AppColors.accentGreen : AppColors.textSecondary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              _buildMetricChip('健康力', health['current'], health['target'], AppColors.accentGreen),
              const SizedBox(width: 8),
              _buildMetricChip('關懷力', care['current'], care['target'], AppColors.accentBlue),
              const SizedBox(width: 8),
              _buildMetricChip('創新力', innov['current'], innov['target'], AppColors.accentTeal),
              const SizedBox(width: 8),
              _buildMetricChip('卓越力', excell['current'], excell['target'], AppColors.accentPurple),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMetricChip(String label, int current, int target, Color color) {
    final done = current >= target;
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 8, horizontal: 4),
        decoration: BoxDecoration(
          color: AppColors.surfaceElevated,
          borderRadius: BorderRadius.circular(10),
          border: Border.all(color: done ? color.withValues(alpha: 0.4) : AppColors.hairline, width: 0.5),
        ),
        child: Column(
          children: [
            Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
            const SizedBox(height: 3),
            Text(
              '$current/$target',
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: done ? color : AppColors.textPrimary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildLectureCard(Map<String, dynamic> row) {
    final eid01 = (row['eid01'] ?? '').toString();
    final title = CalendarHelper.extractTitle(row);
    final canapp = (row['canapp'] ?? '').toString().trim().toUpperCase();
    final count = int.tryParse((row['cnt_10'] ?? '0').toString()) ?? 0;
    final isRegistered = count > 0;
    final isTarget = widget.engine.targets.any((t) => t['eid01']?.toString() == eid01);

    final rawDate = (row['rescsd'] ?? row['sdate'] ?? '').toString();
    final dateStr = CalendarHelper.parseYmd(rawDate) ?? rawDate;
    final stime = (row['stime'] ?? '').toString();
    final etime = (row['etime'] ?? '').toString();
    final place = (row['locale'] ?? row['place'] ?? '').toString();
    final lits = CalendarHelper.detectLiteracies(row);

    Color statusColor;
    String statusText;
    if (isRegistered) {
      statusColor = AppColors.accentGreen;
      statusText = '已完成報名';
    } else if (canapp == 'Y') {
      statusColor = AppColors.accentBlue;
      statusText = '開放報名中';
    } else if (canapp == 'F') {
      statusColor = AppColors.accentOrange;
      statusText = '已額滿';
    } else if (canapp == 'N1') {
      statusColor = AppColors.textMuted;
      statusText = '尚未開放';
    } else {
      statusColor = AppColors.accentRed;
      statusText = '已截止';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isRegistered ? AppColors.accentGreen.withValues(alpha: 0.4) : AppColors.surfaceBorder,
          width: 0.8,
        ),
      ),
      child: CupertinoButton(
        padding: const EdgeInsets.all(14),
        borderRadius: BorderRadius.circular(14),
        onPressed: () => _showLectureDetail(row, title, dateStr, stime, etime, place, lits, statusText, statusColor),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 頂部狀態列與素養標籤
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(color: statusColor.withValues(alpha: 0.4), width: 0.5),
                  ),
                  child: Text(
                    statusText,
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: statusColor),
                  ),
                ),
                const SizedBox(width: 6),
                ...lits.map((lit) => Container(
                      margin: const EdgeInsets.only(right: 4),
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: AppColors.surfaceElevated,
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.hairline, width: 0.5),
                      ),
                      child: Text(
                        lit,
                        style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                      ),
                    )),
                const Spacer(),
                if (isTarget)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.accentOrange.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: const Text('排程監控中', style: TextStyle(fontSize: 10, color: AppColors.accentOrange)),
                  ),
              ],
            ),
            const SizedBox(height: 8),

            // 標題
            Text(
              title,
              style: const TextStyle(
                color: AppColors.textPrimary,
                fontSize: 15,
                fontWeight: FontWeight.w600,
                height: 1.3,
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 8),

            // 日期與地點
            Row(
              children: [
                const Icon(CupertinoIcons.time, size: 13, color: AppColors.textMuted),
                const SizedBox(width: 4),
                Text(
                  '$dateStr $stime ~ $etime',
                  style: const TextStyle(color: AppColors.textSecondary, fontSize: 12),
                ),
              ],
            ),
            if (place.isNotEmpty) ...[
              const SizedBox(height: 4),
              Row(
                children: [
                  const Icon(CupertinoIcons.location, size: 13, color: AppColors.textMuted),
                  const SizedBox(width: 4),
                  Expanded(
                    child: Text(
                      place,
                      style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                ],
              ),
            ],

            const SizedBox(height: 12),

            // 底部操作按鈕橫列
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                if (!isRegistered) ...[
                  // 加入排程按鈕
                  CupertinoButton(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                    color: isTarget ? AppColors.surfaceElevated : AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(8),
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      if (isTarget) {
                        widget.engine.removeTarget(eid01);
                        _showToast('已從排程移除');
                      } else {
                        widget.engine.addTargets([row]);
                        _showToast('已加入搶課排程');
                      }
                    },
                    child: Text(
                      isTarget ? '移除排程' : '加入排程',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: isTarget ? AppColors.accentRed : AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // 一鍵秒報按鈕
                  CupertinoButton(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    color: CupertinoColors.white,
                    borderRadius: BorderRadius.circular(8),
                    onPressed: _isActionInProgress
                        ? null
                        : () async {
                            HapticFeedback.mediumImpact();
                            setState(() => _isActionInProgress = true);
                            try {
                              final msg = await widget.engine.manualRegister(eid01);
                              _showToast(msg);
                              await widget.engine.refreshLectures();
                            } catch (e) {
                              _showToast('報名失敗：$e');
                            } finally {
                              if (mounted) setState(() => _isActionInProgress = false);
                            }
                          },
                    child: const Text(
                      '一鍵秒報',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: CupertinoColors.black),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  void _showLectureDetail(
    Map<String, dynamic> row,
    String title,
    String dateStr,
    String stime,
    String etime,
    String place,
    List<String> lits,
    String statusText,
    Color statusColor,
  ) {
    showCupertinoModalPopup(
      context: context,
      builder: (context) {
        return CupertinoActionSheet(
          title: Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          message: Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('狀態：$statusText', style: TextStyle(color: statusColor, fontWeight: FontWeight.bold)),
                const SizedBox(height: 4),
                Text('時間：$dateStr $stime ~ $etime'),
                const SizedBox(height: 4),
                Text('地點：${place.isNotEmpty ? place : "校方未載明"}'),
                if (lits.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text('素養：${lits.join("、")}'),
                ],
                const SizedBox(height: 4),
                Text('代碼：${row['eid01'] ?? ""}'),
              ],
            ),
          ),
          actions: [
            CupertinoActionSheetAction(
              child: const Text('加入 / 移除搶課排程'),
              onPressed: () {
                final eid01 = row['eid01']?.toString() ?? '';
                final isTarget = widget.engine.targets.any((t) => t['eid01']?.toString() == eid01);
                if (isTarget) {
                  widget.engine.removeTarget(eid01);
                  _showToast('已從排程移除');
                } else {
                  widget.engine.addTargets([row]);
                  _showToast('已加入搶課排程');
                }
                Navigator.pop(context);
              },
            ),
          ],
          cancelButton: CupertinoActionSheetAction(
            isDefaultAction: true,
            child: const Text('關閉'),
            onPressed: () => Navigator.pop(context),
          ),
        );
      },
    );
  }

  void _showToast(String msg) {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        content: Text(msg),
        actions: [
          CupertinoDialogAction(
            child: const Text('確定'),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }
}
