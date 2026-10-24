import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/calendar_helper.dart';
import '../config/constants.dart';
import '../config/i18n.dart';

class CalendarScreen extends StatefulWidget {
  final GrabEngine engine;

  const CalendarScreen({super.key, required this.engine});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  List<Map<String, dynamic>> _registeredList = [];
  bool _isLoading = false;
  String _errorMsg = '';

  @override
  void initState() {
    super.initState();
    _loadRegistered();
  }

  Future<void> _loadRegistered() async {
    final token = widget.engine.session?['token']?.toString();
    if (token == null || token.isEmpty) {
      if (mounted) {
        setState(() {
          _registeredList = [];
          _errorMsg = I18n.t('not_logged_in_cal');
        });
      }
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMsg = '';
    });

    try {
      final rows = await widget.engine.api.listRegistered(token);
      if (mounted) {
        setState(() {
          _registeredList = rows;
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMsg = '${I18n.t('error')}: $e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // 透過 CalendarHelper 核心模組檢驗衝堂
    final conflicts = CalendarHelper.findConflicts(_registeredList);

    return CupertinoPageScaffold(
      backgroundColor: AppColors.background,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            backgroundColor: AppColors.glassBar,
            border: const Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
            largeTitle: Text(I18n.t('calendar_title'), style: const TextStyle(color: AppColors.textPrimary)),
            trailing: CupertinoButton(
              padding: EdgeInsets.zero,
              child: const Icon(CupertinoIcons.arrow_clockwise, size: 20),
              onPressed: () {
                HapticFeedback.lightImpact();
                _loadRegistered();
              },
            ),
          ),

          CupertinoSliverRefreshControl(
            onRefresh: () async {
              HapticFeedback.lightImpact();
              await _loadRegistered();
            },
          ),

          // 頂部統計
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
              child: Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.surfaceBorder, width: 0.8),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(I18n.t('btn_registered'), style: const TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                            const SizedBox(height: 4),
                            Text(
                              I18n.t('registered_count_desc', params: {'n': _registeredList.length}),
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: AppColors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                        if (conflicts.isNotEmpty)
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                            decoration: BoxDecoration(
                              color: AppColors.accentRed.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: AppColors.accentRed.withValues(alpha: 0.4), width: 0.5),
                            ),
                            child: Text(
                              '${I18n.t('conflict_warning')} (${conflicts.length})',
                              style: const TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.bold,
                                color: AppColors.accentRed,
                              ),
                            ),
                          ),
                      ],
                    ),
                    if (_registeredList.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      Container(height: 0.5, color: AppColors.hairline),
                      const SizedBox(height: 10),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.end,
                        children: [
                          CupertinoButton(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              final text = CalendarHelper.formatScheduleText(_registeredList);
                              Clipboard.setData(ClipboardData(text: text));
                              _showMsg(I18n.t('copy_schedule_text'));
                            },
                            child: Text(I18n.t('copy_schedule_text'), style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                          ),
                          const SizedBox(width: 8),
                          CupertinoButton(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            onPressed: () {
                              HapticFeedback.lightImpact();
                              final ics = CalendarHelper.generateIcs(_registeredList);
                              Clipboard.setData(ClipboardData(text: ics));
                              _showMsg(I18n.t('export_ical'));
                            },
                            child: Text(I18n.t('export_ical'), style: const TextStyle(fontSize: 12, color: AppColors.textPrimary)),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ),
          ),

          if (_errorMsg.isNotEmpty)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    _errorMsg,
                    style: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            )
          else if (_registeredList.isEmpty && !_isLoading)
            SliverFillRemaining(
              hasScrollBody: false,
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(32),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(CupertinoIcons.calendar, size: 48, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      Text(
                        I18n.t('empty_registered'),
                        style: const TextStyle(color: AppColors.textSecondary, fontSize: 14),
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
                    final item = _registeredList[index];
                    final hasConflict = conflicts.contains(item['eid01']?.toString() ?? '');
                    return _buildRegisteredCard(item, hasConflict);
                  },
                  childCount: _registeredList.length,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildRegisteredCard(Map<String, dynamic> row, bool hasConflict) {
    final title = CalendarHelper.extractTitle(row);
    final eid01 = (row['eid01'] ?? '').toString();
    final reseid = (row['reseid'] ?? '').toString();
    final eid = (row['eid'] ?? '').toString();
    final date = (row['rescsd'] ?? row['sdate'] ?? '').toString();
    final dateStr = CalendarHelper.parseYmd(date) ?? date;
    final stime = (row['stime'] ?? '').toString();
    final etime = (row['etime'] ?? '').toString();
    final place = (row['locale'] ?? row['place'] ?? '').toString();
    final lits = CalendarHelper.detectLiteracies(row);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: hasConflict ? AppColors.accentRed.withValues(alpha: 0.5) : AppColors.surfaceBorder,
          width: 0.8,
        ),
      ),
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                decoration: BoxDecoration(
                  color: AppColors.accentGreen.withValues(alpha: 0.18),
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  I18n.t('btn_registered'),
                  style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.accentGreen),
                ),
              ),
              if (hasConflict) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.accentRed.withValues(alpha: 0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    I18n.t('conflict_warning'),
                    style: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.accentRed),
                  ),
                ),
              ],
              const Spacer(),
              ...lits.map((lit) => Container(
                    margin: const EdgeInsets.only(left: 4),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: AppColors.surfaceElevated,
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(lit, style: const TextStyle(fontSize: 10, color: AppColors.textSecondary)),
                  )),
            ],
          ),
          const SizedBox(height: 8),

          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
              height: 1.3,
            ),
          ),
          const SizedBox(height: 6),

          Text(
            '$dateStr $stime ~ $etime',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          if (place.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '${I18n.t('venue')}: $place',
              style: const TextStyle(fontSize: 12, color: AppColors.textMuted),
            ),
          ],
          const SizedBox(height: 12),

          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              CupertinoButton(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                color: AppColors.surfaceElevated,
                borderRadius: BorderRadius.circular(8),
                onPressed: () => _confirmCancel(eid01: eid01, reseid: reseid, eid: eid, title: title),
                child: Text(
                  I18n.t('btn_cancel_drop'),
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.accentRed),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmCancel({required String eid01, required String reseid, required String eid, required String title}) {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: Text(I18n.t('drop_confirm_title')),
        content: Text(I18n.t('drop_confirm_msg', params: {'title': title})),
        actions: [
          CupertinoDialogAction(
            child: Text(I18n.t('btn_cancel')),
            onPressed: () => Navigator.pop(context),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () async {
              Navigator.pop(context);
              HapticFeedback.mediumImpact();
              try {
                final targetId = eid.isNotEmpty ? eid : (reseid.isNotEmpty ? reseid : eid01);
                await widget.engine.cancelTarget(targetId, eid01: eid01, reseid: reseid, eid: eid);
                _showMsg(I18n.t('drop_success_title'));
                await _loadRegistered();
                await widget.engine.refreshLectures();
              } catch (e) {
                _showMsg('${I18n.t('drop_failed_title')}: $e');
              }
            },
            child: Text(I18n.t('btn_confirm_drop')),
          ),
        ],
      ),
    );
  }

  void _showMsg(String msg) {
    if (!mounted) return;
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
