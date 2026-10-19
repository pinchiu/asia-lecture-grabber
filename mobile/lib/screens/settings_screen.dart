import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/update_service.dart';
import '../config/constants.dart';

class SettingsScreen extends StatefulWidget {
  final GrabEngine engine;

  const SettingsScreen({super.key, required this.engine});

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  late TextEditingController _userCtrl;
  late TextEditingController _passCtrl;
  late TextEditingController _idLast4Ctrl;

  late TextEditingController _healthCtrl;
  late TextEditingController _careCtrl;
  late TextEditingController _innovCtrl;
  late TextEditingController _excellCtrl;

  bool _rememberPassword = true;
  bool _isLoading = false;
  bool _isCheckingUpdate = false;

  @override
  void initState() {
    super.initState();
    final acc = widget.engine.session ?? {};
    _userCtrl = TextEditingController(text: acc['username'] ?? '');
    _passCtrl = TextEditingController(text: acc['password'] ?? '');
    _idLast4Ctrl = TextEditingController(text: acc['idLast4'] ?? '');

    final hist = widget.engine.graduation['history'] ?? {};
    _healthCtrl = TextEditingController(text: (hist['health'] ?? 0).toString());
    _careCtrl = TextEditingController(text: (hist['care'] ?? 0).toString());
    _innovCtrl = TextEditingController(text: (hist['innovation'] ?? 0).toString());
    _excellCtrl = TextEditingController(text: (hist['excellence'] ?? 0).toString());
  }

  @override
  void dispose() {
    _userCtrl.dispose();
    _passCtrl.dispose();
    _idLast4Ctrl.dispose();
    _healthCtrl.dispose();
    _careCtrl.dispose();
    _innovCtrl.dispose();
    _excellCtrl.dispose();
    super.dispose();
  }

