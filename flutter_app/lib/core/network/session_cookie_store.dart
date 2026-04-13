class SessionCookieStore {
  String? _cookieHeader;

  String? get cookieHeader => _cookieHeader;

  void clear() {
    _cookieHeader = null;
  }

  void saveFromSetCookieHeaders(List<String> setCookieHeaders) {
    for (final header in setCookieHeaders) {
      final match = RegExp(r'^notehub\\.sid=([^;]*)').firstMatch(header.trim());
      if (match == null) continue;
      final value = match.group(1) ?? '';
      _cookieHeader = value.isEmpty ? null : 'notehub.sid=$value';
      return;
    }
  }
}

