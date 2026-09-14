import SwiftUI

struct EvacuationGuidanceView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    private var exitBearing: Double {
        store.frame.risk == .high ? 18 : 42
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(
                    eyebrow: "疏散导航",
                    title: "指南针与逃生路线",
                    subtitle: "热点位置、风险等级与安全出口方向联动引导",
                    trailing: { RiskBadge(risk: store.frame.risk) }
                )

                HStack(spacing: 12) {
                    MetricCard(title: "推荐方向", value: "\(Int(exitBearing))°", unit: "东偏北", detail: directionText(exitBearing), icon: "location.north.fill", color: .cyan)
                    MetricCard(title: "最近安全出口", value: "86", unit: "米", detail: "东侧安全楼梯", icon: "arrow.up.right", color: .green)
                    MetricCard(title: "预计撤离时间", value: "42", unit: "秒", detail: "按正常步速估算", icon: "timer", color: .orange)
                    MetricCard(title: "当前最高温", value: String(format: "%.1f", store.frame.maxTemperature), unit: "°C", detail: store.frame.risk.title, icon: "thermometer.high", color: .red)
                }

                HStack(alignment: .top, spacing: 14) {
                    PanelCard(title: "实时指南针", subtitle: "指引前往最近安全出口", icon: "safari.fill") {
                        HStack(spacing: 26) {
                            CompassDialView(heading: 24, exitBearing: exitBearing, risk: store.frame.risk)
                                .frame(width: 260, height: 260)
                            VStack(alignment: .leading, spacing: 16) {
                                Text(directionText(exitBearing))
                                    .font(.system(size: 28, weight: .bold))
                                Text(turnInstruction)
                                    .font(.system(size: 13))
                                    .foregroundStyle(.secondary)
                                    .fixedSize(horizontal: false, vertical: true)
                                Divider().overlay(.blue.opacity(0.12))
                                Label("避开高温热区与浓烟区域", systemImage: "exclamationmark.triangle.fill")
                                    .foregroundStyle(.orange)
                                Label("沿绿色路线前往东侧楼梯", systemImage: "figure.walk")
                                    .foregroundStyle(.cyan)
                                Label("手机端支持实时磁力计方向", systemImage: "iphone.gen3.radiowaves.left.and.right")
                                    .foregroundStyle(.secondary)
                            }
                            .font(.system(size: 11, weight: .medium))
                            Spacer()
                        }
                        .padding(.vertical, 8)
                    }
                    .frame(maxWidth: .infinity)

                    PanelCard(title: "风险提醒", subtitle: "AI火警网警实时研判", icon: "shield.lefthalf.filled") {
                        VStack(alignment: .leading, spacing: 14) {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(store.frame.risk.title)
                                        .font(.system(size: 30, weight: .bold))
                                        .foregroundStyle(store.frame.risk.color)
                                    Text(store.frame.risk.shortDescription)
                                        .font(.system(size: 11))
                                        .foregroundStyle(.secondary)
                                }
                                Spacer()
                                Image(systemName: "location.north.circle.fill")
                                    .font(.system(size: 47))
                                    .foregroundStyle(store.frame.risk.color)
                            }
                            Divider().overlay(.blue.opacity(0.1))
                            Text("系统检测到 \(store.frame.hotspots.count) 处高温区域，最高温度 \(store.frame.maxTemperature.temperatureText)。建议立即离开热源方向，沿箭头方向移动至安全出口。")
                                .font(.system(size: 11))
                                .foregroundStyle(.secondary)
                                .lineSpacing(5)
                            Label("本功能为疏散演示，不替代消防广播和现场指挥。", systemImage: "info.circle")
                                .font(.system(size: 10))
                                .foregroundStyle(.orange)
                        }
                    }
                    .frame(width: 330)
                }

                PanelCard(title: "推荐逃生路线", subtitle: "三楼实验区 → 东侧安全楼梯 → 一楼集合点", icon: "point.topleft.down.to.point.bottomright.curvepath") {
                    HStack(alignment: .top, spacing: 18) {
                        EvacuationMapView()
                            .frame(maxWidth: .infinity, minHeight: 250)
                        VStack(spacing: 10) {
                            routeStep(index: 1, title: "离开当前热区", detail: "向西侧通道移动 12 米", color: .red)
                            routeStep(index: 2, title: "进入安全走廊", detail: "沿绿色引导线继续前进", color: .orange)
                            routeStep(index: 3, title: "东侧安全楼梯", detail: "不要乘坐电梯", color: .cyan)
                            routeStep(index: 4, title: "一楼集合点", detail: "到达后向消防负责人报到", color: .green)
                        }
                        .frame(width: 260)
                    }
                }
            }
            .padding(.bottom, 24)
        }
    }

    private var turnInstruction: String {
        let turn = ((exitBearing - 24 + 540).truncatingRemainder(dividingBy: 360)) - 180
        if abs(turn) < 15 { return "保持当前方向直行，约 86 米到达安全出口。" }
        return turn > 0
            ? "向右转 \(Int(abs(turn)))° 后前进，避开前方高温区域。"
            : "向左转 \(Int(abs(turn)))° 后前进，避开前方高温区域。"
    }

    private func directionText(_ bearing: Double) -> String {
        let labels = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"]
        let index = Int(round((((bearing.truncatingRemainder(dividingBy: 360)) + 360).truncatingRemainder(dividingBy: 360)) / 45)) % 8
        return "\(labels[index])向安全出口"
    }

    private func routeStep(index: Int, title: String, detail: String, color: Color) -> some View {
        HStack(spacing: 11) {
            Text("\(index)")
                .font(.system(size: 11, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .frame(width: 30, height: 30)
                .background(color.opacity(0.12), in: RoundedRectangle(cornerRadius: 8))
            VStack(alignment: .leading, spacing: 2) {
                Text(title).font(.system(size: 11, weight: .semibold))
                Text(detail).font(.system(size: 9)).foregroundStyle(.secondary)
            }
            Spacer()
        }
        .padding(10)
        .background(.black.opacity(0.13), in: RoundedRectangle(cornerRadius: 10))
    }
}

private struct CompassDialView: View {
    let heading: Double
    let exitBearing: Double
    let risk: RiskLevel

    private var turn: Double {
        ((exitBearing - heading + 540).truncatingRemainder(dividingBy: 360)) - 180
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(RadialGradient(colors: [.blue.opacity(0.19), .black.opacity(0.42)], center: .center, startRadius: 5, endRadius: 132))
            Circle().stroke(.cyan.opacity(0.28), lineWidth: 1)
            Circle().stroke(.blue.opacity(0.13), style: StrokeStyle(lineWidth: 1, dash: [5, 8]))
                .padding(24)
            ForEach(0..<24, id: \.self) { index in
                Capsule()
                    .fill(index % 6 == 0 ? Color.cyan : Color.blue.opacity(0.38))
                    .frame(width: index % 6 == 0 ? 2 : 1, height: index % 6 == 0 ? 15 : 8)
                    .offset(y: -111)
                    .rotationEffect(.degrees(Double(index) * 15))
            }
            Text("N").font(.system(size: 13, weight: .bold)).foregroundStyle(.red).offset(y: -82)
            Text("E").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).offset(x: 86)
            Text("S").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).offset(y: 86)
            Text("W").font(.system(size: 10, weight: .semibold)).foregroundStyle(.secondary).offset(x: -86)
            Image(systemName: "location.north.fill")
                .font(.system(size: 50, weight: .bold))
                .foregroundStyle(risk.color)
                .shadow(color: risk.color.opacity(0.72), radius: 13)
                .rotationEffect(.degrees(turn))
            Circle()
                .fill(.white)
                .frame(width: 11, height: 11)
                .shadow(color: .white.opacity(0.7), radius: 8)
            Text("出口 \(Int(exitBearing))°")
                .font(.system(size: 9, weight: .semibold, design: .monospaced))
                .foregroundStyle(.cyan)
                .offset(y: 106)
        }
    }
}

