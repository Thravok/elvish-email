import Foundation

nonisolated struct AccountKeyMeResponse: Decodable, Sendable {
    let bootstrapped: Bool
    let armoredPublic: String?
    let fingerprint: String?
    let wrappedSecretB64: String?
    let kdf: String?
    let kdfSaltB64: String?
    let kdfParamsJson: String?
}

nonisolated struct IdentitiesListResponse: Decodable, Sendable {
    let identities: [IdentityRowDTO]
}

nonisolated struct IdentityRowDTO: Decodable, Sendable {
    let email: String
    let fingerprint: String?
    let armoredPublic: String?
    let wrappedSecretB64: String?
    let isDefault: Bool?
}

/// JSON inside decrypted `header_ciphertext` (matches `internal/mailpipe.HeaderSummary`).
nonisolated struct MailHeaderStub: Decodable, Sendable {
    let subject: String?
    let from: String?
    let to: [String]?
}
