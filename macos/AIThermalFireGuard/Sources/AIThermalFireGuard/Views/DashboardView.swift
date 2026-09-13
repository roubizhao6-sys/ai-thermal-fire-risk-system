import Charts
import SwiftUI

struct DashboardView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    private let columns = Array(repeating: GridItem(.flexible(), spacing: 12), count: 4)

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(
                    eyebrow: "运行总览",
                    title: "AI 热感火警风险检测系统",
                    subtitle: "热成像矩阵、温度估算与风险分级实时联动",
                    trailing: {
                        HStack(spacing: 10) {
                            RiskBadge(risk: store.frame.risk)
                            Text(store.frame.timestamp, format: .dateTime.hour().minute().second())
                                .font(.system(size: 10, design: .monospaced))
                                .foregroundStyle(.secondary)
                        }
                    }
                )

                LazyVGrid(columns: columns, spacing: 12) {
                    MetricCard(
                        title: "最高温度估算",
                        value: String(format: "%.1f", store.frame.maxTemperature),
                        unit: "°C",
                        detail: "实时",
                        icon: "thermometer.high",
                        color: .orange
                    )
                    MetricCard(
                        title: "识别高温区域",
                        value: "\(store.frame.hotspots.count)",
                        unit: "处",
                        detail: "目标检测",
                        icon: "scope",
                        color: .red
                    )
                    MetricCard(
                        title: "平均画面温度",
                        value: String(format: "%.1f", store.frame.averageTemperature),
                        unit: "°C",
                        detail: "矩阵均值",
                        icon: "chart.line.uptrend.xyaxis",
                        color: .blue
                    )
                    MetricCard(
                        title: "数据刷新频率",
                        value: store.source == .simulator ? "3.1" : "实时",
                        unit: store.source == .simulator ? "帧/秒" : "",
                        detail: store.source.title,
                        icon: "waveform.path.ecg",
                        color: .cyan
                    )
                }

                HStack(alignment: .top, spacing: 14) {
                    PanelCard(title: "实时热成像", subtitle: "32 × 24 温度矩阵", icon: "heat.waves") {
                        ThermalGridView(frame: store.frame)
                    }
                    .frame(maxWidth: .infinity)

                    VStack(spacing: 14) {
                        riskSummary
                        connectionSummary
                    }
                    .frame(width: 310)
                }

                HStack(alignment: .top, spacing: 14) {
                    temperatureTrend
                    hotspotSummary
                }
            }
            .padding(.bottom, 24)
        }
    }

    private var riskSummary: some View {
        PanelCard(title: "风险研判", subtitle: "多级预警模型", icon: "shield.lefthalf.filled") {
            VStack(alignment: .leading, spacing: 15) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(store.frame.risk.title)
                            .font(.system(size: 26, weight: .bold))
                            .foregroundStyle(store.frame.risk.color)
                        Text(store.frame.risk.shortDescription)
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                    }
                    Spacer()
                    RiskBadge(risk: store.frame.risk)
                }

                Divider().overlay(.blue.opacity(0.1))

                riskLevelRow(.low, range: "低于 45°C")
                riskLevelRow(.medium, range: "45–65°C")
                riskLevelRow(.high, range: "高于 65°C")
            }
        }
    }

    private var connectionSummary: some View {
        PanelCard(title: "系统状态", subtitle: "硬件与算法服务", icon: "antenna.radiowaves.left.and.right") {
            VStack(spacing: 0) {
                statusRow("数据源", value: store.source.title, color: .blue)
                statusRow("连接状态", value: store.connectionState.title, color: store.isConnected ? .green : .red)
                statusRow("热像分辨率", value: "\(store.frame.width) × \(store.frame.height)", color: .cyan)
                statusRow("算法状态", value: store.isMonitoring ? "运行中" : "已暂停", color: store.isMonitoring ? .green : .orange, showDivider: false)
            }
        }
    }

    private var temperatureTrend: some View {
        PanelCard(title: "最高温度趋势", subtitle: "最近 80 个采样点", icon: "chart.xyaxis.line") {
            Chart(store.history) { sample in
                AreaMark(
                    x: .value("时间", sample.timestamp),
                    y: .value("温度", sample.maxTemperature)
                )
                .foregroundStyle(
                    LinearGradient(
                        colors: [.orange.opacity(0.35), .orange.opacity(0.02)],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                )

                LineMark(
                    x: .value("时间", sample.timestamp),
                    y: .value("温度", sample.maxTemperature)
                )
                .foregroundStyle(.orange)
                .lineStyle(StrokeStyle(lineWidth: 2))
            }
            .chartYScale(domain: 20...100)
            .chartXAxis(.hidden)
            .chartYAxis {
                AxisMarks(position: .leading) { value in
                    AxisGridLine().foregroundStyle(.blue.opacity(0.08))
                    AxisValueLabel {
                        if let temperature = value.as(Double.self) {
                            Text("\(Int(temperature))°")
                                .font(.system(size: 8))
                                .foregroundStyle(.secondary)
                        }
                    }
                }
            }
            .frame(height: 175)
        }
        .frame(maxWidth: .infinity)
    }

    private var hotspotSummary: some View {
        PanelCard(title: "高温热区", subtitle: "目标检测结果", icon: "scope") {
            VStack(spacing: 8) {
                ForEach(Array(store.frame.hotspots.prefix(3).enumerated()), id: \.element.id) { index, hotspot in
                    HStack(spacing: 11) {
                        Text(String(format: "%02d", index + 1))
                            .font(.system(size: 9, weight: .bold, design: .monospaced))
                            .foregroundStyle(.orange)
                            .frame(width: 28, height: 28)
                            .background(.orange.opacity(0.09), in: RoundedRectangle(cornerRadius: 7))
                        VStack(alignment: .leading, spacing: 3) {
                            Text("疑似高温区域 \(index + 1)")
                                .font(.system(size: 11, weight: .medium))
                            Text("置信度 \(hotspot.confidence.percentText)")
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        Text(hotspot.temperature.temperatureText)
                            .font(.system(size: 12, weight: .bold, design: .monospaced))
                            .foregroundStyle(.orange)
                    }
                    .padding(9)
                    .background(.black.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
                }
            }
        }
        .frame(width: 360)
    }

    private func riskLevelRow(_ level: RiskLevel, range: String) -> some View {
        HStack(spacing: 11) {
            Circle()
                .fill(level.color)
                .frame(width: 8, height: 8)
                .shadow(color: level.color.opacity(0.6), radius: 4)
            Text(level.title)
                .font(.system(size: 11, weight: store.frame.risk == level ? .semibold : .regular))
            Spacer()
            Text(range)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
        }
        .padding(8)
        .background(store.frame.risk == level ? level.color.opacity(0.09) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
    }

    private func statusRow(_ title: String, value: String, color: Color, showDivider: Bool = true) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(title)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                Spacer()
                Text(value)
                    .font(.system(size: 10, weight: .medium))
                    .foregroundStyle(color)
            }
            .padding(.vertical, 9)
            if showDivider {
                Divider().overlay(.blue.opacity(0.08))
            }
        }
    }
}

struct PageHeader<Trailing: View>: View {
    let eyebrow: String
    let title: String
    let subtitle: String
    @ViewBuilder let trailing: Trailing

    init(
        eyebrow: String,
        title: String,
        subtitle: String,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.eyebrow = eyebrow
        self.title = title
        self.subtitle = subtitle
        self.trailing = trailing()
    }

    var body: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 8) {
                Text(eyebrow.uppercased())
                    .font(.system(size: 9, weight: .bold))
                    .foregroundStyle(.blue)
                    .tracking(1.3)
                Text(title)
                    .font(.system(size: 29, weight: .bold))
                Text(subtitle)
                    .font(.system(size: 12))
                    .foregroundStyle(.secondary)
            }
            Spacer()
            trailing
        }
    }
}

extension PageHeader where Trailing == EmptyView {
    init(eyebrow: String, title: String, subtitle: String) {
        self.init(eyebrow: eyebrow, title: title, subtitle: subtitle) {
            EmptyView()
        }
    }
}
