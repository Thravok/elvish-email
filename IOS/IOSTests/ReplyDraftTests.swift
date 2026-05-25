@testable import IOS
import XCTest

final class ReplyDraftTests: XCTestCase {
    func testReplySubjectLine() {
        XCTAssertEqual(MailReplyDraft.replySubjectLine("Hello"), "Re: Hello")
        XCTAssertEqual(MailReplyDraft.replySubjectLine("Re: Hi"), "Re: Hi")
        XCTAssertEqual(MailReplyDraft.replySubjectLine(""), "Re: ")
    }

    func testInboundReplyToSender() {
        let src = ReplyMessageSource(
            fromAddr: "other@elvish.test",
            toAddrs: ["me@elvish.test"],
            ccAddrs: [],
            subject: "Question",
            rfcMessageId: "<abc@elvish.test>",
            inReplyTo: "",
            references: "",
            replyTo: "",
            threadId: ""
        )
        let draft = MailReplyDraft.buildReplyComposeDraft(
            message: src,
            identities: [
                IdentityRowDTO(
                    email: "me@elvish.test",
                    fingerprint: "fp",
                    armoredPublic: "pub",
                    wrappedSecretB64: nil,
                    isDefault: true
                ),
            ],
            accountEmail: "me@elvish.test",
            replyAll: false
        )
        XCTAssertTrue(draft.to.lowercased().contains("other@elvish.test"))
        XCTAssertEqual(draft.subject, "Re: Question")
        XCTAssertEqual(draft.inReplyTo, "<abc@elvish.test>")
    }

    func testOutgoingReplySkipsSelf() {
        let src = ReplyMessageSource(
            fromAddr: "me@elvish.test",
            toAddrs: ["a@elvish.test", "b@elvish.test"],
            ccAddrs: [],
            subject: "Team",
            rfcMessageId: "",
            inReplyTo: "",
            references: "",
            replyTo: "",
            threadId: ""
        )
        let draft = MailReplyDraft.buildReplyComposeDraft(
            message: src,
            identities: [],
            accountEmail: "me@elvish.test",
            replyAll: false
        )
        XCTAssertTrue(draft.to.lowercased().contains("a@elvish.test"))
        XCTAssertFalse(draft.to.lowercased().contains("me@elvish.test"))
    }
}