private struct EvacuationMapView: View {
    var body: some View {
        Canvas { context, size in
            let inset: CGFloat = 18
            let room = Path(roundedRect: CGRect(x: inset, y: inset, width: size.width - inset * 2, height: size.height - inset * 2), cornerRadius: 16)
            context.fill(room, with: .linearGradient(Gradient(colors: [.blue.opacity(0.12), .cyan.opacity(0.035)]), startPoint: .zero, endPoint: CGPoint(x: size.width, y: size.height)))
            context.stroke(room, with: .color(.cyan.opacity(0.28)), lineWidth: 1)

            var grid = Path()
            for x in stride(from: inset, through: size.width - inset, by: 31) {
                grid.move(to: CGPoint(x: x, y: inset))
                grid.addLine(to: CGPoint(x: x, y: size.height - inset))
            }
            for y in stride(from: inset, through: size.height - inset, by: 31) {
                grid.move(to: CGPoint(x: inset, y: y))
                grid.addLine(to: CGPoint(x: size.width - inset, y: y))
            }
            context.stroke(grid, with: .color(.blue.opacity(0.08)), lineWidth: 0.7)

            let corridor = Path(roundedRect: CGRect(x: size.width * 0.31, y: size.height * 0.18, width: size.width * 0.38, height: size.height * 0.64), cornerRadius: 18)
            context.fill(corridor, with: .color(.blue.opacity(0.06)))
            context.stroke(corridor, with: .color(.blue.opacity(0.17)), lineWidth: 1)

            let route = Path { path in
                path.move(to: CGPoint(x: size.width * 0.25, y: size.height * 0.68))
                path.addLine(to: CGPoint(x: size.width * 0.49, y: size.height * 0.68))
                path.addLine(to: CGPoint(x: size.width * 0.49, y: size.height * 0.37))
                path.addLine(to: CGPoint(x: size.width * 0.78, y: size.height * 0.37))
                path.addLine(to: CGPoint(x: size.width * 0.78, y: size.height * 0.16))
            }
            context.stroke(route, with: .color(.green.opacity(0.9)), style: StrokeStyle(lineWidth: 4, lineCap: .round, lineJoin: .round))

            let hot = CGRect(x: size.width * 0.16, y: size.height * 0.25, width: 78, height: 55)
            context.fill(Path(roundedRect: hot, cornerRadius: 12), with: .color(.red.opacity(0.18)))
            context.stroke(Path(roundedRect: hot, cornerRadius: 12), with: .color(.red.opacity(0.78)), lineWidth: 1.5)
            context.draw(Text("高温区").font(.system(size: 9, weight: .bold)).foregroundColor(.red), at: CGPoint(x: hot.midX, y: hot.midY))

            context.draw(Text("当前位置").font(.system(size: 9, weight: .bold)).foregroundColor(.cyan), at: CGPoint(x: size.width * 0.25, y: size.height * 0.72))
            context.draw(Text("安全出口").font(.system(size: 9, weight: .bold)).foregroundColor(.green), at: CGPoint(x: size.width * 0.78, y: size.height * 0.12))
        }
        .background(Color.black.opacity(0.16), in: RoundedRectangle(cornerRadius: 14))
        .overlay {
            RoundedRectangle(cornerRadius: 14).stroke(.blue.opacity(0.12), lineWidth: 1)
        }
    }
}
