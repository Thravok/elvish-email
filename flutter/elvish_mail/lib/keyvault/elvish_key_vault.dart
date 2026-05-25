import 'dart:convert';
import 'dart:typed_data';

import 'dart_pg_openpgp.dart';

import '../api/elvish_api_client.dart';
import '../api/mail_dtos.dart';
import '../crypto/account_wrap.dart';
import 'openpgp_decrypt.dart';
import 'openpgp_encrypt.dart';
import 'secure_account_store.dart';

enum KeyVaultError implements Exception {
  incompleteAccountKeyPayload,
  invalidBase64,
  incorrectPassword,
  noAccountSecretKey,
  vaultLocked,
  emptyCiphertext,
  bodyDecryptFailed,
  signingIdentityUnavailable;

  @override
  String toString() {
    switch (this) {
      case KeyVaultError.incompleteAccountKeyPayload:
        return 'Account key response was incomplete.';
      case KeyVaultError.invalidBase64:
        return 'Invalid base64 in account key material.';
      case KeyVaultError.incorrectPassword:
        return 'Could not unlock mail keys with this password.';
      case KeyVaultError.noAccountSecretKey:
        return 'No OpenPGP secret key found in account material.';
      case KeyVaultError.vaultLocked:
        return 'Mail keys are locked. Sign out and sign in again to read messages.';
      case KeyVaultError.emptyCiphertext:
        return 'Empty message body from server.';
      case KeyVaultError.bodyDecryptFailed:
        return 'Could not decrypt this message with your identities.';
      case KeyVaultError.signingIdentityUnavailable:
        return 'Sender signing identity is not unlocked.';
    }
  }
}

/// Unlocks account + identity keys; decrypts mail headers/bodies (parity with `IOS/IOS/KeyVault/ElvishKeyVault.swift`).
class ElvishKeyVault {
  ElvishKeyVault({SecureAccountStore? store}) : _store = store ?? SecureAccountStore();

  final SecureAccountStore _store;

  bool isUnlocked = false;

  final Map<String, PrivateKeyInterface> _identitySecretKeys = {};
  String? _defaultFingerprint16;
  final List<String> _orderedIdentityFingerprintsFull = [];
  List<IdentityRowDto> identityRows = [];

  Future<void> deletePersistedAccount(String sessionEmail) =>
      _store.delete(SecureAccountStore.normalizeEmail(sessionEmail));

  void zero() {
    _identitySecretKeys.clear();
    _defaultFingerprint16 = null;
    _orderedIdentityFingerprintsFull.clear();
    identityRows = [];
    isUnlocked = false;
  }

  String encryptToRecipient(String armoredRecipientPub, String plaintext) {
    if (!isUnlocked) {
      throw KeyVaultError.vaultLocked;
    }
    return encryptToRecipientArmored(
      armoredRecipientPub: armoredRecipientPub,
      plaintext: plaintext,
    );
  }

  String encryptAndSignToRecipient({
    required String armoredRecipientPub,
    required String plaintext,
    required String signerFingerprint,
  }) {
    if (!isUnlocked) {
      throw KeyVaultError.vaultLocked;
    }
    final kid = fingerprintKeyId16(signerFingerprint);
    final signer = _identitySecretKeys[kid];
    if (signer == null) {
      throw KeyVaultError.signingIdentityUnavailable;
    }
    return encryptAndSignToRecipientArmored(
      armoredRecipientPub: armoredRecipientPub,
      plaintext: plaintext,
      signer: signer,
    );
  }

  String encryptAndSignBinary({
    required String armoredRecipientPub,
    required Uint8List plaintext,
    required String signerFingerprint,
  }) {
    if (!isUnlocked) {
      throw KeyVaultError.vaultLocked;
    }
    final kid = fingerprintKeyId16(signerFingerprint);
    final signer = _identitySecretKeys[kid];
    if (signer == null) {
      throw KeyVaultError.signingIdentityUnavailable;
    }
    return encryptAndSignBinaryArmored(
      armoredRecipientPub: armoredRecipientPub,
      plaintext: plaintext,
      signer: signer,
    );
  }

