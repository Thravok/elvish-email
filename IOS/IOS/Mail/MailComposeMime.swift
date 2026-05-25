import Foundation

/// RFC5322 + PGP/MIME builders for compose (parity with `static/mail/compose.jsx`).
enum MailComposeMime {
    struct HeaderStub: Encodable, Sendable {
        var subject: String
        var from: String
        var to: [String]
        var cc: [String]?
        var bcc: [String]?
        var inReplyTo: String?
        var references: String?

        enum CodingKeys: String, CodingKey {
            case subject, from, to, cc, bcc
            case inReplyTo = "in_reply_to"
            case references
        }
    }

    static func rejectHeaderInjection(_ value: String, label: String) throws -> String {
        let s = value
        if s.contains("\r") || s.contains("\n") || s.contains("\u{0}") {
            throw MailComposeError.headerInjection(label)
        }
        return s
    }

    private static func sanitizeAddressList(_ addrs: [String], label: String) throws -> [String] {
        var out: [String] = []
        for addr in addrs where !addr.isEmpty {
            out.append(try rejectHeaderInjection(addr, label: label))
        }
        return out
    }

    static func splitAddressList(_ value: String) -> [String] {
        let raw = value.replacingOccurrences(of: "\r\n", with: "\n").replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        guard !raw.isEmpty else { return [] }
        var depth = 0
        var cur = ""
        var parts: [String] = []
        for ch in raw {
            if ch == "<" { depth += 1 }
            else if ch == ">" { depth = max(0, depth - 1) }
            if (ch == "," || ch == ";") && depth == 0 {
                let t = cur.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
                if !t.isEmpty { parts.append(t) }
                cur = ""
                continue
            }
            cur.append(ch)
        }
        let t = cur.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression).trimmingCharacters(in: .whitespacesAndNewlines)
        if !t.isEmpty { parts.append(t) }
        return parts
    }

    static func canonicalEmailToken(_ display: String) -> String {
        let raw = display.trimmingCharacters(in: .whitespacesAndNewlines)
        if raw.isEmpty { return "" }
        if let r = raw.range(of: #"<([^<>\s@]+@[^<>\s@]+)>"#, options: .regularExpression) {
            let inner = String(raw[r]).trimmingCharacters(in: CharacterSet(charactersIn: "<>"))
            return inner.lowercased()
        }
        if let r = raw.range(of: #"([A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})"#, options: [.regularExpression, .caseInsensitive]) {
            return String(raw[r]).lowercased()
        }
        return raw.lowercased()
    }

    static func buildHeaderStub(
        from: String,
        to: [String],
        cc: [String],
        bcc: [String],
        subject: String,
        inReplyTo: String = "",
        references: String = ""
    ) throws -> HeaderStub {
        var stub = HeaderStub(
            subject: subject,
            from: from,
            to: to,
            cc: cc.isEmpty ? nil : cc,
            bcc: bcc.isEmpty ? nil : bcc
        )
        let irt = inReplyTo.trimmingCharacters(in: .whitespacesAndNewlines)
        let refs = references.trimmingCharacters(in: .whitespacesAndNewlines)
        if !irt.isEmpty { stub.inReplyTo = irt }
        if !refs.isEmpty { stub.references = refs }
        return stub
    }

    static func buildRFC5322(
        from: String,
        to: [String],
        subject: String,
        body: String,
        cc: [String] = [],
        bcc: [String] = [],
        inReplyTo: String = "",
        references: String = ""
    ) throws -> Data {
        let safeFrom = try rejectHeaderInjection(from.isEmpty ? "anonymous" : from, label: "From")
        let safeSubject = try rejectHeaderInjection(subject.isEmpty ? "(no subject)" : subject, label: "Subject")
        let safeTo = try sanitizeAddressList(to, label: "To")
        let ccJoin = try sanitizeAddressList(cc, label: "Cc").joined(separator: ", ")
        let bccJoin = try sanitizeAddressList(bcc, label: "Bcc").joined(separator: ", ")
        let irt = try rejectHeaderInjection(inReplyTo.trimmingCharacters(in: .whitespacesAndNewlines), label: "In-Reply-To")
        let refs = try rejectHeaderInjection(references.trimmingCharacters(in: .whitespacesAndNewlines), label: "References")

        var lines: [String] = []
        lines.append("Date: \(rfc822Date())")
        lines.append("From: \(safeFrom)")
        lines.append("To: \(safeTo.joined(separator: ", "))")
        if !ccJoin.isEmpty { lines.append("Cc: \(ccJoin)") }
        if !bccJoin.isEmpty { lines.append("Bcc: \(bccJoin)") }
        lines.append("Subject: \(safeSubject)")
        if !irt.isEmpty { lines.append("In-Reply-To: \(irt)") }
        if !refs.isEmpty { lines.append("References: \(refs)") }
        lines.append("Content-Type: text/plain; charset=\"utf-8\"; protected-headers=\"v1\"")
        lines.append("Content-Transfer-Encoding: 8bit")
        lines.append("MIME-Version: 1.0")
        lines.append("")
        lines.append(body)
        return Data(lines.joined(separator: "\r\n").utf8)
    }

    static func buildPGPMIMEMessage(
        from: String,
        to: [String],
        cc: [String],
        subject: String,
        armoredCiphertext: String,
        inReplyTo: String = "",
        references: String = ""
    ) throws -> Data {
        let boundary = "=_elvish_\(randomHex(16))"
        let domain = extractDomain(from: from)
        let messageID = "\(Int(Date().timeIntervalSince1970 * 1000)).\(randomHex(16))@\(domain)"
        let normalized = normalizeCRLF(armoredCiphertext).trimmingCharacters(in: CharacterSet(charactersIn: "\r\n"))
        let ccList = cc.filter { !$0.isEmpty }
        let irt = inReplyTo.trimmingCharacters(in: .whitespacesAndNewlines)
        let refs = references.trimmingCharacters(in: .whitespacesAndNewlines)

        var lines: [String] = [
            "Message-ID: <\(messageID)>",
            "Date: \(rfc822Date())",
            "From: \(try rejectHeaderInjection(from.isEmpty ? "anonymous" : from, label: "From"))",
            "To: \(to.joined(separator: ", "))",
        ]
        if !ccList.isEmpty { lines.append("Cc: \(ccList.joined(separator: ", "))") }
        if !subject.isEmpty { lines.append("Subject: \(try rejectHeaderInjection(subject, label: "Subject"))") }
        if !irt.isEmpty { lines.append("In-Reply-To: \(irt)") }
        if !refs.isEmpty { lines.append("References: \(refs)") }
        lines.append("Content-Type: multipart/encrypted; protocol=\"application/pgp-encrypted\"; boundary=\"\(boundary)\"")
        lines.append("MIME-Version: 1.0")
        lines.append("")
        lines.append("This is an OpenPGP/MIME encrypted message.")
        lines.append("--\(boundary)")
        lines.append("Content-Type: application/pgp-encrypted")
        lines.append("Content-Description: PGP/MIME version identification")
        lines.append("")
        lines.append("Version: 1")
        lines.append("--\(boundary)")
        lines.append("Content-Type: application/octet-stream; name=\"encrypted.asc\"")
        lines.append("Content-Disposition: inline; filename=\"encrypted.asc\"")
        lines.append("Content-Transfer-Encoding: 7bit")
        lines.append("")
        lines.append(normalized)
        lines.append("--\(boundary)--")
        lines.append("")
        return Data(lines.joined(separator: "\r\n").utf8)
    }

    private static func normalizeCRLF(_ text: String) -> String {
        text.replacingOccurrences(of: "\r\n", with: "\n")
            .replacingOccurrences(of: "\r", with: "\n")
            .replacingOccurrences(of: "\n", with: "\r\n")
    }

    private static func randomHex(_ bytes: Int) -> String {
        let data = (try? ElvishAccountWrap.randomBytes(bytes)) ?? Data((0 ..< bytes).map { _ in UInt8.random(in: 0 ... 255) })
        return data.map { String(format: "%02x", $0) }.joined()
    }

    private static func rfc822Date() -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(secondsFromGMT: 0)
        formatter.dateFormat = "EEE, dd MMM yyyy HH:mm:ss zzz"
        return formatter.string(from: Date())
    }

    private static func extractDomain(from: String) -> String {
        let raw = from.trimmingCharacters(in: .whitespacesAndNewlines)
        if let r = raw.range(of: #"@([^<>\s@]+)"#, options: .regularExpression) {
            let part = String(raw[r]).replacingOccurrences(of: "@", with: "")
            return part.lowercased()
        }
        return "elvish.local"
    }
}

enum MailComposeError: Error, LocalizedError {
    case headerInjection(String)

    var errorDescription: String? {
        switch self {
        case let .headerInjection(label):
            return "\(label) contains invalid characters"
        }
    }
}
