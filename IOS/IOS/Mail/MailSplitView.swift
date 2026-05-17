import SwiftUI

/// Mail shell: **iPad / regular width** uses a real `NavigationSplitView` (sidebar + messages).
/// **iPhone / compact** shows the message list first and opens mailboxes from the leading toolbar
/// (sheet), because a 2-column split otherwise stays stuck on the sidebar when rows are plain `Button`s.
struct MailSplitView: View {
    @Bindable var model: AppModel
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var showMailboxSheet = false

    private var isCompact: Bool {
#if os(macOS)
        false
#else
        horizontalSizeClass == .compact
#endif
    }

    var body: some View {
        Group {
            if isCompact {
                mailDetailNavigationStack(showMailboxToolbar: true)
                    .sheet(isPresented: $showMailboxSheet) {
                        mailboxPickerSheet
                    }
            } else {
                NavigationSplitView {
                    mailboxFolderList(afterSelect: {})
                        .navigationTitle("Mail")
#if os(macOS)
                        .navigationSplitViewColumnWidth(min: 200, ideal: 240, max: 320)
#endif
                } detail: {
                    mailDetailNavigationStack(showMailboxToolbar: false)
                }
                .navigationSplitViewStyle(.balanced)
            }
        }
    }

    private var detailTitle: String {
        model.mailFolders.first { $0.name.lowercased() == model.selectedMailboxFolder }?.displayTitle
            ?? model.selectedMailboxFolder.replacingOccurrences(of: "_", with: " ").capitalized
    }

    private var refreshButton: some View {
        Button {
            Task { await model.refreshMailData() }
        } label: {
            Image(systemName: "arrow.clockwise")
        }
        .disabled(model.isBusy)
    }

    private var mailboxMenuButton: some View {
        Button {
            showMailboxSheet = true
        } label: {
            Label("Mailboxes", systemImage: "sidebar.left")
        }
        .accessibilityLabel("Mailboxes")
    }

    /// Message list + refresh; on phone also gets the mailboxes menu button.
    private func mailDetailNavigationStack(showMailboxToolbar: Bool) -> some View {
        NavigationStack {
            MailMessageListView(model: model)
                .navigationTitle(detailTitle)
                .toolbar {
                    if showMailboxToolbar {
#if os(iOS)
                        ToolbarItem(placement: .topBarLeading) {
                            mailboxMenuButton
                        }
#else
                        ToolbarItem(placement: .automatic) {
                            mailboxMenuButton
                        }
#endif
                    }
#if os(iOS)
                    ToolbarItem(placement: .topBarTrailing) {
                        refreshButton
                    }
#else
                    ToolbarItem(placement: .automatic) {
                        refreshButton
                    }
#endif
                }
        }
        .task(id: model.selectedMailboxFolder) {
            await model.refreshMailbox()
        }
    }

    private var mailboxPickerSheet: some View {
        NavigationStack {
            mailboxFolderList {
                showMailboxSheet = false
            }
            .navigationTitle("Mailboxes")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Done") {
                        showMailboxSheet = false
                    }
                }
            }
        }
        .presentationDragIndicator(.visible)
    }

    /// Shared folder list for split sidebar and compact sheet.
    private func mailboxFolderList(afterSelect: @escaping () -> Void) -> some View {
        List {
            Section("Mailboxes") {
                ForEach(model.mailFolders) { folder in
                    let tag = folder.name.lowercased()
                    Button {
                        model.selectedMailboxFolder = tag
                        afterSelect()
                    } label: {
                        Label {
                            HStack {
                                Text(folder.displayTitle)
                                Spacer()
                                if folder.totalCount > 0 {
                                    Text("\(folder.totalCount)")
                                        .font(.subheadline.weight(.medium))
                                        .monospacedDigit()
                                        .foregroundStyle(.secondary)
                                }
                            }
                        } icon: {
                            Image(systemName: folder.symbolName)
                        }
                    }
                    .buttonStyle(.plain)
                    .foregroundStyle(.primary)
                    .listRowBackground(
                        tag == model.selectedMailboxFolder
                            ? Color.accentColor.opacity(0.14)
                            : Color.clear
                    )
                }
            }
        }
#if os(macOS)
        .listStyle(.sidebar)
#endif
        .refreshable { await model.refreshMailData() }
    }
}

