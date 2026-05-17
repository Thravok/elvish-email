import Foundation

/// One row from `GET /api/v1/mailbox/folders`.
nonisolated struct MailFolderDTO: Decodable, Sendable, Identifiable, Hashable {
    let name: String
    let total: Int64?
    let unread: Int64?
    let isStandard: Bool?
    let createdAt: String?

    var id: String { name.lowercased() }

    var totalCount: Int { max(0, Int(total ?? 0)) }

    var unreadCount: Int { max(0, Int(unread ?? 0)) }

    /// Sidebar title (standard folders localized; custom folders as-is).
    var displayTitle: String {
        switch name.lowercased() {
        case "inbox": return "Inbox"
        case "sent": return "Sent"
        case "drafts": return "Drafts"
        case "trash": return "Trash"
        case "archive": return "Archive"
        default: return name
        }
    }

    var symbolName: String {
        switch name.lowercased() {
        case "inbox": return "tray.fill"
        case "sent": return "paperplane.fill"
        case "drafts": return "doc.text.fill"
        case "trash": return "trash.fill"
        case "archive": return "archivebox.fill"
        default: return "folder.fill"
        }
    }

    /// Placeholder rows when the folder API is unavailable so the sidebar still works.
    nonisolated static let standardPlaceholders: [MailFolderDTO] = [
        MailFolderDTO(name: "inbox", total: 0, unread: nil, isStandard: true, createdAt: nil),
        MailFolderDTO(name: "sent", total: 0, unread: nil, isStandard: true, createdAt: nil),
        MailFolderDTO(name: "drafts", total: 0, unread: nil, isStandard: true, createdAt: nil),
        MailFolderDTO(name: "trash", total: 0, unread: nil, isStandard: true, createdAt: nil),
        MailFolderDTO(name: "archive", total: 0, unread: nil, isStandard: true, createdAt: nil),
    ]
}

nonisolated struct MailFoldersResponse: Decodable, Sendable {
    let folders: [MailFolderDTO]
}

nonisolated struct MailListResponse: Decodable, Sendable {
    let messages: [MailManifestRow]
    let consent: [String: Bool]?
}

nonisolated struct MailManifestRow: Decodable, Identifiable, Sendable {
    let id: String
    let folder: String?
    let receivedAt: String?
    let read: Bool?
    let subject: String?
    let fromAddr: String?
    let toAddrs: [String]?
    let headerCiphertextB64: String?
    let hasAttachments: Bool?
}

/// One inbox row after optional client-side header decryption.
nonisolated struct MailInboxRow: Identifiable, Sendable, Equatable {
    let id: String
    let subject: String?
    let fromAddr: String?
    let toAddrs: [String]?
    let receivedAt: String?
    let read: Bool?
    let headerDecrypted: Bool
    let hasHeaderCiphertext: Bool
    let hasAttachments: Bool
}
