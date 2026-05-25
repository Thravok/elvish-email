import 'dart:convert';
import 'dart:math';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// Result of password-based KEK derivation (matches `static/auth/keygen.js` `deriveKEK`).
class ElvishKekDerivation {
  ElvishKekDerivation({
    required this.kdf,
    required this.kek,
    required this.paramsJson,
  });

  final String kdf;
  final SecretKey kek;
  final String paramsJson;
}

/// Mirrors `IOS/IOS/KeyVault/ElvishAccountWrap.swift` and `static/auth/keygen.js`.
class ElvishAccountWrap {
  static const int pbkdf2Iterations = 600000;
  static const int argon2DefaultTime = 3;
  static const int argon2DefaultMemKib = 64 * 1024;
  static const int argon2DefaultParallelism = 1;

  static Uint8List randomBytes(int count) {
    final rnd = Random.secure();
    return Uint8List.fromList(List.generate(count, (_) => rnd.nextInt(256)));
  }

  /// Derive KEK and record KDF name + params JSON for protected-link uploads.
  static Future<ElvishKekDerivation> deriveKekWithMetadata({
    required String password,
    required Uint8List salt,
    String kdf = 'argon2id',
    String? kdfParamsJson,
  }) async {
    final trimmed = kdf.trim();
    if (trimmed.isEmpty || trimmed == 'argon2id') {
      var time = argon2DefaultTime;
      var memKib = argon2DefaultMemKib;
      var parallelism = argon2DefaultParallelism;
      if (kdfParamsJson != null && kdfParamsJson.isNotEmpty) {
        try {
          final m = jsonDecode(kdfParamsJson) as Map<String, dynamic>;
          time = (m['time'] as num?)?.toInt() ?? time;
          memKib = (m['mem'] as num?)?.toInt() ?? memKib;
          parallelism = (m['parallelism'] as num?)?.toInt() ?? parallelism;
        } catch (_) {}
      }
      final algo = Argon2id(
        parallelism: parallelism,
        memory: memKib,
        iterations: time,
        hashLength: 32,
      );
      final kek = await algo.deriveKeyFromPassword(password: password, nonce: salt);
      final paramsJson = jsonEncode({
        'time': time,
        'mem': memKib,
        'parallelism': parallelism,
        'hash_len': 32,
      });
      return ElvishKekDerivation(kdf: 'argon2id', kek: kek, paramsJson: paramsJson);
    }
    if (trimmed == 'pbkdf2-sha256' || trimmed == 'pbkdf2-sha256-600k') {
      final kek = await _pbkdf2Sha256(password: password, salt: salt, iterations: pbkdf2Iterations);
      final paramsJson = jsonEncode({'iterations': pbkdf2Iterations, 'hash': 'SHA-256'});
      return ElvishKekDerivation(kdf: 'pbkdf2-sha256', kek: kek, paramsJson: paramsJson);
    }
    throw UnsupportedError('unsupported KDF: $trimmed');
  }

  static Future<SecretKey> deriveKek({
    required String password,
    required Uint8List salt,
    required String kdf,
    String? kdfParamsJson,
  }) async {
    final d = await deriveKekWithMetadata(
      password: password,
      salt: salt,
      kdf: kdf,
      kdfParamsJson: kdfParamsJson,
    );
    return d.kek;
  }

  static Future<SecretKey> _pbkdf2Sha256({
    required String password,
    required Uint8List salt,
    required int iterations,
  }) async {
    final algo = Pbkdf2(
      macAlgorithm: Hmac.sha256(),
      iterations: iterations,
      bits: 256,
    );
    return algo.deriveKey(
      secretKey: SecretKey(utf8.encode(password)),
      nonce: salt,
    );
  }

  /// AES-256-GCM wrap: nonce || ciphertext+tag (matches web `aesWrap` / iOS `aesWrap`).
  static Future<Uint8List> aesWrap({
    required SecretKey kek,
    required Uint8List plaintext,
  }) async {
    final aes = AesGcm.with256bits();
    final nonce = randomBytes(12);
    final secretBox = await aes.encrypt(plaintext, secretKey: kek, nonce: nonce);
    return Uint8List.fromList([...nonce, ...secretBox.cipherText, ...secretBox.mac.bytes]);
  }

  /// AES-256-GCM unwrap: [wrapped] is nonce+ciphertext+tag (CryptoKit `combined` layout).
  static Future<Uint8List> aesUnwrap({
    required SecretKey kek,
    required Uint8List wrapped,
  }) async {
    if (wrapped.length < 12) {
      throw StateError('invalid wrapped blob');
    }
    final aes = AesGcm.with256bits();
    final secretBox = SecretBox.fromConcatenation(wrapped, nonceLength: 12, macLength: 16);
    final clear = await aes.decrypt(secretBox, secretKey: kek);
    return Uint8List.fromList(clear);
  }
}
