import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/network/api_client.dart';
import 'auth_api.dart';
import 'models/user_summary.dart';

final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final dio = ref.watch(dioProvider);
  return AuthRepository(AuthApi(dio));
});

class AuthRepository {
  AuthRepository(this._api);

  final AuthApi _api;

  Future<UserSummary> login({
    required String identifier,
    required String password,
  }) {
    return _api.login(identifier: identifier, password: password);
  }

  Future<UserSummary> me() => _api.me();

  Future<void> logout() => _api.logout();
}

