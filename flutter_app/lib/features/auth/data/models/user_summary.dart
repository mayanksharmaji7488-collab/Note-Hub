class UserSummary {
  const UserSummary({
    required this.id,
    required this.username,
    required this.nickName,
    required this.role,
    required this.department,
    required this.year,
  });

  final int id;
  final String username;
  final String nickName;
  final String role;
  final String? department;
  final int? year;

  factory UserSummary.fromJson(Map<String, dynamic> json) {
    return UserSummary(
      id: (json['id'] as num).toInt(),
      username: (json['username'] ?? '').toString(),
      nickName: (json['nickName'] ?? json['username'] ?? '').toString(),
      role: (json['role'] ?? 'student').toString(),
      department: json['department'] == null ? null : json['department'].toString(),
      year: json['year'] == null ? null : (json['year'] as num).toInt(),
    );
  }
}

