import 'dart:convert';

import '../api/mail_dtos.dart';
import '../api/mail_service.dart';

/// Client-side filter evaluation (parity with `static/mail/mail-filter-engine.js`).
class MailFilterEngine {
  MailFilterEngine._();

  static const int rulesCap = 50;

  static const Set<String> supportedConditionTypes = {
    'sender',
    'subject',
    'recipient',
    'body',
    'attachment',
    'size',
  };

  static const Set<String> supportedActionTypes = {'move', 'mark_read', 'delete'};

  static List<MailFilterRuleDto> normalizeRules(List<MailFilterRuleDto> raw) {
    final filtered = raw
        .where((r) => r.enabled != false && r.id.trim().isNotEmpty)
        .toList();
    filtered.sort((a, b) {
      final pa = a.priority ?? 0;
      final pb = b.priority ?? 0;
      if (pa != pb) {
        return pb.compareTo(pa);
      }
      return (a.createdAt ?? '').compareTo(b.createdAt ?? '');
    });
    if (filtered.length > rulesCap) {
      return filtered.sublist(0, rulesCap);
    }
    return filtered;
  }

  static String stableRulesHash(List<MailFilterRuleDto> rules) {
    final slim = rules
        .map(
          (r) => {
            'id': r.id,
            'enabled': r.enabled ?? true,
            'priority': r.priority ?? 0,
            'conditions': r.conditions
                .map((c) => {'type': c.type, 'operator': c.op, 'value': c.value ?? ''})
                .toList(),
            'actions': r.actions
                .map((a) => {'type': a.type, 'value': a.value ?? ''})
                .toList(),
          },
        )
        .toList();
    try {
      final json = jsonEncode(slim);
      var h = 5381;
      for (final codeUnit in json.codeUnits) {
        h = ((h * 33) ^ codeUnit) & 0xFFFFFFFF;
      }
      return 'r${h.toRadixString(16)}';
    } catch (_) {
      return 'r0';
    }
  }

  static String norm(String s) => s.trim().toLowerCase();

  static bool matchString(String hay, String needle, String op) {
    final h = norm(hay);
    final n = norm(needle);
    if (n.isEmpty && op != 'equals') {
      return false;
    }
    switch (op) {
      case 'equals':
        return h == n;
      case 'starts_with':
        return h.startsWith(n);
      case 'ends_with':
        return h.endsWith(n);
      case 'matches':
      case 'contains':
        return n.isNotEmpty && h.contains(n);
      default:
        return false;
    }
  }

  static bool conditionMatches(MailFilterConditionDto cond, MailFilterMessageContext ctx) {
    final type = norm(cond.type);
    final op = norm(cond.op);
    final val = cond.value ?? '';
    if (!supportedConditionTypes.contains(type) || type == 'header') {
      return false;
    }
    switch (type) {
      case 'sender':
        return matchString(ctx.from, val, op);
      case 'subject':
        return matchString(ctx.subject, val, op);
      case 'recipient':
        for (final addr in ctx.to) {
          if (matchString(addr, val, op)) {
            return true;
          }
        }
        return false;
      case 'body':
        final body = ctx.bodyText;
        if (body == null || body.isEmpty) {
          return false;
        }
        return matchString(body, val, op);
      case 'attachment':
        final want = norm(val);
        if (want == '0' || want == 'false' || want == 'no') {
          return !ctx.hasAttachments;
        }
        return ctx.hasAttachments;
      case 'size':
        final sz = ctx.sizeBytes;
        final num = int.tryParse(val.trim());
        if (sz == null || num == null) {
          return false;
        }
        switch (op) {
          case 'greater_than':
            return sz > num;
          case 'less_than':
            return sz < num;
          case 'equals':
            return sz == num;
          default:
            return false;
        }
      default:
        return false;
    }
  }

  static bool ruleMatches(MailFilterRuleDto rule, MailFilterMessageContext ctx) {
    if (rule.conditions.isEmpty) {
      return false;
    }
    for (final c in rule.conditions) {
      if (!conditionMatches(c, ctx)) {
        return false;
      }
    }
    return true;
  }

  static MailFilterRuleDto? pickFirstMatchingRule(
    List<MailFilterRuleDto> rules,
    MailFilterMessageContext ctx,
  ) {
    for (final r in rules) {
      if (ruleMatches(r, ctx)) {
        return r;
      }
    }
    return null;
  }

  static String actionFingerprint(List<MailFilterActionDto> actions) {
    final supported = actions.where((a) => supportedActionTypes.contains(norm(a.type))).toList();
    final slim = supported.map((a) => {'type': norm(a.type), 'value': a.value ?? ''}).toList();
    return jsonEncode(slim);
  }

  static List<MailFilterActionDto> filterSupportedActions(List<MailFilterActionDto> actions) {
    return actions.where((a) => supportedActionTypes.contains(norm(a.type))).toList();
  }

  static MailFilterMessageContext buildContext(MailInboxRow row, {String? bodyText}) {
    return MailFilterMessageContext(
      subject: row.subject ?? '',
      from: row.fromAddr ?? '',
      to: row.toAddrs ?? [],
      bodyText: bodyText,
      hasAttachments: row.hasAttachments,
      sizeBytes: null,
    );
  }

  static Future<void> applyActions({
    required String messageId,
    required List<MailFilterActionDto> actions,
    required MailService mail,
  }) async {
    final acts = filterSupportedActions(actions);
    for (final a in acts) {
      final t = norm(a.type);
      final v = a.value ?? '';
      switch (t) {
        case 'move':
          final folder = norm(v);
          if (folder.isNotEmpty) {
            await mail.moveMessage(id: messageId, folder: folder);
          }
        case 'mark_read':
          await mail.setMessageRead(id: messageId, read: true);
        case 'delete':
          await mail.deleteMessage(messageId, permanent: false);
      }
    }
  }
}

class MailFilterMessageContext {
  MailFilterMessageContext({
    required this.subject,
    required this.from,
    required this.to,
    this.bodyText,
    required this.hasAttachments,
    this.sizeBytes,
  });

  final String subject;
  final String from;
  final List<String> to;
  final String? bodyText;
  final bool hasAttachments;
  final int? sizeBytes;
}
