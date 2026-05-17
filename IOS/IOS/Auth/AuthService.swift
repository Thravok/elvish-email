import Foundation

/// Performs SRP login, optional MFA (TOTP / recovery), session cookie handling, and `/api/auth/me`.
final class AuthService: Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func fetchAuthSignupConfig() async throws -> AuthSignupConfig {
        try await client.send(AuthSignupConfig.self, method: "GET", path: "/api/auth/signup-config")
    }

    func fetchMe() async throws -> AuthUserDTO? {
        let r: MeResponse = try await client.send(MeResponse.self, method: "GET", path: "/api/auth/me")
        return r.user
    }

    func logout() async throws {
        try await client.sendExpectOK(method: "POST", path: "/api/auth/logout")
    }

    /// SRP login. Returns `.mfa` when second factor is required.
    /// When the server enables Cap, pass a non-empty `capToken` from the auth captcha WebView.
    func loginSRP(username: String, password: String, capToken: String?) async throws -> LoginSRPOutcome {
        let state = try ElvishSRPClient.beginLogin(username: username, password: password)
        let beginBody = SRPBeginBody(username: username, clientPublicB64: state.clientPublicB64, capToken: capToken)
        let begin: SRPBeginResponse = try await client.send(SRPBeginResponse.self, method: "POST", path: "/api/auth/login/begin", body: beginBody)
        let (proof, expectedServer) = try ElvishSRPClient.clientProof(state: state, saltB64: begin.saltB64, serverPublicB64: begin.serverPublicB64)
        let finishBody = SRPFinishBody(sessionId: begin.sessionId, clientProofB64: proof)
        let finish: SRPFinishResponse = try await client.send(SRPFinishResponse.self, method: "POST", path: "/api/auth/login/finish", body: finishBody)
        if finish.mfaRequired == true, let cid = finish.challengeId, !cid.isEmpty {
            return .mfa(challengeId: cid, methods: finish.methods ?? [], user: finish.user)
        }
        if let sp = finish.serverProofB64, !sp.isEmpty, sp != expectedServer {
            throw AuthServiceError.serverProofMismatch
        }
        guard let user = finish.user else { throw AuthServiceError.missingUser }
        return .loggedIn(user: user)
    }

    func completeMFATOTP(challengeId: String, code: String) async throws -> AuthUserDTO {
        let body = MFALoginBody(challengeId: challengeId, code: code)
        let r: MFAFinishResponse = try await client.send(MFAFinishResponse.self, method: "POST", path: "/api/auth/2fa/login/totp", body: body)
        guard let u = r.user else { throw AuthServiceError.missingUser }
        return u
    }

    func completeMFARecovery(challengeId: String, code: String) async throws -> AuthUserDTO {
        let body = MFALoginBody(challengeId: challengeId, code: code)
        let r: MFAFinishResponse = try await client.send(MFAFinishResponse.self, method: "POST", path: "/api/auth/2fa/login/recovery", body: body)
        guard let u = r.user else { throw AuthServiceError.missingUser }
        return u
    }
}

enum LoginSRPOutcome: Sendable {
    case loggedIn(user: AuthUserDTO)
    case mfa(challengeId: String, methods: [String], user: AuthUserDTO?)
}

enum AuthServiceError: Error {
    case serverProofMismatch
    case missingUser
}
