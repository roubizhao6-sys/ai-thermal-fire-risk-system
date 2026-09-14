import AppKit
import SwiftUI

@main
struct AIThermalFireGuardApp: App {
    @NSApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var store = ThermalMonitorStore()
    @StateObject private var authStore = AuthStore()

    var body: some Scene {
        WindowGroup("AI热感火警风险检测系统") {
            Group {
                if authStore.isAuthenticated {
                    ContentView()
                        .environmentObject(store)
                        .environmentObject(authStore)
                } else {
                    LoginView()
                        .environmentObject(authStore)
                }
            }
                .frame(minWidth: 1180, minHeight: 760)
                .preferredColorScheme(.dark)
        }
        .defaultSize(width: 1320, height: 860)
        .windowToolbarStyle(.unifiedCompact)

        Settings {
            SettingsView()
                .environmentObject(store)
                .frame(width: 560, height: 420)
                .preferredColorScheme(.dark)
        }
    }
}

final class AppDelegate: NSObject, NSApplicationDelegate {
    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.regular)
        NSApp.activate(ignoringOtherApps: true)
    }
}