  Future<void> unlock({
    required ElvishApiClient api,
    required String password,
    String? sessionEmail,
  }) async {
    zero();
    final me = AccountKeyMeResponse.fromJson(await api.getJson('/api/v1/account-key/me'));
    if (!me.bootstrapped) {
      return;
    }
    final pub = me.armoredPublic;
    final wrappedB64 = me.wrappedSecretB64;
    final kdf = me.kdf;
    final saltB64 = me.kdfSaltB64;
    final expectedFp = me.fingerprint;
    if (pub == null ||
        pub.isEmpty ||
        wrappedB64 == null ||
        wrappedB64.isEmpty ||
        kdf == null ||
        kdf.isEmpty ||
        saltB64 == null ||
        saltB64.isEmpty ||
        expectedFp == null ||
        expectedFp.isEmpty) {
      throw KeyVaultError.incompleteAccountKeyPayload;
    }
    Uint8List salt;
    Uint8List wrapped;
    try {
      salt = Uint8List.fromList(base64Decode(saltB64));
      wrapped = Uint8List.fromList(base64Decode(wrappedB64));
    } catch (_) {
      throw KeyVaultError.invalidBase64;
    }

    late final PrivateKeyInterface accountKey;
    late final String armoredPrivString;
    try {
      final kek = await ElvishAccountWrap.deriveKek(
        password: password,
        salt: salt,
        kdf: kdf,
        kdfParamsJson: me.kdfParamsJson,
      );
      final clear = await ElvishAccountWrap.aesUnwrap(kek: kek, wrapped: wrapped);
      armoredPrivString = utf8.decode(clear);
      if (armoredPrivString.isEmpty) {
        throw KeyVaultError.incorrectPassword;
      }
      accountKey = OpenPGP.readPrivateKey(armoredPrivString);
      final liveFp = fingerprintHexFull(accountKey);
      if (!fingerprintsEquivalent(liveFp, expectedFp)) {
        throw KeyVaultError.incorrectPassword;
      }
    } catch (e) {
      if (e is KeyVaultError) {
        rethrow;
      }
      throw KeyVaultError.incorrectPassword;
    }

    await _unlockIdentities(api, accountKey);

    isUnlocked = _identitySecretKeys.isNotEmpty;

    final email = sessionEmail;
    if (isUnlocked && email != null && SecureAccountStore.normalizeEmail(email).isNotEmpty) {
      await _store.save(
        sessionEmail: email,
        accountArmoredPriv: armoredPrivString,
        accountArmoredPub: pub,
        accountFingerprint: expectedFp,
      );
    }
  }

  Future<bool> restoreFromKeychainIfPossible({
    required ElvishApiClient api,
    String? sessionEmail,
  }) async {
    final raw = sessionEmail;
    if (raw == null || SecureAccountStore.normalizeEmail(raw).isEmpty) {
      return false;
    }
    final norm = SecureAccountStore.normalizeEmail(raw);
    final cached = await _store.load(norm);
    if (cached == null || SecureAccountStore.normalizeEmail(cached.sessionEmail) != norm) {
      return false;
    }

    AccountKeyMeResponse me;
    try {
      me = AccountKeyMeResponse.fromJson(await api.getJson('/api/v1/account-key/me'));
    } catch (_) {
      return false;
    }
    if (!me.bootstrapped ||
        me.fingerprint == null ||
        me.fingerprint!.isEmpty ||
        !fingerprintsEquivalent(me.fingerprint!, cached.accountFingerprint)) {
      await _store.delete(norm);
      return false;
    }

    zero();
    try {
      final accountKey = OpenPGP.readPrivateKey(cached.accountArmoredPriv);
      final liveFp = fingerprintHexFull(accountKey);
      if (!fingerprintsEquivalent(liveFp, cached.accountFingerprint)) {
        await _store.delete(norm);
        return false;
      }
      await _unlockIdentities(api, accountKey);
    } catch (_) {
      await _store.delete(norm);
      return false;
    }

    isUnlocked = _identitySecretKeys.isNotEmpty;
    return isUnlocked;
  }

