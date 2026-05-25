import 'dart:convert';
import 'dart:typed_data';

import 'package:cryptography/cryptography.dart';

import 'account_wrap.dart';

/// Mode B protected-link ciphertext (parity with `static/mail/compose.jsx`).
class ProtectedLinkPayload {
  ProtectedLinkPayload({
    required this.kdf,
    required this.kdfSaltB64,
    required this.kdfParamsJson,
    required this.wrappedMsgKeyB64,
    required this.bodyCiphertextB64,
  });

  final String kdf;
  final String kdfSaltB64;
  final String kdfParamsJson;
  final String wrappedMsgKeyB64;
  final String bodyCiphertextB64;
}

class ProtectedLinkCryptoException implements Exception {
  ProtectedLinkCryptoException(this.message);
  final String message;
  @override
  String toString() => message;
}

Future<ProtectedLinkPayload> buildProtectedLinkPayload({
  required String from,
  required String subject,
  required String body,
  required String password,
}) async {
  final trimmedPw = password.trim();
  if (trimmedPw.length < 12) {
    throw ProtectedLinkCryptoException('Password must be at least 12 characters.');
  }
  final fullBody = 'From: ${from.isEmpty ? 'anonymous' : from}\r\n'
      'Subject: ${subject.isEmpty ? '(no subject)' : subject}\r\n\r\n$body';
  final plain = utf8.encode(fullBody);

  final msgKey = ElvishAccountWrap.randomBytes(32);
  final msgNonce = ElvishAccountWrap.randomBytes(12);
  final aes = AesGcm.with256bits();
  final symKey = SecretKey(msgKey);
  final secretBox = await aes.encrypt(plain, secretKey: symKey, nonce: msgNonce);
  final payloadCt = Uint8List.fromList([
    ...msgNonce,
    ...secretBox.cipherText,
    ...secretBox.mac.bytes,
  ]);

  final salt = ElvishAccountWrap.randomBytes(16);
  final derived = await ElvishAccountWrap.deriveKekWithMetadata(
    password: trimmedPw,
    salt: salt,
  );
  final wrapped = await ElvishAccountWrap.aesWrap(kek: derived.kek, plaintext: msgKey);

  return ProtectedLinkPayload(
    kdf: derived.kdf,
    kdfSaltB64: base64Encode(salt),
    kdfParamsJson: derived.paramsJson,
    wrappedMsgKeyB64: base64Encode(wrapped),
    bodyCiphertextB64: base64Encode(payloadCt),
  );
}
