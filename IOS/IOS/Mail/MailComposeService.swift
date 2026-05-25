import Foundation

/// Orchestrates compose/send (parity with `static/mail/compose.jsx`).
@MainActor
struct MailComposeService {
    let mail: MailService
    let vault: ElvishKeyVault

    struct PgpSendResult: Sendable {
        let localDelivery: Bool
        let messageId: String?
        let outboxId: String?
    }

    func sendPgpDirect(
        from: String,
        recipient: String,
        subject: String,
        body: String,
        recipientArmored: String,
        senderArmored: String,
        senderFingerprint: String,
        localDelivery: Bool,
        cc: [String] = [],
        bcc: [String] = [],
        inReplyTo: String = "",
        references: String = ""
    ) async throws -> PgpSendResult {
        guard vault.isUnlocked else { throw KeyVaultError.vaultLocked }
        let recipients = [recipient]
        let headerPayload = try MailComposeMime.buildHeaderStub(
            from: from,
            to: recipients,
            cc: cc.map { MailComposeMime.canonicalEmailToken($0) }.filter { !$0.isEmpty },
            bcc: bcc.map { MailComposeMime.canonicalEmailToken($0) }.filter { !$0.isEmpty },
            subject: subject,
            inReplyTo: inReplyTo,
            references: references
        )
        let rfc822 = try MailComposeMime.buildRFC5322(
            from: from,
            to: recipients,
            subject: subject,
            body: body,
            cc: cc,
            bcc: bcc,
            inReplyTo: inReplyTo,
            references: references
        )
        let armoredBody = try vault.encryptAndSignToRecipient(
            armoredRecipientPub: recipientArmored,
            plaintext: rfc822,
            signerFingerprint: senderFingerprint
        )
        let bodyB64 = Data(armoredBody.utf8).base64EncodedString()

        var senderHeaderB64 = ""
        var senderBodyB64 = ""
        if !senderArmored.isEmpty {
            let senderArmoredBody = try vault.encryptAndSignToRecipient(
                armoredRecipientPub: senderArmored,
                plaintext: rfc822,
                signerFingerprint: senderFingerprint
            )
            let enc = JSONEncoder()
            let headerJSON = try enc.encode(headerPayload)
            let headerCipher = try vault.encryptToRecipient(
                armoredRecipientPub: senderArmored,
                plaintext: String(data: headerJSON, encoding: .utf8) ?? "{}"
            )
            senderBodyB64 = Data(senderArmoredBody.utf8).base64EncodedString()
            senderHeaderB64 = Data(headerCipher.utf8).base64EncodedString()
        }

        if localDelivery {
            let headerCipher = try vault.encryptToRecipient(
                armoredRecipientPub: recipientArmored,
                plaintext: String(data: try JSONEncoder().encode(headerPayload), encoding: .utf8) ?? "{}"
            )
            let res = try await mail.postEncryptedMessage(
                recipient: recipient,
                headerCiphertextB64: Data(headerCipher.utf8).base64EncodedString(),
                bodyCiphertextB64: bodyB64,
                senderHeaderCiphertextB64: senderHeaderB64,
                senderBodyCiphertextB64: senderBodyB64,
                fromAddr: from,
                toAddrs: recipients
            )
            return PgpSendResult(localDelivery: true, messageId: res.id, outboxId: nil)
        }

        let outboundMIME = try MailComposeMime.buildPGPMIMEMessage(
            from: from,
            to: recipients,
            cc: cc,
            subject: subject,
            armoredCiphertext: armoredBody,
            inReplyTo: inReplyTo,
            references: references
        )
        let res = try await mail.postOutbox(
            payloadCiphertextB64: outboundMIME.base64EncodedString(),
            recipientSummary: recipients,
            senderHeaderCiphertextB64: senderHeaderB64,
            senderBodyCiphertextB64: senderBodyB64,
            fromAddr: from
        )
        return PgpSendResult(localDelivery: false, messageId: nil, outboxId: res.id)
    }

    func sendProtectedLink(
        from: String,
        to: String,
        cc: String,
        subject: String,
        body: String,
        password: String,
        ttlSeconds: Int64,
        maxViews: Int64,
        notify: Bool
    ) async throws -> ProtectedLinkCreateResponse {
        let payload = try ProtectedLinkCrypto.buildPayload(from: from, subject: subject, body: body, password: password)
        var seen = Set<String>()
        var recipients: [String] = []
        for disp in MailComposeMime.splitAddressList(to) + MailComposeMime.splitAddressList(cc) {
            let c = MailComposeMime.canonicalEmailToken(disp)
            guard !c.isEmpty, !seen.contains(c) else { continue }
            seen.insert(c)
            recipients.append(c)
        }
        return try await mail.createProtectedLink(
            subjectHint: subject,
            recipientEmails: recipients,
            notifyRecipients: notify,
            notifyFromAddr: from,
            ttlSeconds: ttlSeconds,
            maxViews: maxViews,
            kdf: payload.kdf,
            kdfSaltB64: payload.kdfSaltB64,
            kdfParamsJSON: payload.kdfParamsJSON,
            wrappedMsgKeyB64: payload.wrappedMsgKeyB64,
            bodyCiphertextB64: payload.bodyCiphertextB64
        )
    }

    func resolveRecipientKey(email: String) async throws -> KeyLookupHitDTO? {
        if let c = try await mail.getContactKey(email: email), let arm = c.armoredPublic, !arm.isEmpty {
            return c
        }
        return try await mail.lookupKey(email: email)
    }
}
