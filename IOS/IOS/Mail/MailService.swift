import Foundation

private nonisolated struct MessageReadPatch: Encodable, Sendable {
    let read: Bool
}

private nonisolated struct MessageFolderPatch: Encodable, Sendable {
    let folder: String
}

final class MailService: Sendable {
    private let client: APIClient

    init(client: APIClient) {
        self.client = client
    }

    func listFolders() async throws -> MailFoldersResponse {
        try await client.send(MailFoldersResponse.self, method: "GET", path: "/api/v1/mailbox/folders")
    }

    func messages(folder: String, limit: Int = 50) async throws -> MailListResponse {
        let f = folder.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        guard let encodedFolder = f.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) else {
            throw APIError.invalidURL
        }
        let path = "/api/v1/mail/messages?folder=\(encodedFolder)&limit=\(limit)"
        return try await client.send(MailListResponse.self, method: "GET", path: path)
    }

    /// Default mailbox listing (inbox).
    func inbox(limit: Int = 50) async throws -> MailListResponse {
        try await messages(folder: "inbox", limit: limit)
    }

    /// Raw PGP body bytes from object storage (`mail-manifest.js` `fetchBlob`).
    func messageBlob(id: String) async throws -> Data {
        let path = "/api/v1/mail/messages/\(id)/blob"
        let (data, http) = try await client.data(method: "GET", path: path, accept: "*/*")
        guard (200 ..< 300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8)
            throw APIError.httpStatus(http.statusCode, msg)
        }
        return data
    }

    func setMessageRead(id: String, read: Bool) async throws {
        try await client.sendExpectOK(
            method: "PATCH",
            path: "/api/v1/mail/messages/\(id)",
            body: MessageReadPatch(read: read)
        )
    }

    func moveMessage(id: String, toFolder folder: String) async throws {
        let f = folder.lowercased().trimmingCharacters(in: .whitespacesAndNewlines)
        try await client.sendExpectOK(
            method: "PATCH",
            path: "/api/v1/mail/messages/\(id)",
            body: MessageFolderPatch(folder: f)
        )
    }

    func deleteMessage(id: String, permanent: Bool = false) async throws {
        let enc = id.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? id
        var path = "/api/v1/mail/messages/\(enc)"
        if permanent {
            path += "?mode=permanent"
        }
        try await client.sendExpectOK(method: "DELETE", path: path)
    }

    func listFilters() async throws -> MailFiltersListResponse {
        try await client.send(MailFiltersListResponse.self, method: "GET", path: "/api/v1/filters")
    }
}
