import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../data/notes_repository.dart';

class UploadNotePage extends ConsumerStatefulWidget {
  const UploadNotePage({super.key});

  @override
  ConsumerState<UploadNotePage> createState() => _UploadNotePageState();
}

class _UploadNotePageState extends ConsumerState<UploadNotePage> {
  final _title = TextEditingController();
  final _subject = TextEditingController();
  final _semester = TextEditingController();
  final _description = TextEditingController();
  PlatformFile? _file;
  bool _isSubmitting = false;

  @override
  void dispose() {
    _title.dispose();
    _subject.dispose();
    _semester.dispose();
    _description.dispose();
    super.dispose();
  }

  Future<void> _pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'doc', 'docx', 'ppt', 'pptx'],
    );
    if (result == null || result.files.isEmpty) return;
    setState(() => _file = result.files.first);
  }

  Future<void> _submit() async {
    final title = _title.text.trim();
    final subject = _subject.text.trim();
    final semester = _semester.text.trim();
    final file = _file;

    if (title.isEmpty || subject.isEmpty || semester.isEmpty || file == null) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Title, subject, semester and file are required')),
      );
      return;
    }

    setState(() => _isSubmitting = true);
    try {
      final repo = ref.read(notesRepositoryProvider);
      await repo.uploadNote(
        title: title,
        subject: subject,
        semester: semester,
        description: _description.text,
        file: file,
      );
      if (!mounted) return;
      Navigator.of(context).pop(true);
    } catch (e) {
      final msg = e is ApiException ? e.message : 'Upload failed';
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(msg)));
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final fileLabel = _file == null ? 'Pick a file' : _file!.name;

    return Scaffold(
      appBar: AppBar(title: const Text('Upload note')),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 520),
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                TextField(
                  controller: _title,
                  decoration: const InputDecoration(labelText: 'Title'),
                  enabled: !_isSubmitting,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _subject,
                  decoration: const InputDecoration(labelText: 'Subject'),
                  enabled: !_isSubmitting,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _semester,
                  decoration: const InputDecoration(labelText: 'Semester'),
                  enabled: !_isSubmitting,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _description,
                  decoration: const InputDecoration(
                    labelText: 'Description (optional)',
                  ),
                  minLines: 2,
                  maxLines: 4,
                  enabled: !_isSubmitting,
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: OutlinedButton.icon(
                    onPressed: _isSubmitting ? null : _pickFile,
                    icon: const Icon(Icons.attach_file),
                    label: Text(fileLabel, overflow: TextOverflow.ellipsis),
                  ),
                ),
                const SizedBox(height: 16),
                SizedBox(
                  width: double.infinity,
                  child: FilledButton(
                    onPressed: _isSubmitting ? null : _submit,
                    child: Text(_isSubmitting ? 'Uploading…' : 'Upload'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

