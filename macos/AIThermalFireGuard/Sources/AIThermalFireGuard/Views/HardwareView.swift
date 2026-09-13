import SwiftUI

struct HardwareView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                PageHeader(
                    eyebrow: "硬件连接",
                    title: "连接真实热成像设备",
                    subtitle: "支持 ESP32-S3 USB 串口与 Wi-Fi WebSocket 数据流",
                    trailing: {
                        HStack(spacing: 8) {
                            Circle()
                                .fill(store.isConnected ? .green : .red)
                                .frame(width: 8, height: 8)
                                .shadow(color: (store.isConnected ? Color.green : Color.red).opacity(0.6), radius: 4)
                            Text(store.connectionState.title)
                                .font(.system(size: 11, weight: .semibold))
                        }
                        .padding(.horizontal, 11)
                        .padding(.vertical, 7)
                        .background(.regularMaterial, in: Capsule())
                    }
                )

                sourcePicker

                HStack(alignment: .top, spacing: 14) {
                    connectionForm
                    protocolPanel
                }

                PanelCard(title: "数据接入检查", subtitle: "连接前检查清单", icon: "checklist") {
                    LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 14), count: 2), spacing: 12) {
                        checklistItem("ESP32 已烧录串口或 WebSocket 固件", icon: "cpu")
                        checklistItem("热成像传感器输出 32×24 或 24×32 温度矩阵", icon: "heat.waves")
                        checklistItem("USB 串口模式使用 115200 波特率、每行一条 JSON", icon: "cable.connector")
                        checklistItem("Wi-Fi 模式确保 Mac 与 ESP32 在同一网络", icon: "wifi")
                    }
                }
            }
            .padding(.bottom, 24)
        }
    }

    private var sourcePicker: some View {
        HStack(spacing: 12) {
            ForEach(HardwareSource.allCases) { source in
                Button {
                    store.source = source
                    if source == .simulator {
                        store.connectSimulator()
                    }
                } label: {
                    HStack(spacing: 11) {
                        Image(systemName: source.icon)
                            .font(.system(size: 18))
                            .foregroundStyle(store.source == source ? .white : .blue)
                            .frame(width: 38, height: 38)
                            .background(store.source == source ? Color.blue : Color.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
                        VStack(alignment: .leading, spacing: 3) {
                            Text(source.title)
                                .font(.system(size: 12, weight: .semibold))
                            Text(source.subtitle)
                                .font(.system(size: 9))
                                .foregroundStyle(.secondary)
                        }
                        Spacer()
                        if store.source == source {
                            Image(systemName: "checkmark.circle.fill")
                                .foregroundStyle(.blue)
                        }
                    }
                    .padding(13)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .background(store.source == source ? Color.blue.opacity(0.1) : Color.black.opacity(0.12), in: RoundedRectangle(cornerRadius: 13))
                    .overlay {
                        RoundedRectangle(cornerRadius: 13)
                            .stroke(store.source == source ? Color.blue.opacity(0.35) : Color.blue.opacity(0.1), lineWidth: 1)
                    }
                }
                .buttonStyle(.plain)
            }
        }
    }

    private var connectionForm: some View {
        PanelCard(title: "连接设置", subtitle: store.source.title, icon: "point.3.connected.trianglepath.dotted") {
            VStack(alignment: .leading, spacing: 16) {
                switch store.source {
                case .simulator:
                    VStack(alignment: .leading, spacing: 10) {
                        Label("模拟器无需物理设备", systemImage: "checkmark.seal.fill")
                            .foregroundStyle(.green)
                            .font(.system(size: 13, weight: .semibold))
                        Text("模拟器会持续生成 32×24 温度矩阵、三个热源区域和动态风险等级，用于验证应用与硬件协议。")
                            .font(.system(size: 11))
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }

                case .serial:
                    VStack(alignment: .leading, spacing: 8) {
                        Text("USB 串口")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                        HStack {
                            TextField("/dev/cu.usbserial-0001", text: $store.serialPath)
                                .textFieldStyle(.roundedBorder)
                            Button {
                                store.refreshSerialPorts()
                            } label: {
                                Image(systemName: "arrow.clockwise")
                            }
                            .help("重新扫描串口")
                        }

                        if store.serialPorts.isEmpty {
                            Text("未检测到 /dev/cu.* 串口设备")
                                .font(.system(size: 9))
                                .foregroundStyle(.orange)
                        } else {
                            ForEach(store.serialPorts, id: \.self) { port in
                                Button {
                                    store.serialPath = port
                                } label: {
                                    HStack {
                                        Image(systemName: "cable.connector")
                                        Text(port)
                                            .font(.system(size: 10, design: .monospaced))
                                        Spacer()
                                        if store.serialPath == port {
                                            Image(systemName: "checkmark")
                                        }
                                    }
                                }
                                .buttonStyle(.plain)
                                .padding(8)
                                .background(store.serialPath == port ? Color.blue.opacity(0.1) : Color.clear, in: RoundedRectangle(cornerRadius: 8))
                            }
                        }
                    }

                case .webSocket:
                    VStack(alignment: .leading, spacing: 8) {
                        Text("设备 WebSocket 地址")
                            .font(.system(size: 10, weight: .semibold))
                            .foregroundStyle(.secondary)
                        TextField("ws://192.168.4.1:81/", text: $store.webSocketURL)
                            .textFieldStyle(.roundedBorder)
                            .font(.system(size: 11, design: .monospaced))
                        Text("ESP32 SoftAP 默认推荐地址：ws://192.168.4.1:81/")
                            .font(.system(size: 9))
                            .foregroundStyle(.secondary)
                    }
                }

                HStack(spacing: 10) {
                    Button {
                        store.connectHardware()
                    } label: {
                        Label(store.isConnected ? "重新连接" : "连接设备", systemImage: "link")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    .controlSize(.large)

                    Button {
                        store.stop()
                    } label: {
                        Label("断开", systemImage: "xmark.circle")
                    }
                    .buttonStyle(.bordered)
                    .controlSize(.large)
                    .disabled(!store.isConnected)
                }

                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: store.isConnected ? "checkmark.circle.fill" : "info.circle")
                        .foregroundStyle(store.isConnected ? .green : .cyan)
                    Text(store.statusMessage)
                        .font(.system(size: 10))
                        .foregroundStyle(.secondary)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .padding(10)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background((store.isConnected ? Color.green : Color.cyan).opacity(0.07), in: RoundedRectangle(cornerRadius: 9))
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var protocolPanel: some View {
        PanelCard(title: "数据协议", subtitle: "ESP32 → macOS", icon: "curlybraces") {
            VStack(alignment: .leading, spacing: 10) {
                Text("每帧发送一条 JSON，温度数组长度为 width × height。")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)

                ScrollView(.horizontal) {
                    Text(
"""
{
  "width": 32,
  "height": 24,
  "min_temp": 28.2,
  "max_temp": 86.4,
  "risk": "high",
  "temperatures": [28.2, 29.1, ...],
  "hotspots": [
    {
      "x": 0.31, "y": 0.24,
      "width": 0.18, "height": 0.22,
      "temp": 86.4, "confidence": 0.968
    }
  ]
}
"""
                    )
                    .font(.system(size: 10, design: .monospaced))
                    .textSelection(.enabled)
                    .padding(12)
                }
                .background(.black.opacity(0.28), in: RoundedRectangle(cornerRadius: 9))
                .overlay {
                    RoundedRectangle(cornerRadius: 9)
                        .stroke(.blue.opacity(0.12), lineWidth: 1)
                }

                HStack(spacing: 7) {
                    Image(systemName: "lightbulb.fill")
                        .foregroundStyle(.yellow)
                    Text("坐标和宽高使用 0–1 归一化值，应用会自动换算为画面位置。")
                        .font(.system(size: 9))
                        .foregroundStyle(.secondary)
                }
            }
        }
        .frame(width: 390)
    }

    private func checklistItem(_ title: String, icon: String) -> some View {
        HStack(spacing: 10) {
            Image(systemName: icon)
                .foregroundStyle(.blue)
                .frame(width: 28, height: 28)
                .background(.blue.opacity(0.09), in: RoundedRectangle(cornerRadius: 7))
            Text(title)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
            Spacer()
            Image(systemName: "checkmark")
                .font(.system(size: 9, weight: .bold))
                .foregroundStyle(.green)
        }
        .padding(11)
        .background(.black.opacity(0.12), in: RoundedRectangle(cornerRadius: 9))
    }
}
