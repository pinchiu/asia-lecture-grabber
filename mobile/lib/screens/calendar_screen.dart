import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/calendar_helper.dart';
import '../config/constants.dart';

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
          _errorMsg = '尚未登入，無法取得校方已報名清冊';
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
          _errorMsg = '取得已報名清單失敗：$e';
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // 檢查時間衝突
    final conflicts = _findScheduleConflicts(_registeredList);

    return CupertinoPageScaffold(
      backgroundColor: AppColors.background,
      child: CustomScrollView(
        physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
        slivers: [
          CupertinoSliverNavigationBar(
            backgroundColor: AppColors.glassBar,
            border: const Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
            largeTitle: const Text('個人行程', style: TextStyle(color: AppColors.textPrimary)),
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
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('已成功報名講座', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        const SizedBox(height: 4),
                        Text(
                          '${_registeredList.length} 場次',
                          style: const TextStyle(
                            fontSize: 18,
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
                          '偵測到 ${conflicts.length} 場衝堂',
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            color: AppColors.accentRed,
                          ),
                        ),
                      ),
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
                      Icon(CupertinoIcons.calendar, size: 48, color: AppColors.textMuted),
                      const SizedBox(height: 12),
                      const Text(
                        '目前尚無已報名講座記錄',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                      ),
                    ],
                  ),
                ),
              ),
            )
          else
            SliverPadding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 24),
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
    final title = (row['reseid_name'] ?? row['name'] ?? row['eid01'] ?? '').toString();
    final eid01 = (row['eid01'] ?? '').toString();
    final reseid = (row['reseid'] ?? row['eid'] ?? '').toString();
    final date = (row['rescsd'] ?? row['sdate'] ?? '').toString();
    final dateStr = CalendarHelper.parseYmd(date) ?? date;
    final stime = (row['stime'] ?? '').toString();
    final etime = (row['etime'] ?? '').toString();
    final place = (row['place'] ?? '').toString();
    final lits = CalendarHelper.detectLiteracies(title);

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
                child: const Text(
                  '已報名',
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.accentGreen),
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
                  child: const Text(
                    '時間衝堂',
                    style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.accentRed),
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
            '時間：$dateStr $stime ~ $etime',
            style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
          ),
          if (place.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '地點：$place',
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
                onPressed: () => _confirmCancel(eid01, reseid, title),
                child: const Text(
                  '取消報名（退選）',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.accentRed),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  void _confirmCancel(String eid01, String reseid, String title) {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: const Text('確認取消報名'),
        content: Text('確定要取消【$title】的報名嗎？\n此動作將向校方發送加密退選請求，釋出名額。'),
        actions: [
          CupertinoDialogAction(
            child: const Text('返回'),
            onPressed: () => Navigator.pop(context),
          ),
          CupertinoDialogAction(
            isDestructiveAction: true,
            onPressed: () async {
              Navigator.pop(context);
              HapticFeedback.mediumImpact();
              try {
                final targetId = reseid.isNotEmpty ? reseid : eid01;
                await widget.engine.cancelTarget(targetId, eid01: eid01, reseid: reseid);
                _showMsg('已成功取消報名');
                await _loadRegistered();
                await widget.engine.refreshLectures();
              } catch (e) {
                _showMsg('退選失敗：$e');
              }
            },
            child: const Text('確定退選'),
          ),
        ],
      ),
    );
  }

  Set<String> _findScheduleConflicts(List<Map<String, dynamic>> list) {
    final conflictSet = <String>{};
    for (int i = 0; i < list.length; i++) {
      for (int j = i + 1; j < list.length; j++) {
        final a = list[i];
        final b = list[j];
        final dateA = a['rescsd'] ?? a['sdate'];
        final dateB = b['rescsd'] ?? b['sdate'];
        if (dateA != null && dateA == dateB) {
          final stimeA = (a['stime'] ?? '').toString();
          final etimeA = (a['etime'] ?? '').toString();
          final stimeB = (b['stime'] ?? '').toString();
          final etimeB = (b['etime'] ?? '').toString();

          if (stimeA.isNotEmpty && etimeA.isNotEmpty && stimeB.isNotEmpty && etimeB.isNotEmpty) {
            if (stimeA.compareTo(etimeB) < 0 && stimeB.compareTo(etimeA) < 0) {
              conflictSet.add(a['eid01']?.toString() ?? '');
              conflictSet.add(b['eid01']?.toString() ?? '');
            }
          }
        }
      }
    }
    return conflictSet;
  }

  void _showMsg(String msg) {
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
