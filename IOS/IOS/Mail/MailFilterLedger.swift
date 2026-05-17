import Foundation

/// Persists which filter applications ran for the current rules generation (same idea as web `localStorage`).
enum MailFilterLedger {
    private static let storageVersion = 1

    private struct Entry: Codable, Sendable {
        var ruleId: String
        var actionFingerprint: String
        var rulesHash: String
    }

    private struct Store: Codable, Sendable {
        var version: Int
        var rulesHash: String
        var entries: [String: Entry]
    }

    private static func key(sessionEmail: String) -> String {
        let norm = KeyVaultKeychain.normalizeEmail(sessionEmail)
        return "elvish_mail_filter_ledger_v\(storageVersion)_\(norm)"
    }

    private static func read(sessionEmail: String) -> Store {
        let d = UserDefaults.standard.data(forKey: key(sessionEmail: sessionEmail)) ?? Data()
        guard !d.isEmpty,
              let s = try? JSONDecoder().decode(Store.self, from: d),
              s.version == storageVersion
        else {
            return Store(version: storageVersion, rulesHash: "", entries: [:])
        }
        return s
    }

    private static func write(_ store: Store, sessionEmail: String) {
        if let data = try? JSONEncoder().encode(store) {
            UserDefaults.standard.set(data, forKey: key(sessionEmail: sessionEmail))
        }
    }

    static func syncRulesHash(_ rulesHash: String, sessionEmail: String) {
        var s = read(sessionEmail: sessionEmail)
        if s.rulesHash != rulesHash {
            s.rulesHash = rulesHash
            s.entries = [:]
            write(s, sessionEmail: sessionEmail)
        }
    }

    static func alreadyApplied(messageId: String, ruleId: String, actionFingerprint: String, rulesHash: String, sessionEmail: String) -> Bool {
        guard !messageId.isEmpty, !ruleId.isEmpty, !rulesHash.isEmpty else { return false }
        let s = read(sessionEmail: sessionEmail)
        guard s.rulesHash == rulesHash, let e = s.entries[messageId] else { return false }
        return e.ruleId == ruleId && e.actionFingerprint == actionFingerprint && e.rulesHash == rulesHash
    }

    static func record(messageId: String, ruleId: String, actionFingerprint: String, rulesHash: String, sessionEmail: String) {
        guard !messageId.isEmpty, !ruleId.isEmpty, !rulesHash.isEmpty else { return }
        var s = read(sessionEmail: sessionEmail)
        if s.rulesHash != rulesHash {
            s.rulesHash = rulesHash
            s.entries = [:]
        }
        s.entries[messageId] = Entry(ruleId: ruleId, actionFingerprint: actionFingerprint, rulesHash: rulesHash)
        write(s, sessionEmail: sessionEmail)
    }

    static func pruneMissing(messageIds: Set<String>, sessionEmail: String) {
        var s = read(sessionEmail: sessionEmail)
        s.entries = s.entries.filter { messageIds.contains($0.key) }
        write(s, sessionEmail: sessionEmail)
    }

    static func clear(sessionEmail: String) {
        UserDefaults.standard.removeObject(forKey: key(sessionEmail: sessionEmail))
    }
}
