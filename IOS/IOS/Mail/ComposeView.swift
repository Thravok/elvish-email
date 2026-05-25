import SwiftUI

/// Compose sheet: PGP direct + protected link (parity with `static/mail/compose.jsx`).
struct ComposeView: View {
    @Bindable var model: AppModel
    @Environment(\.dismiss) private var dismiss

    enum SendMode: String, CaseIterable {
        case pgp = "PGP Direct"
        case link = "Protected link"
    }

    @State private var mode: SendMode = .pgp
    @State private var from: String = ""
    @State private var to: String = ""
    @State private var cc: String = ""
    @State private var bcc: String = ""
    @State private var subject: String = ""
    @State private var bodyText: String = ""
    @State private var recipientArmored: String = ""
    @State private var keyStatus: String = "idle"
    @State private var keyError: String = ""
    @State private var lookupBusy = false
    @State private var linkPassword: String = ""
    @State private var linkPasswordConfirm: String = ""
    @State private var ttlSeconds: Int64 = 7 * 24 * 60 * 60
    @State private var maxViews: Int64 = 0
    @State private var notifyRecipients = true
    @State private var linkResultURL: String?
    @State private var sendError: String = ""
    @State private var sending = false

    var body: some View {
        NavigationStack {
            Form {
                if !model.mailKeysUnlocked {
                    Section {
                        Text("Mail keys are locked. Sign out and sign in again with your password.")
                            .foregroundStyle(.secondary)
                    }
                }
                Section {
                    Picker("Mode", selection: $mode) {
                        ForEach(SendMode.allCases, id: \.self) { m in
                            Text(m.rawValue).tag(m)
                        }
                    }
                    .pickerStyle(.segmented)
                }
                Section("From") {
                    Picker("Identity", selection: $from) {
                        ForEach(fromOptions, id: \.self) { e in
                            Text(e).tag(e)
                        }
                    }
                }
                Section("Recipients") {
                    TextField("To", text: $to)
                        .textContentType(.emailAddress)
                        .autocapitalization(.none)
                        .onChange(of: to) { _, _ in
                            if mode == .pgp { scheduleKeyLookup() }
                        }
                    if mode == .pgp {
                        TextField("Cc (headers only)", text: $cc)
                            .autocapitalization(.none)
                        TextField("Bcc (headers only)", text: $bcc)
                            .autocapitalization(.none)
                        if lookupBusy {
                            ProgressView("Looking up key…")
                        } else {
                            Text(keyStatusLabel)
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        if !keyError.isEmpty {
                            Text(keyError).font(.caption).foregroundStyle(.red)
                        }
                        TextField("Or paste armored public key", text: $recipientArmored, axis: .vertical)
                            .lineLimit(3 ... 8)
                            .font(.system(.caption, design: .monospaced))
                    } else {
                        TextField("Cc", text: $cc).autocapitalization(.none)
                    }
                }
                Section("Message") {
                    TextField("Subject", text: $subject)
                    TextField("Body", text: $bodyText, axis: .vertical)
                        .lineLimit(6 ... 16)
                }
                if mode == .link {
                    Section("Protected link") {
                        SecureField("Password (min 12)", text: $linkPassword)
                        SecureField("Confirm password", text: $linkPasswordConfirm)
                        Picker("Expires", selection: $ttlSeconds) {
                            Text("1 hour").tag(Int64(3600))
                            Text("24 hours").tag(Int64(86400))
                            Text("7 days").tag(Int64(7 * 24 * 3600))
                            Text("30 days").tag(Int64(30 * 24 * 3600))
                        }
                        Picker("Max views", selection: $maxViews) {
                            Text("Unlimited").tag(Int64(0))
                            Text("1 (burn after read)").tag(Int64(1))
                            Text("5").tag(Int64(5))
                            Text("10").tag(Int64(10))
                        }
                        Toggle("Notify recipients by email", isOn: $notifyRecipients)
                    }
                }
                if let url = linkResultURL {
                    Section("Link created") {
                        Text(url)
                            .font(.system(.caption, design: .monospaced))
                            .textSelection(.enabled)
                        ShareLink(item: url) {
                            Label("Share link", systemImage: "square.and.arrow.up")
                        }
                    }
                }
                if !sendError.isEmpty {
                    Section {
                        Text(sendError).foregroundStyle(.red)
                    }
                }
            }
            .navigationTitle("Compose")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Send") { Task { await send() } }
                        .disabled(sending || !model.mailKeysUnlocked)
                }
            }
            .onAppear { bootstrapFrom() }
        }
    }

    private var fromOptions: [String] {
        let rows = model.mailIdentities
        if !rows.isEmpty {
            return rows.map(\.email)
        }
        if let e = model.currentUser?.email { return [e] }
        return []
    }

    private var keyStatusLabel: String {
        switch keyStatus {
        case "checking": return "Checking for recipient key…"
        case "found": return "Recipient key found"
        case "missing": return "No key found — paste a public key"
        case "manual": return "Using pasted public key"
        default: return ""
        }
    }

    private func bootstrapFrom() {
        if from.isEmpty, let def = model.mailIdentities.first(where: { $0.isDefault == true })?.email {
            from = def
        } else if from.isEmpty, let first = fromOptions.first {
            from = first
        }
    }

    private func scheduleKeyLookup() {
        keyError = ""
        Task {
            try? await Task.sleep(nanoseconds: 350_000_000)
            await lookupKey()
        }
    }

    private func lookupKey() async {
        let recipients = MailComposeMime.splitAddressList(to)
            .map { MailComposeMime.canonicalEmailToken($0) }
            .filter { !$0.isEmpty }
        guard recipients.count == 1 else {
            keyStatus = recipients.count > 1 ? "needs-single" : "idle"
            return
        }
        lookupBusy = true
        keyStatus = "checking"
        defer { lookupBusy = false }
        do {
            if let hit = try await model.composeService.resolveRecipientKey(email: recipients[0]),
               let arm = hit.armoredPublic, !arm.isEmpty
            {
                recipientArmored = arm
                keyStatus = "found"
            } else if !recipientArmored.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                keyStatus = "manual"
            } else {
                keyStatus = "missing"
            }
        } catch {
            keyError = error.localizedDescription
            keyStatus = "missing"
        }
    }

    private func send() async {
        sendError = ""
        sending = true
        defer { sending = false }
        do {
            if mode == .pgp {
                try await sendPgp()
            } else {
                try await sendLink()
            }
        } catch {
            sendError = error.localizedDescription
        }
    }

    private func sendPgp() async throws {
        let recipients = MailComposeMime.splitAddressList(to)
            .map { MailComposeMime.canonicalEmailToken($0) }
            .filter { !$0.isEmpty }
        guard recipients.count == 1 else {
            throw ComposeValidationError.message("PGP direct requires exactly one To address")
        }
        let recipient = recipients[0]
        let armored = recipientArmored.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !armored.isEmpty else {
            throw ComposeValidationError.message("Recipient public key required")
        }
        guard let sender = model.mailIdentities.first(where: { $0.email == from }),
              let senderPub = sender.armoredPublic, !senderPub.isEmpty,
              let senderFp = sender.fingerprint, !senderFp.isEmpty
        else {
            throw ComposeValidationError.message("Sender identity unavailable")
        }
        let hit = try await model.composeService.resolveRecipientKey(email: recipient)
        let localDelivery = hit?.source == "local" && hit?.email?.lowercased() == recipient
        let routeArmored = armored
        let ccList = MailComposeMime.splitAddressList(cc)
        let bccList = MailComposeMime.splitAddressList(bcc)
        let result = try await model.composeService.sendPgpDirect(
            from: from,
            recipient: recipient,
            subject: subject,
            body: bodyText,
            recipientArmored: routeArmored,
            senderArmored: senderPub,
            senderFingerprint: senderFp,
            localDelivery: localDelivery,
            cc: ccList,
            bcc: bccList
        )
        model.selectedMailboxFolder = "sent"
        await model.refreshMailData()
        if result.localDelivery {
            dismiss()
        } else {
            sendError = "Queued for delivery (outbox \(result.outboxId?.prefix(8) ?? ""))"
            try? await Task.sleep(nanoseconds: 1_500_000_000)
            dismiss()
        }
    }

    private func sendLink() async throws {
        guard linkPassword.count >= 12 else {
            throw ProtectedLinkError.passwordTooShort
        }
        guard linkPassword == linkPasswordConfirm else {
            throw ComposeValidationError.message("Passwords do not match")
        }
        let res = try await model.composeService.sendProtectedLink(
            from: from,
            to: to,
            cc: cc,
            subject: subject,
            body: bodyText,
            password: linkPassword,
            ttlSeconds: ttlSeconds,
            maxViews: maxViews,
            notify: notifyRecipients
        )
        linkResultURL = res.url
    }
}

enum ComposeValidationError: LocalizedError {
    case message(String)
    var errorDescription: String? {
        switch self {
        case let .message(s): return s
        }
    }
}
