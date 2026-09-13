import SwiftUI

struct AlertsView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            PageHeader(
                eyebrow: "预警记录",
                title: "高温事件与处置记录",
                subtitle: "中高风险事件自动进入记录，最多保留最近 30 条",
                trailing: {
                    Button(role: .destructive) {
                        store.alertFrames.removeAll()
                    } label: {
                        Label("清空记录", systemImage: "trash")
                    }
                    .disabled(store.alertFrames.isEmpty)
                }
            )

            if store.alertFrames.isEmpty {
                PanelCard(title: "暂无预警记录", subtitle: "系统运行正常或尚未触发中高风险", icon: "checkmark.shield") {
                    VStack(spacing: 14) {
                        Image(systemName: "shield.checkered")
                            .font(.system(size: 44))
                            .foregroundStyle(.green)
                        Text("当前没有需要处理的高温事件")
                            .font(.system(size: 13, weight: .medium))
                        Text("当最高温度超过 45°C 时，系统会自动记录一次预警。")
                            .font(.system(size: 10))
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 50)
                }
            } else {
                VStack(spacing: 9) {
                    ForEach(store.alertFrames) { frame in
                        alertRow(frame)
                    }
                }
            }
        }
    }

    private func alertRow(_ frame: ThermalFrame) -> some View {
        HStack(spacing: 14) {
            Image(systemName: frame.risk == .high ? "exclamationmark.triangle.fill" : "exclamationmark.circle.fill")
                .font(.system(size: 18))
                .foregroundStyle(frame.risk.color)
                .frame(width: 42, height: 42)
                .background(frame.risk.color.opacity(0.1), in: RoundedRectangle(cornerRadius: 11))

            VStack(alignment: .leading, spacing: 5) {
                HStack(spacing: 8) {
                    RiskBadge(risk: frame.risk, compact: true)
                    Text(frame.source)
                        .font(.system(size: 10, weight: .medium))
                }
                Text(frame.timestamp, format: .dateTime.year().month().day().hour().minute().second())
                    .font(.system(size: 9, design: .monospaced))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text(frame.maxTemperature.temperatureText)
                    .font(.system(size: 17, weight: .bold, design: .monospaced))
                    .foregroundStyle(frame.risk.color)
                Text("\(frame.hotspots.count) 个高温区域")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            Button {
                store.selectedSection = .monitor
            } label: {
                Image(systemName: "arrow.up.right")
            }
            .buttonStyle(.borderless)
            .help("查看实时热成像")
        }
        .padding(14)
        .background(.black.opacity(0.14), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(frame.risk.color.opacity(0.16), lineWidth: 1)
        }
    }
}
