import 'package:dio/dio.dart';

class ApiException implements Exception {
  ApiException(this.message, {this.statusCode});

  final int? statusCode;
  final String message;

  @override
  String toString() => statusCode == null ? message : '[$statusCode] $message';
}

ApiException apiExceptionFromDio(DioException e) {
  final status = e.response?.statusCode;
  final data = e.response?.data;

  if (data is Map && data['message'] is String) {
    return ApiException(data['message'] as String, statusCode: status);
  }

  return ApiException(e.message ?? 'Request failed', statusCode: status);
}

