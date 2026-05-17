import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Persists unlocked account OpenPGP material (same role as `IOS/IOS/KeyVault/KeyVaultKeychain.swift`).
class SecureAccountStore {
  SecureAccountStore({FlutterSecureStorage? storage})
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;

  static String normalizeEmail(String email) => email.trim().toLowerCase();

  String _key(String email) => 'elvish_account_${normalizeEmail(email)}';

  Future<void> save({
    required String sessionEmail,
    required String accountArmoredPriv,
    required String accountArmoredPub,
    required String accountFingerprint,
  }) async {
    final payload = jsonEncode({
      'session_email': normalizeEmail(sessionEmail),
      'account_armored_priv': accountArmoredPriv,
      'account_armored_pub': accountArmoredPub,
      'account_fingerprint': accountFingerprint,
    });
    await _storage.write(key: _key(sessionEmail), value: payload);
  }

  Future<PersistedAccount?> load(String sessionEmail) async {
    final raw = await _storage.read(key: _key(sessionEmail));
    if (raw == null || raw.isEmpty) {
      return null;
    }
    try {
      final j = jsonDecode(raw) as Map<String, dynamic>;
      return PersistedAccount(
        sessionEmail: j['session_email'] as String? ?? '',
        accountArmoredPriv: j['account_armored_priv'] as String? ?? '',
        accountArmoredPub: j['account_armored_pub'] as String? ?? '',
        accountFingerprint: j['account_fingerprint'] as String? ?? '',
      );
    } catch (_) {
      return null;
    }
  }

  Future<void> delete(String sessionEmail) async {
    await _storage.delete(key: _key(sessionEmail));
  }
}

class PersistedAccount {
  PersistedAccount({
    required this.sessionEmail,
    required this.accountArmoredPriv,
    required this.accountArmoredPub,
    required this.accountFingerprint,
  });

  final String sessionEmail;
  final String accountArmoredPriv;
  final String accountArmoredPub;
  final String accountFingerprint;
}
