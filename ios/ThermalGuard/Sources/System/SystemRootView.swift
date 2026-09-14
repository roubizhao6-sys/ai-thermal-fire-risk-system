import SwiftUI

// 系统检测端的四个入口：地图（指挥视角）/ 检测 / 预警 / 逃生

struct SystemRootView: View {
    @State private var store = SystemStore()
    @State private var tab: Tab = .map

    enum Tab: Hashable { case map, monitor, detect, alerts, escape }

    var body: some View {
        TabView(selection: $tab) {
            CityHeatMapView(store: store)
                .tabItem { Label("地图", systemImage: "map") }
                .tag(Tab.map)

            LiveMonitorView(store: store)
                .tabItem { Label("监控", systemImage: "video") }
                .tag(Tab.monitor)

            DetectView(store: store)
                .tabItem { Label("检测", systemImage: "thermometer.medium") }
                .tag(Tab.detect)

            AlertsView(store: store)
                .tabItem { Label("预警", systemImage: "bell.badge") }
                .tag(Tab.alerts)

            EscapePreviewView(store: store)
                .tabItem { Label("逃生", systemImage: "figure.walk") }
                .tag(Tab.escape)
        }
        .tint(.alertRed)
        .preferredColorScheme(.dark)
        .task {
            store.startSimulator()
            // 演示与截图用：-startTab detect|alerts|escape|map，-demoFire 直接进入报警
            let arguments = ProcessInfo.processInfo.arguments
            if let index = arguments.firstIndex(of: "-startTab"), index + 1 < arguments.count {
                switch arguments[index + 1] {
                case "detect": tab = .detect
                case "monitor": tab = .monitor
                case "alerts": tab = .alerts
                case "escape": tab = .escape
                default: tab = .map
                }
            }
            if arguments.contains("-demoFire") { store.startDrill(floor: 4) }
        }
        .fullScreenCover(isPresented: $store.showAlarm) {
            AlarmOverlayView(store: store)
        }
    }
}

// 报警中心：全屏高对比报警，和 Web 端同一套交互
private struct AlarmOverlayView: View {
    @Bindable var store: SystemStore
    @Environment(\.openURL) private var openURL

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()
            VStack(spacing: 18) {
                HStack {
                    Text(store.fire?.isDrill == true ? "火警演练" : "真实警情")
                        .font(.system(size: 12, weight: .semibold))
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(store.fire?.isDrill == true ? Color.orange : Color.alertRed, in: Capsule())
                        .foregroundStyle(store.fire?.isDrill == true ? .black : .white)
                    Spacer()
                }

                Spacer()

                Image(systemName: "flame.fill")
                    .font(.system(size: 52))
                    .foregroundStyle(.white)
                    .padding(30)
                    .background(Color.alertRed, in: Circle())

                Text("火警警报")
                    .font(.system(size: 40, weight: .bold))
                Text(store.fire.map { "\($0.floor) 楼走廊中段" } ?? "未知位置")
                    .font(.system(size: 15))
                    .foregroundStyle(.white.opacity(0.6))
                Text("立即沿逃生路线撤离，切勿搭乘电梯")
                    .font(.system(size: 16))
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, 24)

                Spacer()

                // 把警情推给用户端 App：真实产品走 APNs，演示用 URL scheme
                Button {
                    let floor = store.fire?.floor ?? 4
                    if let url = FireLink.makeFireURL(floor: floor) { openURL(url) }
                } label: {
                    Label("推送警情到用户端", systemImage: "arrow.up.forward.app")
                        .font(.system(size: 15, weight: .medium))
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(Color.white.opacity(0.14), in: RoundedRectangle(cornerRadius: 14))
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 20)

                Button {
                    store.resolveAlarm()
                } label: {
                    Text(store.fire?.isDrill == true ? "结束演练" : "解除警报")
                        .font(.system(size: 17, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 56)
                        .background(Color.safeGreen, in: RoundedRectangle(cornerRadius: 16))
                        .foregroundStyle(.black)
                }
                .buttonStyle(.plain)
                .padding(.horizontal, 20)
                .padding(.bottom, 24)
            }
            .padding(.top, 12)
        }
    }
}

