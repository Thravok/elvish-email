import SwiftUI

struct LoginView: View {
    @Bindable var model: AppModel
    @State private var username = ""
    @State private var password = ""
    @State private var capToken = ""
    @State private var capEmbedReloadToken = UUID()
    @State private var capBridgeError: String?

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    TextField("Username", text: $username)
                        .textContentType(.username)
#if os(iOS)
                        .textInputAutocapitalization(.never)
#endif
                        .autocorrectionDisabled()
                    SecureField("Password", text: $password)
                        .textContentType(.password)
                } header: {
                    Text("Sign in to Elvish")
                } footer: {
                    if !model.mailDomain.isEmpty {
                        Text("Your address will be \(usernameDisplay)@\(model.mailDomain)")
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                    }
                }

                if model.authCapWidgetEndpoint != nil {
                    if let embedURL = capEmbedURL() {
                        Section {
                            AuthCapWebView(embedURL: embedURL) { result in
                                switch result {
                                case let .success(tok):
                                    capBridgeError = nil
                                    capToken = tok ?? ""
                                case let .failure(err):
                                    capToken = ""
                                    if let e = err as? AuthCapBridgeError, case let .badPayload(msg) = e {
                                        capBridgeError = msg
                                    } else {
                                        capBridgeError = err.localizedDescription
                                    }
                                }
                            }
                            .frame(height: 58)
                            .id(capEmbedReloadToken)
                        } header: {
                            Text("Human verification")
                        } footer: {
                            if let capBridgeError {
                                Text(capBridgeError)
                                    .font(.footnote)
                                    .foregroundStyle(.red)
                            }
                        }
                    } else {
                        Section {
                            Text("Human verification is required but the captcha URL is invalid.")
                                .foregroundStyle(.red)
                        }
                    }
                }

                if let err = model.lastError, model.mfaChallenge == nil {
                    Section {
                        Text(err)
                            .foregroundStyle(.red)
                    }
                }

                Section {
                    Button(action: { Task { await model.login(username: username, password: password, capToken: capToken) } }) {
                        if model.isBusy { ProgressView() } else { Text("Log in") }
                    }
                    .disabled(
                        model.isBusy ||
                            username.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ||
                            password.isEmpty ||
                            !capSatisfied
                    )
                }
            }
            .navigationTitle("Elvish Mail")
            .onChange(of: model.lastError) { _, newVal in
                guard let newVal else { return }
                if model.authCapWidgetEndpoint != nil,
                   newVal.localizedCaseInsensitiveContains("captcha")
                {
                    capToken = ""
                    capEmbedReloadToken = UUID()
                }
            }
        }
#if os(macOS)
        .frame(maxWidth: 440)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.windowBackground)
#endif
    }

    private var capSatisfied: Bool {
        if model.authCapWidgetEndpoint == nil { return true }
        return !capToken.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
    }

    private func capEmbedURL() -> URL? {
        guard let raw = model.authCapWidgetEndpoint?.trimmingCharacters(in: .whitespacesAndNewlines), !raw.isEmpty else { return nil }
        var c = URLComponents(url: AppEnvironment.apiBaseURL.appendingPathComponent("auth/cap-embed.html"), resolvingAgainstBaseURL: false)
        c?.queryItems = [URLQueryItem(name: "endpoint", value: raw)]
        return c?.url
    }

    private var usernameDisplay: String {
        let u = username.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return u.isEmpty ? "you" : u
    }
}
