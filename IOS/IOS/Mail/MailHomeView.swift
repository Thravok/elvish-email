import SwiftUI

struct MailHomeView: View {
    @Bindable var model: AppModel

    var body: some View {
#if os(macOS)
        MailSplitView(model: model)
#else
        TabView {
            MailSplitView(model: model)
                .tabItem { Label("Mail", systemImage: "tray.2") }
            NavigationStack {
                AccountSettingsView(model: model)
            }
            .tabItem { Label("Settings", systemImage: "gearshape") }
        }
#endif
    }
}
