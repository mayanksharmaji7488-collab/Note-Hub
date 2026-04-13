class ApiConfig {
  static String get baseUrl {
    const raw = String.fromEnvironment(
      'API_BASE_URL',
      defaultValue: 'http://localhost:5000',
    );
    return raw.endsWith('/') ? raw.substring(0, raw.length - 1) : raw;
  }

  static String resolveUrl(String pathOrUrl) {
    if (pathOrUrl.startsWith('http://') || pathOrUrl.startsWith('https://')) {
      return pathOrUrl;
    }
    if (pathOrUrl.startsWith('/')) return '$baseUrl$pathOrUrl';
    return '$baseUrl/$pathOrUrl';
  }
}

