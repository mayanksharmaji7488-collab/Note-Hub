import 'package:file_picker/file_picker.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'models/note.dart';
import 'notes_api.dart';

final notesRepositoryProvider = Provider<NotesRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return NotesRepository(NotesApi(dio));
});

class NotesRepository {
  NotesRepository(this._api);

  final NotesApi _api;

  Future<List<Note>> listNotes({String? search}) => _api.listNotes(search: search);

  Future<Note> getNote(int id) => _api.getNote(id);

  Future<Note> uploadNote({
    required String title,
    required String subject,
    required String semester,
    String? description,
    required PlatformFile file,
  }) {
    return _api.uploadNote(
      title: title,
      subject: subject,
      semester: semester,
      description: description,
      file: file,
    );
  }

  Future<void> recordDownload(int id) => _api.recordDownload(id);
}

