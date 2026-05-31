import Foundation
import Observation

@MainActor
@Observable
final class AppModel {
    private let client: APIClient
    private let auth: AuthService
    private let mail: MailService
    private let keyVault = ElvishKeyVault()

    /// Password from the last successful credential step; cleared after mail key unlock attempt.
    private var pendingVaultPassword: String?

    init() {
        let c = APIClient()
        client = c
        auth = AuthService(client: c)
        mail = MailService(client: c)
    }

    var mailDomain: String = ""
    /// Cap widget API URL from signup-config when login captcha is enabled (native WebView loads `/auth/cap-embed.html`).
    var authCapWidgetEndpoint: String?
    var currentUser: AuthUserDTO?
    var inboxRows: [MailInboxRow] = []
    /// Sidebar: from `GET /api/v1/mailbox/folders` (or placeholders if the request fails).
    var mailFolders: [MailFolderDTO] = []
    /// Lowercased folder name matching `MailFolderDTO.id` / API `folder` query.
    var selectedMailboxFolder: String = "inbox"
    /// Synced from `GET /api/v1/filters` (JSON only; evaluation is client-side).
    private(set) var mailFilters: [MailFilterRuleDTO] = []
    /// Mirrored from `keyVault.isUnlocked` so `@Observable` invalidates views; the vault itself is not observable.
    private(set) var mailKeysUnlocked = false
    var lastError: String?
    var isBusy = false

    /// When non-nil, UI shows MFA step.
    var mfaChallenge: (challengeId: String, methods: [String], user: AuthUserDTO?)?

