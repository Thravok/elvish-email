import SwiftUI

struct MessageDetailView: View {
    @Bindable var model: AppModel
    let row: MailInboxRow

    @State private var rawDecrypted = ""
    @State private var presented: MailPresentedMessage?
    @State private var loadError: String?
    @State private var isLoading = true
    @State private var showCompose = false
    @State private var composeDraft: ComposeDraft?

    var body: some View {
        Group {
            if isLoading {
                ProgressView("Decrypting…")
            } else if let err = loadError {
                Text(err)
                    .foregroundStyle(.red)
                    .multilineTextAlignment(.center)
                    .padding()
            } else {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        headerBlock
                        Divider()
                        bodyBlock
                        if let atts = presented?.attachments, !atts.isEmpty {
                            Divider()
                            attachmentsBlock(atts)
                        }
                        if showRawFallback {
                            Divider()
                            DisclosureGroup("Show raw message") {
                                Text(rawDecrypted)
                                    .font(.system(.footnote, design: .monospaced))
                                    .textSelection(.enabled)
                            }
                            .foregroundStyle(.secondary)
                        }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding()
                }
            }
        }
        .navigationTitle(navigationTitle)
#if os(iOS)
        .navigationBarTitleDisplayMode(.inline)
#endif
        .toolbar {
            if model.mailKeysUnlocked {
                ToolbarItemGroup(placement: .primaryAction) {
                    Button("Reply") { openCompose(replyAll: false) }
                    Button("Reply All") { openCompose(replyAll: true) }
                }
            }
            if row.read == true {
#if os(macOS)
                ToolbarItem(placement: .automatic) {
                    Button("Mark unread") {
                        Task { await model.markMessageUnread(id: row.id) }
                    }
                }
#else
                ToolbarItem(placement: .secondaryAction) {
                    Button("Mark unread") {
                        Task { await model.markMessageUnread(id: row.id) }
                    }
                }
#endif
            }
        }
        .sheet(isPresented: $showCompose) {
            ComposeView(model: model, initialDraft: composeDraft)
        }
        .task {
            if row.read != true {
                await model.markMessageRead(id: row.id)
            }
            await loadBody()
        }
    }

    private var navigationTitle: String {
        let parsed = (presented?.subject ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !parsed.isEmpty { return parsed }
        if let s = row.subject, !s.isEmpty { return s }
        return "Message"
    }

    private var displaySubject: String {
        let parsed = (presented?.subject ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if !parsed.isEmpty { return parsed }
        if let s = row.subject, !s.isEmpty { return s }
        return "Message"
    }

    @ViewBuilder
    private var headerBlock: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(displaySubject)
                .font(.title2.weight(.semibold))
                .fixedSize(horizontal: false, vertical: true)
            if let p = presented {
                if !p.from.isEmpty {
                    labeled("From", p.from)
                }
                if !p.to.isEmpty {
                    labeled("To", p.to)
                }
                if !p.cc.isEmpty {
                    labeled("Cc", p.cc)
                }
                if !p.date.isEmpty {
                    labeled("Date", p.date)
                }
            } else if let from = row.fromAddr, !from.isEmpty {
                labeled("From", from)
            }
        }
    }

    private func labeled(_ title: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(title)
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.subheadline)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    @ViewBuilder
    private var bodyBlock: some View {
        let body = (presented?.body ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if body.isEmpty {
            Text("No displayable body was found in this message.")
                .foregroundStyle(.secondary)
                .font(.subheadline)
        } else {
            Text(body)
                .font(.body)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var showRawFallback: Bool {
        let body = (presented?.body ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        return body.isEmpty && rawDecrypted.count > 200
    }

    private func attachmentsBlock(_ atts: [MailAttachmentPreview]) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Attachments")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.secondary)
            ForEach(atts) { a in
                HStack {
                    Image(systemName: "doc.fill")
                        .foregroundStyle(.tertiary)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(a.fileName)
                            .font(.subheadline.weight(.medium))
                        Text("\(a.contentType) · \(MailMIMEParser.formatAttachmentBytes(a.byteCount))")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func openCompose(replyAll: Bool) {
        let src: ReplyMessageSource
        if let p = presented {
            src = ReplyMessageSource.fromPresented(p, row: row)
        } else {
            src = ReplyMessageSource.fromInboxRow(row)
        }
        let account = model.currentUser?.email ?? ""
        composeDraft = MailReplyDraft.buildReplyComposeDraft(
            message: src,
            identities: model.mailIdentities,
            accountEmail: account,
            replyAll: replyAll
        )
        showCompose = true
    }

    private func loadBody() async {
        isLoading = true
        loadError = nil
        presented = nil
        rawDecrypted = ""
        defer { isLoading = false }
        do {
            let raw = try await model.loadDecryptedBody(messageId: row.id)
            rawDecrypted = raw
            presented = MailMIMEParser.present(decrypted: raw)
        } catch {
            loadError = error.localizedDescription
        }
    }
}
