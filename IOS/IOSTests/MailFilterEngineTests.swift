@testable import IOS
import XCTest

final class MailFilterEngineTests: XCTestCase {
    func testSubjectContains() {
        let cond = MailFilterConditionDTO(type: "subject", op: "contains", value: "news")
        let ctx = MailFilterEngine.MessageContext(
            subject: "Daily Newsletter",
            from: "",
            to: [],
            bodyText: nil,
            hasAttachments: false,
            sizeBytes: nil
        )
        XCTAssertTrue(MailFilterEngine.conditionMatches(cond, ctx: ctx))
    }

    func testBodyMissingFails() {
        let cond = MailFilterConditionDTO(type: "body", op: "contains", value: "x")
        let ctx = MailFilterEngine.MessageContext(
            subject: "",
            from: "",
            to: [],
            bodyText: nil,
            hasAttachments: false,
            sizeBytes: nil
        )
        XCTAssertFalse(MailFilterEngine.conditionMatches(cond, ctx: ctx))
    }

    func testPickFirstByPriority() {
        let low = MailFilterRuleDTO(
            id: "a",
            name: "low",
            enabled: true,
            priority: 10,
            conditions: [MailFilterConditionDTO(type: "subject", op: "contains", value: "a")],
            actions: [MailFilterActionDTO(type: "mark_read", value: nil)],
            createdAt: "2020-01-01T00:00:00Z"
        )
        let high = MailFilterRuleDTO(
            id: "b",
            name: "high",
            enabled: true,
            priority: 90,
            conditions: [MailFilterConditionDTO(type: "subject", op: "contains", value: "a")],
            actions: [MailFilterActionDTO(type: "move", value: "archive")],
            createdAt: "2020-01-02T00:00:00Z"
        )
        let rules = MailFilterEngine.normalizeRules([low, high])
        let ctx = MailFilterEngine.MessageContext(
            subject: "aha",
            from: "",
            to: [],
            bodyText: nil,
            hasAttachments: false,
            sizeBytes: nil
        )
        let hit = MailFilterEngine.pickFirstMatchingRule(rules: rules, ctx: ctx)
        XCTAssertEqual(hit?.id, "b")
    }

    func testEmptyConditionsNeverMatches() {
        let rule = MailFilterRuleDTO(
            id: "z",
            name: "empty",
            enabled: true,
            priority: 100,
            conditions: [],
            actions: [MailFilterActionDTO(type: "mark_read", value: nil)],
            createdAt: nil
        )
        let ctx = MailFilterEngine.MessageContext(
            subject: "x",
            from: "",
            to: [],
            bodyText: nil,
            hasAttachments: false,
            sizeBytes: nil
        )
        XCTAssertFalse(MailFilterEngine.ruleMatches(rule, ctx: ctx))
    }
}
