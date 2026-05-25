import Foundation

/// Reply compose fields (parity with `buildReplyComposeDraft` in `static/mail/mail-app.jsx`).
struct ComposeDraft: Sendable {
    var to: String
    var cc: String
    var bcc: String
    var subject: String
    var body: String
    var inReplyTo: String
    var references: String
    var showCc: Bool
}

/// Metadata used to build a reply draft.
struct ReplyMessageSource: Sendable {
    var fromAddr: String
    var toAddrs: [String]
    var ccAddrs: [String]
    var subject: String
    var rfcMessageId: String
    var inReplyTo: String
    var references: String
    var replyTo: String
    var threadId: String

    static func fromInboxRow(_ row: MailInboxRow) -> ReplyMessageSource {
        ReplyMessageSource(
            fromAddr: row.fromAddr ?? "",
            toAddrs: row.toAddrs ?? [],
            ccAddrs: [],
            subject: row.subject ?? "",
            rfcMessageId: "",
            inReplyTo: "",
            references: "",
            replyTo: "",
            threadId: ""
        )
    }

    static func fromPresented(_ presented: MailPresentedMessage, row: MailInboxRow) -> ReplyMessageSource {
        ReplyMessageSource(
            fromAddr: presented.from.isEmpty ? (row.fromAddr ?? "") : presented.from,
            toAddrs: MailComposeMime.splitAddressList(presented.to),
            ccAddrs: MailComposeMime.splitAddressList(presented.cc),
            subject: presented.subject.isEmpty ? (row.subject ?? "") : presented.subject,
            rfcMessageId: presented.rfcMessageId,
            inReplyTo: presented.inReplyTo,
            references: presented.references,
            replyTo: presented.replyTo,
            threadId: ""
        )
    }
}

enum MailReplyDraft {
    static func canonicalizeSenderId(_ fromValue: String) -> String {
        MailComposeMime.canonicalEmailToken(fromValue)
    }

    static func replySubjectLine(_ subj: String?) -> String {
        let s = (subj ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return "Re: " }
        if s.range(of: #"^re:\s*"#, options: [.regularExpression, .caseInsensitive]) != nil { return s }
        return "Re: \(s)"
    }

    static func normalizeAngleMessageId(_ mid: String) -> String {
        var s = mid.trimmingCharacters(in: .whitespacesAndNewlines)
        if s.isEmpty { return "" }
        if !s.hasPrefix("<"), s.contains("@") { s = "<\(s)>" }
        return s
    }

    static func inReplyToForReply(_ message: ReplyMessageSource) -> String {
        let m = message.rfcMessageId.trimmingCharacters(in: .whitespacesAndNewlines)
        if !m.isEmpty { return m.hasPrefix("<") ? m : "<\(m)>" }
        let t = message.threadId.trimmingCharacters(in: .whitespacesAndNewlines)
        if t.isEmpty { return "" }
        return t.hasPrefix("<") ? t : "<\(t)>"
    }

    static func referencesChainForReply(_ message: ReplyMessageSource) -> String {
        var tokens = message.references
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .split(whereSeparator: \.isWhitespace)
            .map(String.init)
        let mid = message.rfcMessageId.trimmingCharacters(in: .whitespacesAndNewlines)
        if !mid.isEmpty, !tokens.contains(mid) { tokens.append(mid) }
        var out = tokens.joined(separator: " ")
        if out.count > 4000 {
            out = String(out.suffix(4000)).trimmingCharacters(in: .whitespacesAndNewlines)
        }
        return out
    }

    static func buildReplyComposeDraft(
        message: ReplyMessageSource,
        identities: [IdentityRowDTO],
        accountEmail: String,
        replyAll: Bool
    ) -> ComposeDraft {
        var selfSet = Set<String>()
        let ae = canonicalizeSenderId(accountEmail)
        if !ae.isEmpty { selfSet.insert(ae) }
        for idn in identities {
            let e = canonicalizeSenderId(idn.email)
            if !e.isEmpty { selfSet.insert(e) }
        }
        let fromDisp = message.fromAddr.trimmingCharacters(in: .whitespacesAndNewlines)
        let fromCanon = canonicalizeSenderId(fromDisp)
        let replyToRaw = message.replyTo.trimmingCharacters(in: .whitespacesAndNewlines)
        var toDisp = ""
        var ccParts: [String] = []
        let outgoing = !fromCanon.isEmpty && selfSet.contains(fromCanon)
        if outgoing {
            let others = message.toAddrs
                .filter { !selfSet.contains(canonicalizeSenderId($0)) }
                .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
                .filter { !$0.isEmpty }
            toDisp = others.joined(separator: ", ")
            if toDisp.isEmpty { toDisp = fromDisp }
            if replyAll {
                var onTo = Set(MailComposeMime.splitAddressList(toDisp).map { canonicalizeSenderId($0) }.filter { !$0.isEmpty })
                for d in message.ccAddrs {
                    let c = canonicalizeSenderId(d)
                    if c.isEmpty || selfSet.contains(c) || onTo.contains(c) { continue }
                    onTo.insert(c)
                    ccParts.append(d)
                }
            }
        } else {
            toDisp = replyToRaw.isEmpty ? fromDisp : replyToRaw
            if replyAll {
                var onTo = Set(MailComposeMime.splitAddressList(toDisp).map { canonicalizeSenderId($0) }.filter { !$0.isEmpty })
                for d in message.toAddrs + message.ccAddrs {
                    let c = canonicalizeSenderId(d)
                    if c.isEmpty || selfSet.contains(c) || onTo.contains(c) { continue }
                    onTo.insert(c)
                    ccParts.append(d)
                }
            }
        }
        let ccStr = ccParts.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }.filter { !$0.isEmpty }.joined(separator: ", ")
        return ComposeDraft(
            to: toDisp,
            cc: ccStr,
            bcc: "",
            subject: replySubjectLine(message.subject),
            body: "",
            inReplyTo: inReplyToForReply(message),
            references: referencesChainForReply(message),
            showCc: replyAll
        )
    }
}
