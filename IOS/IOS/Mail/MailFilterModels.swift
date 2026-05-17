import Foundation

nonisolated struct MailFiltersListResponse: Decodable, Sendable {
    let filters: [MailFilterRuleDTO]
}

nonisolated struct MailFilterRuleDTO: Decodable, Sendable, Identifiable {
    let id: String
    let name: String
    let enabled: Bool?
    let priority: Int?
    let conditions: [MailFilterConditionDTO]
    let actions: [MailFilterActionDTO]
    let createdAt: String?

    init(
        id: String,
        name: String,
        enabled: Bool?,
        priority: Int?,
        conditions: [MailFilterConditionDTO],
        actions: [MailFilterActionDTO],
        createdAt: String?
    ) {
        self.id = id
        self.name = name
        self.enabled = enabled
        self.priority = priority
        self.conditions = conditions
        self.actions = actions
        self.createdAt = createdAt
    }
}

nonisolated struct MailFilterConditionDTO: Decodable, Sendable {
    let type: String
    let op: String
    let value: String?

    init(type: String, op: String = "contains", value: String?) {
        self.type = type
        self.op = op
        self.value = value
    }

    enum CodingKeys: String, CodingKey {
        case type
        case value
        case op = "operator"
    }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        type = try c.decode(String.self, forKey: .type)
        value = try c.decodeIfPresent(String.self, forKey: .value)
        op = try c.decodeIfPresent(String.self, forKey: .op) ?? "contains"
    }
}

nonisolated struct MailFilterActionDTO: Decodable, Sendable {
    let type: String
    let value: String?

    init(type: String, value: String?) {
        self.type = type
        self.value = value
    }
}
