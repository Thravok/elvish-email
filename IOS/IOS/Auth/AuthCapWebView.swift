import SwiftUI
import WebKit

enum AuthCapBridgeError: Error {
    case badPayload(String)
}

extension AuthCapBridgeError: LocalizedError {
    var errorDescription: String? {
        switch self {
        case let .badPayload(s):
            return s
        }
    }
}

/// Shared bridge for Cap token events from `cap-embed.html`.
final class AuthCapCoordinator: NSObject, WKScriptMessageHandler {
    var onEvent: (Result<String?, Error>) -> Void
    var lastLoadedURLString: String?

    init(onEvent: @escaping (Result<String?, Error>) -> Void) {
        self.onEvent = onEvent
    }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any] else { return }
        guard let type = body["type"] as? String else { return }
        switch type {
        case "token":
            let tok = body["token"] as? String
            onEvent(.success(tok))
        case "reset":
            onEvent(.success(nil))
        case "error":
            let detail = body["detail"] as? String ?? "captcha error"
            onEvent(.failure(AuthCapBridgeError.badPayload(detail)))
        default:
            break
        }
    }
}

private func configureCapWebView(_ w: WKWebView, coordinator: AuthCapCoordinator) {
#if os(iOS) || os(visionOS)
    w.isOpaque = false
    w.backgroundColor = .clear
#endif
    w.scrollView.isScrollEnabled = false
    w.scrollView.bounces = false
}

private func loadEmbedIfNeeded(webView: WKWebView, coordinator: AuthCapCoordinator, embedURL: URL, onEvent: @escaping (Result<String?, Error>) -> Void) {
    coordinator.onEvent = onEvent
    let key = embedURL.absoluteString
    if coordinator.lastLoadedURLString == key {
        return
    }
    coordinator.lastLoadedURLString = key
    webView.load(URLRequest(url: embedURL))
}

#if os(iOS) || os(visionOS)
import UIKit

/// Embeds the server's `/auth/cap-embed.html` so the Cap widget can produce a `cap_token` for SRP `/login/begin`.
struct AuthCapWebView: UIViewRepresentable {
    let embedURL: URL
    var onEvent: (Result<String?, Error>) -> Void

    func makeCoordinator() -> AuthCapCoordinator {
        AuthCapCoordinator(onEvent: onEvent)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "elvishCap")
        let w = WKWebView(frame: .zero, configuration: config)
        configureCapWebView(w, coordinator: context.coordinator)
        return w
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        loadEmbedIfNeeded(webView: webView, coordinator: context.coordinator, embedURL: embedURL, onEvent: onEvent)
    }

    static func dismantleUIView(_ uiView: WKWebView, coordinator: AuthCapCoordinator) {
        uiView.configuration.userContentController.removeScriptMessageHandler(forName: "elvishCap")
    }
}
#endif

#if os(macOS)
import AppKit

struct AuthCapWebView: NSViewRepresentable {
    let embedURL: URL
    var onEvent: (Result<String?, Error>) -> Void

    func makeCoordinator() -> AuthCapCoordinator {
        AuthCapCoordinator(onEvent: onEvent)
    }

    func makeNSView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        config.userContentController.add(context.coordinator, name: "elvishCap")
        let w = WKWebView(frame: .zero, configuration: config)
        configureCapWebView(w, coordinator: context.coordinator)
        return w
    }

    func updateNSView(_ webView: WKWebView, context: Context) {
        loadEmbedIfNeeded(webView: webView, coordinator: context.coordinator, embedURL: embedURL, onEvent: onEvent)
    }

    static func dismantleNSView(_ nsView: WKWebView, coordinator: AuthCapCoordinator) {
        nsView.configuration.userContentController.removeScriptMessageHandler(forName: "elvishCap")
    }
}
#endif
