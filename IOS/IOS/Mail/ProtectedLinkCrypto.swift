import CryptoKit
import Foundation

/// Client-side protected-link payload (Mode B; parity with `static/mail/compose.jsx` `sendProtectedLink`).
enum ProtectedLinkCrypto {
    struct Payload: Sendable {
        let kdf: String
        let kdfSaltB64: String
        let kdfParamsJSON: String
        let wrappedMsgKeyB64: String
        let bodyCiphertextB64: String
    }

    static func buildPayload(from: String, subject: String, body: String, password: String) throws -> Payload {
        let trimmedPw = password.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmedPw.count >= 12 else {
            throw ProtectedLinkError.passwordTooShort
        }
        let fullBody = "From: \(from.isEmpty ? "anonymous" : from)\r\nSubject: \(subject.isEmpty ? "(no subject)" : subject)\r\n\r\n\(body)"
        let plain = Data(fullBody.utf8)

        var msgKey = try ElvishAccountWrap.randomBytes(32)
        defer { msgKey.resetBytes(in: 0 ..< msgKey.count) }

        let msgNonce = try ElvishAccountWrap.randomBytes(12)
        let symKey = SymmetricKey(data: msgKey)
        let sealed = try AES.GCM.seal(plain, using: symKey, nonce: AES.GCM.Nonce(data: msgNonce))
        guard let combined = sealed.combined else {
            throw ProtectedLinkError.encryptFailed
        }
        // `combined` is nonce || ciphertext || tag (same layout as web `msgNonce` + subtle.encrypt output).
        let payloadCt = combined

        let salt = try ElvishAccountWrap.randomBytes(16)
        let derived = try ElvishAccountWrap.deriveKEKWithMetadata(
            password: trimmedPw,
            salt: salt,
            kdf: "argon2id",
            kdfParamsJSON: nil
        )
        let wrapped = try ElvishAccountWrap.aesWrap(kek: derived.kek, plaintext: msgKey)

        return Payload(
            kdf: derived.kdf,
            kdfSaltB64: salt.base64EncodedString(),
            kdfParamsJSON: derived.paramsJSON,
            wrappedMsgKeyB64: wrapped.base64EncodedString(),
            bodyCiphertextB64: payloadCt.base64EncodedString()
        )
    }
}

enum ProtectedLinkError: Error, LocalizedError {
    case passwordTooShort
    case encryptFailed

    var errorDescription: String? {
        switch self {
        case .passwordTooShort:
            return "Password must be at least 12 characters."
        case .encryptFailed:
            return "Could not encrypt protected link payload."
        }
    }
}
