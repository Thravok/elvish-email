import '../api/mail_dtos.dart';
import '../mime/mail_compose_mime.dart';

/// Reply compose fields (parity with `buildReplyComposeDraft` in `static/mail/mail-app.jsx`).
class ComposeDraft {
  ComposeDraft({
    required this.to,
    this.cc = '',
    this.bcc = '',
    required this.subject,
    this.body = '',
    this.inReplyTo = '',
    this.references = '',
    this.showCc = false,
  });

  final String to;
  final String cc;
  final String bcc;
  final String subject;
  final String body;
  final String inReplyTo;
  final String references;
  final bool showCc;
}

/// Metadata used to build a reply draft.
class ReplyMessageSource {
  ReplyMessageSource({
    this.fromAddr = '',
    this.toAddrs = const [],
    this.ccAddrs = const [],
    this.subject = '',
    this.rfcMessageId = '',
    this.inReplyTo = '',
    this.references = '',
    this.replyTo = '',
    this.threadId = '',
  });

  final String fromAddr;
  final List<String> toAddrs;
  final List<String> ccAddrs;
  final String subject;
  final String rfcMessageId;
  final String inReplyTo;
  final String references;
  final String replyTo;
  final String threadId;

  static ReplyMessageSource fromInboxRow(MailInboxRow row) {
    return ReplyMessageSource(
      fromAddr: row.fromAddr ?? '',
      toAddrs: row.toAddrs ?? [],
      subject: row.subject ?? '',
    );
  }

  static ReplyMessageSource fromParsedHeaders({
    required String from,
    required String to,
    required String cc,
    required String subject,
    String messageId = '',
    String inReplyTo = '',
    String references = '',
    String replyTo = '',
  }) {
    return ReplyMessageSource(
      fromAddr: from,
      toAddrs: MailComposeMime.splitAddressList(to),
      ccAddrs: MailComposeMime.splitAddressList(cc),
      subject: subject,
      rfcMessageId: messageId,
      inReplyTo: inReplyTo,
      references: references,
      replyTo: replyTo,
    );
  }
}

String canonicalizeSenderId(String fromValue) {
  final raw = fromValue.trim();
  if (raw.isEmpty) {
    return '';
  }
  final bracket = RegExp(r'<\s*([^<>\s@]+@[^<>\s@]+)\s*>').firstMatch(raw);
  if (bracket != null) {
    return bracket.group(1)!.trim().toLowerCase();
  }
  final email = RegExp(
    r"([A-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Z0-9.-]+\.[A-Z]{2,})",
    caseSensitive: false,
  ).firstMatch(raw);
  if (email != null) {
    return email.group(1)!.trim().toLowerCase();
  }
  return raw.replaceAll(RegExp(r'\s+'), ' ').toLowerCase();
}

String replySubjectLine(String? subj) {
  final s = (subj ?? '').trim();
  if (s.isEmpty) {
    return 'Re: ';
  }
  if (RegExp(r'^re:\s*', caseSensitive: false).hasMatch(s)) {
    return s;
  }
  return 'Re: $s';
}

String normalizeAngleMessageId(String mid) {
  var s = mid.trim();
  if (s.isEmpty) {
    return '';
  }
  if (!s.startsWith('<') && s.contains('@')) {
    s = '<$s>';
  }
  return s;
}

String inReplyToForReply(ReplyMessageSource message) {
  final m = message.rfcMessageId.trim();
  if (m.isNotEmpty) {
    return m.startsWith('<') ? m : '<$m>';
  }
  final t = message.threadId.trim();
  if (t.isEmpty) {
    return '';
  }
  return t.startsWith('<') ? t : '<$t>';
}

String referencesChainForReply(ReplyMessageSource message) {
  final tokens = message.references.trim().split(RegExp(r'\s+')).where((t) => t.isNotEmpty).toList();
  final mid = message.rfcMessageId.trim();
  if (mid.isNotEmpty && !tokens.contains(mid)) {
    tokens.add(mid);
  }
  var out = tokens.join(' ');
  if (out.length > 4000) {
    out = out.substring(out.length - 4000).trim();
  }
  return out;
}

ComposeDraft buildReplyComposeDraft({
  required ReplyMessageSource message,
  required List<String> identityEmails,
  required String accountEmail,
  required bool replyAll,
}) {
  final self = <String>{};
  final ae = canonicalizeSenderId(accountEmail);
  if (ae.isNotEmpty) {
    self.add(ae);
  }
  for (final e in identityEmails) {
    final c = canonicalizeSenderId(e);
    if (c.isNotEmpty) {
      self.add(c);
    }
  }
  final fromDisp = message.fromAddr.trim();
  final fromCanon = canonicalizeSenderId(fromDisp);
  final replyToRaw = message.replyTo.trim();
  var toDisp = '';
  final ccParts = <String>[];
  final outgoing = fromCanon.isNotEmpty && self.contains(fromCanon);
  if (outgoing) {
    final others = message.toAddrs
        .where((d) => !self.contains(canonicalizeSenderId(d)))
        .map((d) => d.trim())
        .where((d) => d.isNotEmpty)
        .toList();
    toDisp = others.join(', ');
    if (toDisp.isEmpty) {
      toDisp = fromDisp;
    }
    if (replyAll) {
      final onTo = MailComposeMime.splitAddressList(toDisp)
          .map(canonicalizeSenderId)
          .where((c) => c.isNotEmpty)
          .toSet();
      for (final d in message.ccAddrs) {
        final c = canonicalizeSenderId(d);
        if (c.isEmpty || self.contains(c) || onTo.contains(c)) {
          continue;
        }
        onTo.add(c);
        ccParts.add(d);
      }
    }
  } else {
    toDisp = replyToRaw.isNotEmpty ? replyToRaw : fromDisp;
    if (replyAll) {
      final onTo = MailComposeMime.splitAddressList(toDisp)
          .map(canonicalizeSenderId)
          .where((c) => c.isNotEmpty)
          .toSet();
      for (final d in [...message.toAddrs, ...message.ccAddrs]) {
        final c = canonicalizeSenderId(d);
        if (c.isEmpty || self.contains(c) || onTo.contains(c)) {
          continue;
        }
        onTo.add(c);
        ccParts.add(d);
      }
    }
  }
  final ccStr = ccParts.map((d) => d.trim()).where((d) => d.isNotEmpty).join(', ');
  return ComposeDraft(
    to: toDisp,
    cc: ccStr,
    bcc: '',
    subject: replySubjectLine(message.subject),
    body: '',
    inReplyTo: inReplyToForReply(message),
    references: referencesChainForReply(message),
    showCc: replyAll,
  );
}
