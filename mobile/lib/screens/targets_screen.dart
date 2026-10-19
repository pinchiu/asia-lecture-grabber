import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/calendar_helper.dart';
import '../config/constants.dart';

class TargetsScreen extends StatefulWidget {
  final GrabEngine engine;

  const TargetsScreen({super.key, required this.engine});

  @override
  State<TargetsScreen> createState() => _TargetsScreenState();
}

class _TargetsScreenState extends State<TargetsScreen> {
  bool _isActionInProgress = false;

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: AppColors.background,
      child: AnimatedBuilder(
        animation: widget.engine,
        builder: (context, _) {
          final isRunning = widget.engine.running;
          final targets = widget.engine.targets;
          final stats = widget.engine.stats;

          return CustomScrollView(
            physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
            slivers: [
              CupertinoSliverNavigationBar(
                backgroundColor: AppColors.glassBar,
                border: const Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
                largeTitle: const Text('搶課排程', style: TextStyle(color: AppColors.textPrimary)),
                trailing: CupertinoButton(
                  padding: EdgeInsets.zero,
                  child: const Text('清理已完成', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                  onPressed: targets.isEmpty
                      ? null
                      : () {
                          HapticFeedback.lightImpact();
                          widget.engine.clearTargets();
                        },
                ),
              ),

              // 狀態機儀表板卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 10),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(
                        color: isRunning ? AppColors.accentGreen.withValues(alpha: 0.5) : AppColors.surfaceBorder,
                        width: 0.8,
                      ),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 10,
                              height: 10,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: isRunning ? AppColors.accentGreen : AppColors.textMuted,
                                boxShadow: isRunning
                                    ? [
                                        BoxShadow(
                                          color: AppColors.accentGreen.withValues(alpha: 0.6),
                                          blurRadius: 6,
                                          spreadRadius: 1,
                                        ),
                                      ]
                                    : null,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              isRunning ? '搶課引擎監控中' : '搶課引擎已就緒（閒置）',
                              style: TextStyle(
                                color: isRunning ? AppColors.accentGreen : AppColors.textSecondary,
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // 統計三欄位
                        Row(
                          children: [
                            _buildStatItem('目標總數', '${targets.length} 場'),
                            _buildStatItem('輪詢次數', '${stats['ticks'] ?? 0} 次'),
                            _buildStatItem('成功搶得', '${stats['registrations'] ?? 0} 場'),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // 啟動 / 停止 大按鈕
                        SizedBox(
                          width: double.infinity,
                          child: CupertinoButton(
                            padding: const EdgeInsets.symmetric(vertical: 13),
                            color: isRunning ? AppColors.accentRed : CupertinoColors.white,
                            borderRadius: BorderRadius.circular(12),
                            onPressed: _isActionInProgress
                                ? null
                                : () async {
                                    HapticFeedback.mediumImpact();
                                    setState(() => _isActionInProgress = true);
                                    try {
                                      if (isRunning) {
                                        widget.engine.stop('使用者手動停止');
                                      } else {
                                        await widget.engine.start();
                                      }
                                    } catch (e) {
                                      _showDialog('操作失敗', e.toString().replaceAll('Exception: ', ''));
                                    } finally {
                                      if (mounted) setState(() => _isActionInProgress = false);
                                    }
                                  },
                            child: Text(
                              isRunning ? '停止搶課監控' : '啟動即時搶課監控',
                              style: TextStyle(
                                fontSize: 15,
                                fontWeight: FontWeight.bold,
                                color: isRunning ? CupertinoColors.white : CupertinoColors.black,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 排程目標清單標題
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        '目標佇列清單',
                        style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '共 ${targets.length} 筆',
                        style: const TextStyle(color: AppColors.textMuted, fontSize: 12),
                      ),
                    ],
                  ),
                ),
              ),

              // 目標佇列列表
              if (targets.isEmpty)
                SliverFillRemaining(
                  hasScrollBody: false,
                  child: Center(
                    child: Padding(
                      padding: const EdgeInsets.all(32),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(CupertinoIcons.square_list, size: 48, color: AppColors.textMuted),
                          const SizedBox(height: 12),
                          const Text(
                            '尚未加入任何搶課目標\n請在「講座情報」列表點擊「加入排程」',
                            style: TextStyle(color: AppColors.textSecondary, fontSize: 14),
                            textAlign: TextAlign.center,
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
                        final target = targets[index];
                        return _buildTargetItem(target);
                      },
                      childCount: targets.length,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildStatItem(String label, String value) {
    return Expanded(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textMuted)),
          const SizedBox(height: 3),
          Text(
            value,
            style: const TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
          ),
        ],
      ),
    );
  }

  Widget _buildTargetItem(Map<String, dynamic> target) {
    final eid01 = (target['eid01'] ?? '').toString();
    final title = CalendarHelper.extractTitle(target);
    final status = (target['status'] ?? 'waiting').toString();
    final message = (target['message'] ?? '').toString();
    final rescsd = (target['rescsd'] ?? '').toString();
    final stime = (target['stime'] ?? '').toString();

    Color badgeColor;
    String badgeText;
    if (status == 'registered') {
      badgeColor = AppColors.accentGreen;
      badgeText = '報名成功';
    } else if (status == 'closed') {
      badgeColor = AppColors.accentRed;
      badgeText = '已截止';
    } else if (status == 'error') {
      badgeColor = AppColors.accentRed;
      badgeText = '失敗';
    } else {
      badgeColor = AppColors.accentOrange;
      badgeText = '監控中';
    }

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: AppColors.surfaceBorder, width: 0.8),
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
                  color: badgeColor.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(6),
                  border: Border.all(color: badgeColor.withValues(alpha: 0.4), width: 0.5),
                ),
                child: Text(
                  badgeText,
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: badgeColor),
                ),
              ),
              const Spacer(),
              CupertinoButton(
                padding: EdgeInsets.zero,
                child: const Icon(CupertinoIcons.trash, size: 16, color: AppColors.textMuted),
                onPressed: () {
                  HapticFeedback.lightImpact();
                  widget.engine.removeTarget(eid01);
                },
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            title,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w600,
              color: AppColors.textPrimary,
            ),
          ),
          if (rescsd.isNotEmpty || stime.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              '場次時間：$rescsd $stime',
              style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
            ),
          ],
          if (message.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              '狀態更新：$message',
              style: const TextStyle(fontSize: 11, color: AppColors.textMuted),
            ),
          ],
        ],
      ),
    );
  }

  void _showDialog(String title, String msg) {
    showCupertinoDialog(
      context: context,
      builder: (context) => CupertinoAlertDialog(
        title: Text(title),
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
