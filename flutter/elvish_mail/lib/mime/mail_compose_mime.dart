import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

/// RFC5322 + PGP/MIME builders (parity with `static/mail/compose.jsx`).
class MailComposeMime {
  static String rejectHeaderInjection(String value, String label) {
    if (value.contains(RegExp(r'[\r\n\x00]'))) {
      throw MailComposeException('$label contains invalid characters');
    }
    return value;
  }

  static List<String> splitAddressList(String value) {
    final raw = value.replaceAll('\r\n', '\n').replaceAll('\n', ' ').trim();
    if (raw.isEmpty) {
      return [];
    }
    var depth = 0;
    var cur = '';
    final parts = <String>[];
    for (var i = 0; i < raw.length; i++) {
      final c = raw[i];
      if (c == '<') {
        depth += 1;
      } else if (c == '>') {
        depth = depth > 0 ? depth - 1 : 0;
      }
      if ((c == ',' || c == ';') && depth == 0) {
        final t = cur.replaceAll(RegExp(r'\s+'), ' ').trim();
        if (t.isNotEmpty) {
          parts.add(t);
        }
        cur = '';
        continue;
      }
      cur += c;
    }
    final t = cur.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (t.isNotEmpty) {
      parts.add(t);
    }
    return parts;
  }

  static String canonicalEmailToken(String display) {
    final raw = display.trim();
    if (raw.isEmpty) {
      return '';
    }
    final bracket = RegExp(r'<\s*([^<>\s@]+@[^<>\s@]+)\s*>').firstMatch(raw);
    if (bracket != null) {
      return bracket.group(1)!.trim().toLowerCase();
    }
    final bare = RegExp(r'([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})', caseSensitive: false).firstMatch(raw);
    if (bare != null) {
      return bare.group(1)!.trim().toLowerCase();
    }
    return raw.toLowerCase();
  }

  static Map<String, dynamic> buildHeaderStub({
    required String from,
    required List<String> to,
    List<String> cc = const [],
    List<String> bcc = const [],
    required String subject,
    String inReplyTo = '',
    String references = '',
  }) {
    final out = <String, dynamic>{
      'subject': subject,
      'from': from,
      'to': to,
    };
    if (cc.isNotEmpty) {
      out['cc'] = cc;
    }
    if (bcc.isNotEmpty) {
      out['bcc'] = bcc;
    }
    final irt = inReplyTo.trim();
    final refs = references.trim();
    if (irt.isNotEmpty) {
      out['in_reply_to'] = irt;
    }
    if (refs.isNotEmpty) {
      out['references'] = refs;
    }
    return out;
  }

  static Uint8List buildRfc5322({
    required String from,
    required List<String> to,
    required String subject,
    required String body,
    List<String> cc = const [],
    List<String> bcc = const [],
    String inReplyTo = '',
    String references = '',
  }) {
    final safeFrom = rejectHeaderInjection(from.isEmpty ? 'anonymous' : from, 'From');
    final safeSubject = rejectHeaderInjection(subject.isEmpty ? '(no subject)' : subject, 'Subject');
    final ccJoin = cc.where((a) => a.isNotEmpty).map((a) => rejectHeaderInjection(a, 'Cc')).join(', ');
    final bccJoin = bcc.where((a) => a.isNotEmpty).map((a) => rejectHeaderInjection(a, 'Bcc')).join(', ');
    final irt = rejectHeaderInjection(inReplyTo.trim(), 'In-Reply-To');
    final refs = rejectHeaderInjection(references.trim(), 'References');

    final lines = <String>[
      'Date: ${_rfc822Date()}',
      'From: $safeFrom',
      'To: ${to.map((a) => rejectHeaderInjection(a, 'To')).join(', ')}',
    ];
    if (ccJoin.isNotEmpty) {
      lines.add('Cc: $ccJoin');
    }
    if (bccJoin.isNotEmpty) {
      lines.add('Bcc: $bccJoin');
    }
    lines.add('Subject: $safeSubject');
    if (irt.isNotEmpty) {
      lines.add('In-Reply-To: $irt');
    }
    if (refs.isNotEmpty) {
      lines.add('References: $refs');
    }
    lines.addAll([
      'Content-Type: text/plain; charset="utf-8"; protected-headers="v1"',
      'Content-Transfer-Encoding: 8bit',
      'MIME-Version: 1.0',
      '',
      body,
    ]);
    return Uint8List.fromList(utf8.encode(lines.join('\r\n')));
  }

