import XCTest
@testable import IOS

final class MailComposeMimeTests: XCTestCase {
    func testRejectHeaderInjectionRejectsNewlines() {
        XCTAssertThrowsError(
            try MailComposeMime.buildRFC5322(
                from: "from@test.com",
                to: ["to@test.com"],
                subject: "line1\nline2",
                body: "body"
            )
        )
    }

    func testBuildRFC5322Smoke() throws {
        let data = try MailComposeMime.buildRFC5322(
            from: "sender@elvish.test",
            to: ["recipient@elvish.test"],
            subject: "Hello",
            body: "Plain body"
        )
        let text = String(data: data, encoding: .utf8) ?? ""
        XCTAssertTrue(text.contains("From: sender@elvish.test"))
        XCTAssertTrue(text.contains("To: recipient@elvish.test"))
        XCTAssertTrue(text.contains("Subject: Hello"))
        XCTAssertTrue(text.contains("Plain body"))
    }
}
