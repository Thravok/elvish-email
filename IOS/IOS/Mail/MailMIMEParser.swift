import Foundation

/// Parsed attachment metadata (mirrors `mail-app.jsx` `parseMimeEntity` attachment branch).
nonisolated struct MailAttachmentPreview: Sendable, Identifiable, Hashable {
    let id: UUID
    let fileName: String
    let contentType: String
    let byteCount: Int
}

/// Human-oriented view of a decrypted RFC 822 / MIME message.
nonisolated struct MailPresentedMessage: Sendable {
    let subject: String
    let from: String
    let to: String
    let cc: String
    let date: String
    let body: String
    let attachments: [MailAttachmentPreview]
}

/// MIME walk + decoding aligned with `static/mail/mail-app.jsx` (`extractDisplayEnvelope`, `parseMimeEntity`, …).
nonisolated enum MailMIMEParser {

    static func present(decrypted: String) -> MailPresentedMessage {
        let normalized = decrypted.replacingOccurrences(of: "\r\n", with: "\n")
        guard let sep = normalized.range(of: "\n\n") else {
            return MailPresentedMessage(subject: "", from: "", to: "", cc: "", date: "", body: decrypted, attachments: [])
        }
        let headerBlock = String(normalized[..<sep.lowerBound])
        if headerBlock.count > 32 * 1024 {
            return MailPresentedMessage(subject: "", from: "", to: "", cc: "", date: "", body: decrypted, attachments: [])
        }
        guard let parsed = parseHeaderBlock(headerBlock), looksLikeDisplayableEnvelope(parsed) else {
            return MailPresentedMessage(subject: "", from: "", to: "", cc: "", date: "", body: decrypted, attachments: [])
        }
        let headers = parsed.headers
        let body = String(normalized[sep.upperBound...])
        let envelope = parseMimeEntity(headers: headers, body: body, depth: 0)
        let subject = (headers["subject"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let from = collapseHeaderWhitespace(headers["from"] ?? "")
        let to = collapseHeaderWhitespace(headers["to"] ?? "")
        let cc = collapseHeaderWhitespace(headers["cc"] ?? "")
        let date = (headers["date"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        let displayBody = envelope.bodyText.trimmingCharacters(in: .whitespacesAndNewlines)
        if envelope.bodyScore > 0 || !envelope.attachments.isEmpty || (headers["content-type"] ?? "").lowercased().hasPrefix("multipart/") {
            return MailPresentedMessage(
                subject: subject,
                from: from,
                to: to,
                cc: cc,
                date: date,
                body: displayBody,
                attachments: envelope.attachments
            )
        }
        let fallback = decodeMailBody(body, transferEncoding: headers["content-transfer-encoding"])
        return MailPresentedMessage(subject: subject, from: from, to: to, cc: cc, date: date, body: fallback, attachments: [])
    }

    // MARK: - Header block

    private struct ParsedHeaders {
        let headers: [String: String]
        let totalHeaders: Int
        let knownHeaders: Int
    }

    private static func parseHeaderBlock(_ headerBlock: String) -> ParsedHeaders? {
        var lines = headerBlock.split(separator: "\n", omittingEmptySubsequences: false).map(String.init)
        while lines.last?.isEmpty == true { lines.removeLast() }
        if lines.isEmpty { return nil }
        var headers: [String: String] = [:]
        var current = ""
        var total = 0
        var known = 0
        let knownSet: Set<String> = [
            "from", "to", "cc", "subject", "date", "message-id", "mime-version",
            "content-type", "content-transfer-encoding", "content-disposition",
        ]
        for line in lines {
            if line.isEmpty { return nil }
            if let first = line.first, first == " " || first == "\t" {
                if current.isEmpty { return nil }
                headers[current, default: ""] += " " + line.trimmingCharacters(in: .whitespaces)
                continue
            }
            guard let colon = line.firstIndex(of: ":") else { return nil }
            let nameRaw = String(line[..<colon])
            guard nameRaw.range(of: #"^[A-Za-z0-9-]+$"#, options: .regularExpression) != nil else { return nil }
            let value = String(line[line.index(after: colon)...]).trimmingCharacters(in: .whitespaces)
            current = nameRaw.lowercased()
            headers[current] = value
            total += 1
            if knownSet.contains(current) { known += 1 }
        }
        return ParsedHeaders(headers: headers, totalHeaders: total, knownHeaders: known)
    }

    private static func looksLikeFullMessageHeaders(_ parsed: ParsedHeaders) -> Bool {
        parsed.totalHeaders >= 2 && parsed.knownHeaders >= 2
    }

    private static func looksLikeMimeEntityHeaders(_ parsed: ParsedHeaders) -> Bool {
        let contentType = (parsed.headers["content-type"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let transferEncoding = (parsed.headers["content-transfer-encoding"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        let disposition = (parsed.headers["content-disposition"] ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if contentType.isEmpty { return false }
        return contentType.hasPrefix("multipart/")
            || contentType.hasPrefix("text/")
            || disposition.contains("attachment")
            || transferEncoding == "base64"
            || transferEncoding == "quoted-printable"
    }

    private static func looksLikeDisplayableEnvelope(_ parsed: ParsedHeaders) -> Bool {
        looksLikeFullMessageHeaders(parsed) || looksLikeMimeEntityHeaders(parsed)
    }

    private static func collapseHeaderWhitespace(_ s: String) -> String {
        s.replacingOccurrences(of: #"\s+"#, with: " ", options: .regularExpression)
            .trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - MIME tree

    private struct MimeParseResult {
        var bodyText: String
        var bodyScore: Int
        var attachments: [MailAttachmentPreview]
    }

    private static func parseMimeEntity(headers: [String: String], body: String, depth: Int) -> MimeParseResult {
        let normalizedBody = String(body)
        let contentType = headers["content-type"] ?? ""
        let disposition = headers["content-disposition"] ?? ""
        let transferEncoding = headers["content-transfer-encoding"]
        let kind = contentType.split(separator: ";", maxSplits: 1, omittingEmptySubsequences: false).first.map(String.init)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        let filenameMatch = firstMatch(disposition, pattern: "filename=\"?([^\"]+)\"?")
            ?? firstMatch(contentType, pattern: "name=\"?([^\"]+)\"?")
        let filename = filenameMatch?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""

        let isPGPSignature = kind == "application/pgp-signature" || kind == "application/x-pgp-signature"
        let isAttachment = !isPGPSignature && (
            disposition.lowercased().contains("attachment")
                || (!filename.isEmpty && !kind.hasPrefix("multipart/") && kind != "text/plain" && kind != "text/html")
        )

        if isAttachment {
            let bytes = decodeAttachmentBytes(normalizedBody, transferEncoding: transferEncoding)
            let name = filename.isEmpty ? "attachment.bin" : filename
            let att = MailAttachmentPreview(id: UUID(), fileName: name, contentType: kind.isEmpty ? "application/octet-stream" : kind, byteCount: bytes.count)
            return MimeParseResult(bodyText: "", bodyScore: 0, attachments: [att])
        }

        if depth < 8, kind.hasPrefix("multipart/"),
           let boundary = extractBoundary(from: contentType)
        {
            if kind == "multipart/signed" {
                let protocolVal = extractProtocol(from: contentType)?.lowercased() ?? ""
                if protocolVal.range(of: #"application/(pgp|x-pgp)-signature"#, options: [.regularExpression, .caseInsensitive]) != nil {
                    let parts = splitMultipartBody(normalizedBody, boundary: boundary)
                    if let first = parts.first {
                        if let partSep = first.range(of: "\n\n") {
                            let head = String(first[..<partSep.lowerBound])
                            let subBody = String(first[partSep.upperBound...])
                            if let subParsed = parseHeaderBlock(head) {
                                return parseMimeEntity(headers: subParsed.headers, body: subBody, depth: depth + 1)
                            }
                        }
                    }
                    return MimeParseResult(bodyText: "", bodyScore: 0, attachments: [])
                }
            }
            var bestText = ""
            var bestScore = 0
            var attachments: [MailAttachmentPreview] = []
            for part in splitMultipartBody(normalizedBody, boundary: boundary) {
                guard let partSep = part.range(of: "\n\n") else { continue }
                let head = String(part[..<partSep.lowerBound])
                let subBody = String(part[partSep.upperBound...])
                guard let subParsed = parseHeaderBlock(head) else { continue }
                let child = parseMimeEntity(headers: subParsed.headers, body: subBody, depth: depth + 1)
                attachments.append(contentsOf: child.attachments)
                if child.bodyScore > bestScore {
                    bestText = child.bodyText
                    bestScore = child.bodyScore
                }
            }
            return MimeParseResult(bodyText: bestText, bodyScore: bestScore, attachments: attachments)
        }

        let decodedBody = decodeMailBody(normalizedBody, transferEncoding: transferEncoding)
        if kind == "text/html" {
            let text = htmlToDisplayText(decodedBody)
            return MimeParseResult(bodyText: text, bodyScore: scoreBodyText(kind, text: text), attachments: [])
        }
        if kind.hasPrefix("text/") || kind.isEmpty {
            return MimeParseResult(bodyText: decodedBody, bodyScore: scoreBodyText(kind.isEmpty ? "text/plain" : kind, text: decodedBody), attachments: [])
        }
        return MimeParseResult(bodyText: "", bodyScore: 0, attachments: [])
    }

    private static func scoreBodyText(_ contentType: String, text: String) -> Int {
        let t = text.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return 0 }
        let kind = contentType.split(separator: ";").first.map(String.init)?.trimmingCharacters(in: .whitespacesAndNewlines).lowercased() ?? ""
        if kind == "text/plain" { return 3 }
        if kind == "text/html" { return 2 }
        if kind.hasPrefix("text/") { return 1 }
        return 0
    }

    private static func splitMultipartBody(_ body: String, boundary: String) -> [String] {
        let marker = "--" + boundary
        var out: [String] = []
        for raw in body.components(separatedBy: marker) {
            var part = raw.trimmingCharacters(in: .whitespacesAndNewlines)
            if part.isEmpty || part == "--" { continue }
            if part.hasSuffix("--") {
                part = String(part.dropLast(2)).trimmingCharacters(in: .whitespacesAndNewlines)
            }
            if !part.isEmpty { out.append(part) }
        }
        return out
    }

    private static func extractBoundary(from contentType: String) -> String? {
        firstMatch(contentType, pattern: "boundary=\"?([^\";\n]+)\"?")
    }

    private static func extractProtocol(from contentType: String) -> String? {
        firstMatch(contentType, pattern: "protocol\\s*=\\s*\"([^\";\n]+)\"")
            ?? firstMatch(contentType, pattern: "protocol\\s*=\\s*([^\";\n\\s]+)")
    }

    private static func firstMatch(_ s: String, pattern: String) -> String? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: .caseInsensitive) else { return nil }
        let range = NSRange(s.startIndex..., in: s)
        guard let m = re.firstMatch(in: s, options: [], range: range), m.numberOfRanges > 1,
              let r = Range(m.range(at: 1), in: s)
        else { return nil }
        return String(s[r]).trimmingCharacters(in: .whitespacesAndNewlines)
    }

    // MARK: - Transfer decoding

    private static func decodeMailBody(_ body: String, transferEncoding: String?) -> String {
        let encoding = (transferEncoding ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if encoding.isEmpty || encoding == "7bit" || encoding == "8bit" || encoding == "binary" {
            return body
        }
        if encoding == "quoted-printable" {
            return decodeQuotedPrintable(body)
        }
        if encoding == "base64" {
            let cleaned = body.replacingOccurrences(of: #"\s+"#, with: "", options: .regularExpression)
            guard let data = Data(base64Encoded: cleaned) else { return body }
            return String(decoding: data, as: UTF8.self)
        }
        return body
    }

    private static func decodeAttachmentBytes(_ body: String, transferEncoding: String?) -> Data {
        let encoding = (transferEncoding ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        if encoding == "base64" {
            let cleaned = body.replacingOccurrences(of: #"\s+"#, with: "", options: .regularExpression)
            return Data(base64Encoded: cleaned) ?? Data()
        }
        return Data(body.utf8)
    }

    private static func decodeQuotedPrintable(_ text: String) -> String {
        guard text.contains("=") else { return text }
        let cleaned = text.replacingOccurrences(of: "=\r\n", with: "").replacingOccurrences(of: "=\n", with: "")
        var out = Data()
        let bytes = Array(cleaned.utf8)
        var i = 0
        while i < bytes.count {
            if bytes[i] == UInt8(ascii: "="), i + 2 < bytes.count {
                if let hi = hexNibble(bytes[i + 1]), let lo = hexNibble(bytes[i + 2]) {
                    out.append(hi << 4 | lo)
                    i += 3
                    continue
                }
            }
            out.append(bytes[i])
            i += 1
        }
        return String(decoding: out, as: UTF8.self)
    }

    private static func hexNibble(_ b: UInt8) -> UInt8? {
        switch b {
        case UInt8(ascii: "0") ... UInt8(ascii: "9"):
            return b - UInt8(ascii: "0")
        case UInt8(ascii: "a") ... UInt8(ascii: "f"):
            return 10 + (b - UInt8(ascii: "a"))
        case UInt8(ascii: "A") ... UInt8(ascii: "F"):
            return 10 + (b - UInt8(ascii: "A"))
        default:
            return nil
        }
    }

    // MARK: - HTML → readable text (same idea as `htmlToDisplayText` in mail-app.jsx)

    private static func htmlToDisplayText(_ html: String) -> String {
        var s = html
        if let re = try? NSRegularExpression(pattern: "<style[\\s\\S]*?</style>", options: .caseInsensitive) {
            s = re.stringByReplacingMatches(in: s, options: [], range: NSRange(s.startIndex..., in: s), withTemplate: " ")
        }
        if let re = try? NSRegularExpression(pattern: "<script[\\s\\S]*?</script>", options: .caseInsensitive) {
            s = re.stringByReplacingMatches(in: s, options: [], range: NSRange(s.startIndex..., in: s), withTemplate: " ")
        }
        if let re = try? NSRegularExpression(pattern: "<(br|/p|/div|/li|/tr|/h[1-6])\\b[^>]*>", options: .caseInsensitive) {
            s = re.stringByReplacingMatches(in: s, options: [], range: NSRange(s.startIndex..., in: s), withTemplate: "\n")
        }
        if let re = try? NSRegularExpression(pattern: "<[^>]+>", options: []) {
            s = re.stringByReplacingMatches(in: s, options: [], range: NSRange(s.startIndex..., in: s), withTemplate: " ")
        }
        s = s.replacingOccurrences(of: "&nbsp;", with: " ", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "&amp;", with: "&", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "&lt;", with: "<", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "&gt;", with: ">", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "&quot;", with: "\"", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "&#39;", with: "'", options: .caseInsensitive)
        s = s.replacingOccurrences(of: "\r", with: "")
        s = s.replacingOccurrences(of: #"[ \t]+\n"#, with: "\n", options: .regularExpression)
        s = s.replacingOccurrences(of: #"\n{3,}"#, with: "\n\n", options: .regularExpression)
        return s.trimmingCharacters(in: .whitespacesAndNewlines)
    }

    /// Human-readable size for attachment rows.
    static func formatAttachmentBytes(_ n: Int) -> String {
        guard n > 0 else { return "0 B" }
        let units = ["B", "KB", "MB", "GB"]
        var cur = Double(n)
        var idx = 0
        while cur >= 1024, idx < units.count - 1 {
            cur /= 1024
            idx += 1
        }
        if idx == 0 || cur >= 10 {
            return "\(Int(cur.rounded())) \(units[idx])"
        }
        return String(format: "%.1f %@", cur, units[idx])
    }
}
