import 'dart:convert';

/// JSON DTOs (snake_case on the wire), aligned with `IOS/IOS/Auth/AuthModels.swift`.
class AuthUserDto {
  AuthUserDto({
    required this.email,
    required this.username,
    this.name,
    required this.isAdmin,
  });

  final String email;
  final String username;
  final String? name;
  final bool isAdmin;

  factory AuthUserDto.fromJson(Map<String, dynamic> j) {
    return AuthUserDto(
      email: j['email'] as String? ?? '',
      username: j['username'] as String? ?? '',
      name: j['name'] as String?,
      isAdmin: j['is_admin'] as bool? ?? false,
    );
  }
}

/// Public Cap settings from `GET /api/auth/signup-config` (matches iOS `CapPublicConfig`).
class AuthCapConfig {
  const AuthCapConfig({required this.enabled, this.widgetApiEndpoint});

  final bool enabled;
  final String? widgetApiEndpoint;

  factory AuthCapConfig.fromJson(Map<String, dynamic> j) {
    return AuthCapConfig(
      enabled: j['enabled'] as bool? ?? false,
      widgetApiEndpoint: j['widget_api_endpoint'] as String?,
    );
  }
}

class MeResponse {
  MeResponse({this.user});

  final AuthUserDto? user;

  factory MeResponse.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    return MeResponse(
      user: u is Map<String, dynamic> ? AuthUserDto.fromJson(u) : null,
    );
  }
}

class SignupConfigResponse {
  SignupConfigResponse({required this.mailDomain, this.cap});

  final String mailDomain;
  final AuthCapConfig? cap;

  /// Non-empty widget URL when the server requires Cap on auth.
  String? get activeCapWidgetEndpoint {
    final c = cap;
    if (c == null || !c.enabled) {
      return null;
    }
    final ep = c.widgetApiEndpoint?.trim();
    if (ep == null || ep.isEmpty) {
      return null;
    }
    return ep;
  }

  factory SignupConfigResponse.fromJson(Map<String, dynamic> j) {
    final capRaw = j['cap'];
    return SignupConfigResponse(
      mailDomain: j['mail_domain'] as String? ?? '',
      cap: capRaw is Map<String, dynamic> ? AuthCapConfig.fromJson(capRaw) : null,
    );
  }
}

class SrpBeginResponse {
  SrpBeginResponse({
    required this.sessionId,
    required this.saltB64,
    required this.serverPublicB64,
  });

  final String sessionId;
  final String saltB64;
  final String serverPublicB64;

  factory SrpBeginResponse.fromJson(Map<String, dynamic> j) {
    return SrpBeginResponse(
      sessionId: j['session_id'] as String? ?? '',
      saltB64: j['salt_b64'] as String? ?? '',
      serverPublicB64: j['server_public_b64'] as String? ?? '',
    );
  }
}

class SrpFinishResponse {
  SrpFinishResponse({
    this.ok,
    this.mfaRequired,
    this.challengeId,
    this.methods,
    this.user,
    this.serverProofB64,
  });

  final bool? ok;
  final bool? mfaRequired;
  final String? challengeId;
  final List<String>? methods;
  final AuthUserDto? user;
  final String? serverProofB64;

  factory SrpFinishResponse.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    final m = j['methods'];
    return SrpFinishResponse(
      ok: j['ok'] as bool?,
      mfaRequired: j['mfa_required'] as bool?,
      challengeId: j['challenge_id'] as String?,
      methods: m is List ? m.cast<String>() : null,
      user: u is Map<String, dynamic> ? AuthUserDto.fromJson(u) : null,
      serverProofB64: j['server_proof_b64'] as String?,
    );
  }
}

class MfaFinishResponse {
  MfaFinishResponse({this.ok, this.user});

  final bool? ok;
  final AuthUserDto? user;

  factory MfaFinishResponse.fromJson(Map<String, dynamic> j) {
    final u = j['user'];
    return MfaFinishResponse(
      ok: j['ok'] as bool?,
      user: u is Map<String, dynamic> ? AuthUserDto.fromJson(u) : null,
    );
  }
}

String? parseApiErrorBody(String body) {
  try {
    final j = jsonDecode(body);
    if (j is Map && j['error'] is String) {
      return j['error'] as String;
    }
  } catch (_) {}
  return null;
}
