import SwiftUI

struct LiveMonitorView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PageHeader(
                eyebrow: "实时热成像",
                title: "温度矩阵与热源定位",
                subtitle: "\(store.frame.width) × \(store.frame.height) 热成像采样矩阵",
                trailing: {
                    HStack(spacing: 10) {
                        RiskBadge(risk: store.frame.risk)
                        Button {
                            store.isMonitoring.toggle()
                        } label: {
                            Label(store.isMonitoring ? "暂停监测" : "继续监测", systemImage: store.isMonitoring ? "pause.fill" : "play.fill")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                }
            )

            HStack(alignment: .top, spacing: 14) {
                PanelCard(title: "热成像画面", subtitle: "温度越高颜色越亮，橙框代表疑似高温区域", icon: "camera.viewfinder") {
                    ThermalGridView(frame: store.frame)
                }
                .frame(maxWidth: .infinity)

                VStack(spacing: 14) {
                    liveMetrics
                    sourcePanel
                    actionPanel
                }
                .frame(width: 315)
            }
        }
    }

    private var liveMetrics: some View {
        PanelCard(title: "实时读数", subtitle: "当前热成像帧", icon: "gauge.with.dots.needle.50percent") {
            VStack(spacing: 13) {
                HStack(spacing: 12) {
                    readingBlock(title: "最高温度", value: store.frame.maxTemperature.temperatureText, color: .orange)
                    readingBlock(title: "最低温度", value: store.frame.minTemperature.temperatureText, color: .blue)
                }
                HStack(spacing: 12) {
                    readingBlock(title: "平均温度", value: store.frame.averageTemperature.temperatureText, color: .cyan)
                    readingBlock(title: "高温区域", value: "\(store.frame.hotspots.count) 处", color: .red)
                }
            }
        }
    }

    private var sourcePanel: some View {
        PanelCard(title: "当前数据源", subtitle: store.source.subtitle, icon: store.source.icon) {
            VStack(alignment: .leading, spacing: 12) {
                HStack {
                    Image(systemName: store.source.icon)
                        .foregroundStyle(.blue)
                    Text(store.source.title)
                        .font(.system(size: 13, weight: .semibold))
                    Spacer()
                    Text(store.connectionState.title)
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(store.isConnected ? .green : .red)
                }
                Text(store.statusMessage)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)

                HStack {
                    Text("采样时间")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                    Spacer()
                    Text(store.frame.timestamp, format: .dateTime.hour().minute().second().secondFraction(.fractional(1)))
                        .font(.system(size: 9, design: .monospaced))
                }
            }
        }
    }

    private var actionPanel: some View {
        PanelCard(title: "监测控制", subtitle: "演示与硬件切换", icon: "slider.horizontal.3") {
            VStack(spacing: 9) {
                Button {
                    store.connectSimulator()
                    store.isMonitoring = true
                } label: {
                    Label("启动模拟热像仪", systemImage: "waveform.path.ecg")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .controlSize(.large)

                Button {
                    store.selectedSection = .hardware
                } label: {
                    Label("连接 ESP32 硬件", systemImage: "cable.connector")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.bordered)
                .controlSize(.large)
            }
        }
    }

    private func readingBlock(title: String, value: String, color: Color) -> some View {
        VStack(alignment: .leading, spacing: 5) {
            Text(title)
                .font(.system(size: 9))
                .foregroundStyle(.secondary)
            Text(value)
                .font(.system(size: 16, weight: .bold, design: .monospaced))
                .foregroundStyle(color)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
        }
        .padding(11)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(color.opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
        .overlay {
            RoundedRectangle(cornerRadius: 9)
                .stroke(color.opacity(0.14), lineWidth: 1)
        }
    }
}