  static Uint8List buildPgpMimeMessage({
    required String from,
    required List<String> to,
    List<String> cc = const [],
    required String subject,
    required String armoredCiphertext,
    String inReplyTo = '',
    String references = '',
  }) {
    final boundary = '=_elvish_${_randomHex(16)}';
    final domain = _extractDomain(from);
    final messageId = '${DateTime.now().millisecondsSinceEpoch}.${_randomHex(16)}@$domain';
    final normalized = _normalizeCrlf(armoredCiphertext).replaceAll(RegExp(r'\r\n$'), '');
    final ccList = cc.where((a) => a.isNotEmpty).toList();
    final irt = inReplyTo.trim();
    final refs = references.trim();

    final lines = <String>[
      'Message-ID: <$messageId>',
      'Date: ${_rfc822Date()}',
      'From: ${rejectHeaderInjection(from.isEmpty ? 'anonymous' : from, 'From')}',
      'To: ${to.join(', ')}',
    ];
    if (ccList.isNotEmpty) {
      lines.add('Cc: ${ccList.join(', ')}');
    }
    if (subject.isNotEmpty) {
      lines.add('Subject: ${rejectHeaderInjection(subject, 'Subject')}');
    }
    if (irt.isNotEmpty) {
      lines.add('In-Reply-To: $irt');
    }
    if (refs.isNotEmpty) {
      lines.add('References: $refs');
    }
    lines.addAll([
      'Content-Type: multipart/encrypted; protocol="application/pgp-encrypted"; boundary="$boundary"',
      'MIME-Version: 1.0',
      '',
      'This is an OpenPGP/MIME encrypted message.',
      '--$boundary',
      'Content-Type: application/pgp-encrypted',
      'Content-Description: PGP/MIME version identification',
      '',
      'Version: 1',
      '--$boundary',
      'Content-Type: application/octet-stream; name="encrypted.asc"',
      'Content-Disposition: inline; filename="encrypted.asc"',
      'Content-Transfer-Encoding: 7bit',
      '',
      normalized,
      '--$boundary--',
      '',
    ]);
    return Uint8List.fromList(utf8.encode(lines.join('\r\n')));
  }

  static String _normalizeCrlf(String text) {
    return text.replaceAll('\r\n', '\n').replaceAll('\r', '\n').replaceAll('\n', '\r\n');
  }

  static String _randomHex(int bytes) {
    final rnd = Random.secure();
    return List.generate(bytes, (_) => rnd.nextInt(256))
        .map((b) => b.toRadixString(16).padLeft(2, '0'))
        .join();
  }

  static String _rfc822Date() {
    final d = DateTime.now().toUtc();
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return '${days[d.weekday - 1]}, ${d.day.toString().padLeft(2, '0')} ${months[d.month - 1]} ${d.year} '
        '${d.hour.toString().padLeft(2, '0')}:${d.minute.toString().padLeft(2, '0')}:${d.second.toString().padLeft(2, '0')} GMT';
  }

  static String _extractDomain(String from) {
    final raw = from.trim();
    final m = RegExp(r'@([^<>\s@]+)').firstMatch(raw);
    if (m != null) {
      return m.group(1)!.toLowerCase();
    }
    return 'elvish.local';
  }
}

class MailComposeException implements Exception {
  MailComposeException(this.message);
  final String message;
  @override
  String toString() => message;
}
