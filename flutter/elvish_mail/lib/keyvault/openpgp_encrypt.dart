import 'dart:typed_data';

import 'dart_pg_openpgp.dart';

/// Encrypt to armored PGP MESSAGE (parity with `static/auth/unlock.js` + iOS `ElvishKeyVault`).
String encryptToRecipientArmored({
  required String armoredRecipientPub,
  required String plaintext,
}) {
  final recipient = OpenPGP.readPublicKey(armoredRecipientPub);
  final enc = OpenPGP.encryptCleartext(plaintext, encryptionKeys: [recipient]);
  return enc.armor();
}

String encryptAndSignToRecipientArmored({
  required String armoredRecipientPub,
  required String plaintext,
  required PrivateKeyInterface signer,
}) {
  final recipient = OpenPGP.readPublicKey(armoredRecipientPub);
  final enc = OpenPGP.encryptCleartext(
    plaintext,
    encryptionKeys: [recipient],
    signingKeys: [signer],
  );
  return enc.armor();
}

String encryptAndSignBinaryArmored({
  required String armoredRecipientPub,
  required Uint8List plaintext,
  required PrivateKeyInterface signer,
}) {
  final recipient = OpenPGP.readPublicKey(armoredRecipientPub);
  final lit = OpenPGP.createLiteralMessage(plaintext);
  final enc = OpenPGP.encrypt(
    lit,
    encryptionKeys: [recipient],
    signingKeys: [signer],
  );
  return enc.armor();
}