  Future<void> _handleLogin() async {
    final username = _userCtrl.text.trim();
    final password = _passCtrl.text;
    final idLast4 = _idLast4Ctrl.text.trim();

    if (username.isEmpty || password.isEmpty) {
      _showDialog('提示', '請輸入帳號與密碼');
      return;
    }
    if (idLast4.isNotEmpty && !RegExp(r'^\d{4}$').hasMatch(idLast4)) {
      _showDialog('提示', '身分證末四碼格式不正確（應為 4 位數字）');
      return;
    }

    setState(() => _isLoading = true);
    HapticFeedback.mediumImpact();

    try {
      final res = await widget.engine.api.login(username, password);
      final newSession = {
        'token': res['token'],
        'username': username,
        'password': _rememberPassword ? password : '',
        'emp_id': res['emp_id'] ?? username,
        'emp_nm': res['emp_nm'] ?? '',
        'emp_rl': res['emp_rl'] ?? 'Student',
        'idLast4': idLast4,
      };
      widget.engine.setSession(newSession);

      if (idLast4.isNotEmpty) {
        try {
          await widget.engine.ensureIdentity();
        } catch (_) {}
      }

      await widget.engine.persistConfig();
      await widget.engine.refreshLectures();
      _showDialog('登入成功', '歡迎 ${res['emp_nm'] ?? username}！已完成身分驗證');
    } catch (e) {
      _showDialog('登入失敗', e.toString().replaceAll('Exception: ', ''));
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _saveGraduationHistory() async {
    final h = int.tryParse(_healthCtrl.text.trim()) ?? 0;
    final c = int.tryParse(_careCtrl.text.trim()) ?? 0;
    final i = int.tryParse(_innovCtrl.text.trim()) ?? 0;
    final e = int.tryParse(_excellCtrl.text.trim()) ?? 0;

    widget.engine.graduation['history'] = {
      'health': h,
      'care': c,
      'innovation': i,
      'excellence': e,
      'total': h + c + i + e,
    };
    await widget.engine.persistConfig();
    HapticFeedback.lightImpact();
    _showDialog('儲存成功', '已更新歷年素養累積資料');
  }

  @override
  Widget build(BuildContext context) {
    return CupertinoPageScaffold(
      backgroundColor: AppColors.background,
      child: AnimatedBuilder(
        animation: widget.engine,
        builder: (context, _) {
          final session = widget.engine.session;
          final isLoggedIn = session?['token'] != null;
          final logs = widget.engine.logs.reversed.take(60).toList();

          return CustomScrollView(
            physics: const BouncingScrollPhysics(parent: AlwaysScrollableScrollPhysics()),
            slivers: [
              const CupertinoSliverNavigationBar(
                backgroundColor: AppColors.glassBar,
                border: Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
                largeTitle: Text('系統設定', style: TextStyle(color: AppColors.textPrimary)),
              ),

              // 帳號認證設定卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                  child: Container(
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
                              '校園入口帳號認證',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isLoggedIn ? AppColors.accentGreen.withValues(alpha: 0.18) : AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isLoggedIn ? '已登入 (${session!['emp_nm'] ?? session['username']})' : '未登入',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.bold,
                                  color: isLoggedIn ? AppColors.accentGreen : AppColors.textMuted,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // 學號輸入框
                        const Text('學號 / 帳號', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _userCtrl,
                          placeholder: '請輸入學號',
                          placeholderStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.hairline, width: 0.5),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // 密碼輸入框
                        const Text('密碼', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _passCtrl,
                          placeholder: '請輸入校園入口密碼',
                          placeholderStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                          obscureText: true,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.hairline, width: 0.5),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // 身分證末四碼輸入框
                        const Text('身分證字號末四碼（身分驗證必備）', style: TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _idLast4Ctrl,
                          placeholder: '4 位數字',
                          placeholderStyle: const TextStyle(color: AppColors.textMuted, fontSize: 13),
                          maxLength: 4,
                          keyboardType: TextInputType.number,
                          style: const TextStyle(color: AppColors.textPrimary, fontSize: 14),
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.hairline, width: 0.5),
                          ),
                        ),
                        const SizedBox(height: 12),

                        // 記住密碼開關
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            const Text('記住帳密並在開機時自動登入', style: TextStyle(fontSize: 13, color: AppColors.textSecondary)),
                            CupertinoSwitch(
                              value: _rememberPassword,
                              activeTrackColor: AppColors.accentGreen,
                              onChanged: (val) {
                                setState(() => _rememberPassword = val);
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 14),

                        // 登入按鈕
                        SizedBox(
                          width: double.infinity,
                          child: CupertinoButton(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            color: CupertinoColors.white,
                            borderRadius: BorderRadius.circular(10),
                            onPressed: _isLoading ? null : _handleLogin,
                            child: Text(
                              _isLoading ? '連線中...' : (isLoggedIn ? '更新並重新驗證' : '登入校方系統'),
                              style: const TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: CupertinoColors.black,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 歷年素養手動補登卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface,
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: AppColors.surfaceBorder, width: 0.8),
                    ),
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text(
                          '歷年已累積素養場次補登',
                          style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          '若您前幾學期已取得部分講座素養次數，可在此補登，系統將與本期即時加總計算門檻。',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 14),

                        Row(
                          children: [
                            _buildLitInput('健康力', _healthCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput('關懷力', _careCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput('創新力', _innovCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput('卓越力', _excellCtrl),
                          ],
                        ),
                        const SizedBox(height: 14),

                        SizedBox(
                          width: double.infinity,
                          child: CupertinoButton(
                            padding: const EdgeInsets.symmetric(vertical: 11),
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(10),
                            onPressed: _saveGraduationHistory,
                            child: const Text(
                              '儲存補登設定',
                              style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 系統紀錄卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  child: Container(
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
                              '即時執行紀錄',
                              style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                            CupertinoButton(
                              padding: EdgeInsets.zero,
                              child: const Text('清空', style: TextStyle(fontSize: 12, color: AppColors.textMuted)),
                              onPressed: () {
                                widget.engine.logs.clear();
                                setState(() {});
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          height: 160,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.hairline, width: 0.5),
                          ),
                          child: logs.isEmpty
                              ? const Center(
                                  child: Text('尚無執行紀錄', style: TextStyle(color: AppColors.textMuted, fontSize: 12)),
                                )
                              : ListView.builder(
                                  padding: const EdgeInsets.all(8),
                                  physics: const BouncingScrollPhysics(),
                                  itemCount: logs.length,
                                  itemBuilder: (context, idx) {
                                    final l = logs[idx];
                                    final time = (l['time'] ?? '').toString().split('T').last.split('.').first;
                                    final msg = (l['message'] ?? '').toString();
                                    final lvl = (l['level'] ?? 'info').toString();
                                    Color c = AppColors.textSecondary;
                                    if (lvl == 'error') c = AppColors.accentRed;
                                    if (lvl == 'warn') c = AppColors.accentOrange;

                                    return Padding(
                                      padding: const EdgeInsets.symmetric(vertical: 2),
                                      child: Text(
                                        '[$time] $msg',
                                        style: TextStyle(fontFamily: 'monospace', fontSize: 11, color: c),
                                      ),
                                    );
                                  },
                                ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 軟體版本與線上更新卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 4, 16, 96),
                  child: Container(
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
                              '關於軟體與更新',
                              style: TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.hairline, width: 0.5),
                              ),
                              child: const Text(
                                '目前版本 v${UpdateService.currentVersion}',
                                style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        const Text(
                          '亞洲大學通識講座自動報名助手與四大基本素養追蹤系統行動端。支援 GitHub 線上檢查更新，可直接在 App 內下載最新 APK 升級或透過瀏覽器下載。',
                          style: TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 16),
                        Row(
                          children: [
                            Expanded(
                              child: CupertinoButton(
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                color: CupertinoColors.white,
                                borderRadius: BorderRadius.circular(10),
                                onPressed: _isCheckingUpdate ? null : _handleCheckUpdate,
                                child: _isCheckingUpdate
                                    ? const CupertinoActivityIndicator(color: CupertinoColors.black)
                                    : const Text(
                                        '檢查新版本',
                                        style: TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,
                                          color: CupertinoColors.black,
                                        ),
                                      ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Future<void> _handleCheckUpdate() async {
    setState(() => _isCheckingUpdate = true);
    HapticFeedback.lightImpact();

    try {
      final info = await UpdateService.checkUpdate();
      if (!mounted) return;

      if (info == null) {
        _showDialog('檢查更新失敗', '無法連接至 GitHub Releases 服務，請確認手機網路連線。');
        return;
      }

      if (info.hasUpdate) {
        _showUpdatePrompt(info);
      } else {
        _showDialog('已是最新版本', '目前安裝版本 v${UpdateService.currentVersion} 已是最新正式發布版本。');
      }
    } catch (e) {
      if (mounted) _showDialog('錯誤', '檢查更新時發生例外：$e');
    } finally {
      if (mounted) setState(() => _isCheckingUpdate = false);
    }
  }

  void _showUpdatePrompt(ReleaseInfo info) {
    final sizeMb = (info.apkSize / (1024 * 1024)).toStringAsFixed(1);
    final sizeText = info.apkSize > 0 ? '（約 $sizeMb MB）' : '';

    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text('發現新版本 ${info.tagName}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text('更新標題：${info.name}\n檔案大小：$sizeText\n\n是否立即下載並安裝更新？',
                style: const TextStyle(fontSize: 13, color: AppColors.textPrimary)),
          ],
        ),
        actions: [
          CupertinoDialogAction(
            child: const Text('稍後再說'),
            onPressed: () => Navigator.pop(ctx),
          ),
          if (info.apkUrl.isNotEmpty)
            CupertinoDialogAction(
              isDefaultAction: true,
              child: const Text('App 內下載安裝'),
              onPressed: () {
                Navigator.pop(ctx);
                _startInAppDownload(info);
              },
            ),
          CupertinoDialogAction(
            child: const Text('瀏覽器下載'),
            onPressed: () {
              Navigator.pop(ctx);
              UpdateService.openUrl(info.apkUrl.isNotEmpty ? info.apkUrl : info.htmlUrl);
            },
          ),
        ],
      ),
    );
  }

  void _startInAppDownload(ReleaseInfo info) {
    double progressValue = 0.0;
    String statusText = '準備下載...';
    StateSetter? dialogSetState;

    showCupertinoDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) {
          dialogSetState = setDialogState;
          final percent = (progressValue * 100).clamp(0, 100).toStringAsFixed(0);

          return CupertinoAlertDialog(
            title: const Text('正在下載最新版本'),
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
        if (mounted) _showDialog('安裝提示', '下載完成，但啟動安裝失敗：$e\n您可選擇使用瀏覽器下載安裝。');
      }
    }).catchError((err) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        _showDialog('下載失敗', err.toString().replaceAll('Exception: ', ''));
      }
    });
  }

  Widget _buildLitInput(String label, TextEditingController ctrl) {
    return Expanded(
      child: Column(
        children: [
          Text(label, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary)),
          const SizedBox(height: 4),
          CupertinoTextField(
            controller: ctrl,
            textAlign: TextAlign.center,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: AppColors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: AppColors.surfaceElevated,
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: AppColors.hairline, width: 0.5),
            ),
          ),
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
