import SwiftUI

struct SettingsView: View {
    @EnvironmentObject private var store: ThermalMonitorStore

    var body: some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 12) {
                Image(systemName: "gearshape.2.fill")
                    .font(.system(size: 22))
                    .foregroundStyle(.blue)
                    .frame(width: 46, height: 46)
                    .background(.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
                VStack(alignment: .leading, spacing: 3) {
                    Text("监测设置")
                        .font(.system(size: 18, weight: .bold))
                    Text("配置默认硬件数据源")
                        .font(.system(size: 11))
                        .foregroundStyle(.secondary)
                }
            }

            Form {
                Picker("默认数据源", selection: $store.source) {
                    ForEach(HardwareSource.allCases) { source in
                        Text(source.title).tag(source)
                    }
                }

                TextField("USB 串口", text: $store.serialPath)
                    .font(.system(size: 11, design: .monospaced))

                TextField("WebSocket 地址", text: $store.webSocketURL)
                    .font(.system(size: 11, design: .monospaced))
            }
            .formStyle(.grouped)

            HStack {
                Text("风险阈值：低 < 45°C，中 45–65°C，高 ≥ 65°C")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                Spacer()
                Button("恢复默认") {
                    store.serialPath = "/dev/cu.usbserial-0001"
                    store.webSocketURL = "ws://192.168.4.1:81/"
                }
            }
        }
        .padding(24)
        .background(Color(red: 0.025, green: 0.045, blue: 0.085))
    }
}
