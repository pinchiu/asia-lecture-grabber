import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';

class ReleaseInfo {
  final String tagName;
  final String name;
  final String body;
  final String apkUrl;
  final int apkSize;
  final String htmlUrl;
  final bool hasUpdate;

  ReleaseInfo({
    required this.tagName,
    required this.name,
    required this.body,
    required this.apkUrl,
    required this.apkSize,
    required this.htmlUrl,
    required this.hasUpdate,
  });
}

class UpdateService {
  static const String currentVersion = '1.3.2';
  static const String repoApiUrl = 'https://api.github.com/repos/pinchiu/asia-lecture-grabber/releases/latest';
  static const MethodChannel _channel = MethodChannel('com.asia.lecturegrabber/installer');

  /// 檢查 GitHub 是否有新版本
  static Future<ReleaseInfo?> checkUpdate() async {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 12);

    try {
      final request = await client.getUrl(Uri.parse(repoApiUrl));
      request.headers.set('User-Agent', 'AsiaLectureGrabberApp/$currentVersion');
      request.headers.set('Accept', 'application/vnd.github.v3+json');

      final response = await request.close();
      if (response.statusCode != 200) {
        return null;
      }

      final bodyString = await response.transform(utf8.decoder).join();
      final json = jsonDecode(bodyString) as Map<String, dynamic>;

      final tagName = (json['tag_name'] ?? '').toString();
      final name = (json['name'] ?? tagName).toString();
      final body = (json['body'] ?? '').toString();
      final htmlUrl = (json['html_url'] ?? '').toString();

      String apkUrl = '';
      int apkSize = 0;

      final assets = json['assets'] as List<dynamic>? ?? [];
      for (final asset in assets) {
        final aName = (asset['name'] ?? '').toString();
        if (aName.endsWith('.apk')) {
          apkUrl = (asset['browser_download_url'] ?? '').toString();
          apkSize = int.tryParse((asset['size'] ?? 0).toString()) ?? 0;
          break;
        }
      }

      final hasUpdate = _isNewer(tagName, currentVersion);

      return ReleaseInfo(
        tagName: tagName,
        name: name,
        body: body,
        apkUrl: apkUrl,
        apkSize: apkSize,
        htmlUrl: htmlUrl,
        hasUpdate: hasUpdate,
      );
    } catch (_) {
      return null;
    } finally {
      client.close();
    }
  }

  /// 下載 APK 檔案並即時回報進度 (0.0 ~ 1.0)
  static Future<String> downloadApk(
    String downloadUrl, {
    required void Function(double progress, int received, int total) onProgress,
  }) async {
    final client = HttpClient();
    client.connectionTimeout = const Duration(seconds: 15);

    try {
      final request = await client.getUrl(Uri.parse(downloadUrl));
      request.headers.set('User-Agent', 'AsiaLectureGrabberApp/$currentVersion');
      request.followRedirects = true;

      final response = await request.close();
      if (response.statusCode != 200) {
        throw Exception('伺服器回應異常：HTTP ${response.statusCode}');
      }

      final total = response.contentLength;
      final tempDir = Directory.systemTemp;
      final saveFile = File('${tempDir.path}/app-update.apk');
      if (await saveFile.exists()) {
        try {
          await saveFile.delete();
        } catch (_) {}
      }

      final sink = saveFile.openWrite();
      int received = 0;

      await for (final chunk in response) {
        received += chunk.length;
        sink.add(chunk);
        if (total > 0) {
          final progress = received / total;
          onProgress(progress, received, total);
        } else {
          onProgress(-1.0, received, 0);
        }
      }

      await sink.flush();
      await sink.close();

      return saveFile.path;
    } finally {
      client.close();
    }
  }

  /// 呼叫 Android 系統套件安裝程式
  static Future<bool> installApk(String filePath) async {
    try {
      final res = await _channel.invokeMethod<bool>('installApk', {'filePath': filePath});
      return res ?? false;
    } catch (e) {
      throw Exception('啟動安裝失敗：$e');
    }
  }

  /// 呼叫外部瀏覽器開啟 URL（備用下載）
  static Future<bool> openUrl(String url) async {
    try {
      final res = await _channel.invokeMethod<bool>('openUrl', {'url': url});
      return res ?? false;
    } catch (e) {
      throw Exception('開啟網址失敗：$e');
    }
  }

  /// 版本比對：判斷 remote 是否比 local 新
  static bool _isNewer(String remoteTag, String localVer) {
    final r = _parseVersion(remoteTag);
    final l = _parseVersion(localVer);

    for (int i = 0; i < 3; i++) {
      if (r[i] > l[i]) return true;
      if (r[i] < l[i]) return false;
    }
    return false;
  }

  static List<int> _parseVersion(String ver) {
    final clean = ver.replaceAll(RegExp(r'[^0-9.]'), '');
    final parts = clean.split('.');
    final result = [0, 0, 0];
    for (int i = 0; i < parts.length && i < 3; i++) {
      result[i] = int.tryParse(parts[i]) ?? 0;
    }
    return result;
  }
}
