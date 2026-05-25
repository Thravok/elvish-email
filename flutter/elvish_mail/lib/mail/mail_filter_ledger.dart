import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

import '../keyvault/secure_account_store.dart';

/// Persists which filter applications ran for the current rules generation (web `localStorage`).
class MailFilterLedger {
  MailFilterLedger._();

  static const int storageVersion = 1;

  static String _key(String sessionEmail) {
    final norm = SecureAccountStore.normalizeEmail(sessionEmail);
    return 'elvish_mail_filter_ledger_v${storageVersion}_$norm';
  }

  static Future<_Store> _read(String sessionEmail) async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_key(sessionEmail));
    if (raw == null || raw.isEmpty) {
      return _Store(version: storageVersion, rulesHash: '', entries: {});
    }
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      if ((j['version'] as num?)?.toInt() != storageVersion) {
        return _Store(version: storageVersion, rulesHash: '', entries: {});
      }
      final entries = <String, _Entry>{};
      final rawE = j['entries'];
      if (rawE is Map) {
        for (final e in rawE.entries) {
          if (e.value is Map<String, dynamic>) {
            final m = e.value as Map<String, dynamic>;
            entries[e.key] = _Entry(
              ruleId: m['ruleId'] as String? ?? '',
              actionFingerprint: m['actionFingerprint'] as String? ?? '',
              rulesHash: m['rulesHash'] as String? ?? '',
            );
          }
        }
      }
      return _Store(
        version: storageVersion,
        rulesHash: j['rulesHash'] as String? ?? '',
        entries: entries,
      );
    } catch (_) {
      return _Store(version: storageVersion, rulesHash: '', entries: {});
    }
  }

  static Future<void> _write(_Store store, String sessionEmail) async {
    final prefs = await SharedPreferences.getInstance();
    final payload = jsonEncode({
      'version': store.version,
      'rulesHash': store.rulesHash,
      'entries': {
        for (final e in store.entries.entries)
          e.key: {
            'ruleId': e.value.ruleId,
            'actionFingerprint': e.value.actionFingerprint,
            'rulesHash': e.value.rulesHash,
          },
      },
    });
    await prefs.setString(_key(sessionEmail), payload);
  }

  static Future<void> syncRulesHash(String rulesHash, String sessionEmail) async {
    var s = await _read(sessionEmail);
    if (s.rulesHash != rulesHash) {
      s = _Store(version: storageVersion, rulesHash: rulesHash, entries: {});
      await _write(s, sessionEmail);
    }
  }

  static Future<bool> alreadyApplied({
    required String messageId,
    required String ruleId,
    required String actionFingerprint,
    required String rulesHash,
    required String sessionEmail,
  }) async {
    if (messageId.isEmpty || ruleId.isEmpty || rulesHash.isEmpty) {
      return false;
    }
    final s = await _read(sessionEmail);
    if (s.rulesHash != rulesHash) {
      return false;
    }
    final e = s.entries[messageId];
    if (e == null) {
      return false;
    }
    return e.ruleId == ruleId &&
        e.actionFingerprint == actionFingerprint &&
        e.rulesHash == rulesHash;
  }

  static Future<void> record({
    required String messageId,
    required String ruleId,
    required String actionFingerprint,
    required String rulesHash,
    required String sessionEmail,
  }) async {
    if (messageId.isEmpty || ruleId.isEmpty || rulesHash.isEmpty) {
      return;
    }
    var s = await _read(sessionEmail);
    if (s.rulesHash != rulesHash) {
      s = _Store(version: storageVersion, rulesHash: rulesHash, entries: {});
    }
    s.entries[messageId] = _Entry(
      ruleId: ruleId,
      actionFingerprint: actionFingerprint,
      rulesHash: rulesHash,
    );
    await _write(s, sessionEmail);
  }

  static Future<void> pruneMissing(Set<String> messageIds, String sessionEmail) async {
    var s = await _read(sessionEmail);
    s.entries.removeWhere((id, _) => !messageIds.contains(id));
    await _write(s, sessionEmail);
  }

  static Future<void> clear(String sessionEmail) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_key(sessionEmail));
  }
}

class _Entry {
  _Entry({
    required this.ruleId,
    required this.actionFingerprint,
    required this.rulesHash,
  });

  final String ruleId;
  final String actionFingerprint;
  final String rulesHash;
}

class _Store {
  _Store({
    required this.version,
    required this.rulesHash,
    required this.entries,
  });

  final int version;
  final String rulesHash;
  final Map<String, _Entry> entries;
}
