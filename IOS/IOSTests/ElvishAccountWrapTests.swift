import XCTest
@testable import IOS

final class ElvishAccountWrapTests: XCTestCase {
    func testAESWrapRoundTrip() throws {
        let salt = try ElvishAccountWrap.randomBytes(16)
        let derived = try ElvishAccountWrap.deriveKEKWithMetadata(
            password: "correct horse battery staple",
            salt: salt,
            kdf: "argon2id",
            kdfParamsJSON: nil
        )
        let plain = try ElvishAccountWrap.randomBytes(32)
        let wrapped = try ElvishAccountWrap.aesWrap(kek: derived.kek, plaintext: plain)
        let clear = try ElvishAccountWrap.aesUnwrap(kek: derived.kek, wrapped: wrapped)
        XCTAssertEqual(clear, plain)
    }
}
