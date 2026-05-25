import 'dart:convert';

import 'package:dio/dio.dart';

import 'auth_dtos.dart';

/// Mail + account-key DTOs aligned with `IOS/IOS/Mail/MailModels.swift` and `AccountKeyDTOs.swift`.
class MailFolderDto {
  MailFolderDto({
    required this.name,
    this.total,
    this.unread,
    this.isStandard,
    this.createdAt,
  });

  final String name;
  final int? total;
  final int? unread;
  final bool? isStandard;
  final String? createdAt;

  String get id => name.toLowerCase();

  factory MailFolderDto.fromJson(Map<String, dynamic> j) {
    return MailFolderDto(
      name: j['name'] as String? ?? '',
      total: (j['total'] as num?)?.toInt(),
      unread: (j['unread'] as num?)?.toInt(),
      isStandard: j['is_standard'] as bool?,
      createdAt: j['created_at'] as String?,
    );
  }

  static List<MailFolderDto> standardPlaceholders() => [
        MailFolderDto(name: 'inbox', total: 0, unread: null, isStandard: true, createdAt: null),
        MailFolderDto(name: 'sent', total: 0, unread: null, isStandard: true, createdAt: null),
        MailFolderDto(name: 'drafts', total: 0, unread: null, isStandard: true, createdAt: null),
        MailFolderDto(name: 'trash', total: 0, unread: null, isStandard: true, createdAt: null),
        MailFolderDto(name: 'archive', total: 0, unread: null, isStandard: true, createdAt: null),
      ];
}

class MailFoldersResponse {
  MailFoldersResponse({required this.folders});

  final List<MailFolderDto> folders;

  factory MailFoldersResponse.fromJson(Map<String, dynamic> j) {
    final raw = j['folders'];
    final list = <MailFolderDto>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map<String, dynamic>) {
          list.add(MailFolderDto.fromJson(e));
        }
      }
    }
    return MailFoldersResponse(folders: list);
  }
}

class MailManifestRow {
  MailManifestRow({
    required this.id,
    this.folder,
    this.receivedAt,
    this.read,
    this.subject,
    this.fromAddr,
    this.toAddrs,
    this.headerCiphertextB64,
    this.hasAttachments,
  });

  final String id;
  final String? folder;
  final String? receivedAt;
  final bool? read;
  final String? subject;
  final String? fromAddr;
  final List<String>? toAddrs;
  final String? headerCiphertextB64;
  final bool? hasAttachments;

  factory MailManifestRow.fromJson(Map<String, dynamic> j) {
    final to = j['to_addrs'];
    return MailManifestRow(
      id: j['id'] as String? ?? '',
      folder: j['folder'] as String?,
      receivedAt: j['received_at'] as String?,
      read: j['read'] as bool?,
      subject: j['subject'] as String?,
      fromAddr: j['from_addr'] as String?,
      toAddrs: to is List ? to.cast<String>() : null,
      headerCiphertextB64: j['header_ciphertext_b64'] as String?,
      hasAttachments: j['has_attachments'] as bool?,
    );
  }
}

class MailListResponse {
  MailListResponse({required this.messages, this.consent});

  final List<MailManifestRow> messages;
  final Map<String, bool>? consent;

  factory MailListResponse.fromJson(Map<String, dynamic> j) {
    final raw = j['messages'];
    final list = <MailManifestRow>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map<String, dynamic>) {
          list.add(MailManifestRow.fromJson(e));
        }
      }
    }
    Map<String, bool>? consent;
    final c = j['consent'];
    if (c is Map) {
      consent = c.map((k, v) => MapEntry(k.toString(), v == true));
    }
    return MailListResponse(messages: list, consent: consent);
  }
}

class MailInboxRow {
  MailInboxRow({
    required this.id,
    this.subject,
    this.fromAddr,
    this.toAddrs,
    this.receivedAt,
    this.read,
    required this.headerDecrypted,
    required this.hasHeaderCiphertext,
    required this.hasAttachments,
  });

  final String id;
  final String? subject;
  final String? fromAddr;
  final List<String>? toAddrs;
  final String? receivedAt;
  final bool? read;
  final bool headerDecrypted;
  final bool hasHeaderCiphertext;
  final bool hasAttachments;
}

