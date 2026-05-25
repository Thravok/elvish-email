import 'dart:convert';

import '../crypto/protected_link_crypto.dart';
import '../keyvault/elvish_key_vault.dart';
import '../mime/mail_compose_mime.dart';
import 'mail_dtos.dart';
import 'mail_service.dart';

class PgpSendResult {
  PgpSendResult({
    required this.localDelivery,
    this.messageId,
    this.outboxId,
  });

  final bool localDelivery;
  final String? messageId;
  final String? outboxId;
}

/// Orchestrates compose/send (parity with `static/mail/compose.jsx`).
class ComposeService {
  ComposeService({required this.mail, required this.vault});

  final MailService mail;
  final ElvishKeyVault vault;

  Future<PgpSendResult> sendPgpDirect({
    required String from,
    required String recipient,
    required String subject,
    required String body,
    required String recipientArmored,
    required String senderArmored,
    required String senderFingerprint,
    required bool localDelivery,
    List<String> cc = const [],
    List<String> bcc = const [],
    String inReplyTo = '',
    String references = '',
  }) async {
    if (!vault.isUnlocked) {
      throw KeyVaultError.vaultLocked;
    }
    final recipients = [recipient];
    final headerPayload = MailComposeMime.buildHeaderStub(
      from: from,
      to: recipients,
      cc: cc.map(MailComposeMime.canonicalEmailToken).where((e) => e.isNotEmpty).toList(),
      bcc: bcc.map(MailComposeMime.canonicalEmailToken).where((e) => e.isNotEmpty).toList(),
      subject: subject,
      inReplyTo: inReplyTo,
      references: references,
    );
    final rfc822 = MailComposeMime.buildRfc5322(
      from: from,
      to: recipients,
      subject: subject,
      body: body,
      cc: cc,
      bcc: bcc,
      inReplyTo: inReplyTo,
      references: references,
    );
    final armoredBody = vault.encryptAndSignBinary(
      armoredRecipientPub: recipientArmored,
      plaintext: rfc822,
      signerFingerprint: senderFingerprint,
    );
    final bodyB64 = base64Encode(utf8.encode(armoredBody));

    var senderHeaderB64 = '';
    var senderBodyB64 = '';
    if (senderArmored.isNotEmpty) {
      final senderArmoredBody = vault.encryptAndSignBinary(
        armoredRecipientPub: senderArmored,
        plaintext: rfc822,
        signerFingerprint: senderFingerprint,
      );
      final headerCipher = vault.encryptToRecipient(
        senderArmored,
        jsonEncode(headerPayload),
      );
      senderBodyB64 = base64Encode(utf8.encode(senderArmoredBody));
      senderHeaderB64 = base64Encode(utf8.encode(headerCipher));
    }

    if (localDelivery) {
      final headerCipher = vault.encryptToRecipient(
        recipientArmored,
        jsonEncode(headerPayload),
      );
      final res = await mail.postEncryptedMessage(
        recipient: recipient,
        headerCiphertextB64: base64Encode(utf8.encode(headerCipher)),
        bodyCiphertextB64: bodyB64,
        senderHeaderCiphertextB64: senderHeaderB64,
        senderBodyCiphertextB64: senderBodyB64,
        fromAddr: from,
        toAddrs: recipients,
      );
      return PgpSendResult(localDelivery: true, messageId: res.id);
    }

    final outboundMime = MailComposeMime.buildPgpMimeMessage(
      from: from,
      to: recipients,
      cc: cc,
      subject: subject,
      armoredCiphertext: armoredBody,
      inReplyTo: inReplyTo,
      references: references,
    );
    final res = await mail.postOutbox(
      payloadCiphertextB64: base64Encode(outboundMime),
      recipientSummary: recipients,
      senderHeaderCiphertextB64: senderHeaderB64,
      senderBodyCiphertextB64: senderBodyB64,
      fromAddr: from,
    );
    return PgpSendResult(localDelivery: false, outboxId: res.id);
  }

  Future<ProtectedLinkCreateResponse> sendProtectedLink({
    required String from,
    required String to,
    required String cc,
    required String subject,
    required String body,
    required String password,
    required int ttlSeconds,
    required int maxViews,
    required bool notify,
  }) async {
    final payload = await buildProtectedLinkPayload(
      from: from,
      subject: subject,
      body: body,
      password: password,
    );
    final seen = <String>{};
    final recipients = <String>[];
    for (final disp in [...MailComposeMime.splitAddressList(to), ...MailComposeMime.splitAddressList(cc)]) {
      final c = MailComposeMime.canonicalEmailToken(disp);
      if (c.isEmpty || seen.contains(c)) {
        continue;
      }
      seen.add(c);
      recipients.add(c);
    }
    return mail.createProtectedLink(
      subjectHint: subject,
      recipientEmails: recipients,
      notifyRecipients: notify,
      notifyFromAddr: from,
      ttlSeconds: ttlSeconds,
      maxViews: maxViews,
      kdf: payload.kdf,
      kdfSaltB64: payload.kdfSaltB64,
      kdfParamsJson: payload.kdfParamsJson,
      wrappedMsgKeyB64: payload.wrappedMsgKeyB64,
      bodyCiphertextB64: payload.bodyCiphertextB64,
    );
  }

  Future<KeyLookupHitDto?> resolveRecipientKey(String email) async {
    final contact = await mail.getContactKey(email);
    if (contact?.armoredPublic != null && contact!.armoredPublic!.isNotEmpty) {
      return contact;
    }
    return mail.lookupKey(email);
  }
}
