import 'dart:async';
import 'dart:convert';
import 'dart:io';

class ApiError implements Exception {
  final String message;
  final int status;
  final dynamic payload;
  final bool transient;

  ApiError(this.message, {this.status = 0, this.payload, this.transient = false});

  @override
  String toString() => message;
}

class AsiaApi {
  static const String defaultBaseUrl = 'https://webap.asia.edu.tw/cfd2020/';
  final String baseUrl;
  final HttpClient _client;

  AsiaApi({this.baseUrl = defaultBaseUrl})
      : _client = HttpClient()
          ..badCertificateCallback = ((X509Certificate cert, String host, int port) => true)
          ..connectionTimeout = const Duration(seconds: 25);

  Uri _resolve(String path) {
    final base = baseUrl.endsWith('/') ? baseUrl : '$baseUrl/';
    return Uri.parse('$base$path');
  }

  Future<dynamic> _rawRequest(
    String method,
    String path, {
    Map<String, dynamic>? body,
    String? token,
    Duration timeout = const Duration(seconds: 25),
  }) async {
    final uri = _resolve(path);
    HttpClientRequest request;
    try {
      request = await _client.openUrl(method, uri).timeout(timeout);
    } catch (e) {
      throw ApiError('網路連線失敗：$e', status: 0, transient: true);
    }

    request.headers.set(HttpHeaders.acceptHeader, 'application/json, text/plain, */*');
    request.headers.set(HttpHeaders.contentTypeHeader, 'application/json;charset=UTF-8');
    request.headers.set(HttpHeaders.userAgentHeader,
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36');

    if (token != null && token.isNotEmpty) {
      request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    }

    if (body != null) {
      final payload = utf8.encode(jsonEncode(body));
      request.headers.set(HttpHeaders.contentLengthHeader, payload.length.toString());
      request.add(payload);
    }

    HttpClientResponse response;
    try {
      response = await request.close().timeout(timeout);
    } catch (e) {
      throw ApiError('請求逾時或連線中斷：$e', status: 0, transient: true);
    }

    final respBytes = await response.fold<List<int>>([], (prev, element) => prev..addAll(element));
    String text = utf8.decode(respBytes, allowMalformed: true).trim();
    if (text.startsWith('\uFEFF')) {
      text = text.substring(1).trim();
    }

    dynamic jsonData;
    try {
      if (text.isNotEmpty) {
        jsonData = jsonDecode(text);
      }
    } catch (_) {
      jsonData = null;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final msg = jsonData is Map ? (jsonData['message'] ?? jsonData['Message']) : text;
      throw ApiError(msg?.toString() ?? 'HTTP ${response.statusCode} $method $path',
          status: response.statusCode, payload: jsonData ?? text);
    }

    if (jsonData == null && text.isNotEmpty) {
      throw ApiError('校方伺服器回應非 JSON 格式', status: response.statusCode, payload: text);
    }

    if (jsonData is Map && jsonData['success'] == false) {
      throw ApiError(jsonData['message']?.toString() ?? '伺服器回報失敗', status: 200, payload: jsonData);
    }

    return jsonData;
  }

  /// 登入校方帳號
  Future<Map<String, dynamic>> login(String username, String password) async {
    final res = await _rawRequest('POST', 'api/Login/Auth', body: {
      'username': username.trim(),
      'password': password,
    });

    if (res is Map && res['res'] != null && res['res']['token'] != null) {
      return Map<String, dynamic>.from(res['res'] as Map);
    }
    throw ApiError(res is Map ? (res['message']?.toString() ?? '登入失敗') : '登入失敗（未取得憑證）', status: 401);
  }

  /// 取得公開/學生講座清冊
  Future<List<Map<String, dynamic>>> listLectures(String? token) async {
    final res = await _rawRequest(
      'POST',
      'api/Cfd01/Load?op=X01F00&eid01=',
      token: token,
      body: {'op': 'X01F00', 'sdate': '', 'edate': '', 'eid01': ''},
    );

    if (res is Map && res['data'] is List) {
      return (res['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }

  /// 取得特定講座明細
  Future<Map<String, dynamic>?> getLecture(String? token, String eid01) async {
    final res = await _rawRequest(
      'GET',
      'api/Cfd01/GetRes?eid01=${Uri.encodeComponent(eid01)}',
      token: token,
    );

    if (res is Map && res['data'] is List && (res['data'] as List).isNotEmpty) {
      return Map<String, dynamic>.from((res['data'] as List).first as Map);
    }
    return null;
  }

  /// 以身分證末四碼進行學生身分驗證，獲取報名所需 std_info
  Future<Map<String, dynamic>> verifyIdentity(
    String token, {
    required String pNo,
    required String pId,
    String pType = 'S',
  }) async {
    final res = await _rawRequest(
      'POST',
      'api/PersonInfo/GetPInfo',
      token: token,
      body: {'p_no': pNo, 'p_id': pId, 'p_type': pType},
    );

    if (res is Map && res['data'] is List && (res['data'] as List).isNotEmpty) {
      final info = Map<String, dynamic>.from((res['data'] as List).first as Map);
      if (info['errmsg'] != null && info['errmsg'].toString().isNotEmpty) {
        throw ApiError(info['errmsg'].toString(), status: 400, payload: info);
      }
      return info;
    }
    throw ApiError('身分驗證無有效回應', status: 400);
  }

  /// 送出講座報名
  Future<Map<String, dynamic>> registerLecture(
    String token, {
    required Map<String, dynamic> stdInfo,
    required String eid01,
    required String reseid,
  }) async {
    final safeStd = Map<String, dynamic>.from(stdInfo);
    safeStd['bfree'] = safeStd['bfree'] ?? 'N';

    final res = await _rawRequest(
      'POST',
      'api/Cfd10/Save',
      token: token,
      body: {'std_info': safeStd, 'eid01': eid01, 'reseid': reseid},
      timeout: const Duration(seconds: 20),
    );

    final msg = (res is Map ? (res['message'] ?? res['Message']) : '')?.toString().trim() ?? '';
    final isOk = res is Map &&
        res['success'] != false &&
        msg.contains('成功') &&
        !RegExp(r'未成功|失敗|錯誤|不正確|已滿|額滿').hasMatch(msg);

    return {'ok': isOk, 'message': msg.isNotEmpty ? msg : '（系統未回傳訊息）', 'raw': res};
  }

  /// 退選已報名之講座（reseid 為校方加密流水號 ID...）
  Future<Map<String, dynamic>> cancelLecture(String token, String regEid) async {
    final uri = _resolve('api/cfd10/DeleteData?reseid=${Uri.encodeComponent(regEid)}');
    final request = await _client.openUrl('POST', uri).timeout(const Duration(seconds: 20));

    request.headers.set(HttpHeaders.acceptHeader, 'application/json, text/plain, */*');
    request.headers.set(HttpHeaders.contentTypeHeader, 'application/json;charset=UTF-8');
    request.headers.set(HttpHeaders.authorizationHeader, 'Bearer $token');
    request.headers.set(HttpHeaders.contentLengthHeader, '2');
    request.add(utf8.encode('{}'));

    final response = await request.close().timeout(const Duration(seconds: 20));
    final respBytes = await response.fold<List<int>>([], (prev, element) => prev..addAll(element));
    String text = utf8.decode(respBytes, allowMalformed: true).trim();
    if (text.startsWith('\uFEFF')) text = text.substring(1).trim();

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiError(text.isNotEmpty ? text : '退選失敗（HTTP ${response.statusCode}）', status: response.statusCode);
    }

    // 校方 DeleteData 成功時回傳空字串 ""
    if (text.isEmpty) {
      return {'ok': true, 'message': '已成功取消報名'};
    }

    try {
      final json = jsonDecode(text);
      final msg = json is Map ? (json['message'] ?? json['Message'] ?? text) : text;
      throw ApiError(msg.toString(), status: 400, payload: text);
    } catch (_) {
      throw ApiError(text, status: 400, payload: text);
    }
  }

  /// 取得已報名清冊（含加密退選代碼）
  Future<List<Map<String, dynamic>>> listRegistered(String token) async {
    final res = await _rawRequest(
      'POST',
      'api/Cfd01/Load_del?op=X01F00DEL&eid01=',
      token: token,
      body: {'op': 'X01F00DEL', 'eid01': '', 'reseid': ''},
    );

    if (res is Map && res['data'] is List) {
      return (res['data'] as List).map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
    return [];
  }
}
