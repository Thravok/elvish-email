import Foundation

/// Client-side filter evaluation (parity with `static/mail/mail-filter-engine.js`).
enum MailFilterEngine {
    private static let rulesCap = 50

    private static let supportedConditionTypes: Set<String> = [
        "sender", "subject", "recipient", "body", "attachment", "size",
    ]

    private static let supportedActionTypes: Set<String> = ["move", "mark_read", "delete"]

    static func normalizeRules(_ raw: [MailFilterRuleDTO]) -> [MailFilterRuleDTO] {
        let filtered = raw.filter { rule in
            rule.enabled != false && !rule.id.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
        }
        let sorted = filtered.sorted { a, b in
            let pa = a.priority ?? 0
            let pb = b.priority ?? 0
            if pa != pb { return pa > pb }
            return (a.createdAt ?? "").localizedStandardCompare(b.createdAt ?? "") == .orderedAscending
        }
        return Array(sorted.prefix(rulesCap))
    }

    static func stableRulesHash(rules: [MailFilterRuleDTO]) -> String {
        var slim: [[String: Any]] = []
        for r in rules {
            let condObjs: [[String: Any]] = r.conditions.map {
                ["type": $0.type, "operator": $0.op, "value": $0.value ?? ""]
            }
            let actObjs: [[String: Any]] = r.actions.map {
                ["type": $0.type, "value": $0.value ?? ""]
            }
            slim.append([
                "id": r.id,
                "enabled": r.enabled ?? true,
                "priority": r.priority ?? 0,
                "conditions": condObjs,
                "actions": actObjs,
            ])
        }
        guard let json = try? JSONSerialization.data(withJSONObject: slim, options: [.sortedKeys]),
              let str = String(data: json, encoding: .utf8)
        else {
            return "r0"
        }
        var h: UInt32 = 5381
        for u in str.utf8 {
            h = ((h &* 33) &+ UInt32(u))
        }
        return "r\(String(h, radix: 16))"
    }

    struct MessageContext: Sendable {
        var subject: String
        var from: String
        var to: [String]
        var bodyText: String?
        var hasAttachments: Bool
        var sizeBytes: Int?
    }

    static func buildContext(row: MailInboxRow, bodyText: String?) -> MessageContext {
        MessageContext(
            subject: row.subject ?? "",
            from: row.fromAddr ?? "",
            to: row.toAddrs ?? [],
            bodyText: bodyText,
            hasAttachments: row.hasAttachments,
            sizeBytes: nil
        )
    }

    private static func norm(_ s: String) -> String {
        s.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
    }

    private static func matchString(hay: String, needle: String, op: String) -> Bool {
        let h = norm(hay)
        let n = norm(needle)
        if n.isEmpty, op != "equals" { return false }
        switch op {
        case "equals": return h == n
        case "starts_with": return h.hasPrefix(n)
        case "ends_with": return h.hasSuffix(n)
        case "matches", "contains": return !n.isEmpty && h.contains(n)
        default: return false
        }
    }

    static func conditionMatches(_ cond: MailFilterConditionDTO, ctx: MessageContext) -> Bool {
        let type = norm(cond.type)
        let op = norm(cond.op)
        let val = cond.value ?? ""
        guard supportedConditionTypes.contains(type), type != "header" else { return false }
        switch type {
        case "sender":
            return matchString(hay: ctx.from, needle: val, op: op)
        case "subject":
            return matchString(hay: ctx.subject, needle: val, op: op)
        case "recipient":
            for addr in ctx.to where matchString(hay: addr, needle: val, op: op) { return true }
            return false
        case "body":
            guard let body = ctx.bodyText, !body.isEmpty else { return false }
            return matchString(hay: body, needle: val, op: op)
        case "attachment":
            let want = norm(val)
            if want == "0" || want == "false" || want == "no" { return !ctx.hasAttachments }
            return ctx.hasAttachments
        case "size":
            guard let sz = ctx.sizeBytes, let num = Int(val.trimmingCharacters(in: .whitespacesAndNewlines)) else { return false }
            switch op {
            case "greater_than": return sz > num
            case "less_than": return sz < num
            case "equals": return sz == num
            default: return false
            }
        default:
            return false
        }
    }

    static func ruleMatches(_ rule: MailFilterRuleDTO, ctx: MessageContext) -> Bool {
        let conds = rule.conditions
        if conds.isEmpty { return false }
        for c in conds where !conditionMatches(c, ctx: ctx) { return false }
        return true
    }

    static func pickFirstMatchingRule(rules: [MailFilterRuleDTO], ctx: MessageContext) -> MailFilterRuleDTO? {
        for r in rules where ruleMatches(r, ctx: ctx) { return r }
        return nil
    }

    static func actionFingerprint(_ actions: [MailFilterActionDTO]) -> String {
        let supported = actions.filter { supportedActionTypes.contains(norm($0.type)) }
        let slim = supported.map { ["type": norm($0.type), "value": $0.value ?? ""] }
        guard let d = try? JSONSerialization.data(withJSONObject: slim, options: [.sortedKeys]),
              let s = String(data: d, encoding: .utf8) else { return "[]" }
        return s
    }

    static func filterSupportedActions(_ actions: [MailFilterActionDTO]) -> [MailFilterActionDTO] {
        actions.filter { supportedActionTypes.contains(norm($0.type)) }
    }

    static func applyActions(messageId: String, actions: [MailFilterActionDTO], mail: MailService) async throws {
        let acts = filterSupportedActions(actions)
        for a in acts {
            let t = norm(a.type)
            let v = a.value ?? ""
            switch t {
            case "move":
                let folder = norm(v)
                if !folder.isEmpty { try await mail.moveMessage(id: messageId, toFolder: folder) }
            case "mark_read":
                try await mail.setMessageRead(id: messageId, read: true)
            case "delete":
                try await mail.deleteMessage(id: messageId, permanent: false)
            default:
                break
            }
        }
    }
}
