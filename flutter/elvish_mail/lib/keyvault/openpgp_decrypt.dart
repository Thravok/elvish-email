import 'dart:convert';
import 'dart:typed_data';

import 'package:dart_pg/dart_pg.dart';

/// Decrypt OpenPGP payloads (armored or binary) using identity/account secret keys.
String decryptOpenPgpUtf8(Uint8List ciphertext, List<PrivateKeyInterface> keys) {
  final head = ciphertext.length > 80 ? 80 : ciphertext.length;
  final probe = String.fromCharCodes(ciphertext.sublist(0, head));
  final EncryptedMessageInterface enc;
  if (probe.contains('BEGIN PGP MESSAGE')) {
    enc = OpenPGP.readEncryptedMessage(utf8.decode(ciphertext));
  } else {
    enc = EncryptedMessage(PacketList.decode(ciphertext));
  }
  final lit = OpenPGP.decryptMessage(enc, decryptionKeys: keys);
  return lit.literalData.text;
}
