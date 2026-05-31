import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

/// Mirrors `IOS/IOS/KeyVault/ElvishAccountWrap.swift` and `static/auth/keygen.js`.
class ElvishAccountWrap {
  static const int pbkdf2Iterations = 600000;
  static const int argon2DefaultTime = 3;
  static const int argon2DefaultMemKib = 64 * 1024;
  static const int argon2DefaultParallelism = 1;

  static Future<SecretKey> deriveKek({
    required String password,
    required Uint8List salt,
    required String kdf,
    String? kdfParamsJson,
  }) async {
    final trimmed = kdf.trim();
    switch (trimmed) {
      case 'argon2id':
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
        // `cryptography` Argon2id `memory` is in 1 KiB blocks (same as server `mem`).
        final algo = Argon2id(
          parallelism: parallelism,
          memory: memKib,
          iterations: time,
          hashLength: 32,
        );
        return algo.deriveKeyFromPassword(
          password: password,
          nonce: salt,
        );
      case 'pbkdf2-sha256':
      case 'pbkdf2-sha256-600k':
        return _pbkdf2Sha256(password: password, salt: salt, iterations: pbkdf2Iterations);
      default:
        throw UnsupportedError('unsupported KDF: $trimmed');
    }
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
