import SwiftUI

// 用户端唯一的一屏：一个表盘 + 表盘正中的读数 + 底部三个文字按钮。
// 布局对位 iOS 指南针：表盘居中、超大等宽数字、下方两三行小字、底部纯文字控件。

struct UserHomeView: View {
    @State private var store = UserStore()
    @State private var heading = HeadingProvider()
    @State private var showsPositionSheet = false
    @State private var showsSteps = false

    private var isAlert: Bool { store.fire != nil }

    /// 表盘是否跟随手机朝向（真机罗盘模式）
    private var dialRotation: Double {
        guard store.useDeviceHeading, let value = heading.heading else { return 0 }
        return -value
    }

    private var needleRotation: Double { store.bearing - dialRotation }

    var body: some View {
        VStack(spacing: 0) {
            if let fire = store.fire {
                alertStrip(fire: fire)
            }

            Spacer(minLength: 8)

            ZStack {
                CompassDialView(dialRotation: dialRotation, needleRotation: needleRotation, isAlert: isAlert)
                    .frame(maxWidth: 420)

                readout
            }
            .padding(.horizontal, 24)

            Spacer(minLength: 8)

            statusLine
                .padding(.bottom, 18)

            tools
        }
        .background(Color.black.ignoresSafeArea())
        .preferredColorScheme(.dark)
        .sheet(isPresented: $showsPositionSheet) { PositionSheet(store: store) }
        .sheet(isPresented: $showsSteps) { StepsSheet(route: store.route) }
        .onOpenURL { store.handle(url: $0) }
        // 演示与截图用：-demoFire 直接进入火警态，-demoFloor 8 指定楼层
        .task {
            let arguments = ProcessInfo.processInfo.arguments
            if let index = arguments.firstIndex(of: "-demoFloor"), index + 1 < arguments.count,
               let floor = Int(arguments[index + 1]) {
                store.position.floor = floor
            }
            if arguments.contains("-demoFire") { store.startDrill() }
            if arguments.contains("-fixedNorth") {
                store.useDeviceHeading = false
            } else {
                // 与原版指南针一致：默认让表盘跟着手机转，拿不到权限时自动退回固定指北
                store.useDeviceHeading = true
                heading.start()
            }
        }
    }

    // 火警时唯一出现的一条横幅，细、窄、不抢表盘
    private func alertStrip(fire: FireSource) -> some View {
        HStack(spacing: 8) {
            Text("火警 · 立即撤离")
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.alertRed)
            Text("\(fire.floor) 楼起火")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.3))
        }
        .padding(.top, 6)
    }

    private var readout: some View {
        VStack(spacing: 2) {
            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(store.cardinal.short)
                    .font(.system(size: 26, weight: .semibold, design: .rounded))
                    .foregroundStyle(.white.opacity(0.6))
                Text("\(Int(store.bearing.rounded()))")
                    .font(.system(size: 76, weight: .light, design: .rounded))
                    .monospacedDigit()
                    .foregroundStyle(isAlert ? Color.alertRed : .white)
                Text("°")
                    .font(.system(size: 28, weight: .light, design: .rounded))
                    .foregroundStyle(.white.opacity(0.6))
            }
            .lineLimit(1)
            .minimumScaleFactor(0.6)

            Text("\(store.cardinal.label)方向")
                .font(.system(size: 13))
                .foregroundStyle(.white.opacity(0.55))

            VStack(spacing: 8) {
                metaRow(isAlert ? "撤离至" : "最近出口", store.route.ok ? store.route.exitLabel : "通道受阻")
                if store.route.ok {
                    metaRow("距离", "\(Int(store.route.meters.rounded())) 米 · 约 \(durationText(store.route.seconds))")
                    if let step = store.nextInstruction {
                        metaRow("下一步", step.title)
                    }
                } else if let reason = store.route.reason {
                    metaRow("提示", reason)
                }
            }
            .frame(width: 200)
            .padding(.top, 22)
        }
    }

    private func metaRow(_ label: String, _ value: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text(label)
                .foregroundStyle(.white.opacity(0.3))
            Spacer(minLength: 0)
            Text(value)
                .foregroundStyle(.white)
                .multilineTextAlignment(.trailing)
        }
        .font(.system(size: 12))
    }

    private var statusLine: some View {
        Text(statusText)
            .font(.system(size: 12))
            .foregroundStyle(.white.opacity(0.3))
    }

    private var statusText: String {
        if store.fire != nil {
            return "距起火点 \(Int(store.elapsed.rounded())) 秒，路线每秒重算"
        }
        let spot = ["A": "A 梯", "C": "走廊", "B": "B 梯"][store.position.spot] ?? "走廊"
        guard store.route.ok else { return "\(store.position.floor) 楼\(spot) · 等待定位" }
        let target = store.nextInstruction?.icon == .stair ? "进楼梯" : "到下一个路口"
        return "\(store.position.floor) 楼\(spot) · \(Int(store.distanceToNext.rounded())) 米后\(target)"
    }

    private var tools: some View {
        HStack(spacing: 44) {
            Button(isAlert ? "结束演练" : "演练") {
                isAlert ? store.stopDrill() : store.startDrill()
            }
            .foregroundStyle(isAlert ? Color.alertRed : .white.opacity(0.6))

            Button("我的位置") { showsPositionSheet = true }
                .foregroundStyle(.white.opacity(0.6))

            Button(store.useDeviceHeading ? "指北" : "罗盘") {
                if store.useDeviceHeading {
                    store.useDeviceHeading = false
                    heading.stop()
                } else {
                    heading.start()
                    store.useDeviceHeading = true
                    if !heading.authorized {
                        store.show(hint: "未获得方向权限，已保持固定指北")
                    }
                }
            }
            .foregroundStyle(.white.opacity(0.6))
        }
        .font(.system(size: 15))
        .buttonStyle(.plain)
        .padding(.bottom, 10)
        .overlay(alignment: .bottom) {
            if let hint = store.hint {
                Text(hint)
                    .font(.system(size: 12))
                    .padding(.horizontal, 14)
                    .padding(.vertical, 9)
                    .background(.ultraThinMaterial, in: Capsule())
                    .offset(y: -44)
                    .transition(.opacity)
            }
        }
    }

    private func durationText(_ seconds: Int) -> String {
        if seconds < 60 { return "\(seconds) 秒" }
        return "\(seconds / 60) 分 \(String(format: "%02d", seconds % 60)) 秒"
    }
}

