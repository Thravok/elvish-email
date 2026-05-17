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
}
