import Foundation
import Security

/// Keychain backing for unlocked account key material (Skiff-style persistence like
/// `PERSIST_KEY` / `persistAccountCache` in `static/auth/unlock.js`).
///
/// Stores the **unwrapped** account OpenPGP secret (armored) — treat like a device-bound secret;
/// cleared on logout. Uses **this device only** accessibility (no iCloud Keychain sync).
enum KeyVaultKeychain {
    private static let service = (Bundle.main.bundleIdentifier ?? "elvish.ios") + ".keyvault.account"

    /// Same logical shape as `unlock.js` persisted JSON `version: 1`.
    struct PersistedAccount: Codable, Sendable {
        var version: Int = 1
        var sessionEmail: String
        var accountArmoredPriv: String
        var accountArmoredPub: String
        var accountFingerprint: String
    }

    static func normalizeEmail(_ email: String) -> String {
        email.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    static func save(_ account: PersistedAccount) throws {
        let email = normalizeEmail(account.sessionEmail)
        guard !email.isEmpty else { return }
        let encoder = JSONEncoder()
        let data = try encoder.encode(account)
        var query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: email,
        ]
        SecItemDelete(query as CFDictionary)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        let status = SecItemAdd(query as CFDictionary, nil)
        guard status == errSecSuccess else {
            throw KeychainVaultError.saveFailed(status)
        }
    }

    static func load(sessionEmail: String) throws -> PersistedAccount? {
        let email = normalizeEmail(sessionEmail)
        guard !email.isEmpty else { return nil }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: email,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var out: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &out)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess, let data = out as? Data else {
            throw KeychainVaultError.loadFailed(status)
        }
        return try JSONDecoder().decode(PersistedAccount.self, from: data)
    }

    static func delete(sessionEmail: String) {
        let email = normalizeEmail(sessionEmail)
        guard !email.isEmpty else { return }
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: email,
        ]
        SecItemDelete(query as CFDictionary)
    }
}

enum KeychainVaultError: Error, Sendable {
    case saveFailed(OSStatus)
    case loadFailed(OSStatus)
}
