import SwiftUI

struct ContentView: View {
    @EnvironmentObject private var store: ThermalMonitorStore
    @EnvironmentObject private var authStore: AuthStore

    var body: some View {
        NavigationSplitView {
            SidebarView()
                .navigationSplitViewColumnWidth(min: 210, ideal: 230, max: 260)
        } detail: {
            ZStack {
                AppBackground()
                selectedView
                    .padding(24)
            }
        }
        .toolbar {
            ToolbarItemGroup(placement: .primaryAction) {
                HStack(spacing: 7) {
                    Circle()
                        .fill(statusColor)
                        .frame(width: 7, height: 7)
                        .shadow(color: statusColor.opacity(0.8), radius: 4)
                    Text(store.connectionState.title)
                        .font(.system(size: 11, weight: .medium))
                }
                .padding(.horizontal, 10)
                .padding(.vertical, 6)
                .background(.regularMaterial, in: Capsule())

                Button {
                    authStore.logout()
                } label: {
                    Label("退出登录", systemImage: "rectangle.portrait.and.arrow.right")
                }
                .help("退出当前本机账号")

                Button {
                    store.isMonitoring.toggle()
                } label: {
                    Label(store.isMonitoring ? "暂停" : "继续", systemImage: store.isMonitoring ? "pause.fill" : "play.fill")
                }
                .help(store.isMonitoring ? "暂停热成像刷新" : "继续热成像刷新")
            }
        }
    }

    @ViewBuilder
    private var selectedView: some View {
        switch store.selectedSection ?? .dashboard {
        case .dashboard:
            DashboardView()
        case .monitor:
            LiveMonitorView()
        case .evacuation:
            EvacuationGuidanceView()
        case .hardware:
            HardwareView()
        case .equipment:
            ExperimentGuideView()
        case .alerts:
            AlertsView()
        }
    }

    private var statusColor: Color {
        switch store.connectionState {
        case .connected, .simulator: .green
        case .connecting: .cyan
        case .disconnected: .gray
        case .failed: .red
        }
    }
}

struct AppBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.025, green: 0.045, blue: 0.085),
                    Color(red: 0.045, green: 0.08, blue: 0.14),
                    Color(red: 0.02, green: 0.035, blue: 0.07)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            Canvas { context, size in
                let spacing: CGFloat = 42
                var path = Path()
                for x in stride(from: 0, through: size.width, by: spacing) {
                    path.move(to: CGPoint(x: x, y: 0))
                    path.addLine(to: CGPoint(x: x, y: size.height))
                }
                for y in stride(from: 0, through: size.height, by: spacing) {
                    path.move(to: CGPoint(x: 0, y: y))
                    path.addLine(to: CGPoint(x: size.width, y: y))
                }
                context.stroke(path, with: .color(.cyan.opacity(0.045)), lineWidth: 0.7)
            }
        }
        .ignoresSafeArea()
    }
}