// 逃生预览：系统端给指挥员看的疏散态势（完整 UI 在用户端）
private struct EscapePreviewView: View {
    @Bindable var store: SystemStore
    @State private var now = Date()

    private var route: EvacuationRoute {
        let elapsed = store.fire.map { max(0, now.timeIntervalSince($0.startedAt)) } ?? 0
        return Evacuation.plan(startId: "C4", fire: store.fire, elapsed: elapsed)
    }

    var body: some View {
        ScrollView {
            let route = route
            VStack(alignment: .leading, spacing: 14) {
                Text("逃生指引")
                    .font(.system(size: 11, weight: .semibold))
                    .foregroundStyle(Color.alertRed)
                Text(store.fire == nil ? "常规疏散路线" : "火警疏散路线")
                    .font(.system(size: 28, weight: .bold))

                VStack(alignment: .leading, spacing: 6) {
                    Text("建议撤离至").font(.system(size: 12)).foregroundStyle(.white.opacity(0.35))
                    Text(route.ok ? route.exitLabel : "通道受阻")
                        .font(.system(size: 20, weight: .semibold))
                    if route.ok {
                        Text("\(Int(route.meters.rounded())) 米 · 约 \(route.seconds) 秒")
                            .font(.system(size: 13))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color(white: 0.11), in: RoundedRectangle(cornerRadius: 18))

                ForEach(Array(route.steps.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: 12) {
                        Text(String(format: "%02d", index + 1))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.alertRed)
                            .frame(width: 28, height: 28)
                            .background(Color.alertRed.opacity(0.16), in: RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(step.title).font(.system(size: 15, weight: .semibold))
                            Text(step.detail).font(.system(size: 12)).foregroundStyle(.white.opacity(0.45))
                        }
                    }
                }

                if !route.warnings.isEmpty {
                    VStack(alignment: .leading, spacing: 8) {
                        ForEach(route.warnings, id: \.self) { warning in
                            HStack(alignment: .top, spacing: 8) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                Text(warning).font(.system(size: 12))
                            }
                            .foregroundStyle(.orange)
                        }
                    }
                    .padding(14)
                    .background(Color.orange.opacity(0.12), in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(16)
        }
        .background(Color.black)
        .task {
            while !Task.isCancelled {
                now = Date()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }
}

// 预警记录
struct AlertsView: View {
    @Bindable var store: SystemStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 12) {
                VStack(alignment: .leading, spacing: 6) {
                    Text("预警记录")
                        .font(.system(size: 11, weight: .semibold))
                        .foregroundStyle(Color.alertRed)
                    Text("检测日志").font(.system(size: 28, weight: .bold))
                    Text("自动留存检测日志，支持事后回溯起火原因与蔓延过程")
                        .font(.system(size: 13))
                        .foregroundStyle(.white.opacity(0.5))
                }
                .padding(.top, 8)

                ForEach(store.alerts) { point in
                    HStack(spacing: 12) {
                        Circle()
                            .fill(color(for: point.risk))
                            .frame(width: 10, height: 10)
                        VStack(alignment: .leading, spacing: 3) {
                            Text(point.name).font(.system(size: 15, weight: .semibold))
                            Text("\(point.area) · \(point.time)")
                                .font(.system(size: 12))
                                .foregroundStyle(.white.opacity(0.4))
                        }
                        Spacer()
                        VStack(alignment: .trailing, spacing: 3) {
                            Text(point.risk.label)
                                .font(.system(size: 12, weight: .semibold))
                                .foregroundStyle(color(for: point.risk))
                            Text(String(format: "%.1f°C", point.temperature))
                                .font(.system(size: 12))
                                .monospacedDigit()
                                .foregroundStyle(.white.opacity(0.5))
                        }
                    }
                    .padding(14)
                    .background(Color(white: 0.11), in: RoundedRectangle(cornerRadius: 14))
                }
            }
            .padding(16)
        }
        .background(Color.black)
    }

    private func color(for risk: RiskLevel) -> Color {
        switch risk {
        case .high: return .alertRed
        case .medium: return .orange
        case .low: return .safeGreen
        }
    }
}