    func bootstrap() async {
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            let cfg = try await auth.fetchAuthSignupConfig()
            mailDomain = cfg.mailDomain
            if let cap = cfg.cap, cap.enabled == true,
               let ep = cap.widgetApiEndpoint?.trimmingCharacters(in: .whitespacesAndNewlines), !ep.isEmpty
            {
                authCapWidgetEndpoint = ep
            } else {
                authCapWidgetEndpoint = nil
            }
            let sessionUser = try await auth.fetchMe()
            if let user = sessionUser {
                pendingVaultPassword = nil
                _ = await keyVault.restoreFromKeychainIfPossible(client: client, sessionEmail: user.email)
                syncMailKeysUnlockedFromVault()
                currentUser = user
                await refreshFolders()
                await loadMailFilters()
                await refreshMailbox()
            } else {
                currentUser = nil
                syncMailKeysUnlockedFromVault()
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func login(username: String, password: String, capToken: String) async {
        isBusy = true
        lastError = nil
        mfaChallenge = nil
        defer { isBusy = false }
        let u = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let trimmedCap = capToken.trimmingCharacters(in: .whitespacesAndNewlines)
        let capTok: String? = authCapWidgetEndpoint == nil ? nil : (trimmedCap.isEmpty ? nil : trimmedCap)
        do {
            switch try await auth.loginSRP(username: u, password: password, capToken: capTok) {
            case let .loggedIn(user):
                pendingVaultPassword = password
                currentUser = user
                await unlockMailKeysAndRefreshInbox(sessionEmail: user.email)
            case let .mfa(challengeId, methods, user):
                pendingVaultPassword = password
                mfaChallenge = (challengeId, methods, user)
            }
        } catch {
            lastError = error.localizedDescription
        }
    }

    func submitMFACode(_ code: String, useRecovery: Bool) async {
        guard let ch = mfaChallenge else { return }
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            let user: AuthUserDTO
            if useRecovery {
                user = try await auth.completeMFARecovery(challengeId: ch.challengeId, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
            } else {
                user = try await auth.completeMFATOTP(challengeId: ch.challengeId, code: code.trimmingCharacters(in: .whitespacesAndNewlines))
            }
            mfaChallenge = nil
            currentUser = user
            await unlockMailKeysAndRefreshInbox(sessionEmail: user.email)
        } catch {
            lastError = error.localizedDescription
        }
    }

    func cancelMFA() {
        mfaChallenge = nil
        pendingVaultPassword = nil
    }

    func logout() async {
        isBusy = true
        lastError = nil
        defer { isBusy = false }
        do {
            let sessionEmail = currentUser?.email
            try await auth.logout()
            if let sessionEmail {
                KeyVaultKeychain.delete(sessionEmail: sessionEmail)
                MailFilterLedger.clear(sessionEmail: sessionEmail)
            }
            currentUser = nil
            inboxRows = []
            mailFolders = []
            mailFilters = []
            selectedMailboxFolder = "inbox"
            mfaChallenge = nil
            pendingVaultPassword = nil
            keyVault.zero()
            syncMailKeysUnlockedFromVault()
        } catch {
            lastError = error.localizedDescription
        }
    }

    /// Reloads folder counts then the message list for `selectedMailboxFolder`.
    func refreshMailData() async {
        await refreshFolders()
        await loadMailFilters()
        await refreshMailbox()
    }

    func refreshFolders() async {
        do {
            let r = try await mail.listFolders()
            mailFolders = r.folders
            let names = Set(r.folders.map { $0.name.lowercased() })
            if !names.contains(selectedMailboxFolder) {
                selectedMailboxFolder = "inbox"
            }
        } catch {
            if mailFolders.isEmpty {
                mailFolders = MailFolderDTO.standardPlaceholders
            }
            lastError = error.localizedDescription
        }
    }

    func refreshMailbox() async {
        do {
            let r = try await mail.messages(folder: selectedMailboxFolder)
            inboxRows = buildInboxRows(from: r.messages)
            await applyInboxClientFiltersIfNeeded()
        } catch {
            inboxRows = []
            lastError = error.localizedDescription
        }
    }

    private func loadMailFilters() async {
        do {
            let res = try await mail.listFilters()
            mailFilters = res.filters
        } catch {
            mailFilters = []
        }
    }

    /// Runs client-side rules against inbox rows (same semantics as web `mail-filter-engine.js`).
    private func applyInboxClientFiltersIfNeeded() async {
        guard selectedMailboxFolder == "inbox", mailKeysUnlocked, let email = currentUser?.email else { return }
        let rules = MailFilterEngine.normalizeRules(mailFilters)
        let rulesHash = MailFilterEngine.stableRulesHash(rules: rules)
        MailFilterLedger.syncRulesHash(rulesHash, sessionEmail: email)
        let idSet = Set(inboxRows.map(\.id))
        MailFilterLedger.pruneMissing(messageIds: idSet, sessionEmail: email)

        var didAny = false
        for row in inboxRows {
            let ctx = MailFilterEngine.buildContext(row: row, bodyText: nil)
            guard let hit = MailFilterEngine.pickFirstMatchingRule(rules: rules, ctx: ctx) else { continue }
            let acts = MailFilterEngine.filterSupportedActions(hit.actions)
            guard !acts.isEmpty else { continue }
            let fp = MailFilterEngine.actionFingerprint(hit.actions)
            if MailFilterLedger.alreadyApplied(
                messageId: row.id,
                ruleId: hit.id,
                actionFingerprint: fp,
                rulesHash: rulesHash,
                sessionEmail: email
            ) {
                continue
            }
            do {
                try await MailFilterEngine.applyActions(messageId: row.id, actions: hit.actions, mail: mail)
                MailFilterLedger.record(
                    messageId: row.id,
                    ruleId: hit.id,
                    actionFingerprint: fp,
                    rulesHash: rulesHash,
                    sessionEmail: email
                )
                didAny = true
            } catch {
                break
            }
        }
        if didAny {
            await refreshFolders()
            await refreshMailboxWithoutFilterPass()
        }
    }

    private func refreshMailboxWithoutFilterPass() async {
        do {
            let r = try await mail.messages(folder: selectedMailboxFolder)
            inboxRows = buildInboxRows(from: r.messages)
        } catch {
            inboxRows = []
            lastError = error.localizedDescription
        }
    }

    /// Moves a message to another folder (server-side mailbox), then refreshes counts and the current list.
    func moveMessage(id: String, toFolder folder: String) async {
        isBusy = true
        defer { isBusy = false }
        do {
            try await mail.moveMessage(id: id, toFolder: folder)
            await refreshMailData()
        } catch {
            lastError = error.localizedDescription
        }
    }

    private func unlockMailKeysAndRefreshInbox(sessionEmail: String?) async {
        defer { pendingVaultPassword = nil }
        await refreshFolders()
        guard let pw = pendingVaultPassword else {
            await loadMailFilters()
            await refreshMailbox()
            syncMailKeysUnlockedFromVault()
            return
        }
        do {
            try await keyVault.unlock(client: client, password: pw, sessionEmail: sessionEmail)
        } catch {
            lastError = error.localizedDescription
        }
        syncMailKeysUnlockedFromVault()
        await loadMailFilters()
        await refreshMailbox()
    }

    private func syncMailKeysUnlockedFromVault() {
        mailKeysUnlocked = keyVault.isUnlocked
    }

    private func buildInboxRows(from manifests: [MailManifestRow]) -> [MailInboxRow] {
        manifests.map { m in
            var subject = m.subject.flatMap { $0.isEmpty ? nil : $0 }
            var fromAddr = m.fromAddr.flatMap { $0.isEmpty ? nil : $0 }
            var toAddrs = m.toAddrs
            var decrypted = false
            if let b64 = m.headerCiphertextB64, !b64.isEmpty, keyVault.isUnlocked {
                if let stub = try? keyVault.decryptMailHeader(headerCiphertextB64: b64) {
                    if let s = stub.subject, !s.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        subject = subject ?? s
                    }
                    if let f = stub.from, !f.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                        fromAddr = fromAddr ?? f
                    }
                    if let t = stub.to, !t.isEmpty {
                        toAddrs = (toAddrs?.isEmpty == false) ? toAddrs : t
                    }
                    decrypted = true
                }
            }
            let hasCipher = !(m.headerCiphertextB64 ?? "").isEmpty
            let hasAtt = m.hasAttachments ?? false
            return MailInboxRow(
                id: m.id,
                subject: subject,
                fromAddr: fromAddr,
                toAddrs: toAddrs,
                receivedAt: m.receivedAt,
                read: m.read,
                headerDecrypted: decrypted,
                hasHeaderCiphertext: hasCipher,
                hasAttachments: hasAtt
            )
        }
    }

    func loadDecryptedBody(messageId: String) async throws -> String {
        let blob = try await mail.messageBlob(id: messageId)
        return try keyVault.decryptMessageBody(ciphertext: blob)
    }

    func markMessageRead(id: String) async {
        do {
            try await mail.setMessageRead(id: id, read: true)
            await refreshMailbox()
        } catch {
            // Best-effort: unread badge is non-critical if PATCH fails.
        }
    }

    func markMessageUnread(id: String) async {
        do {
            try await mail.setMessageRead(id: id, read: false)
            await refreshMailbox()
        } catch {
            lastError = error.localizedDescription
        }
    }
}
