import SwiftUI

struct MFAView: View {
    @Bindable var model: AppModel
    let challenge: (challengeId: String, methods: [String], user: AuthUserDTO?)

    @State private var code = ""
    @State private var useRecovery = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(challenge.user?.email ?? "Your account")
                        .foregroundStyle(.secondary)
                } header: {
                    Text("Two-factor authentication")
                }

                if challenge.methods.count > 1 {
                    Section {
                        if challenge.methods.contains("totp") {
                            Button("Authenticator app") { useRecovery = false }
                        }
                        if challenge.methods.contains("recovery") {
                            Button("Recovery code") { useRecovery = true }
                        }
                    }
                }

                Section {
                    if !challenge.methods.contains("totp"), !challenge.methods.contains("recovery"),
                       challenge.methods.contains("webauthn")
                    {
                        Text("Security key sign-in is not available in this app build yet. Use the web client or add TOTP/recovery.")
                            .foregroundStyle(.secondary)
                    } else {
                        SecureField(useRecovery ? "Recovery code" : "Authenticator code", text: $code)
                            .textContentType(.oneTimeCode)
                    }
                }

                if let err = model.lastError {
                    Section {
                        Text(err).foregroundStyle(.red)
                    }
                }

                Section {
                    Button("Verify") {
                        Task { await model.submitMFACode(code, useRecovery: useRecovery) }
                    }
                    .disabled(
                        model.isBusy || code.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            || (!challenge.methods.contains("totp") && !challenge.methods.contains("recovery"))
                    )

                    Button("Back", role: .cancel) { model.cancelMFA() }
                }
            }
            .navigationTitle("2FA")
            .onAppear {
                if challenge.methods.contains("recovery"), !challenge.methods.contains("totp") {
                    useRecovery = true
                }
            }
        }
#if os(macOS)
        .frame(maxWidth: 440)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.windowBackground)
#endif
    }
}
