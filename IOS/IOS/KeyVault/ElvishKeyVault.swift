import Foundation
import ObjectivePGP

/// Unlocks Skiff-style account + identity OpenPGP material and decrypts mail header ciphertexts
/// (parity with `static/auth/unlock.js` + `static/mail/mail-app.jsx` folder load).
///
/// - Note: OpenPGP uses [ObjectivePGP](https://github.com/krzyzanowskim/ObjectivePGP) (dual license).
@MainActor
final class ElvishKeyVault {
    private(set) var isUnlocked = false

    /// Last 16 hex digits of fingerprint, uppercased — matches `fingerprintKeyId16` in `unlock.js`.
    private var identitySecretKeys: [String: Key] = [:]
    private var defaultFingerprint16: String?
    private var orderedIdentityFingerprintsFull: [String] = []

    func zero() {
        identitySecretKeys.removeAll()
        defaultFingerprint16 = nil
        orderedIdentityFingerprintsFull.removeAll()
        isUnlocked = false
    }

    /// Fetch `/api/v1/account-key/me` + `/api/v1/identities`, unwrap account secret with `password`, unlock identity keys.
    /// On success, persists unwrapped account material to the Keychain (same role as `unlock.js` `persistAccountCache`).
    func unlock(client: APIClient, password: String, sessionEmail: String?) async throws {
        zero()
        let me = try await client.send(AccountKeyMeResponse.self, method: "GET", path: "/api/v1/account-key/me")
        guard me.bootstrapped else { return }

        guard me.armoredPublic != nil, !(me.armoredPublic ?? "").isEmpty,
              let wrappedB64 = me.wrappedSecretB64, !wrappedB64.isEmpty,
              let kdf = me.kdf, !kdf.isEmpty,
              let saltB64 = me.kdfSaltB64, !saltB64.isEmpty,
              let expectedFp = me.fingerprint, !expectedFp.isEmpty
        else {
            throw KeyVaultError.incompleteAccountKeyPayload
        }

        guard let salt = Data(base64Encoded: saltB64),
              let wrapped = Data(base64Encoded: wrappedB64)
        else {
            throw KeyVaultError.invalidBase64
        }

        let kek = try ElvishAccountWrap.deriveKEK(password: password, salt: salt, kdf: kdf, kdfParamsJSON: me.kdfParamsJson)
        let accountPrivArmored: Data
        do {
            accountPrivArmored = try ElvishAccountWrap.aesUnwrap(kek: kek, wrapped: wrapped)
        } catch {
            throw KeyVaultError.incorrectPassword
        }

        let armoredPrivString = String(data: accountPrivArmored, encoding: .utf8) ?? ""
        if armoredPrivString.isEmpty {
            throw KeyVaultError.incorrectPassword
        }

        let accountKeys = try readSecretKeys(from: accountPrivArmored)
        guard let accountKey = accountKeys.first(where: { $0.isSecret }) else {
            throw KeyVaultError.noAccountSecretKey
        }

        let liveFp = try fingerprintHexFull(for: accountKey)
        guard fingerprintsEquivalent(liveFp, expectedFp) else {
            throw KeyVaultError.incorrectPassword
        }

        try await unlockIdentities(client: client, accountKey: accountKey)

        isUnlocked = !identitySecretKeys.isEmpty

        if isUnlocked, let email = sessionEmail, !KeyVaultKeychain.normalizeEmail(email).isEmpty,
           let pub = me.armoredPublic, !pub.isEmpty
        {
            let payload = KeyVaultKeychain.PersistedAccount(
                sessionEmail: KeyVaultKeychain.normalizeEmail(email),
                accountArmoredPriv: armoredPrivString,
                accountArmoredPub: pub,
                accountFingerprint: expectedFp
            )
            try? KeyVaultKeychain.save(payload)
        }
    }

