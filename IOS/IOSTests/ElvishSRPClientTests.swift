import BigInt
@testable import IOS
import XCTest

/// Transcript from a single `go run ./cmd/srpvector` run (server `B` is random; do not mix `server_pub`/`m1`/`m2` across runs).
final class ElvishSRPClientTests: XCTestCase {
    func testVectorsMatchGoPake() throws {
        let a = BigUInt("1234567890123456")
        let state = try ElvishSRPClient.beginLogin(
            username: "alice",
            password: "correct horse battery staple",
            deterministicPrivateExponent: a
        )
        XCTAssertEqual(
            state.clientPublicB64,
            "AHPQ/ZOwjW/UiKdsuslstkCJyOhFWUdJaTC8Nxds+2LJsyDNNTJB9V5H7WyvQ4AwDwiRkeKtPqQfKljCMSciODOQGo1OwEDl1M+k/xKR89qauOho2rdr+PVnD5IzVfFJqmw2oeRvMUnhRqKdkWZDGtD0ls4X9CJq0Y9qpIinKjRRG5OU71/zUwOX"
        )
        let (m1, m2) = try ElvishSRPClient.clientProof(
            state: state,
            saltB64: "BwoNEBMWGRwfIiUoKy4xNA==",
            serverPublicB64:
            "CbZ7yCw5cg6s95+tacMFT6gtwHWqZsPbEX6bIZr9CqJnvN5r/fd31bJbLFxRAZ0IpaG9BYoK/6hOOYbga2NrTScI+5iUZ82flrstlOJL+fX/fE1cZvEVsh6pTZcOGHSg+GXQNdwKLvOuMQJztCRTMX+aw+dgrbtrV7rMiM3AoyBg9DDhrYtPBuim"
        )
        XCTAssertEqual(m1, "XaQQlEWw9Y374aQpW6Bi5QiZgrhhPLht+feUhGcms0s=")
        XCTAssertEqual(m2, "vqfmEejEQ9xHH30uKhomVMf6CyN+2wLPKdg1MERhzFY=")
    }
}
