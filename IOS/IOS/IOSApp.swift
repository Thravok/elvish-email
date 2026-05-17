//
//  IOSApp.swift
//  IOS
//
//  Created by irc on 5/12/26.
//

import SwiftUI

@main
struct IOSApp: App {
    @State private var appModel = AppModel()

    var body: some Scene {
        WindowGroup {
            RootView(model: appModel)
#if os(macOS)
                .frame(minWidth: 880, minHeight: 540)
#endif
        }
#if os(macOS)
        .defaultSize(width: 1100, height: 720)
        .commands {
            CommandMenu("Mail") {
                Button("Refresh Mailbox") {
                    Task { await appModel.refreshMailData() }
                }
                .keyboardShortcut("r", modifiers: .command)
                .disabled(appModel.currentUser == nil || appModel.isBusy)
            }
            CommandMenu("Account") {
                Button("Log Out") {
                    Task { await appModel.logout() }
                }
                .keyboardShortcut("l", modifiers: [.command, .shift])
                .disabled(appModel.currentUser == nil || appModel.isBusy)
            }
        }
#endif
#if os(macOS)
        Settings {
            NavigationStack {
                AccountSettingsView(model: appModel)
            }
        }
#endif
    }
}

