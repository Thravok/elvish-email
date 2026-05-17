import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:dio_cookie_manager/dio_cookie_manager.dart';
import 'package:cookie_jar/cookie_jar.dart';
import 'package:path/path.dart' as p;
import 'package:path_provider/path_provider.dart';

import '../config.dart';
import 'mail_dtos.dart';

/// JSON API client with persistent cookies (`elvish_session`), matching `IOS/IOS/Networking/APIClient.swift`.
class ElvishApiClient {
  ElvishApiClient._(this._dio);

  final Dio _dio;

  static Future<ElvishApiClient> create() async {
    final base = resolveApiBaseUrl();
    if (base.isEmpty) {
      throw StateError('ELVISH_API_BASE is empty (web builds need --dart-define).');
    }
    final dir = await getApplicationSupportDirectory();
    final storage = FileStorage(p.join(dir.path, 'elvish_http_cookies'));
    final jar = PersistCookieJar(storage: storage);
    final dio = Dio(
      BaseOptions(
        baseUrl: base,
        connectTimeout: const Duration(seconds: 30),
        receiveTimeout: const Duration(seconds: 60),
        headers: {
          'Accept': 'application/json',
        },
        responseType: ResponseType.json,
        validateStatus: (s) => s != null && s < 500,
      ),
    );
    dio.interceptors.add(CookieManager(jar));
    return ElvishApiClient._(dio);
  }

  Dio get dio => _dio;

  /// API origin without trailing slash (same as `IOS/AppEnvironment.apiBaseURL`).
  String get apiRoot => _dio.options.baseUrl;

  Future<Map<String, dynamic>> getJson(String path) async {
    final r = await _dio.get<dynamic>(path);
    throwIfNotOk(r);
    final m = decodeJsonMap(r);
    if (m == null) {
      throw StateError('Expected JSON object for GET $path');
    }
    return m;
  }

  Future<Map<String, dynamic>> postJson(String path, Map<String, dynamic> body) async {
    final r = await _dio.post<dynamic>(
      path,
      data: jsonEncode(body),
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
    throwIfNotOk(r);
    final m = decodeJsonMap(r);
    if (m == null) {
      throw StateError('Expected JSON object for POST $path');
    }
    return m;
  }

  Future<void> postJsonExpectOk(String path, Map<String, dynamic> body) async {
    final r = await _dio.post<dynamic>(
      path,
      data: jsonEncode(body),
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
    throwIfNotOk(r);
  }

  Future<void> postEmptyExpectOk(String path) async {
    final r = await _dio.post<dynamic>(path);
    throwIfNotOk(r);
  }

  Future<Map<String, dynamic>> patchJson(String path, Map<String, dynamic> body) async {
    final r = await _dio.patch<dynamic>(
      path,
      data: jsonEncode(body),
      options: Options(headers: {'Content-Type': 'application/json'}),
    );
    throwIfNotOk(r);
    final m = decodeJsonMap(r);
    if (m == null) {
      throw StateError('Expected JSON object for PATCH $path');
    }
    return m;
  }

  Future<void> deleteExpectOk(String path) async {
    final r = await _dio.delete<dynamic>(path);
    throwIfNotOk(r);
  }

  /// Raw bytes (e.g. PGP blob). Caller checks status.
  Future<List<int>> getBytes(String path) async {
    final r = await _dio.get<dynamic>(
      path,
      options: Options(
        responseType: ResponseType.bytes,
        headers: {'Accept': '*/*'},
      ),
    );
    throwIfNotOk(r);
    final data = r.data;
    if (data == null) {
      throw StateError('empty body for $path');
    }
    if (data is Uint8List) {
      return data;
    }
    if (data is List<int>) {
      return data;
    }
    throw StateError('unexpected body type for $path');
  }
}