// 位置选择：极简底部弹层
private struct PositionSheet: View {
    @Bindable var store: UserStore
    @Environment(\.dismiss) private var dismiss
    private let spots = [("A", "A 梯"), ("C", "走廊"), ("B", "B 梯")]

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("我的位置")
                .font(.system(size: 20, weight: .semibold))
            Text("实际部署时由蓝牙信标自动定位，这里用于演示手动选点。")
                .font(.system(size: 12))
                .foregroundStyle(.white.opacity(0.3))

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 6), count: 8), spacing: 6) {
                ForEach(1...Building.floorCount, id: \.self) { floor in
                    Button {
                        store.position.floor = floor
                    } label: {
                        Text("\(floor)")
                            .frame(maxWidth: .infinity, minHeight: 42)
                            .background(store.position.floor == floor ? Color.white : Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(store.position.floor == floor ? .black : .white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
            }

            LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3), spacing: 8) {
                ForEach(spots, id: \.0) { spot in
                    Button {
                        store.position.spot = spot.0
                    } label: {
                        Text(spot.1)
                            .frame(maxWidth: .infinity, minHeight: 44)
                            .background(store.position.spot == spot.0 ? Color.white : Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 10))
                            .foregroundStyle(store.position.spot == spot.0 ? .black : .white.opacity(0.6))
                    }
                    .buttonStyle(.plain)
                }
            }

            Button {
                dismiss()
            } label: {
                Text("完成")
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(Color.white.opacity(0.16), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
        }
        .padding(20)
        .presentationDetents([.height(320)])
        .presentationBackground(Color(white: 0.11))
    }
}

// 分步指引：用户端只在需要时用弹层展示完整步骤，主界面保持干净
private struct StepsSheet: View {
    let route: EvacuationRoute
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 14) {
                Text("分步指引")
                    .font(.system(size: 20, weight: .semibold))
                ForEach(Array(route.steps.enumerated()), id: \.element.id) { index, step in
                    HStack(alignment: .top, spacing: 12) {
                        Text(String(format: "%02d", index + 1))
                            .font(.system(size: 12, weight: .semibold))
                            .foregroundStyle(Color.alertRed)
                            .frame(width: 28, height: 28)
                            .background(Color.alertRed.opacity(0.16), in: RoundedRectangle(cornerRadius: 8))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(step.title).font(.system(size: 15, weight: .semibold))
                            Text(step.detail)
                                .font(.system(size: 12))
                                .foregroundStyle(.white.opacity(0.45))
                        }
                    }
                }
            }
            .padding(20)
        }
        .presentationDetents([.medium, .large])
        .presentationBackground(Color(white: 0.11))
    }
}
