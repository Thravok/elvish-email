import BigInt
import CryptoKit
import Foundation
import Security

/// SRP-6a client matching `static/auth/srp.js` and `internal/pake` (RFC5054-2048, SHA-256).
enum ElvishSRPClient {
    private static let nHex =
        "AC6BDB41324A9A9BF166DE5E1389582FAF72B6651987EE07FC3192943DB56050A37329CBB4A099ED8193E0757767A13DD52312AB4B03310DCD7F48A9DA04FD50E8083969EDB767B0CF6096BEECFB71744F9A5B7CDBD7B3E8C94BBE117577A615D6C770988C0BAD946E208E24FA074E5AB3143DB5BFCE0FD108E4B82D120A93AD2CAFFFFFFFFFFFFFFFF"

    private static let groupN: BigUInt = { BigUInt(nHex, radix: 16)! }()
    private static let groupG: BigUInt = 2
    /// Matches `len(N.Bytes())` after `big.Int.SetString(nHex, 16)` in `internal/pake` (RFC5054-2048 `N` uses 275 hex digits → 138 bytes).
    private static let padLen = (nHex.count + 1) / 2

    struct LoginState: Sendable {
        fileprivate let username: String
        fileprivate let password: String
        fileprivate let a: BigUInt
        fileprivate let A: BigUInt
        let clientPublicB64: String
    }

    /// Begin SRP login. Pass `deterministicPrivateExponent` only from unit tests.
    static func beginLogin(username: String, password: String, deterministicPrivateExponent: BigUInt? = nil) throws -> LoginState {
        let a: BigUInt
        if let deterministicPrivateExponent {
            a = deterministicPrivateExponent
        } else {
            a = randomPrivateExponent()
        }
        let A = groupG.power(a, modulus: groupN)
        if A % groupN == 0 { throw SRPError.invalidPublic }
        let pub = padBig(A)
        return LoginState(username: username, password: password, a: a, A: A, clientPublicB64: pub.base64EncodedString())
    }

    static func clientProof(state: LoginState, saltB64: String, serverPublicB64: String) throws -> (clientProofB64: String, expectedServerProofB64: String) {
        guard let salt = Data(base64Encoded: saltB64) else { throw SRPError.badEncoding }
        guard let serverPub = Data(base64Encoded: serverPublicB64) else { throw SRPError.badEncoding }
        let B = BigUInt(serverPub)
        if B == 0 || B % groupN == 0 { throw SRPError.invalidPublic }

        let k = BigUInt(Data(digest([padBig(groupN), padBig(groupG)])))
        let u = BigUInt(Data(digest([padBig(state.A), padBig(B)])))
        if u == 0 { throw SRPError.zeroScramble }

        let x = try computeX(username: state.username, password: state.password, salt: salt)
        let gx = groupG.power(x, modulus: groupN)
        let kgx = (k * gx) % groupN
        let base = modSubtract(B, kgx, groupN)
        let exp = state.a + u * x
        let S = base.power(exp, modulus: groupN)
        let K = digest([padBig(S)])

        let hN = digest([padBig(groupN)])
        let hG = digest([padBig(groupG)])
        var xor = Data(hN)
        xor.withUnsafeMutableBytes { buf in
            let g = hG
            for i in 0 ..< min(buf.count, g.count) {
                buf[i] ^= g[i]
            }
        }
        let userHash = Data(digest([Data(state.username.utf8)]))
        let m1 = digest([xor, userHash, salt, padBig(state.A), padBig(B), Data(K)])
        let m2 = digest([trimLeadingZeros(Data(padBig(state.A))), Data(m1), Data(K)])
        return (Data(m1).base64EncodedString(), Data(m2).base64EncodedString())
    }

    private enum SRPError: Error {
        case invalidPublic
        case badEncoding
        case zeroScramble
    }

    private static func randomPrivateExponent() -> BigUInt {
        let max = groupN - 2
        var bytes = [UInt8](repeating: 0, count: 32)
        let status = SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes)
        guard status == errSecSuccess else {
            return BigUInt(1)
        }
        let x = BigUInt(Data(bytes))
        let r = x % max
        return r == 0 ? 1 : r
    }

    private static func computeX(username: String, password: String, salt: Data) throws -> BigUInt {
        let inner = digest([Data("\(username):\(password)".utf8)])
        let outer = digest([salt, Data(inner)])
        return BigUInt(Data(outer))
    }

    private static func digest(_ parts: [Data]) -> [UInt8] {
        var h = SHA256()
        for p in parts {
            h.update(data: p)
        }
        return Array(h.finalize())
    }

    private static func padBig(_ v: BigUInt) -> Data {
        toBytesBE(v, paddedTo: padLen)
    }

    private static func toBytesBE(_ v: BigUInt, paddedTo length: Int) -> Data {
        var hex = String(v, radix: 16)
        if hex.count % 2 == 1 { hex = "0" + hex }
        var raw = [UInt8]()
        raw.reserveCapacity(hex.count / 2)
        var idx = hex.startIndex
        while idx < hex.endIndex {
            let next = hex.index(idx, offsetBy: 2, limitedBy: hex.endIndex) ?? hex.endIndex
            guard let b = UInt8(hex[idx ..< next], radix: 16) else { break }
            raw.append(b)
            idx = next
        }
        let d = Data(raw)
        if d.count >= length { return d }
        return Data(repeating: 0, count: length - d.count) + d
    }

    private static func trimLeadingZeros(_ d: Data) -> Data {
        var i = 0
        while i < d.count && d[i] == 0 {
            i += 1
        }
        if i >= d.count { return Data([0]) }
        return d.subdata(in: i ..< d.count)
    }

    private static func modSubtract(_ B: BigUInt, _ t: BigUInt, _ N: BigUInt) -> BigUInt {
        let tm = t % N
        return (B + N - tm) % N
    }
}
