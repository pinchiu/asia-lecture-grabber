import 'dart:convert';
import 'dart:io';
import 'package:flutter/services.dart';
import 'calendar_helper.dart';
import 'grab_engine.dart';

/// 提供手機端原生內嵌 HTTP 伺服器，支援網頁前端資源與本地 REST API 端點。
class InAppServer {
  /// 伺服器所綁定之搶課狀態機引擎實例。
  final GrabEngine engine;
  HttpServer? _server;

  /// 本地 HTTP 服務目前監聽之連接埠號。
  int get port => _server?.port ?? 0;

  /// 本地 HTTP 服務之完整位址。
  String get localUrl => 'http://127.0.0.1:$port';

  /// 建立手機端內嵌 HTTP 伺服器實例。
  ///
  /// 可傳入特定之 [engineInstance]；若未指定則預設建立 [GrabEngine.new]。
  InAppServer({GrabEngine? engineInstance}) : engine = engineInstance ?? GrabEngine();

  /// 靜態檔案副檔名對應之 MIME 類型表。
  static const Map<String, String> mimeTypes = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.webmanifest': 'application/manifest+json; charset=utf-8',
  };

  /// 啟動手機端內建獨立 HTTP 伺服器。
  ///
  /// 初始化引擎儲存狀態並隨機綁定可用之本地連接埠。
  Future<void> start() async {
    await engine.initFromStorage();
    _server = await HttpServer.bind(InternetAddress.loopbackIPv4, 0);
    _server!.listen(_handleRequest);
    engine.log('info', '手機端獨立伺服器已啟動於 127.0.0.1:$port');
  }

  /// 停止內建伺服器並釋放網路資源。
  ///
  /// 停止搶課引擎並強制關閉 HTTP 監聽通道。
  Future<void> stop() async {
    engine.stop('伺服器關閉');
    await _server?.close(force: true);
    _server = null;
  }

  Future<void> _handleRequest(HttpRequest request) async {
    // 支援 CORS
    request.response.headers.set('Access-Control-Allow-Origin', '*');
    request.response.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    request.response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (request.method == 'OPTIONS') {
      request.response.statusCode = HttpStatus.noContent;
      await request.response.close();
      return;
    }

    final path = request.uri.path;
    try {
      if (path.startsWith('/api/')) {
        await _handleApi(request);
      } else {
        await _serveStatic(request);
      }
    } catch (e) {
      _sendJson(request.response, HttpStatus.internalServerError, {'error': e.toString()});
    }
  }

  Future<void> _serveStatic(HttpRequest request) async {
    String reqPath = request.uri.path;
    if (reqPath == '/' || reqPath.isEmpty) {
      reqPath = '/index.html';
    }

    final assetPath = 'assets/web${reqPath.startsWith('/') ? reqPath : '/$reqPath'}';
    try {
      final byteData = await rootBundle.load(assetPath);
      final bytes = byteData.buffer.asUint8List();

      final ext = reqPath.contains('.') ? '.${reqPath.split('.').last}' : '.html';
      final mime = mimeTypes[ext] ?? 'application/octet-stream';

      request.response.headers.set(HttpHeaders.contentTypeHeader, mime);
      request.response.headers.set(HttpHeaders.contentLengthHeader, bytes.length.toString());
      request.response.add(bytes);
      await request.response.close();
    } catch (_) {
      request.response.statusCode = HttpStatus.notFound;
      request.response.write('Not Found: $reqPath');
      await request.response.close();
    }
  }

  Future<Map<String, dynamic>> _readJson(HttpRequest request) async {
    final content = await utf8.decoder.bind(request).join();
    if (content.trim().isEmpty) return {};
    try {
      final data = jsonDecode(content);
      return data is Map ? Map<String, dynamic>.from(data) : {};
    } catch (_) {
      throw Exception('請求格式需為 JSON');
    }
  }

  void _sendJson(HttpResponse response, int status, dynamic data) {
    final payload = utf8.encode(jsonEncode(data));
    response.statusCode = status;
    response.headers.set(HttpHeaders.contentTypeHeader, 'application/json; charset=utf-8');
    response.headers.set(HttpHeaders.cacheControlHeader, 'no-store');
    response.headers.set(HttpHeaders.contentLengthHeader, payload.length.toString());
    response.add(payload);
    response.close();
  }

  Future<void> _handleApi(HttpRequest request) async {
    final method = request.method;
    final path = request.uri.path;
    final route = '$method $path';
    final res = request.response;

    switch (route) {
      case 'GET /api/state':
        return _sendJson(res, 200, engine.snapshot());

      case 'POST /api/login':
        final body = await _readJson(request);
        final username = (body['username'] ?? '').toString().trim();
        String password = (body['password'] ?? '').toString();
        final idLast4 = (body['idLast4'] ?? '').toString().trim();
        final remember = body['remember'] == true;

        if (password.isEmpty && engine.session?['password'] != null && engine.session?['username'] == username) {
          password = engine.session!['password'].toString();
        }

        if (username.isEmpty || password.isEmpty) {
          return _sendJson(res, 400, {'error': '請輸入學號與密碼'});
        }

        try {
          final user = await engine.api.login(username, password);
          engine.setSession({
            'token': user['token'],
            'emp_id': user['emp_id'] ?? username,
            'emp_nm': user['emp_nm'] ?? '',
            'emp_rl': user['emp_rl'] ?? 'Student',
            'idLast4': idLast4,
            'username': username,
            'password': remember ? password : '',
          });

          await engine.persistConfig();

          Map<String, dynamic>? identity;
          if (idLast4.isNotEmpty) {
            try {
              final info = await engine.ensureIdentity();
              identity = {
                'name': info['chi_name'] ?? '',
                'dept': info['dept_name_s'] ?? info['dept_dept'] ?? '',
                'email': info['email'] ?? '',
              };
            } catch (err) {
              engine.log('warn', '身分驗證失敗：$err');
            }
          }

          return _sendJson(res, 200, {
            'session': engine.snapshot()['session'],
            'identity': identity,
          });
        } catch (e) {
          return _sendJson(res, 400, {'error': e.toString()});
        }

      case 'POST /api/logout':
        engine.stop('使用者登出');
        engine.setSession(null);
        await engine.persistConfig();
        return _sendJson(res, 200, {'ok': true});

      case 'GET /api/lectures':
        try {
          final token = engine.session?['token']?.toString();
          final rows = await engine.api.listLectures(token);
          engine.lectures = rows;
          engine.stats['lastSyncAt'] = DateTime.now().millisecondsSinceEpoch;
          return _sendJson(res, 200, {'lectures': rows, 'fetchedAt': DateTime.now().millisecondsSinceEpoch});
        } catch (e) {
          if (engine.lectures.isNotEmpty) {
            return _sendJson(res, 200, {
              'lectures': engine.lectures,
              'fetchedAt': engine.stats['lastSyncAt'],
              'warning': e.toString(),
            });
          }
          return _sendJson(res, 502, {'error': e.toString()});
        }

      case 'GET /api/registered':
        final token = engine.session?['token']?.toString();
        if (token == null) return _sendJson(res, 401, {'error': '請先登入'});
        final rows = await engine.api.listRegistered(token);
        return _sendJson(res, 200, {'rows': rows});

      case 'POST /api/targets':
        final body = await _readJson(request);
        final ids = (body['eid01s'] is List)
            ? (body['eid01s'] as List).map((e) => e.toString()).toList()
            : (body['eid01'] != null ? [body['eid01'].toString()] : <String>[]);
        if (ids.isEmpty) return _sendJson(res, 400, {'error': '請提供要加入的講座編號'});

        if (engine.lectures.isEmpty) {
          engine.lectures = await engine.api.listLectures(engine.session?['token']?.toString());
        }

        final rows = engine.lectures.where((r) => ids.contains(r['eid01']?.toString())).toList();
        final added = engine.addTargets(rows);
        final missing = ids.where((id) => !rows.any((r) => r['eid01']?.toString() == id)).toList();
        return _sendJson(res, 200, {'added': added, 'missing': missing});

      case 'POST /api/targets/remove':
        final body = await _readJson(request);
        engine.removeTarget(body['eid01']?.toString() ?? '');
        return _sendJson(res, 200, {'ok': true});

      case 'POST /api/targets/clear':
        engine.clearTargets();
        return _sendJson(res, 200, {'ok': true});

      case 'POST /api/engine/start':
        try {
          await engine.start();
          return _sendJson(res, 200, {'ok': true});
        } catch (e) {
          return _sendJson(res, 400, {'error': e.toString()});
        }

      case 'POST /api/engine/stop':
        engine.stop('使用者停止');
        return _sendJson(res, 200, {'ok': true});

      case 'POST /api/register':
        final body = await _readJson(request);
        try {
          final msg = await engine.manualRegister(body['eid01']?.toString() ?? '');
          return _sendJson(res, 200, {'message': msg});
        } catch (e) {
          return _sendJson(res, 400, {'error': e.toString()});
        }

      case 'POST /api/cancel':
        final body = await _readJson(request);
        final id = (body['eid'] ?? body['reseid'] ?? body['eid01'] ?? '').toString();
        try {
          final title = await engine.cancelTarget(
            id,
            eid: body['eid']?.toString(),
            reseid: body['reseid']?.toString(),
            eid01: body['eid01']?.toString(),
          );
          return _sendJson(res, 200, {'ok': true, 'message': '已成功取消報名：$title'});
        } catch (e) {
          return _sendJson(res, 400, {'error': e.toString()});
        }

      case 'GET /api/calendar':
        List<Map<String, dynamic>> registered = [];
        final token = engine.session?['token']?.toString();
        if (token != null) {
          try {
            registered = await engine.api.listRegistered(token);
          } catch (_) {}
        }
        final all = [...engine.lectures, ...registered];
        return _sendJson(res, 200, {
          'events': CalendarHelper.buildCalendar(all),
          'fetchedAt': DateTime.now().millisecondsSinceEpoch,
        });

      case 'GET /api/calendar.ics':
        List<Map<String, dynamic>> registered = [];
        final token = engine.session?['token']?.toString();
        if (token != null) {
          try {
            registered = await engine.api.listRegistered(token);
          } catch (_) {}
        }
        final all = [...engine.lectures, ...registered];
        final icsContent = CalendarHelper.generateIcs(all);
        final icsBytes = utf8.encode(icsContent);
        res.statusCode = HttpStatus.ok;
        res.headers.set(HttpHeaders.contentTypeHeader, 'text/calendar; charset=utf-8');
        res.headers.set('Content-Disposition', 'inline; filename="asia-lectures.ics"');
        res.headers.set(HttpHeaders.cacheControlHeader, 'no-cache');
        res.headers.set(HttpHeaders.contentLengthHeader, icsBytes.length.toString());
        res.add(icsBytes);
        await res.close();
        return;

      case 'POST /api/config':
        final body = await _readJson(request);
        if (body['graduation'] is Map && body['graduation']['history'] is Map) {
          engine.graduation['history'] = Map<String, dynamic>.from(body['graduation']['history']);
        }
        if (body['engine'] is Map) {
          engine.settings.addAll(Map<String, dynamic>.from(body['engine']));
        }
        await engine.persistConfig();
        return _sendJson(res, 200, {'ok': true, 'config': engine.snapshot()});

      case 'POST /api/schedule':
        final body = await _readJson(request);
        if (body['enabled'] != null) {
          engine.schedule['enabled'] = body['enabled'] == true;
        }
        if (body['entries'] is List) {
          engine.schedule['entries'] = List.from(body['entries']);
        }
        await engine.persistConfig();
        return _sendJson(res, 200, {'schedule': engine.schedule});

      case 'GET /api/logs':
        final since = int.tryParse(request.uri.queryParameters['since'] ?? '0') ?? 0;
        return _sendJson(res, 200, {
          'logs': engine.logsSince(since),
          'cursor': engine.logs.isNotEmpty ? engine.logs.last['seq'] : 0,
        });

      case 'POST /api/logs/clear':
        engine.logs.clear();
        return _sendJson(res, 200, {'ok': true});

      default:
        return _sendJson(res, 404, {'error': 'Route not found: $route'});
    }
  }
}
