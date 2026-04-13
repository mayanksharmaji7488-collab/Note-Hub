import 'package:dio/dio.dart';

import '../../../core/network/api_error.dart';
import 'models/user_summary.dart';

class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<UserSummary> login({
    required String identifier,
    required String password,
  }) async {
    try {
      final res = await _dio.post(
        '/api/login',
        data: {'identifier': identifier, 'password': password},
      );
      return UserSummary.fromJson(_asMap(res.data));
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Future<UserSummary> me() async {
    try {
      final res = await _dio.get('/api/user');
      return UserSummary.fromJson(_asMap(res.data));
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Future<void> logout() async {
    try {
      await _dio.post('/api/logout');
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw ApiException('Invalid response payload');
  }
}

