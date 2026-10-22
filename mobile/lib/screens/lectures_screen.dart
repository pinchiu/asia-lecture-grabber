import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/calendar_helper.dart';
import '../config/constants.dart';
import '../config/i18n.dart';

class LecturesScreen extends StatefulWidget {
  final GrabEngine engine;

  const LecturesScreen({super.key, required this.engine});

  @override
  State<LecturesScreen> createState() => _LecturesScreenState();
}

class _LecturesScreenState extends State<LecturesScreen> {
  String _searchQuery = '';
  String _selectedLitFilter = 'all';
  bool _isActionInProgress = false;

  final List<String> _filterKeys = [
    'all',
    'health',
    'care',
    'innovation',
    'excellence',
    'open_only',
  ];

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

            if (_selectedLitFilter == 'open_only') {
              return canapp == 'Y' && !isRegistered;
            } else if (_selectedLitFilter == 'health') {
              return lits.contains('健康力');
            } else if (_selectedLitFilter == 'care') {
              return lits.contains('關懷力');
            } else if (_selectedLitFilter == 'innovation') {
              return lits.contains('創新力');
            } else if (_selectedLitFilter == 'excellence') {
              return lits.contains('卓越力');
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
                largeTitle: Text(I18n.t('lectures_title'), style: const TextStyle(color: AppColors.textPrimary)),
                trailing: CupertinoButton(
                  padding: EdgeInsets.zero,
                  child: const Icon(CupertinoIcons.arrow_clockwise, size: 20),
                  onPressed: () async {
                    HapticFeedback.lightImpact();
                    try {
                      await widget.engine.refreshLectures();
                    } catch (e) {
                      _showToast(e.toString());
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
                    _showToast(e.toString());
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
                    placeholder: I18n.t('search_hint'),
                    placeholderStyle: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                    onChanged: (val) {
                      setState(() {
                        _searchQuery = val.trim();
                      });
                    },
                  ),
                ),
              ),

              // 橫向素養滾動過濾晶片列 (Filter Chips)
              SliverToBoxAdapter(
                child: SizedBox(
                  height: 44,
                  child: ListView.separated(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
                    scrollDirection: Axis.horizontal,
                    physics: const BouncingScrollPhysics(),
                    itemCount: _filterKeys.length,
                    separatorBuilder: (_, __) => const SizedBox(width: 8),
                    itemBuilder: (context, idx) {
                      final key = _filterKeys[idx];
                      final isSelected = _selectedLitFilter == key;
                      final label = I18n.t('filter_$key');

                      return GestureDetector(
                        onTap: () {
                          HapticFeedback.selectionClick();
                          setState(() {
                            _selectedLitFilter = key;
                          });
                        },
                        child: AnimatedContainer(
                          duration: const Duration(milliseconds: 180),
                          padding: const EdgeInsets.symmetric(horizontal: 13, vertical: 6),
                          decoration: BoxDecoration(
                            color: isSelected ? CupertinoColors.white : AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(
                              color: isSelected ? CupertinoColors.white : AppColors.hairline,
                              width: 0.6,
                            ),
                          ),
                          child: Center(
                            child: Text(
                              label,
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
                                color: isSelected ? CupertinoColors.black : AppColors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      );
                    },
                  ),
                ),
              ),

              // 講座卡片列表
              if (filteredLectures.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(CupertinoIcons.search, size: 44, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          Text(
                            I18n.t('empty_lectures'),
                            style: const TextStyle(color: AppColors.textMuted, fontSize: 14),
                          ),
                        ],
                      ),
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, idx) => _buildLectureCard(filteredLectures[idx]),
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

  Widget _buildGraduationHeaderCard(Map<String, dynamic> progress) {
    final total = progress['total'] as Map<String, dynamic>;
    final health = progress['health'] as Map<String, dynamic>;
    final care = progress['care'] as Map<String, dynamic>;
    final innov = progress['innovation'] as Map<String, dynamic>;
    final excell = progress['excellence'] as Map<String, dynamic>;
    final isQualified = progress['isQualified'] as bool;

    return Container(
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: AppColors.surfaceBorder, width: 0.8),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                I18n.t('grad_progress_title'),
                style: const TextStyle(
                  color: AppColors.textPrimary,
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: isQualified ? AppColors.accentGreen.withValues(alpha: 0.15) : AppColors.surfaceElevated,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: isQualified ? AppColors.accentGreen : AppColors.hairline,
                    width: 0.5,
                  ),
                ),
                child: Text(
                  isQualified ? I18n.t('grad_completed') : '${total['current']}/${total['target']}',
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
              _buildMetricChip(I18n.t('filter_health'), health['current'], health['target'], AppColors.accentGreen),
              const SizedBox(width: 8),
              _buildMetricChip(I18n.t('filter_care'), care['current'], care['target'], AppColors.accentBlue),
              const SizedBox(width: 8),
              _buildMetricChip(I18n.t('filter_innovation'), innov['current'], innov['target'], AppColors.accentTeal),
              const SizedBox(width: 8),
              _buildMetricChip(I18n.t('filter_excellence'), excell['current'], excell['target'], AppColors.accentPurple),
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
    final capacity = CalendarHelper.formatCapacity(row);

    Color statusColor;
    String statusText;
    if (isRegistered) {
      statusColor = AppColors.accentGreen;
      statusText = I18n.t('btn_registered');
    } else if (canapp == 'Y') {
      statusColor = AppColors.accentBlue;
      statusText = I18n.t('st_open');
    } else if (canapp == 'F') {
      statusColor = AppColors.accentOrange;
      statusText = I18n.t('st_waitlist');
    } else if (canapp == 'N1') {
      statusColor = AppColors.textMuted;
      statusText = I18n.t('st_upcoming');
    } else {
      statusColor = AppColors.accentRed;
      statusText = I18n.t('st_closed');
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
        onPressed: () => _showLectureDetail(row, title, dateStr, stime, etime, place, lits, statusText, statusColor, capacity),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // 頂部狀態列、已選名額與素養標籤
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
                if (capacity != '-') ...[
                  const SizedBox(width: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: AppColors.hairline, width: 0.5),
                    ),
                    child: Text(
                      '${I18n.t('capacity')} $capacity',
                      style: const TextStyle(fontSize: 10, color: AppColors.textSecondary),
                    ),
                  ),
                ],
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
                    child: Text(I18n.t('btn_in_queue'), style: const TextStyle(fontSize: 10, color: AppColors.accentOrange)),
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
                    color: AppColors.surfaceElevated,
                    borderRadius: BorderRadius.circular(8),
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      if (isTarget) {
                        widget.engine.removeTarget(eid01);
                        _showToast(I18n.t('btn_remove'));
                      } else {
                        widget.engine.addTargets([row]);
                        _showToast(I18n.t('target_added_title'));
                      }
                    },
                    child: Text(
                      isTarget ? I18n.t('btn_remove') : I18n.t('btn_add_target'),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w500,
                        color: isTarget ? AppColors.accentRed : AppColors.textSecondary,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),

                  // 手動快報按鈕
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
                              _showToast(e.toString());
                            } finally {
                              if (mounted) setState(() => _isActionInProgress = false);
                            }
                          },
                    child: Text(
                      I18n.t('btn_quick_register'),
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: CupertinoColors.black),
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
    String capacity,
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
                Text(statusText, style: TextStyle(color: statusColor, fontWeight: FontWeight.bold)),
                if (capacity != '-') ...[
                  const SizedBox(height: 4),
                  Text('${I18n.t('capacity')}: $capacity'),
                ],
                const SizedBox(height: 4),
                Text('$dateStr $stime ~ $etime'),
                const SizedBox(height: 4),
                Text('${I18n.t('venue')}: ${place.isNotEmpty ? place : "-"}'),
                if (lits.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(lits.join("、")),
                ],
                const SizedBox(height: 4),
                Text('${I18n.t('code')}: ${row['eid01'] ?? ""}'),
              ],
            ),
          ),
          actions: [
            CupertinoActionSheetAction(
              child: Text(I18n.t('btn_add_target')),
              onPressed: () {
                final eid01 = row['eid01']?.toString() ?? '';
                final isTarget = widget.engine.targets.any((t) => t['eid01']?.toString() == eid01);
                if (isTarget) {
                  widget.engine.removeTarget(eid01);
                  _showToast(I18n.t('btn_remove'));
                } else {
                  widget.engine.addTargets([row]);
                  _showToast(I18n.t('target_added_title'));
                }
                Navigator.pop(context);
              },
            ),
          ],
          cancelButton: CupertinoActionSheetAction(
            isDefaultAction: true,
            child: Text(I18n.t('btn_cancel')),
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
            child: Text(I18n.t('btn_ok')),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }
}