// MARK: - Message list

struct MailMessageListView: View {
    @Bindable var model: AppModel

    var body: some View {
        Group {
            if model.inboxRows.isEmpty, model.lastError == nil {
                ContentUnavailableView(
                    "No messages",
                    systemImage: "tray",
                    description: Text("There is nothing in \(detailTitle) yet.")
                )
            } else {
                messageList
            }
        }
        .refreshable { await model.refreshMailData() }
    }

    private var detailTitle: String {
        model.mailFolders.first { $0.name.lowercased() == model.selectedMailboxFolder }?.displayTitle
            ?? model.selectedMailboxFolder
    }

    private var messageList: some View {
        List {
            if let err = model.lastError, model.inboxRows.isEmpty {
                Text(err)
                    .foregroundStyle(.secondary)
            }
            ForEach(model.inboxRows) { row in
                NavigationLink {
                    MessageDetailView(model: model, row: row)
                } label: {
                    messageRowLabel(row)
                }
                .opacity(row.read == true ? 0.65 : 1)
                .swipeActions(edge: .trailing, allowsFullSwipe: model.selectedMailboxFolder != "trash") {
                    if model.selectedMailboxFolder != "trash" {
                        Button(role: .destructive) {
                            Task { await model.moveMessage(id: row.id, toFolder: "trash") }
                        } label: {
                            Label("Trash", systemImage: "trash")
                        }
                    }
                }
                .swipeActions(edge: .leading, allowsFullSwipe: false) {
                    if model.selectedMailboxFolder == "inbox" {
                        Button {
                            Task { await model.moveMessage(id: row.id, toFolder: "archive") }
                        } label: {
                            Label("Archive", systemImage: "archivebox")
                        }
                        .tint(.indigo)
                    }
                    if model.selectedMailboxFolder == "trash" || model.selectedMailboxFolder == "archive" {
                        Button {
                            Task { await model.moveMessage(id: row.id, toFolder: "inbox") }
                        } label: {
                            Label("Inbox", systemImage: "tray")
                        }
                        .tint(.blue)
                    }
                }
            }
        }
    }

    @ViewBuilder
    private func messageRowLabel(_ row: MailInboxRow) -> some View {
        let secondary = secondaryLine(for: row).trimmingCharacters(in: .whitespacesAndNewlines)
        VStack(alignment: .leading, spacing: 4) {
            Text(displaySubject(for: row))
                .font(.headline)
            HStack {
                if !secondary.isEmpty {
                    Text(secondary)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                if let at = row.receivedAt {
                    Text(shortDate(at))
                        .font(.caption)
                        .foregroundStyle(.tertiary)
                }
            }
        }
    }

    private func secondaryLine(for row: MailInboxRow) -> String {
        let folder = model.selectedMailboxFolder.lowercased()
        if folder == "sent" || folder == "drafts" {
            if let line = toLine(from: row) { return line }
        }
        if let from = row.fromAddr, !from.isEmpty {
            return from
        }
        if row.hasHeaderCiphertext, !row.headerDecrypted {
            if model.mailKeysUnlocked {
                return "Sender metadata unavailable"
            }
            return "Sender hidden (unlock mail keys)"
        }
        return " "
    }

    private func toLine(from row: MailInboxRow) -> String? {
        guard let addrs = row.toAddrs, let first = addrs.first, !first.isEmpty else { return nil }
        if addrs.count == 1 { return first }
        return "\(first) + \(addrs.count - 1) more"
    }

    private func displaySubject(for row: MailInboxRow) -> String {
        if let s = row.subject, !s.isEmpty { return s }
        if row.headerDecrypted { return "(no subject)" }
        if row.hasHeaderCiphertext {
            if model.mailKeysUnlocked {
                return "(could not decrypt header)"
            }
            return "Encrypted message"
        }
        return "(no subject)"
    }

    private func shortDate(_ iso: String) -> String {
        iso.prefix(16).replacingOccurrences(of: "T", with: " ")
    }
}