class MailHeaderStub {
  MailHeaderStub({this.subject, this.from, this.to});

  final String? subject;
  final String? from;
  final List<String>? to;

  factory MailHeaderStub.fromJson(Map<String, dynamic> j) {
    final t = j['to'];
    return MailHeaderStub(
      subject: j['subject'] as String?,
      from: j['from'] as String?,
      to: t is List ? t.cast<String>() : null,
    );
  }
}

class AccountKeyMeResponse {
  AccountKeyMeResponse({
    required this.bootstrapped,
    this.armoredPublic,
    this.fingerprint,
    this.wrappedSecretB64,
    this.kdf,
    this.kdfSaltB64,
    this.kdfParamsJson,
  });

  final bool bootstrapped;
  final String? armoredPublic;
  final String? fingerprint;
  final String? wrappedSecretB64;
  final String? kdf;
  final String? kdfSaltB64;
  final String? kdfParamsJson;

  factory AccountKeyMeResponse.fromJson(Map<String, dynamic> j) {
    return AccountKeyMeResponse(
      bootstrapped: j['bootstrapped'] as bool? ?? false,
      armoredPublic: j['armored_public'] as String?,
      fingerprint: j['fingerprint'] as String?,
      wrappedSecretB64: j['wrapped_secret_b64'] as String?,
      kdf: j['kdf'] as String?,
      kdfSaltB64: j['kdf_salt_b64'] as String?,
      kdfParamsJson: j['kdf_params_json'] as String?,
    );
  }
}

class IdentityRowDto {
  IdentityRowDto({
    required this.email,
    this.fingerprint,
    this.armoredPublic,
    this.wrappedSecretB64,
    this.isDefault,
  });

  final String email;
  final String? fingerprint;
  final String? armoredPublic;
  final String? wrappedSecretB64;
  final bool? isDefault;

  factory IdentityRowDto.fromJson(Map<String, dynamic> j) {
    return IdentityRowDto(
      email: j['email'] as String? ?? '',
      fingerprint: j['fingerprint'] as String?,
      armoredPublic: j['armored_public'] as String?,
      wrappedSecretB64: j['wrapped_secret_b64'] as String?,
      isDefault: j['is_default'] as bool?,
    );
  }
}

class IdentitiesListResponse {
  IdentitiesListResponse({required this.identities});

  final List<IdentityRowDto> identities;

  factory IdentitiesListResponse.fromJson(Map<String, dynamic> j) {
    final raw = j['identities'];
    final list = <IdentityRowDto>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map<String, dynamic>) {
          list.add(IdentityRowDto.fromJson(e));
        }
      }
    }
    return IdentitiesListResponse(identities: list);
  }
}

class KeyLookupHitDto {
  KeyLookupHitDto({
    this.email,
    this.fingerprint,
    this.armoredPublic,
    this.source,
  });

  final String? email;
  final String? fingerprint;
  final String? armoredPublic;
  final String? source;

  factory KeyLookupHitDto.fromJson(Map<String, dynamic> j) {
    return KeyLookupHitDto(
      email: j['email'] as String?,
      fingerprint: j['fingerprint'] as String?,
      armoredPublic: (j['armored_public'] ?? j['armored']) as String?,
      source: j['source'] as String?,
    );
  }
}

class PostEncryptedMessageResponse {
  PostEncryptedMessageResponse({this.id, this.blobRef});

  final String? id;
  final String? blobRef;

  factory PostEncryptedMessageResponse.fromJson(Map<String, dynamic> j) {
    return PostEncryptedMessageResponse(
      id: j['id'] as String?,
      blobRef: j['blob_ref'] as String?,
    );
  }
}

class PostOutboxResponse {
  PostOutboxResponse({this.id});

  final String? id;

  factory PostOutboxResponse.fromJson(Map<String, dynamic> j) {
    return PostOutboxResponse(id: j['id'] as String?);
  }
}

class ProtectedLinkCreateResponse {
  ProtectedLinkCreateResponse({
    this.token,
    this.url,
    this.expiresAt,
    this.maxViews,
    this.notifySent,
  });

