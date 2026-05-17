import SwiftUI

/// Shared account UI: **iOS** uses it inside `TabView`; **macOS** uses it in the `Settings` scene (⌘,).
struct AccountSettingsView: View {
    @Bindable var model: AppModel

    var body: some View {
        Form {
            if let u = model.currentUser {
                Section("Account") {
                    LabeledContent("Email", value: u.email)
                    if let name = u.name, !name.isEmpty {
                        LabeledContent("Name", value: name)
                    }
                    LabeledContent(
                        "Mail keys",
                        value: model.mailKeysUnlocked ? "Unlocked (this session)" : "Locked — sign out and sign in again to decrypt"
                    )
                    .foregroundStyle(model.mailKeysUnlocked ? .primary : .secondary)
                }
            } else {
                Section {
                    Text("Sign in from the main window to manage your account.")
                        .foregroundStyle(.secondary)
                }
            }
            Section {
                Button("Log out", role: .destructive) {
                    Task { await model.logout() }
                }
                .disabled(model.currentUser == nil || model.isBusy)
            }
        }
#if os(macOS)
        .formStyle(.grouped)
        .frame(minWidth: 360, minHeight: 280)
        .padding()
#endif
        .navigationTitle("Settings")
    }
}
