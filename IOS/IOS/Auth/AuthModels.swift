import Foundation

nonisolated struct AuthUserDTO: Codable, Equatable, Sendable {
    let email: String
    let username: String
    let name: String?
    let isAdmin: Bool
}

nonisolated struct CapPublicConfig: Decodable, Sendable {
    let enabled: Bool?
    let widgetApiEndpoint: String?
}

nonisolated struct AuthSignupConfig: Decodable, Sendable {
    let mailDomain: String
    let cap: CapPublicConfig?
}

nonisolated struct MeResponse: Decodable, Sendable {
    let user: AuthUserDTO?
}

nonisolated struct SRPBeginBody: Encodable, Sendable {
    let username: String
    let clientPublicB64: String
    let capToken: String?
}

nonisolated struct SRPBeginResponse: Decodable, Sendable {
    let sessionId: String
    let saltB64: String
    let serverPublicB64: String
    let group: String?
    let hash: String?
}

nonisolated struct SRPFinishBody: Encodable, Sendable {
    let sessionId: String
    let clientProofB64: String
}

nonisolated struct SRPFinishResponse: Decodable, Sendable {
    let ok: Bool?
    let mfaRequired: Bool?
    let challengeId: String?
    let methods: [String]?
    let user: AuthUserDTO?
    let serverProofB64: String?
}

nonisolated struct MFALoginBody: Encodable, Sendable {
    let challengeId: String
    let code: String
}

nonisolated struct MFAFinishResponse: Decodable, Sendable {
    let ok: Bool?
    let user: AuthUserDTO?
}
