import 'package:flutter/cupertino.dart';
import 'package:flutter/services.dart';
import '../backend/grab_engine.dart';
import '../backend/update_service.dart';
import '../config/constants.dart';
import '../config/i18n.dart';

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
  ReleaseInfo? _latestRelease;

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
      _showDialog(I18n.t('error'), I18n.t('label_username') + ' / ' + I18n.t('label_password'));
      return;
    }
    if (idLast4.isNotEmpty && !RegExp(r'^\d{4}$').hasMatch(idLast4)) {
      _showDialog(I18n.t('error'), I18n.t('hint_idlast4'));
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
      _showDialog(
        I18n.t('login_success_title'),
        I18n.t('login_success_msg', params: {'name': res['emp_nm'] ?? username}),
      );
    } catch (e) {
      _showDialog(I18n.t('error'), e.toString().replaceAll('Exception: ', ''));
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
    _showDialog(I18n.t('btn_ok'), I18n.t('saved_credits_msg'));
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
              CupertinoSliverNavigationBar(
                backgroundColor: AppColors.glassBar,
                border: const Border(bottom: BorderSide(color: AppColors.hairline, width: 0.5)),
                largeTitle: Text(I18n.t('settings_header'), style: const TextStyle(color: AppColors.textPrimary)),
              ),

              // 介面語言切換卡片 (Language Selection)
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 14, 16, 8),
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
                        Text(
                          I18n.t('section_language'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 12),
                        SizedBox(
                          width: double.infinity,
                          child: CupertinoSlidingSegmentedControl<String>(
                            groupValue: I18n.lang,
                            backgroundColor: AppColors.surfaceElevated,
                            thumbColor: CupertinoColors.white,
                            children: {
                              'zh': Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                child: Text(
                                  I18n.t('lang_zh'),
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: I18n.lang == 'zh' ? CupertinoColors.black : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                              'en': Padding(
                                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                                child: Text(
                                  I18n.t('lang_en'),
                                  style: TextStyle(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: I18n.lang == 'en' ? CupertinoColors.black : AppColors.textSecondary,
                                  ),
                                ),
                              ),
                            },
                            onValueChanged: (v) {
                              if (v != null) {
                                HapticFeedback.selectionClick();
                                I18n.setLanguage(v);
                                setState(() {});
                              }
                            },
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 帳號認證設定卡片
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
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              I18n.t('section_auth'),
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: isLoggedIn ? AppColors.accentGreen.withValues(alpha: 0.18) : AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isLoggedIn ? '${I18n.t('btn_registered')} (${session!['emp_nm'] ?? session['username']})' : I18n.t('not_logged_in_cal').split('，').first,
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
                        Text(I18n.t('label_username'), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _userCtrl,
                          placeholder: I18n.t('hint_username'),
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
                        Text(I18n.t('label_password'), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _passCtrl,
                          placeholder: I18n.t('hint_password'),
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
                        Text(I18n.t('label_idlast4'), style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
                        const SizedBox(height: 6),
                        CupertinoTextField(
                          controller: _idLast4Ctrl,
                          placeholder: I18n.t('hint_idlast4'),
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
                            Expanded(
                              child: Text(
                                I18n.t('label_remember_pwd'),
                                style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                              ),
                            ),
                            CupertinoSwitch(
                              value: _rememberPassword,
                              activeColor: AppColors.accentBlue,
                              onChanged: (val) {
                                HapticFeedback.selectionClick();
                                setState(() => _rememberPassword = val);
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),

                        // 登入按鈕
                        SizedBox(
                          width: double.infinity,
                          child: CupertinoButton(
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            color: CupertinoColors.white,
                            borderRadius: BorderRadius.circular(10),
                            onPressed: _isLoading ? null : _handleLogin,
                            child: _isLoading
                                ? const CupertinoActivityIndicator(color: CupertinoColors.black)
                                : Text(
                                    I18n.t('btn_login_verify'),
                                    style: const TextStyle(
                                      color: CupertinoColors.black,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                    ),
                                  ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 歷年素養補登卡片
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
                        Text(
                          I18n.t('section_past_credits'),
                          style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        const SizedBox(height: 8),
                        Text(
                          I18n.t('desc_past_credits'),
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 14),

                        Row(
                          children: [
                            _buildLitInput(I18n.t('filter_health'), _healthCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput(I18n.t('filter_care'), _careCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput(I18n.t('filter_innovation'), _innovCtrl),
                            const SizedBox(width: 8),
                            _buildLitInput(I18n.t('filter_excellence'), _excellCtrl),
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
                            child: Text(
                              I18n.t('btn_save_past_credits'),
                              style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),

              // 軟體版本與線上更新卡片 (App Updates & In-App Installer)
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
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              I18n.t('section_app_updates'),
                              style: const TextStyle(color: AppColors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceElevated,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: AppColors.hairline, width: 0.5),
                              ),
                              child: Text(
                                I18n.t('current_version_label', params: {'version': UpdateService.currentVersion}),
                                style: const TextStyle(fontSize: 11, color: AppColors.textSecondary),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                        Text(
                          I18n.t('app_update_desc'),
                          style: const TextStyle(fontSize: 12, color: AppColors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 16),

                        // 若已發現更新，提供高對比立即更新按鈕
                        if (_latestRelease != null && _latestRelease!.hasUpdate) ...[
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.surfaceElevated,
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: AppColors.accentBlue.withValues(alpha: 0.6), width: 0.8),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  I18n.t('update_found_title', params: {'version': _latestRelease!.tagName}),
                                  style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  _latestRelease!.name,
                                  style: const TextStyle(fontSize: 12, color: AppColors.textSecondary),
                                ),
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  child: CupertinoButton(
                                    padding: const EdgeInsets.symmetric(vertical: 10),
                                    color: AppColors.accentBlue,
                                    borderRadius: BorderRadius.circular(8),
                                    onPressed: () => _startInAppDownload(_latestRelease!),
                                    child: Text(
                                      I18n.t('btn_update_now'),
                                      style: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: CupertinoColors.white),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 12),
                        ],

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
                                    : Text(
                                        I18n.t('btn_check_update'),
                                        style: const TextStyle(
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

              // 系統紀錄卡片
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 96),
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
                            Text(
                              I18n.t('section_logs'),
                              style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                            ),
                            CupertinoButton(
                              padding: EdgeInsets.zero,
                              child: Text(I18n.t('clear_finished').split('已').first, style: const TextStyle(fontSize: 12, color: AppColors.textMuted)),
                              onPressed: () {
                                widget.engine.logs.clear();
                                setState(() {});
                              },
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Container(
                          height: 150,
                          decoration: BoxDecoration(
                            color: AppColors.surfaceElevated,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: AppColors.hairline, width: 0.5),
                          ),
                          child: logs.isEmpty
                              ? Center(
                                  child: Text(I18n.t('empty_logs'), style: const TextStyle(color: AppColors.textMuted, fontSize: 12)),
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
        _showDialog(I18n.t('error'), 'GitHub API error / Network offline');
        return;
      }

      setState(() => _latestRelease = info);

      if (info.hasUpdate) {
        _showUpdatePrompt(info);
      } else {
        _showDialog(
          I18n.t('already_latest_title'),
          I18n.t('already_latest_msg', params: {'version': UpdateService.currentVersion}),
        );
      }
    } catch (e) {
      if (mounted) _showDialog(I18n.t('error'), e.toString());
    } finally {
      if (mounted) setState(() => _isCheckingUpdate = false);
    }
  }

  void _showUpdatePrompt(ReleaseInfo info) {
    final sizeMb = (info.apkSize / (1024 * 1024)).toStringAsFixed(1);
    final sizeText = info.apkSize > 0 ? '$sizeMb MB' : '—';

    showCupertinoDialog(
      context: context,
      builder: (ctx) => CupertinoAlertDialog(
        title: Text(I18n.t('update_found_title', params: {'version': info.tagName})),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const SizedBox(height: 8),
            Text(
              I18n.t('update_found_desc', params: {
                'title': info.name,
                'size': sizeText,
              }),
              style: const TextStyle(fontSize: 13, color: AppColors.textPrimary),
            ),
          ],
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
                _startInAppDownload(info);
              },
            ),
          CupertinoDialogAction(
            child: Text(I18n.t('btn_browser_download')),
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
          _showDialog(
            I18n.t('install_hint_title'),
            I18n.t('install_hint_msg', params: {'error': e.toString()}),
          );
        }
      }
    }).catchError((err) {
      if (mounted) {
        Navigator.of(context, rootNavigator: true).pop();
        _showDialog(I18n.t('download_failed_title'), err.toString().replaceAll('Exception: ', ''));
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
            child: Text(I18n.t('btn_ok')),
            onPressed: () => Navigator.pop(context),
          ),
        ],
      ),
    );
  }
}