  final String? token;
  final String? url;
  final String? expiresAt;
  final int? maxViews;
  final bool? notifySent;

  factory ProtectedLinkCreateResponse.fromJson(Map<String, dynamic> j) {
    return ProtectedLinkCreateResponse(
      token: j['token'] as String?,
      url: j['url'] as String?,
      expiresAt: j['expires_at'] as String?,
      maxViews: (j['max_views'] as num?)?.toInt(),
      notifySent: j['notify_sent'] as bool?,
    );
  }
}

class MailFilterConditionDto {
  MailFilterConditionDto({
    required this.type,
    required this.op,
    this.value,
  });

  final String type;
  final String op;
  final String? value;

  factory MailFilterConditionDto.fromJson(Map<String, dynamic> j) {
    return MailFilterConditionDto(
      type: j['type'] as String? ?? '',
      op: j['operator'] as String? ?? j['op'] as String? ?? 'contains',
      value: j['value'] as String?,
    );
  }
}

class MailFilterActionDto {
  MailFilterActionDto({required this.type, this.value});

  final String type;
  final String? value;

  factory MailFilterActionDto.fromJson(Map<String, dynamic> j) {
    return MailFilterActionDto(
      type: j['type'] as String? ?? '',
      value: j['value'] as String?,
    );
  }
}

class MailFilterRuleDto {
  MailFilterRuleDto({
    required this.id,
    required this.name,
    this.enabled,
    this.priority,
    required this.conditions,
    required this.actions,
    this.createdAt,
  });

  final String id;
  final String name;
  final bool? enabled;
  final int? priority;
  final List<MailFilterConditionDto> conditions;
  final List<MailFilterActionDto> actions;
  final String? createdAt;

  factory MailFilterRuleDto.fromJson(Map<String, dynamic> j) {
    final conds = <MailFilterConditionDto>[];
    final rawC = j['conditions'];
    if (rawC is List) {
      for (final e in rawC) {
        if (e is Map<String, dynamic>) {
          conds.add(MailFilterConditionDto.fromJson(e));
        }
      }
    }
    final acts = <MailFilterActionDto>[];
    final rawA = j['actions'];
    if (rawA is List) {
      for (final e in rawA) {
        if (e is Map<String, dynamic>) {
          acts.add(MailFilterActionDto.fromJson(e));
        }
      }
    }
    return MailFilterRuleDto(
      id: j['id'] as String? ?? '',
      name: j['name'] as String? ?? '',
      enabled: j['enabled'] as bool?,
      priority: (j['priority'] as num?)?.toInt(),
      conditions: conds,
      actions: acts,
      createdAt: j['created_at'] as String?,
    );
  }
}

class MailFiltersListResponse {
  MailFiltersListResponse({required this.filters});

  final List<MailFilterRuleDto> filters;

  factory MailFiltersListResponse.fromJson(Map<String, dynamic> j) {
    final raw = j['filters'];
    final list = <MailFilterRuleDto>[];
    if (raw is List) {
      for (final e in raw) {
        if (e is Map<String, dynamic>) {
          list.add(MailFilterRuleDto.fromJson(e));
        }
      }
    }
    return MailFiltersListResponse(filters: list);
  }
}

class ElvishHttpException implements Exception {
  ElvishHttpException(this.statusCode, this.body);

  final int statusCode;
  final String body;

  String get message => parseApiErrorBody(body) ?? body;

  @override
  String toString() => 'HTTP $statusCode: $message';
}

Map<String, dynamic>? decodeJsonMap(Response<dynamic> r) {
  final d = r.data;
  if (d is Map<String, dynamic>) {
    return d;
  }
  if (d is String) {
    final o = jsonDecode(d);
    if (o is Map<String, dynamic>) {
      return o;
    }
  }
  return null;
}

void throwIfNotOk(Response<dynamic> r) {
  if (r.statusCode != null && r.statusCode! >= 200 && r.statusCode! < 300) {
    return;
  }
  final body = r.data is String ? r.data as String : jsonEncode(r.data);
  throw ElvishHttpException(r.statusCode ?? 0, body);
}
