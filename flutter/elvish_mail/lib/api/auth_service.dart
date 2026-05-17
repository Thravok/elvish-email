import 'package:meta/meta.dart';

import '../crypto/srp_client.dart';
import 'auth_dtos.dart';
import 'elvish_api_client.dart';

@immutable
class LoginSuccess {
  const LoginSuccess(this.user);
  final AuthUserDto user;
}

@immutable
class LoginMfaRequired {
  const LoginMfaRequired({
    required this.challengeId,
    required this.methods,
    this.user,
  });

  final String challengeId;
  final List<String> methods;
  final AuthUserDto? user;
}

/// SRP login + MFA, matching `IOS/IOS/Auth/AuthService.swift`.
class AuthService {
  AuthService(this._api);

  final ElvishApiClient _api;

  Future<SignupConfigResponse> fetchSignupConfig() async {
    final m = await _api.getJson('/api/auth/signup-config');
    return SignupConfigResponse.fromJson(m);
  }

  Future<AuthUserDto?> fetchMe() async {
    final m = await _api.getJson('/api/auth/me');
    return MeResponse.fromJson(m).user;
  }

  Future<void> logout() => _api.postEmptyExpectOk('/api/auth/logout');

  /// [capToken] is required when the server enables Cap (see signup-config `cap`).
  Future<Object> loginSrp(String username, String password, {String? capToken}) async {
    final state = ElvishSrpClient.beginLogin(username, password);
    final beginPayload = <String, dynamic>{
      'username': username,
      'client_public_b64': state.clientPublicB64,
    };
    final trimmedCap = capToken?.trim();
    if (trimmedCap != null && trimmedCap.isNotEmpty) {
      beginPayload['cap_token'] = trimmedCap;
    }
    final begin = SrpBeginResponse.fromJson(
      await _api.postJson('/api/auth/login/begin', beginPayload),
    );
    final proof = ElvishSrpClient.clientProof(
      state: state,
      saltB64: begin.saltB64,
      serverPublicB64: begin.serverPublicB64,
    );
    final finish = SrpFinishResponse.fromJson(
      await _api.postJson('/api/auth/login/finish', {
        'session_id': begin.sessionId,
        'client_proof_b64': proof.clientProofB64,
      }),
    );
    if (finish.mfaRequired == true) {
      final cid = finish.challengeId;
      if (cid != null && cid.isNotEmpty) {
        return LoginMfaRequired(
          challengeId: cid,
          methods: finish.methods ?? const [],
          user: finish.user,
        );
      }
    }
    final sp = finish.serverProofB64;
    if (sp != null && sp.isNotEmpty && sp != proof.expectedServerProofB64) {
      throw StateError('server proof mismatch');
    }
    final user = finish.user;
    if (user == null) {
      throw StateError('missing user');
    }
    return LoginSuccess(user);
  }

  Future<AuthUserDto> completeMfaTotp({
    required String challengeId,
    required String code,
  }) async {
    final m = await _api.postJson('/api/auth/2fa/login/totp', {
      'challenge_id': challengeId,
      'code': code,
    });
    final r = MfaFinishResponse.fromJson(m);
    final u = r.user;
    if (u == null) {
      throw StateError('missing user');
    }
    return u;
  }

  Future<AuthUserDto> completeMfaRecovery({
    required String challengeId,
    required String code,
  }) async {
    final m = await _api.postJson('/api/auth/2fa/login/recovery', {
      'challenge_id': challengeId,
      'code': code,
    });
    final r = MfaFinishResponse.fromJson(m);
    final u = r.user;
    if (u == null) {
      throw StateError('missing user');
    }
    return u;
  }
}
