import 'dart:async';
import 'dart:convert';
import 'dart:io';

import '../config/school_certs.dart';

/// 表示與亞洲大學伺服器通訊時所發生的 API 例外狀況。
class ApiError implements Exception {
  /// 錯誤描述訊息。
  final String message;

  /// HTTP 狀態碼或內部錯誤代碼。
  final int status;

  /// 校方伺服器回傳之原始錯誤資料內容。
  final dynamic payload;

  /// 是否為暫時性連線異常或網路逾時。
  final bool transient;

  /// 建立 [ApiError] 例外物件。
  ///
  /// 指定錯誤訊息 [message]，並可選填狀態碼 [status]、原始資料 [payload] 以及是否暫時性 [transient]。
  ApiError(this.message, {this.status = 0, this.payload, this.transient = false});

  @override
  String toString() => message;
}

/// 提供與亞洲大學校園通識講座系統後端 REST API 進行通訊之客戶端。
class AsiaApi {
  /// 預設之亞大通識講座系統基底網址。
  static const String defaultBaseUrl = 'https://webap.asia.edu.tw/cfd2020/';

  /// 當前連線之伺服器基底網址。
  final String baseUrl;
  final HttpClient _client;

  /// 建立亞大 API 客戶端實例。
  ///
  /// 可傳入自訂之伺服器位址 [baseUrl]；若未提供則使用 [defaultBaseUrl]。
  /// TLS 驗證維持開啟：除作業系統根憑證外，額外信任校方 AIA 中繼憑證，
  /// 不使用 badCertificateCallback 放行任何網域。
  AsiaApi({this.baseUrl = defaultBaseUrl}) : _client = _createVerifiedClient();

  static HttpClient _createVerifiedClient() {
    final client = HttpClient(context: buildSchoolSecurityContext());
    client.connectionTimeout = const Duration(seconds: 25);
    return client;
  }

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

  /// 登入校方帳號並取得授權憑證。
  ///
  /// 傳入學生學號 [username] 與密碼 [password]，成功時回傳包含 JWT token 與使用者資料的 [Map]。
  /// 若帳密錯誤或通訊失敗則拋出 [ApiError]。
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

  /// 取得全校通識講座清冊。
  ///
  /// 傳入登入憑證 [token]（若為訪客瀏覽可為 `null`），回傳全校公開或已登入可視之講座列表。
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

  /// 取得指定代碼之講座詳細資料。
  ///
  /// 依據講座代碼 [eid01] 與憑證 [token] 查詢，若查無該場次則回傳 `null`。
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

  /// 以學生身分證末四碼進行身分驗證。
  ///
  /// 傳入授權憑證 [token]、學號 [pNo]、身分證末四碼 [pId]，以及身分類型 [pType]（預設為 `'S'`）。
  /// 成功時回傳學生詳細基本資料字典，供報名時填寫 `std_info` 使用；若驗證失敗則拋出 [ApiError]。
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

  /// 送出講座報名請求。
  ///
  /// 傳入授權憑證 [token]、學生驗證資訊 [stdInfo]、講座代碼 [eid01] 與校方場次代碼 [reseid]。
  /// 回傳包含執行結果旗標 `ok`、校方訊息 `message` 與原始回應資料 `raw` 的 [Map]。
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

  /// 退選已報名之指定講座。
  ///
  /// 傳入授權憑證 [token] 與校方加密退選流水代碼 [regEid]（格式通常為 `ID...`）。
  /// 退選成功時回傳成功字典；若狀態碼非 200 或退選失敗則拋出 [ApiError]。
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

    // 校方 DeleteData 成功時回傳空字串或引號字串 ""
    if (text.isEmpty || text == '""') {
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

  /// 取得已報名之講座清冊。
  ///
  /// 傳入登入憑證 [token]，回傳包含加密退選流水號（`reseid` / `eid`）之已報名清冊。
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
