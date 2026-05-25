import 'dart:typed_data';

import 'elvish_api_client.dart';
import 'mail_dtos.dart';

/// Mail REST calls matching `IOS/IOS/Mail/MailService.swift`.
class MailService {
  MailService(this._api);

  final ElvishApiClient _api;

  Future<MailFoldersResponse> listFolders() async {
    final m = await _api.getJson('/api/v1/mailbox/folders');
    return MailFoldersResponse.fromJson(m);
  }

  Future<MailListResponse> messages({required String folder, int limit = 50}) async {
    final f = folder.toLowerCase().trim();
    final enc = Uri.encodeQueryComponent(f);
    final m = await _api.getJson('/api/v1/mail/messages?folder=$enc&limit=$limit');
    return MailListResponse.fromJson(m);
  }

  Future<Uint8List> messageBlob(String id) async {
    final bytes = await _api.getBytes('/api/v1/mail/messages/$id/blob');
    return Uint8List.fromList(bytes);
  }

  Future<void> setMessageRead({required String id, required bool read}) async {
    await _api.patchJson('/api/v1/mail/messages/$id', {'read': read});
  }

  Future<void> moveMessage({required String id, required String folder}) async {
    final f = folder.toLowerCase().trim();
    await _api.patchJson('/api/v1/mail/messages/$id', {'folder': f});
  }

  Future<void> deleteMessage(String id, {bool permanent = false}) async {
    final enc = Uri.encodeComponent(id);
    var path = '/api/v1/mail/messages/$enc';
    if (permanent) {
      path = '$path?mode=permanent';
    }
    await _api.deleteExpectOk(path);
  }

  Future<MailFiltersListResponse> listFilters() async {
    final m = await _api.getJson('/api/v1/filters');
    return MailFiltersListResponse.fromJson(m);
  }

  Future<IdentitiesListResponse> listIdentities() async {
    final m = await _api.getJson('/api/v1/identities');
    return IdentitiesListResponse.fromJson(m);
  }

  Future<KeyLookupHitDto?> lookupKey(String email) async {
    final enc = Uri.encodeQueryComponent(email);
    try {
      final m = await _api.getJson('/api/v1/keys/lookup?email=$enc');
      return KeyLookupHitDto.fromJson(m);
    } on ElvishHttpException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<KeyLookupHitDto?> getContactKey(String email) async {
    final enc = Uri.encodeComponent(email);
    try {
      final m = await _api.getJson('/api/v1/keys/contacts/$enc');
      return KeyLookupHitDto.fromJson(m);
    } on ElvishHttpException catch (e) {
      if (e.statusCode == 404) {
        return null;
      }
      rethrow;
    }
  }

  Future<PostEncryptedMessageResponse> postEncryptedMessage({
    required String recipient,
    required String headerCiphertextB64,
    required String bodyCiphertextB64,
    required String senderHeaderCiphertextB64,
    required String senderBodyCiphertextB64,
    required String fromAddr,
    required List<String> toAddrs,
  }) async {
    final m = await _api.postJson('/api/v1/mail/messages', {
      'recipient': recipient,
      'header_ciphertext_b64': headerCiphertextB64,
      'body_ciphertext_b64': bodyCiphertextB64,
      'sender_header_ciphertext_b64': senderHeaderCiphertextB64,
      'sender_body_ciphertext_b64': senderBodyCiphertextB64,
      'from_addr': fromAddr,
      'to_addrs': toAddrs,
    });
    return PostEncryptedMessageResponse.fromJson(m);
  }

  Future<PostOutboxResponse> postOutbox({
    required String payloadCiphertextB64,
    required List<String> recipientSummary,
    required String senderHeaderCiphertextB64,
    required String senderBodyCiphertextB64,
    required String fromAddr,
  }) async {
    final m = await _api.postJson('/api/v1/mail/outbox', {
      'payload_ciphertext_b64': payloadCiphertextB64,
      'recipient_summary': recipientSummary,
      'sender_header_ciphertext_b64': senderHeaderCiphertextB64,
      'sender_body_ciphertext_b64': senderBodyCiphertextB64,
      'from_addr': fromAddr,
    });
    return PostOutboxResponse.fromJson(m);
  }

  Future<ProtectedLinkCreateResponse> createProtectedLink({
    required String subjectHint,
    required List<String> recipientEmails,
    required bool notifyRecipients,
    required String notifyFromAddr,
    required int ttlSeconds,
    required int maxViews,
    required String kdf,
    required String kdfSaltB64,
    required String kdfParamsJson,
    required String wrappedMsgKeyB64,
    required String bodyCiphertextB64,
  }) async {
    final m = await _api.postJson('/api/v1/mail/protected-links', {
      'subject_hint': subjectHint,
      'recipient_emails': recipientEmails,
      'notify_recipients': notifyRecipients,
      'notify_from_addr': notifyFromAddr,
      'ttl_seconds': ttlSeconds,
      'max_views': maxViews,
      'kdf': kdf,
      'kdf_salt_b64': kdfSaltB64,
      'kdf_params_json': kdfParamsJson,
      'wrapped_msg_key_b64': wrappedMsgKeyB64,
      'body_ciphertext_b64': bodyCiphertextB64,
    });
    return ProtectedLinkCreateResponse.fromJson(m);
  }
}
