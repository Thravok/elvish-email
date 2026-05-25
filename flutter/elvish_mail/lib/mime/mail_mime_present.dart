/// Minimal MIME envelope display (subset of `IOS/IOS/Mail/MailMIMEParser.swift`).
class MailPresentedMessage {
  MailPresentedMessage({
    required this.subject,
    required this.from,
    required this.to,
    required this.cc,
    required this.date,
    required this.body,
    this.messageId = '',
    this.inReplyTo = '',
    this.references = '',
    this.replyTo = '',
  });

  final String subject;
  final String from;
  final String to;
  final String cc;
  final String date;
  final String body;
  final String messageId;
  final String inReplyTo;
  final String references;
  final String replyTo;

  static MailPresentedMessage present(String decrypted) {
    final normalized = decrypted.replaceAll('\r\n', '\n');
    final idx = normalized.indexOf('\n\n');
    if (idx < 0) {
      return MailPresentedMessage(
        subject: '',
        from: '',
        to: '',
        cc: '',
        date: '',
        body: decrypted.trim(),
      );
    }
    final headerBlock = normalized.substring(0, idx);
    final bodyText = normalized.substring(idx + 2);
    final headers = <String, String>{};
    var current = '';
    for (final line in headerBlock.split('\n')) {
      if (line.isEmpty) {
        break;
      }
      if (line.startsWith(' ') || line.startsWith('\t')) {
        if (current.isEmpty) {
          return _fallback(decrypted);
        }
        headers[current] = '${headers[current] ?? ''} ${line.trim()}';
        continue;
      }
      final colon = line.indexOf(':');
      if (colon <= 0) {
        return _fallback(decrypted);
      }
      final name = line.substring(0, colon).trim().toLowerCase();
      final value = line.substring(colon + 1).trim();
      current = name;
      headers[name] = value;
    }
    return MailPresentedMessage(
      subject: (headers['subject'] ?? '').trim(),
      from: (headers['from'] ?? '').trim(),
      to: (headers['to'] ?? '').trim(),
      cc: (headers['cc'] ?? '').trim(),
      date: (headers['date'] ?? '').trim(),
      body: bodyText.trim(),
      messageId: (headers['message-id'] ?? '').trim(),
      inReplyTo: (headers['in-reply-to'] ?? '').trim(),
      references: (headers['references'] ?? '').trim(),
      replyTo: (headers['reply-to'] ?? '').trim(),
    );
  }

  static MailPresentedMessage _fallback(String decrypted) {
    return MailPresentedMessage(
      subject: '',
      from: '',
      to: '',
      cc: '',
      date: '',
      body: decrypted.trim(),
    );
  }
}
