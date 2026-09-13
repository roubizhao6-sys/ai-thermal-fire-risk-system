import SwiftUI

// 检测页：热像矩阵 + 检测流程 + 结果分级，高风险直接进入报警。
// 热像用 Canvas 逐像素上色，配色与 Web 端 heat 色标一致。

struct DetectView: View {
    @Bindable var store: SystemStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header
                thermalCard
                resultCard
            }
            .padding(16)
        }
        .background(Color.black)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("首页检测")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.alertRed)
                .textCase(.uppercase)
            Text("热成像风险检测")
                .font(.system(size: 30, weight: .bold))
            Text("超早期温度预警 · 多维度智能判断")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(.top, 8)
    }

    private var thermalCard: some View {
        VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("实时热像").font(.system(size: 16, weight: .semibold))
                    Text(store.frame.source).font(.system(size: 12)).foregroundStyle(.white.opacity(0.35))
                }
                Spacer()
                Text(String(format: "%.1f°C", store.frame.maxTemp))
                    .font(.system(size: 20, weight: .semibold))
                    .monospacedDigit()
                    .foregroundStyle(color(for: store.frame.risk()))
            }

            ThermalMatrixView(frame: store.frame)
                .frame(height: 220)
                .clipShape(RoundedRectangle(cornerRadius: 14))

            if store.isDetecting {
                ProgressView(value: store.progress)
                    .tint(Color.alertRed)
                Text("AI 正在分析温度轮廓与扩散梯度")
                    .font(.system(size: 12))
                    .foregroundStyle(.white.opacity(0.4))
            } else {
                Button {
                    store.runDetection()
                } label: {
                    Text("开始 AI 检测")
                        .font(.system(size: 16, weight: .semibold))
                        .frame(maxWidth: .infinity, minHeight: 50)
                        .background(Color.alertRed, in: RoundedRectangle(cornerRadius: 14))
                        .foregroundStyle(.white)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(16)
        .background(Color(white: 0.11), in: RoundedRectangle(cornerRadius: 20))
    }

    private var resultCard: some View {
        let risk = store.frame.risk()
        return VStack(alignment: .leading, spacing: 14) {
            HStack {
                VStack(alignment: .leading, spacing: 3) {
                    Text("风险等级").font(.system(size: 12)).foregroundStyle(.white.opacity(0.35))
                    Text(risk.label).font(.system(size: 22, weight: .bold)).foregroundStyle(color(for: risk))
                }
                Spacer()
                Text(risk.advice)
                    .font(.system(size: 13, weight: .medium))
                    .padding(.horizontal, 12)
                    .padding(.vertical, 6)
                    .background(color(for: risk).opacity(0.16), in: Capsule())
                    .foregroundStyle(color(for: risk))
            }

            HStack(spacing: 10) {
                metric("最高温度", String(format: "%.1f°C", store.frame.maxTemp))
                metric("高温区域", "\(store.frame.hotspots.count) 处")
                metric("平均温度", String(format: "%.1f°C", store.frame.averageTemp))
            }

            Button {
                store.startDrill(floor: 4)
            } label: {
                Text("启动火警演练")
                    .font(.system(size: 15, weight: .semibold))
                    .frame(maxWidth: .infinity, minHeight: 46)
                    .background(Color.white.opacity(0.12), in: RoundedRectangle(cornerRadius: 12))
            }
            .buttonStyle(.plain)
        }
        .padding(16)
        .background(Color(white: 0.11), in: RoundedRectangle(cornerRadius: 20))
    }

    private func metric(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(label).font(.system(size: 11)).foregroundStyle(.white.opacity(0.35))
            Text(value).font(.system(size: 15, weight: .semibold)).monospacedDigit()
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Color.white.opacity(0.06), in: RoundedRectangle(cornerRadius: 12))
    }

    private func color(for risk: RiskLevel) -> Color {
        switch risk {
        case .high: return .alertRed
        case .medium: return .orange
        case .low: return .safeGreen
        }
    }
}

/// 32×24 热像矩阵：逐像素映射到热力色标
struct ThermalMatrixView: View {
    let frame: ThermalFrame

    var body: some View {
        Canvas { context, size in
            let cellW = size.width / Double(frame.width)
            let cellH = size.height / Double(frame.height)
            let range = max(frame.maxTemp - frame.minTemp, 0.1)

            for y in 0..<frame.height {
                for x in 0..<frame.width {
                    let value = (frame.temperatures[y * frame.width + x] - frame.minTemp) / range
                    let rect = CGRect(x: Double(x) * cellW, y: Double(y) * cellH, width: cellW + 0.6, height: cellH + 0.6)
                    context.fill(Path(rect), with: .color(Self.thermalColor(value)))
                }
            }

            for spot in frame.hotspots {
                let rect = CGRect(
                    x: size.width * spot.x / 100,
                    y: size.height * spot.y / 100,
                    width: size.width * spot.width / 100,
                    height: size.height * spot.height / 100
                )
                context.stroke(Path(rect), with: .color(.orange), lineWidth: 1.6)
            }
        }
        .background(Color.black)
    }

    static func thermalColor(_ value: Double) -> Color {
        let t = min(max(value, 0), 1)
        let stops: [(Double, (Double, Double, Double))] = [
            (0.0, (7, 13, 30)),
            (0.24, (32, 28, 93)),
            (0.44, (125, 23, 84)),
            (0.62, (220, 38, 50)),
            (0.78, (249, 115, 22)),
            (0.90, (250, 204, 21)),
            (1.0, (255, 251, 220)),
        ]
        var lower = stops[0]
        var upper = stops[stops.count - 1]
        for index in 1..<stops.count where t <= stops[index].0 {
            lower = stops[index - 1]
            upper = stops[index]
            break
        }
        let span = max(upper.0 - lower.0, 0.001)
        let p = (t - lower.0) / span
        let r = (lower.1.0 + (upper.1.0 - lower.1.0) * p) / 255
        let g = (lower.1.1 + (upper.1.1 - lower.1.1) * p) / 255
        let b = (lower.1.2 + (upper.1.2 - lower.1.2) * p) / 255
        return Color(red: r, green: g, blue: b)
    }
}
