import 'package:dio/dio.dart';
import 'package:dio/browser.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/api_config.dart';
import 'session_cookie_store.dart';

final sessionCookieStoreProvider = Provider<SessionCookieStore>((ref) {
  return SessionCookieStore();
});

final dioProvider = Provider<Dio>((ref) {
  final dio = Dio(
    BaseOptions(
      baseUrl: ApiConfig.baseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 15),
    ),
  );

  if (kIsWeb) {
    dio.httpClientAdapter = BrowserHttpClientAdapter()..withCredentials = true;
  } else {
    final store = ref.read(sessionCookieStoreProvider);
    dio.interceptors.add(_SessionCookieInterceptor(store));
  }

  return dio;
});

class _SessionCookieInterceptor extends Interceptor {
  _SessionCookieInterceptor(this.store);

  final SessionCookieStore store;

  @override
  void onRequest(RequestOptions options, RequestInterceptorHandler handler) {
    final cookie = store.cookieHeader;
    if (cookie != null && cookie.isNotEmpty) {
      options.headers['Cookie'] = cookie;
    }
    handler.next(options);
  }

  @override
  void onResponse(Response response, ResponseInterceptorHandler handler) {
    final setCookie = response.headers.map['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      store.saveFromSetCookieHeaders(setCookie);
    }
    handler.next(response);
  }

  @override
  void onError(DioException err, ErrorInterceptorHandler handler) {
    final setCookie = err.response?.headers.map['set-cookie'];
    if (setCookie != null && setCookie.isNotEmpty) {
      store.saveFromSetCookieHeaders(setCookie);
    }
    handler.next(err);
  }
}

