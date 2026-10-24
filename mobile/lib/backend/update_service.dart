import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';

/// 儲存 GitHub 最新版本發布之詳細資訊。
class ReleaseInfo {
  /// 版本標籤名稱（如 `'v1.3.3'`）。
  final String tagName;

  /// 發布標題文字。
  final String name;

  /// 發布更新日誌與說明內文。
  final String body;

  /// APK 安裝包下載位址。
  final String apkUrl;

  /// 安裝包檔案位元組大小。
  final int apkSize;

  /// GitHub 發布頁面網址。
  final String htmlUrl;

  /// 是否存在比本機更新的版本。
  final bool hasUpdate;

  /// 建立版本發布資訊物件。
  ///
  /// 包含 [tagName]、[name]、[body]、[apkUrl]、[apkSize]、[htmlUrl] 與 [hasUpdate]。
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

/// 提供 GitHub 遠端版本檢查、APK 下載進度回報與原生安裝引導之服務。
class UpdateService {
  UpdateService._();

  /// 當前 App 運行的版本識別字串。
  static const String currentVersion = '1.4.1';

  /// GitHub Releases 最新版本之 REST API 查詢端點。
  static const String repoApiUrl = 'https://api.github.com/repos/pinchiu/asia-lecture-grabber/releases/latest';
  static const MethodChannel _channel = MethodChannel('com.asia.lecturegrabber/installer');

  /// 檢查 GitHub 是否有新版本釋出。
  ///
  /// 查詢 GitHub Releases API，若連線成功且解析順利則回傳 [ReleaseInfo]；發生錯誤或無回應時回傳 `null`。
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
      final decoded = jsonDecode(bodyString);
      if (decoded is! Map) return null;
      final json = decoded;

      final tagName = (json['tag_name'] ?? '').toString();
      final name = (json['name'] ?? tagName).toString();
      final body = (json['body'] ?? '').toString();
      final htmlUrl = (json['html_url'] ?? '').toString();

      String apkUrl = '';
      int apkSize = 0;

      final assets = (json['assets'] is List) ? (json['assets'] as List) : const [];
      for (final asset in assets) {
        if (asset is! Map) continue;
        final aName = (asset['name'] ?? '').toString();
        if (aName.endsWith('.apk')) {
          apkUrl = (asset['browser_download_url'] ?? '').toString();
          apkSize = int.tryParse((asset['size'] ?? 0).toString()) ?? 0;
          break;
        }
      }

      final hasUpdate = isNewer(tagName, currentVersion);

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

  /// 下載 APK 檔案並即時回報進度。
  ///
  /// 向 [downloadUrl] 發送 GET 請求，並透過回呼函式 [onProgress] 回報進度比率（0.0 ~ 1.0）、已接收位元組數與總位元組數。
  /// 下載完成後回傳暫存檔案之本機路徑。若 HTTP 狀態碼非 200 則拋出 [Exception]。
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

  /// 呼叫 Android 系統套件安裝程式。
  ///
  /// 傳入欲安裝之本機檔案路徑 [filePath]，透過原生通道叫起系統安裝畫面。
  /// 成功啟動時回傳 `true`；若調用失敗則拋出 [Exception]。
  static Future<bool> installApk(String filePath) async {
    try {
      final res = await _channel.invokeMethod<bool>('installApk', {'filePath': filePath});
      return res ?? false;
    } catch (e) {
      throw Exception('啟動安裝失敗：$e');
    }
  }

  /// 呼叫外部瀏覽器開啟指定之網址。
  ///
  /// 傳入欲開啟之 [url]；成功啟動外部應用時回傳 `true`，調用失敗則拋出 [Exception]。
  static Future<bool> openUrl(String url) async {
    try {
      final res = await _channel.invokeMethod<bool>('openUrl', {'url': url});
      return res ?? false;
    } catch (e) {
      throw Exception('開啟網址失敗：$e');
    }
  }

  /// 比較版本號碼以判定遠端版本是否新於本地版本。
  ///
  /// 解析 [remoteTag] 與 [localVer]，依序比對主版號、次版號與修訂版號。
  /// 若遠端版本較新則回傳 `true`；若版本相同或遠端較舊則回傳 `false`。
  static bool isNewer(String remoteTag, String localVer) {
    final r = parseVersion(remoteTag);
    final l = parseVersion(localVer);

    for (int i = 0; i < 3; i++) {
      if (r[i] > l[i]) return true;
      if (r[i] < l[i]) return false;
    }
    return false;
  }

  /// 解析版本號碼字串為整數三元組。
  ///
  /// 過濾 [ver] 中非數字與句點之字元，回傳長度為 3 之整數陣列（`[major, minor, patch]`）。
  static List<int> parseVersion(String ver) {
    final clean = ver.replaceAll(RegExp(r'[^0-9.]'), '');
    final parts = clean.split('.');
    final result = [0, 0, 0];
    for (int i = 0; i < parts.length && i < 3; i++) {
      result[i] = int.tryParse(parts[i]) ?? 0;
    }
    return result;
  }
}
