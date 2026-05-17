import Foundation

enum APIError: Error, LocalizedError {
    case invalidURL
    case httpStatus(Int, String?)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .invalidURL:
            return "Invalid URL"
        case let .httpStatus(code, msg):
            return msg ?? "HTTP \(code)"
        case let .decoding(err):
            return "Decoding failed: \(err.localizedDescription)"
        case let .transport(err):
            return err.localizedDescription
        }
    }
}

nonisolated struct APIJSONError: Decodable, Sendable {
    let error: String?
}
