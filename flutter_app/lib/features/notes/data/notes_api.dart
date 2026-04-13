import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/foundation.dart';

import '../../../core/network/api_error.dart';
import 'models/note.dart';

class NotesApi {
  NotesApi(this._dio);

  final Dio _dio;

  Future<List<Note>> listNotes({String? search}) async {
    try {
      final res = await _dio.get(
        '/api/notes',
        queryParameters:
            (search == null || search.trim().isEmpty) ? null : {'search': search.trim()},
      );

      final data = res.data;
      if (data is! List) throw ApiException('Invalid response payload');
      return data
          .whereType<Object?>()
          .map((e) => Note.fromJson(_asMap(e)))
          .toList(growable: false);
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Future<Note> getNote(int id) async {
    try {
      final res = await _dio.get('/api/notes/$id');
      return Note.fromJson(_asMap(res.data));
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Future<Note> uploadNote({
    required String title,
    required String subject,
    required String semester,
    String? description,
    required PlatformFile file,
  }) async {
    try {
      final MultipartFile multipartFile;
      if (kIsWeb) {
        final bytes = file.bytes;
        if (bytes == null) {
          throw ApiException('File bytes missing (web). Try picking the file again.');
        }
        multipartFile = MultipartFile.fromBytes(bytes, filename: file.name);
      } else {
        final path = file.path;
        if (path == null) {
          throw ApiException('File path missing. Try picking the file again.');
        }
        multipartFile = await MultipartFile.fromFile(path, filename: file.name);
      }

      final form = FormData.fromMap({
        'title': title.trim(),
        'subject': subject.trim(),
        'semester': semester.trim(),
        if (description != null && description.trim().isNotEmpty) 'description': description.trim(),
        'file': multipartFile,
      });

      final res = await _dio.post(
        '/api/notes',
        data: form,
        options: Options(contentType: 'multipart/form-data'),
      );
      return Note.fromJson(_asMap(res.data));
    } on DioException catch (e) {
      throw apiExceptionFromDio(e);
    }
  }

  Future<void> recordDownload(int id) async {
    try {
      await _dio.post('/api/notes/$id/download');
    } on DioException catch (e) {
      final err = apiExceptionFromDio(e);
      if (err.statusCode == 404) return;
      throw err;
    }
  }

  Map<String, dynamic> _asMap(dynamic data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return Map<String, dynamic>.from(data);
    throw ApiException('Invalid response payload');
  }
}

