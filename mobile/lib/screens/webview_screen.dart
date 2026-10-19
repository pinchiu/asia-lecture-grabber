import 'package:flutter/material.dart';
import 'package:webview_flutter/webview_flutter.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../backend/in_app_server.dart';
import '../config/constants.dart';
import 'settings_modal.dart';

class WebViewScreen extends StatefulWidget {
  final String initialUrl;
  final InAppServer inAppServer;

  const WebViewScreen({
    super.key,
    required this.initialUrl,
    required this.inAppServer,
  });

  @override
  State<WebViewScreen> createState() => _WebViewScreenState();
}

class _WebViewScreenState extends State<WebViewScreen> {
  late final WebViewController _controller;
  late String _currentUrl;
  int _loadingProgress = 0;
  bool _isLoading = true;
  bool _hasError = false;
  String _errorDescription = '';

  bool get _isLocalMode => _currentUrl.contains('127.0.0.1') || _currentUrl.contains('localhost');

  @override
  void initState() {
    super.initState();
    _currentUrl = widget.initialUrl;
    _initController();
  }

  void _initController() {
    _controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setBackgroundColor(AppColors.background)
      ..setNavigationDelegate(
        NavigationDelegate(
          onProgress: (progress) {
            if (mounted) {
              setState(() {
                _loadingProgress = progress;
              });
            }
          },
          onPageStarted: (url) {
            if (mounted) {
              setState(() {
                _isLoading = true;
                _hasError = false;
                _errorDescription = '';
              });
            }
          },
          onPageFinished: (url) {
            if (mounted) {
              setState(() {
                _isLoading = false;
              });
            }
          },
          onWebResourceError: (error) {
            if (error.isForMainFrame ?? true) {
              if (mounted) {
                setState(() {
                  _hasError = true;
                  _isLoading = false;
                  _errorDescription = error.description;
                });
              }
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(_currentUrl));
  }

  Future<void> _updateServerUrl(String newUrl) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(AppConstants.prefKeyHostUrl, newUrl);

    setState(() {
      _currentUrl = newUrl;
      _hasError = false;
      _isLoading = true;
    });

    _controller.loadRequest(Uri.parse(newUrl));
  }

  Future<void> _switchToLocalMode() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(AppConstants.prefKeyHostUrl);
    final localUrl = widget.inAppServer.localUrl;
    await _updateServerUrl(localUrl);
  }

  @override
  Widget build(BuildContext context) {
    final statusText = _isLocalMode ? '原生獨立運行（免電腦 Server）' : '連線目標：$_currentUrl';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, result) async {
        if (didPop) return;
        final canGoBack = await _controller.canGoBack();
        if (canGoBack) {
          await _controller.goBack();
        } else if (mounted) {
          Navigator.of(context).maybePop();
        }
      },
      child: Scaffold(
        backgroundColor: AppColors.background,
        appBar: AppBar(
          backgroundColor: AppColors.surface,
          elevation: 0,
          titleSpacing: 16,
          title: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                AppConstants.appTitle,
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                statusText,
                style: TextStyle(
                  fontSize: 11,
                  fontFamily: 'monospace',
                  color: _isLocalMode ? AppColors.accentGreen : AppColors.accentCyan,
                ),
              ),
            ],
          ),
          bottom: PreferredSize(
            preferredSize: const Size.fromHeight(2),
            child: _isLoading && _loadingProgress < 100
                ? LinearProgressIndicator(
                    value: _loadingProgress / 100.0,
                    backgroundColor: AppColors.surfaceBorder,
                    valueColor: const AlwaysStoppedAnimation<Color>(AppColors.primary),
                    minHeight: 2,
                  )
                : const Divider(height: 1, thickness: 1, color: AppColors.surfaceBorder),
          ),
          actions: [
            IconButton(
              icon: const Icon(Icons.refresh, color: AppColors.textPrimary, size: 20),
              tooltip: '重新整理',
              onPressed: () {
                setState(() {
                  _hasError = false;
                  _isLoading = true;
                });
                _controller.reload();
              },
            ),
            IconButton(
              icon: const Icon(Icons.settings_outlined, color: AppColors.textPrimary, size: 20),
              tooltip: '設定',
              onPressed: () {
                SettingsModal.show(
                  context,
                  currentUrl: _currentUrl,
                  onSaveUrl: _updateServerUrl,
                );
              },
            ),
          ],
        ),
        body: SafeArea(
          child: _hasError ? _buildErrorView() : WebViewWidget(controller: _controller),
        ),
      ),
    );
  }

  Widget _buildErrorView() {
    return Center(
      child: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: const Icon(
                Icons.cloud_off_rounded,
                size: 48,
                color: AppColors.error,
              ),
            ),
            const SizedBox(height: 20),
            const Text(
              '連線發生異常',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: AppColors.textPrimary,
              ),
            ),
            const SizedBox(height: 10),
            Text(
              '連線位址：$_currentUrl',
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 12,
                fontFamily: 'monospace',
                color: AppColors.textSecondary,
              ),
            ),
            const SizedBox(height: 16),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.surfaceBorder),
              ),
              child: Text(
                _errorDescription.isNotEmpty
                    ? '連線錯誤原因：$_errorDescription\n\n本 App 內建原生獨立搶課引擎。\n若您先前設定了外部電腦 IP 且無法連通，建議點擊下方按鈕切換回「手機原生獨立運行」，即可完全不依賴電腦伺服器。'
                    : '本 App 內建原生獨立搶課引擎。\n若您先前設定了外部電腦 IP 且無法連通，建議點擊下方按鈕切換回「手機原生獨立運行」，即可完全不依賴電腦伺服器。',
                style: const TextStyle(
                  fontSize: 13,
                  color: AppColors.textSecondary,
                  height: 1.5,
                ),
              ),
            ),
            const SizedBox(height: 24),
            Column(
              children: [
                ElevatedButton.icon(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.accentGreen,
                    foregroundColor: Colors.black,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 0,
                  ),
                  icon: const Icon(Icons.phone_android, size: 16),
                  label: const Text('切換為手機原生獨立運行（免電腦）', style: TextStyle(fontWeight: FontWeight.bold)),
                  onPressed: _switchToLocalMode,
                ),
                const SizedBox(height: 12),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    OutlinedButton.icon(
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.textPrimary,
                        side: const BorderSide(color: AppColors.surfaceBorder),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      ),
                      icon: const Icon(Icons.settings, size: 16),
                      label: const Text('設定網址'),
                      onPressed: () {
                        SettingsModal.show(
                          context,
                          currentUrl: _currentUrl,
                          onSaveUrl: _updateServerUrl,
                        );
                      },
                    ),
                    const SizedBox(width: 12),
                    ElevatedButton.icon(
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                        elevation: 0,
                      ),
                      icon: const Icon(Icons.refresh, size: 16),
                      label: const Text('重試連線'),
                      onPressed: () {
                        setState(() {
                          _hasError = false;
                          _isLoading = true;
                        });
                        _controller.loadRequest(Uri.parse(_currentUrl));
                      },
                    ),
                  ],
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
