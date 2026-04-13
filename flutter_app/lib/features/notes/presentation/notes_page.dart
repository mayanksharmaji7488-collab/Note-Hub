import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../../core/config/api_config.dart';
import '../../../core/network/api_error.dart';
import '../../auth/presentation/session_controller.dart';
import '../data/models/note.dart';
import '../data/notes_repository.dart';
import 'upload_note_page.dart';

final notesSearchQueryProvider = StateProvider<String>((ref) => '');

final notesListProvider = FutureProvider.autoDispose<List<Note>>((ref) async {
  final repo = ref.watch(notesRepositoryProvider);
  final q = ref.watch(notesSearchQueryProvider).trim();
  return repo.listNotes(search: q.isEmpty ? null : q);
});

class NotesPage extends ConsumerStatefulWidget {
  const NotesPage({super.key});

  @override
  ConsumerState<NotesPage> createState() => _NotesPageState();
}

class _NotesPageState extends ConsumerState<NotesPage> {
  final _search = TextEditingController();

  @override
  void dispose() {
    _search.dispose();
    super.dispose();
  }

  Future<void> _openUpload() async {
    final ok = await Navigator.of(context).push<bool>(
      MaterialPageRoute(builder: (_) => const UploadNotePage()),
    );
    if (ok == true) {
      ref.invalidate(notesListProvider);
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = ref.watch(sessionControllerProvider).value;
    final notes = ref.watch(notesListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notes'),
        actions: [
          IconButton(
            tooltip: 'Refresh',
            onPressed: () => ref.invalidate(notesListProvider),
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Logout',
            onPressed: () async {
              try {
                await ref.read(sessionControllerProvider.notifier).logout();
              } catch (_) {}
            },
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _openUpload,
        icon: const Icon(Icons.upload_file),
        label: const Text('Upload'),
      ),
      body: Column(
        children: [
          if (user != null)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 0),
              child: Row(
                children: [
                  Expanded(
                    child: Text(
                      'Hi, ${user.nickName}',
                      style: Theme.of(context).textTheme.titleMedium,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ),
                  if (user.department != null && user.year != null)
                    Text('${user.department} • Year ${user.year}'),
                ],
              ),
            ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: TextField(
              controller: _search,
              decoration: InputDecoration(
                labelText: 'Search',
                suffixIcon: IconButton(
                  onPressed: () {
                    ref.read(notesSearchQueryProvider.notifier).state = _search.text;
                    ref.invalidate(notesListProvider);
                  },
                  icon: const Icon(Icons.search),
                ),
              ),
              onSubmitted: (v) {
                ref.read(notesSearchQueryProvider.notifier).state = v;
                ref.invalidate(notesListProvider);
              },
            ),
          ),
          Expanded(
            child: notes.when(
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _stack) => _NotesError(error: error),
              data: (items) => _NotesList(items: items),
            ),
          ),
        ],
      ),
    );
  }
}

class _NotesError extends StatelessWidget {
  const _NotesError({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final msg = error is ApiException ? (error as ApiException).message : error.toString();
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(msg, textAlign: TextAlign.center),
      ),
    );
  }
}

class _NotesList extends ConsumerWidget {
  const _NotesList({required this.items});

  final List<Note> items;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (items.isEmpty) {
      return const Center(child: Text('No notes found.'));
    }

    return ListView.separated(
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, i) {
        final note = items[i];
        return ListTile(
          title: Text(note.title),
          subtitle: Text('${note.subject} • ${note.semester}${note.author == null ? '' : ' • ${note.author}'}'),
          trailing: const Icon(Icons.open_in_new),
          onTap: () async {
            final repo = ref.read(notesRepositoryProvider);
            try {
              await repo.recordDownload(note.id);
            } catch (_) {}

            final url = ApiConfig.resolveUrl(note.fileUrl);
            await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
          },
        );
      },
    );
  }
}

