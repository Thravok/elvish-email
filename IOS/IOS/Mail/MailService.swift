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

    func listIdentities() async throws -> IdentitiesListResponse {
        try await client.send(IdentitiesListResponse.self, method: "GET", path: "/api/v1/identities")
    }

    func lookupKey(email: String) async throws -> KeyLookupHitDTO? {
        let enc = email.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? email
        let path = "/api/v1/keys/lookup?email=\(enc)"
        let (data, http) = try await client.data(method: "GET", path: path)
        if http.statusCode == 404 { return nil }
        guard (200 ..< 300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8)
            throw APIError.httpStatus(http.statusCode, msg)
        }
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        return try dec.decode(KeyLookupHitDTO.self, from: data)
    }

    func getContactKey(email: String) async throws -> KeyLookupHitDTO? {
        let enc = email.addingPercentEncoding(withAllowedCharacters: .urlPathAllowed) ?? email
        let path = "/api/v1/keys/contacts/\(enc)"
        let (data, http) = try await client.data(method: "GET", path: path)
        if http.statusCode == 404 { return nil }
        guard (200 ..< 300).contains(http.statusCode) else {
            let msg = String(data: data, encoding: .utf8)
            throw APIError.httpStatus(http.statusCode, msg)
        }
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        return try dec.decode(KeyLookupHitDTO.self, from: data)
    }

    func postEncryptedMessage(
        recipient: String,
        headerCiphertextB64: String,
        bodyCiphertextB64: String,
        senderHeaderCiphertextB64: String,
        senderBodyCiphertextB64: String,
        fromAddr: String,
        toAddrs: [String]
    ) async throws -> PostEncryptedMessageResponse {
        struct Body: Encodable {
            let recipient: String
            let headerCiphertextB64: String
            let bodyCiphertextB64: String
            let senderHeaderCiphertextB64: String
            let senderBodyCiphertextB64: String
            let fromAddr: String
            let toAddrs: [String]
        }
        return try await client.send(
            PostEncryptedMessageResponse.self,
            method: "POST",
            path: "/api/v1/mail/messages",
            body: Body(
                recipient: recipient,
                headerCiphertextB64: headerCiphertextB64,
                bodyCiphertextB64: bodyCiphertextB64,
                senderHeaderCiphertextB64: senderHeaderCiphertextB64,
                senderBodyCiphertextB64: senderBodyCiphertextB64,
                fromAddr: fromAddr,
                toAddrs: toAddrs
            )
        )
    }

    func postOutbox(
        payloadCiphertextB64: String,
        recipientSummary: [String],
        senderHeaderCiphertextB64: String,
        senderBodyCiphertextB64: String,
        fromAddr: String
    ) async throws -> PostOutboxResponse {
        struct Body: Encodable {
            let payloadCiphertextB64: String
            let recipientSummary: [String]
            let senderHeaderCiphertextB64: String
            let senderBodyCiphertextB64: String
            let fromAddr: String
        }
        return try await client.send(
            PostOutboxResponse.self,
            method: "POST",
            path: "/api/v1/mail/outbox",
            body: Body(
                payloadCiphertextB64: payloadCiphertextB64,
                recipientSummary: recipientSummary,
                senderHeaderCiphertextB64: senderHeaderCiphertextB64,
                senderBodyCiphertextB64: senderBodyCiphertextB64,
                fromAddr: fromAddr
            )
        )
    }

    func createProtectedLink(
        subjectHint: String,
        recipientEmails: [String],
        notifyRecipients: Bool,
        notifyFromAddr: String,
        ttlSeconds: Int64,
        maxViews: Int64,
        kdf: String,
        kdfSaltB64: String,
        kdfParamsJSON: String,
        wrappedMsgKeyB64: String,
        bodyCiphertextB64: String
    ) async throws -> ProtectedLinkCreateResponse {
        struct Body: Encodable {
            let subjectHint: String
            let recipientEmails: [String]
            let notifyRecipients: Bool
            let notifyFromAddr: String
            let ttlSeconds: Int64
            let maxViews: Int64
            let kdf: String
            let kdfSaltB64: String
            let kdfParamsJSON: String
            let wrappedMsgKeyB64: String
            let bodyCiphertextB64: String
        }
        return try await client.send(
            ProtectedLinkCreateResponse.self,
            method: "POST",
            path: "/api/v1/mail/protected-links",
            body: Body(
                subjectHint: subjectHint,
                recipientEmails: recipientEmails,
                notifyRecipients: notifyRecipients,
                notifyFromAddr: notifyFromAddr,
                ttlSeconds: ttlSeconds,
                maxViews: maxViews,
                kdf: kdf,
                kdfSaltB64: kdfSaltB64,
                kdfParamsJSON: kdfParamsJSON,
                wrappedMsgKeyB64: wrappedMsgKeyB64,
                bodyCiphertextB64: bodyCiphertextB64
            )
        )
    }
}