    /// Restore vault from Keychain when the HTTP session is still valid (cold start without password).
    /// Validates `/api/v1/account-key/me` fingerprint against cached material before loading keys.
    func restoreFromKeychainIfPossible(client: APIClient, sessionEmail: String?) async -> Bool {
        guard let raw = sessionEmail, !KeyVaultKeychain.normalizeEmail(raw).isEmpty else { return false }
        let norm = KeyVaultKeychain.normalizeEmail(raw)

        let cached: KeyVaultKeychain.PersistedAccount
        do {
            guard let c = try KeyVaultKeychain.load(sessionEmail: norm) else { return false }
            cached = c
        } catch {
            return false
        }

        guard KeyVaultKeychain.normalizeEmail(cached.sessionEmail) == norm else {
            KeyVaultKeychain.delete(sessionEmail: norm)
            return false
        }

        let me: AccountKeyMeResponse
        do {
            me = try await client.send(AccountKeyMeResponse.self, method: "GET", path: "/api/v1/account-key/me")
        } catch {
            return false
        }
        guard me.bootstrapped,
              let serverFp = me.fingerprint, !serverFp.isEmpty,
              fingerprintsEquivalent(serverFp, cached.accountFingerprint)
        else {
            KeyVaultKeychain.delete(sessionEmail: norm)
            return false
        }

        zero()

        guard let privData = cached.accountArmoredPriv.data(using: .utf8), !privData.isEmpty else {
            KeyVaultKeychain.delete(sessionEmail: norm)
            return false
        }

        do {
            let accountKeys = try readSecretKeys(from: privData)
            guard let accountKey = accountKeys.first(where: { $0.isSecret }) else {
                KeyVaultKeychain.delete(sessionEmail: norm)
                return false
            }
            let liveFp = try fingerprintHexFull(for: accountKey)
            guard fingerprintsEquivalent(liveFp, cached.accountFingerprint) else {
                KeyVaultKeychain.delete(sessionEmail: norm)
                return false
            }
            try await unlockIdentities(client: client, accountKey: accountKey)
        } catch {
            KeyVaultKeychain.delete(sessionEmail: norm)
            return false
        }

        isUnlocked = !identitySecretKeys.isEmpty
        return isUnlocked
    }

    private func unlockIdentities(client: APIClient, accountKey: Key) async throws {
        let idList = try await client.send(IdentitiesListResponse.self, method: "GET", path: "/api/v1/identities")
        var ordered: [String] = []
        for row in idList.identities {
            guard let fp = row.fingerprint, !fp.isEmpty,
                  row.armoredPublic?.isEmpty == false,
                  let wB64 = row.wrappedSecretB64, !wB64.isEmpty,
                  let wrappedId = Data(base64Encoded: wB64)
            else { continue }
            let armoredWrap = String(decoding: wrappedId, as: UTF8.self)
            guard let wrapData = armoredWrap.data(using: .utf8) else { continue }

            guard let decryptedArmoredData = try? ObjectivePGP.decrypt(
                wrapData,
                andVerifySignature: false,
                using: [accountKey],
                passphraseForKey: { _ in nil }
            ) else {
                continue
            }

            let idKeys = try readSecretKeys(from: decryptedArmoredData)
            guard let idSecret = idKeys.first(where: { $0.isSecret }) else { continue }
            let idFpFull = try fingerprintHexFull(for: idSecret)
            guard fingerprintsEquivalent(idFpFull, fp) else { continue }

            let kid = fingerprintKeyId16(idFpFull)
            identitySecretKeys[kid] = idSecret
            ordered.append(fp)
        }

        let defaultFull = idList.identities.first(where: { $0.isDefault == true })?.fingerprint
            ?? ordered.first

        if let d = defaultFull {
            defaultFingerprint16 = fingerprintKeyId16(d)
            orderedIdentityFingerprintsFull = [d] + ordered.filter { !fingerprintsEquivalent($0, d) }
        } else {
            orderedIdentityFingerprintsFull = ordered
        }
    }

