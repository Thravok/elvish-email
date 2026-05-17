import SwiftUI

struct RootView: View {
    @Bindable var model: AppModel

    var body: some View {
        Group {
            if model.currentUser != nil {
                MailHomeView(model: model)
            } else if let mfa = model.mfaChallenge {
                MFAView(model: model, challenge: mfa)
            } else {
                LoginView(model: model)
            }
        }
        .task { await model.bootstrap() }
    }
}
