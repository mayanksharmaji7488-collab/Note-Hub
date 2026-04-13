import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_error.dart';
import '../data/auth_repository.dart';
import '../data/models/user_summary.dart';

final sessionControllerProvider =
    AsyncNotifierProvider<SessionController, UserSummary?>(
  SessionController.new,
);

class SessionController extends AsyncNotifier<UserSummary?> {
  @override
  Future<UserSummary?> build() async {
    final repo = ref.read(authRepositoryProvider);
    try {
      return await repo.me();
    } on ApiException catch (e) {
      if (e.statusCode == 401) return null;
      rethrow;
    }
  }

  Future<void> login({
    required String identifier,
    required String password,
  }) async {
    final repo = ref.read(authRepositoryProvider);
    state = const AsyncLoading();

    try {
      final user = await repo.login(identifier: identifier, password: password);
      state = AsyncData(user);
    } catch (err, st) {
      state = AsyncError(err, st);
      rethrow;
    }
  }

  Future<void> logout() async {
    final repo = ref.read(authRepositoryProvider);
    state = const AsyncLoading();

    try {
      await repo.logout();
      state = const AsyncData(null);
    } catch (err, st) {
      state = AsyncError(err, st);
      rethrow;
    }
  }
}

