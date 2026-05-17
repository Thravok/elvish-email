import Argon2Swift
import CommonCrypto
import CryptoKit
import Foundation

enum ElvishAccountWrapError: Error, Sendable {
    case unsupportedKDF(String)
    case invalidBase64
    case invalidWrappedBlob
    case aesUnwrapFailed
    case pbkdf2Failed
}

/// Mirrors `static/auth/keygen.js` — KEK derivation + AES-256-GCM unwrap of the account OpenPGP secret.
enum ElvishAccountWrap {
    private static let pbkdf2Iterations = 600_000
    private static let argon2DefaultTime = 3
    private static let argon2DefaultMemKib = 64 * 1024
    private static let argon2DefaultParallelism = 1

    private struct Argon2Params: Decodable {
        let time: Int?
        let mem: Int?
        let parallelism: Int?
    }

    static func deriveKEK(password: String, salt: Data, kdf: String, kdfParamsJSON: String?) throws -> Data {
        let trimmed = kdf.trimmingCharacters(in: .whitespacesAndNewlines)
        switch trimmed {
        case "argon2id":
            let params: Argon2Params
            if let raw = kdfParamsJSON?.data(using: .utf8), !raw.isEmpty {
                params = (try? JSONDecoder().decode(Argon2Params.self, from: raw)) ?? Argon2Params(time: nil, mem: nil, parallelism: nil)
            } else {
                params = Argon2Params(time: nil, mem: nil, parallelism: nil)
            }
            let t = params.time ?? argon2DefaultTime
            let m = params.mem ?? argon2DefaultMemKib
            let p = params.parallelism ?? argon2DefaultParallelism
            let saltObj = Salt(bytes: salt)
            let result = try Argon2Swift.hashPasswordBytes(
                password: Data(password.utf8),
                salt: saltObj,
                iterations: t,
                memory: m,
                parallelism: p,
                length: 32,
                type: .id
            )
            return result.hashData()
        case "pbkdf2-sha256", "pbkdf2-sha256-600k":
            return try pbkdf2SHA256(password: password, salt: salt, iterations: pbkdf2Iterations)
        default:
            throw ElvishAccountWrapError.unsupportedKDF(trimmed)
        }
    }

    static func aesUnwrap(kek: Data, wrapped: Data) throws -> Data {
        guard wrapped.count >= 12 else { throw ElvishAccountWrapError.invalidWrappedBlob }
        do {
            let box = try AES.GCM.SealedBox(combined: wrapped)
            let key = SymmetricKey(data: kek)
            return try AES.GCM.open(box, using: key)
        } catch {
            throw ElvishAccountWrapError.aesUnwrapFailed
        }
    }

    private static func pbkdf2SHA256(password: String, salt: Data, iterations: Int) throws -> Data {
        var derived = [UInt8](repeating: 0, count: 32)
        let pass = Data(password.utf8)
        let status: CCCryptorStatus = derived.withUnsafeMutableBytes { derivedBuf in
            let derivedBase = derivedBuf.bindMemory(to: UInt8.self).baseAddress!
            return pass.withUnsafeBytes { passBuf in
                let passBase = passBuf.bindMemory(to: Int8.self).baseAddress!
                return salt.withUnsafeBytes { saltBuf in
                    let saltBase = saltBuf.bindMemory(to: UInt8.self).baseAddress!
                    return CCKeyDerivationPBKDF(
                        CCPBKDFAlgorithm(kCCPBKDF2),
                        passBase,
                        pass.count,
                        saltBase,
                        salt.count,
                        CCPseudoRandomAlgorithm(kCCPRFHmacAlgSHA256),
                        UInt32(iterations),
                        derivedBase,
                        32
                    )
                }
            }
        }
        guard status == kCCSuccess else { throw ElvishAccountWrapError.pbkdf2Failed }
        return Data(derived)
    }
}
