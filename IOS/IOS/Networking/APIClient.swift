import Foundation

/// JSON API client with shared cookie jar for `elvish_session`.
final class APIClient: @unchecked Sendable {
    private let baseURL: URL
    private let session: URLSession
    private let encoder: JSONEncoder
    private let decoder: JSONDecoder

    init(baseURL: URL = AppEnvironment.apiBaseURL, cookieStorage: HTTPCookieStorage = .shared) {
        self.baseURL = baseURL
        let config = URLSessionConfiguration.default
        config.httpCookieStorage = cookieStorage
        config.httpCookieAcceptPolicy = .always
        config.httpShouldSetCookies = true
        // Do not persist API JSON on the shared URL cache (session-adjacent responses).
        config.urlCache = nil
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        if #available(iOS 15.0, *) {
            config.tlsMinimumSupportedProtocolVersion = .TLSv12
        }
        self.session = URLSession(configuration: config)
        let enc = JSONEncoder()
        enc.keyEncodingStrategy = .convertToSnakeCase
        self.encoder = enc
        let dec = JSONDecoder()
        dec.keyDecodingStrategy = .convertFromSnakeCase
        self.decoder = dec
    }

    nonisolated func data(method: String, path: String, body: Encodable? = nil, accept: String? = nil) async throws -> (Data, HTTPURLResponse) {
        guard let url = URL(string: path, relativeTo: baseURL) else { throw APIError.invalidURL }
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue(accept ?? "application/json", forHTTPHeaderField: "Accept")
        if let body {
            req.setValue("application/json", forHTTPHeaderField: "Content-Type")
            req.httpBody = try encoder.encode(AnyEncodableBox(body))
        }
        do {
            let (data, resp) = try await session.data(for: req)
            guard let http = resp as? HTTPURLResponse else { throw APIError.transport(URLError(.badServerResponse)) }
            return (data, http)
        } catch {
            throw APIError.transport(error)
        }
    }

    nonisolated func send<T: Decodable>(_ type: T.Type, method: String, path: String, body: Encodable? = nil) async throws -> T {
        let (data, http) = try await data(method: method, path: path, body: body)
        if (200 ..< 300).contains(http.statusCode) {
            do {
                return try decoder.decode(T.self, from: data)
            } catch {
                throw APIError.decoding(error)
            }
        }
        let msg = (try? decoder.decode(APIJSONError.self, from: data))?.error
            ?? String(data: data, encoding: .utf8)
        throw APIError.httpStatus(http.statusCode, msg)
    }

    nonisolated func sendExpectOK(method: String, path: String, body: Encodable? = nil) async throws {
        let (data, http) = try await data(method: method, path: path, body: body)
        guard (200 ..< 300).contains(http.statusCode) else {
            let msg = (try? decoder.decode(APIJSONError.self, from: data))?.error
            throw APIError.httpStatus(http.statusCode, msg)
        }
    }
}

/// Type-erased `Encodable` for generic POST bodies.
private struct AnyEncodableBox: Encodable {
    private let encodeBody: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) {
        self.encodeBody = { try value.encode(to: $0) }
    }
    func encode(to encoder: Encoder) throws { try encodeBody(encoder) }
}
