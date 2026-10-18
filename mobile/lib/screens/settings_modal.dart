import 'package:flutter/material.dart';
import '../config/constants.dart';

class SettingsModal extends StatefulWidget {
  final String currentUrl;
  final ValueChanged<String> onSaveUrl;

  const SettingsModal({
    super.key,
    required this.currentUrl,
    required this.onSaveUrl,
  });

  static Future<void> show(
    BuildContext context, {
    required String currentUrl,
    required ValueChanged<String> onSaveUrl,
  }) {
    return showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: AppColors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
        side: BorderSide(color: AppColors.surfaceBorder, width: 1),
      ),
      builder: (ctx) => SettingsModal(
        currentUrl: currentUrl,
        onSaveUrl: onSaveUrl,
      ),
    );
  }

  @override
  State<SettingsModal> createState() => _SettingsModalState();
}

class _SettingsModalState extends State<SettingsModal> {
  late final TextEditingController _urlController;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _urlController = TextEditingController(text: widget.currentUrl);
  }

  @override
  void dispose() {
    _urlController.dispose();
    super.dispose();
  }

  void _applyPreset(String host) {
    setState(() {
      _urlController.text = 'http://$host:${AppConstants.defaultPort}';
      _errorMessage = null;
    });
  }

  void _submit() {
    String input = _urlController.text.trim();
    if (input.isEmpty) {
      setState(() {
        _errorMessage = '請輸入伺服器網址';
      });
      return;
    }

    if (!input.startsWith('http://') && !input.startsWith('https://')) {
      input = 'http://$input';
    }

    final uri = Uri.tryParse(input);
    if (uri == null || !uri.hasAuthority) {
      setState(() {
        _errorMessage = '無效的網址格式，請確認是否包含主機位址';
      });
      return;
    }

    widget.onSaveUrl(input);
    Navigator.of(context).pop();
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, 20 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                '伺服器連線設定',
                style: TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  letterSpacing: 0.5,
                ),
              ),
              IconButton(
                icon: const Icon(Icons.close, color: AppColors.textSecondary, size: 20),
                onPressed: () => Navigator.of(context).pop(),
              ),
            ],
          ),
          const SizedBox(height: 12),
          const Text(
            '請輸入電腦上運行的搶課後端服務位址（需與手機連線至相同的 Wi-Fi 區域網路）：',
            style: TextStyle(
              fontSize: 13,
              color: AppColors.textSecondary,
              height: 1.4,
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _urlController,
            style: const TextStyle(
              color: AppColors.textPrimary,
              fontFamily: 'monospace',
              fontSize: 14,
            ),
            decoration: InputDecoration(
              filled: true,
              fillColor: AppColors.background,
              hintText: 'http://192.168.1.100:5199',
              hintStyle: const TextStyle(color: Color(0xFF6B7280)),
              errorText: _errorMessage,
              errorStyle: const TextStyle(color: AppColors.error),
              contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.surfaceBorder),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: const BorderSide(color: AppColors.primary, width: 1.5),
              ),
            ),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ActionChip(
                backgroundColor: AppColors.background,
                side: const BorderSide(color: AppColors.surfaceBorder),
                label: const Text('Android 模擬器 (10.0.2.2)', style: TextStyle(fontSize: 12, color: AppColors.accentCyan)),
                onPressed: () => _applyPreset(AppConstants.defaultAndroidEmulatorHost),
              ),
              ActionChip(
                backgroundColor: AppColors.background,
                side: const BorderSide(color: AppColors.surfaceBorder),
                label: const Text('本機預設 (127.0.0.1)', style: TextStyle(fontSize: 12, color: AppColors.accentGreen)),
                onPressed: () => _applyPreset(AppConstants.defaultLocalHost),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  style: OutlinedButton.styleFrom(
                    foregroundColor: AppColors.textSecondary,
                    side: const BorderSide(color: AppColors.surfaceBorder),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  onPressed: () => Navigator.of(context).pop(),
                  child: const Text('取消'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton(
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                    elevation: 0,
                  ),
                  onPressed: _submit,
                  child: const Text('儲存並重新連線', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