    /// Decrypt `header_ciphertext_b64` → JSON header stub; tries default identity first, then others (same order as web).
    func decryptMailHeader(headerCiphertextB64: String) throws -> MailHeaderStub? {
        guard isUnlocked, !headerCiphertextB64.isEmpty else { return nil }
        guard let raw = Data(base64Encoded: headerCiphertextB64), !raw.isEmpty else { return nil }

        let candidates = decryptionCandidateFingerprints()
        for fp in candidates {
            let kid = fingerprintKeyId16(fp)
            guard let key = identitySecretKeys[kid] else { continue }
            if let clear = try? ObjectivePGP.decrypt(
                raw,
                andVerifySignature: false,
                using: [key],
                passphraseForKey: { _ in nil }
            ),
                let text = String(data: clear, encoding: .utf8)
            {
                let data = Data(text.utf8)
                let dec = JSONDecoder()
                return try? dec.decode(MailHeaderStub.self, from: data)
            }
        }
        return nil
    }

    /// Decrypt message body ciphertext (same strategy as `decryptMessageBlobLocally` in `mail-app.jsx`).
    func decryptMessageBody(ciphertext: Data) throws -> String {
        guard isUnlocked else { throw KeyVaultError.vaultLocked }
        guard !ciphertext.isEmpty else { throw KeyVaultError.emptyCiphertext }

        let candidates = decryptionCandidateFingerprints()
        var last: Error = KeyVaultError.bodyDecryptFailed
        for fp in candidates {
            let kid = fingerprintKeyId16(fp)
            guard let key = identitySecretKeys[kid] else { continue }
            do {
                let clear = try ObjectivePGP.decrypt(
                    ciphertext,
                    andVerifySignature: true,
                    using: [key],
                    passphraseForKey: { _ in nil }
                )
                let text = String(decoding: clear, as: UTF8.self)
                if !text.isEmpty { return text }
            } catch {
                last = error
            }
        }
        throw last
    }

    private func decryptionCandidateFingerprints() -> [String] {
        var out = orderedIdentityFingerprintsFull
        if let d = defaultFingerprint16 {
            if let idx = out.firstIndex(where: { fingerprintKeyId16($0) == d }), idx > 0 {
                let item = out.remove(at: idx)
                out.insert(item, at: 0)
            }
        }
        return out
    }

    private func readSecretKeys(from data: Data) throws -> [Key] {
        do {
            let keys = try ObjectivePGP.readKeys(from: data)
            return keys
        } catch {
            throw KeyVaultError.openPGP(String(describing: error))
        }
    }

    private func fingerprintHexFull(for key: Key) throws -> String {
        guard let fp = key.publicKey?.fingerprint ?? key.secretKey?.fingerprint else {
            throw KeyVaultError.openPGP("missing fingerprint")
        }
        let desc = fp.description.trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: " ", with: "")
            .uppercased()
        return desc
    }

    private func fingerprintKeyId16(_ fp: String) -> String {
        let x = fp.replacingOccurrences(of: " ", with: "").uppercased()
        guard x.count >= 16 else { return x }
        return String(x.suffix(16))
    }

    private func fingerprintsEquivalent(_ a: String, _ b: String) -> Bool {
        let x = a.replacingOccurrences(of: " ", with: "").uppercased()
        let y = b.replacingOccurrences(of: " ", with: "").uppercased()
        if x.isEmpty || y.isEmpty { return false }
        if x == y { return true }
        return fingerprintKeyId16(x) == fingerprintKeyId16(y)
    }
}

enum KeyVaultError: Error, LocalizedError {
    case incompleteAccountKeyPayload
    case invalidBase64
    case incorrectPassword
    case noAccountSecretKey
    case openPGP(String)
    case vaultLocked
    case emptyCiphertext
    case bodyDecryptFailed

    var errorDescription: String? {
        switch self {
        case .incompleteAccountKeyPayload:
            return "Account key response was incomplete."
        case .invalidBase64:
            return "Invalid base64 in account key material."
        case .incorrectPassword:
            return "Could not unlock mail keys with this password."
        case .noAccountSecretKey:
            return "No OpenPGP secret key found in account material."
        case let .openPGP(msg):
            return "OpenPGP: \(msg)"
        case .vaultLocked:
            return "Mail keys are locked. Sign out and sign in again to read messages."
        case .emptyCiphertext:
            return "Empty message body from server."
        case .bodyDecryptFailed:
            return "Could not decrypt this message with your identities."
        }
    }
}