  Future<void> _unlockIdentities(ElvishApiClient api, PrivateKeyInterface accountKey) async {
    final idList = IdentitiesListResponse.fromJson(await api.getJson('/api/v1/identities'));
    identityRows = idList.identities;
    final ordered = <String>[];
    for (final row in idList.identities) {
      final fp = row.fingerprint;
      if (fp == null || fp.isEmpty) {
        continue;
      }
      if (row.armoredPublic == null || row.armoredPublic!.isEmpty) {
        continue;
      }
      final wB64 = row.wrappedSecretB64;
      if (wB64 == null || wB64.isEmpty) {
        continue;
      }
      Uint8List wrappedId;
      try {
        wrappedId = Uint8List.fromList(base64Decode(wB64));
      } catch (_) {
        continue;
      }
      final armoredWrap = utf8.decode(wrappedId);
      LiteralMessageInterface lit;
      try {
        lit = OpenPGP.decrypt(armoredWrap, decryptionKeys: [accountKey]);
      } catch (_) {
        continue;
      }
      final decryptedArmored = lit.literalData.text;
      PrivateKeyInterface idSecret;
      try {
        idSecret = OpenPGP.readPrivateKey(decryptedArmored);
      } catch (_) {
        continue;
      }
      final idFpFull = fingerprintHexFull(idSecret);
      if (!fingerprintsEquivalent(idFpFull, fp)) {
        continue;
      }
      final kid = fingerprintKeyId16(idFpFull);
      _identitySecretKeys[kid] = idSecret;
      ordered.add(fp);
    }

    IdentityRowDto? defRow;
    for (final e in idList.identities) {
      if (e.isDefault == true) {
        defRow = e;
        break;
      }
    }
    final defaultFull = defRow?.fingerprint ?? (ordered.isNotEmpty ? ordered.first : null);

    if (defaultFull != null) {
      _defaultFingerprint16 = fingerprintKeyId16(defaultFull);
      _orderedIdentityFingerprintsFull
        ..clear()
        ..add(defaultFull)
        ..addAll(ordered.where((x) => !fingerprintsEquivalent(x, defaultFull)));
    } else {
      _orderedIdentityFingerprintsFull
        ..clear()
        ..addAll(ordered);
    }
  }

  MailHeaderStub? decryptMailHeader(String headerCiphertextB64) {
    if (!isUnlocked || headerCiphertextB64.isEmpty) {
      return null;
    }
    Uint8List raw;
    try {
      raw = Uint8List.fromList(base64Decode(headerCiphertextB64));
    } catch (_) {
      return null;
    }
    if (raw.isEmpty) {
      return null;
    }
    for (final fp in _decryptionCandidateFingerprints()) {
      final kid = fingerprintKeyId16(fp);
      final key = _identitySecretKeys[kid];
      if (key == null) {
        continue;
      }
      try {
        final text = decryptOpenPgpUtf8(raw, [key]);
        final stub = MailHeaderStub.fromJson(jsonDecode(text) as Map<String, dynamic>);
        return stub;
      } catch (_) {
        continue;
      }
    }
    return null;
  }

  String decryptMessageBody(Uint8List ciphertext) {
    if (!isUnlocked) {
      throw KeyVaultError.vaultLocked;
    }
    if (ciphertext.isEmpty) {
      throw KeyVaultError.emptyCiphertext;
    }
    Object last = KeyVaultError.bodyDecryptFailed;
    for (final fp in _decryptionCandidateFingerprints()) {
      final kid = fingerprintKeyId16(fp);
      final key = _identitySecretKeys[kid];
      if (key == null) {
        continue;
      }
      try {
        final text = decryptOpenPgpUtf8(ciphertext, [key]);
        if (text.isNotEmpty) {
          return text;
        }
      } catch (e) {
        last = e;
      }
    }
    if (last is Exception) {
      throw last;
    }
    throw KeyVaultError.bodyDecryptFailed;
  }

  List<String> _decryptionCandidateFingerprints() {
    final out = List<String>.from(_orderedIdentityFingerprintsFull);
    final d = _defaultFingerprint16;
    if (d != null) {
      final idx = out.indexWhere((fp) => fingerprintKeyId16(fp) == d);
      if (idx > 0) {
        final item = out.removeAt(idx);
        out.insert(0, item);
      }
    }
    return out;
  }

  static String fingerprintHexFull(PrivateKeyInterface key) {
    final fp = key.fingerprint;
    final sb = StringBuffer();
    for (var i = 0; i < fp.length; i++) {
      sb.write(fp[i].toRadixString(16).padLeft(2, '0'));
    }
    return sb.toString().toUpperCase();
  }

  static String fingerprintKeyId16(String fp) {
    final x = fp.replaceAll(RegExp(r'\s'), '').toUpperCase();
    if (x.length < 16) {
      return x;
    }
    return x.substring(x.length - 16);
  }

  static bool fingerprintsEquivalent(String a, String b) {
    final x = a.replaceAll(RegExp(r'\s'), '').toUpperCase();
    final y = b.replaceAll(RegExp(r'\s'), '').toUpperCase();
    if (x.isEmpty || y.isEmpty) {
      return false;
    }
    if (x == y) {
      return true;
    }
    return fingerprintKeyId16(x) == fingerprintKeyId16(y);
  }
}
