class Note {
  const Note({
    required this.id,
    required this.title,
    required this.subject,
    required this.semester,
    required this.description,
    required this.fileUrl,
    required this.fileName,
    required this.userId,
    required this.createdAt,
    required this.author,
    required this.downloadedAt,
  });

  final int id;
  final String title;
  final String subject;
  final String semester;
  final String? description;
  final String fileUrl;
  final String fileName;
  final int userId;
  final DateTime? createdAt;
  final String? author;
  final DateTime? downloadedAt;

  factory Note.fromJson(Map<String, dynamic> json) {
    return Note(
      id: (json['id'] as num).toInt(),
      title: (json['title'] ?? '').toString(),
      subject: (json['subject'] ?? '').toString(),
      semester: (json['semester'] ?? '').toString(),
      description: json['description'] == null ? null : json['description'].toString(),
      fileUrl: (json['fileUrl'] ?? '').toString(),
      fileName: (json['fileName'] ?? '').toString(),
      userId: (json['userId'] as num).toInt(),
      createdAt: _parseDate(json['createdAt']),
      author: json['author'] == null ? null : json['author'].toString(),
      downloadedAt: _parseDate(json['downloadedAt']),
    );
  }

  static DateTime? _parseDate(dynamic v) {
    if (v == null) return null;
    final s = v.toString();
    return DateTime.tryParse(s);
  }
}

