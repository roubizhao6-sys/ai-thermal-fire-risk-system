import SwiftUI

struct ExperimentGuideView: View {
    private let starterKit = [
        ExperimentEquipment(name: "主控开发板", model: "ESP32-S3-DevKitC-1", purpose: "采集传感器数据并通过 USB/Wi-Fi 发送 JSON", price: "¥45–80", priority: "必备", icon: "cpu"),
        ExperimentEquipment(name: "红外热成像阵列", model: "MLX90640 32×24", purpose: "输出 768 点温度矩阵，适合第一版算法验证", price: "¥180–320", priority: "推荐", icon: "heat.waves"),
        ExperimentEquipment(name: "温度湿度传感器", model: "SHT31 或 DHT22", purpose: "记录环境温湿度，辅助排除热源误报", price: "¥15–45", priority: "建议", icon: "thermometer.medium"),
        ExperimentEquipment(name: "烟雾/可燃气体传感器", model: "MQ-2 或 SGP30", purpose: "增加烟雾与可燃气体维度，不能替代热成像", price: "¥15–60", priority: "可选", icon: "smoke.fill"),
        ExperimentEquipment(name: "声光报警模块", model: "有源蜂鸣器 + RGB LED", purpose: "高风险时触发本地声光报警", price: "¥10–25", priority: "建议", icon: "light.beacon.max"),
        ExperimentEquipment(name: "面包板与杜邦线", model: "400 孔面包板、母母线", purpose: "连接传感器和主控，便于快速搭建原型", price: "¥20–40", priority: "必备", icon: "square.grid.3x3")
    ]

    private let advancedKit = [
        ExperimentEquipment(name: "专业热成像模块", model: "FLIR Lepton 3.5 + PureThermal 2", purpose: "160×120 辐射热成像，适合更真实的火情实验", price: "¥1800–2800", priority: "升级", icon: "camera.metering.center.weighted"),
        ExperimentEquipment(name: "边缘计算设备", model: "Raspberry Pi 5 8GB 或 Jetson Orin Nano", purpose: "运行 YOLO/视觉模型并向外提供 WebSocket", price: "¥600–3500", priority: "升级", icon: "server.rack"),
        ExperimentEquipment(name: "USB 热像仪", model: "InfiRay P2 Pro / Topdon TC001", purpose: "快速验证热成像输入，完整 SDK 支持程度需确认", price: "¥900–1800", priority: "备选", icon: "video"),
        ExperimentEquipment(name: "受控热源与实验台", model: "低压加热片 + 耐热台面", purpose: "在安全条件下产生可控温升，验证分级阈值", price: "¥120–300", priority: "实验", icon: "flame")
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 20) {
                PageHeader(
                    eyebrow: "实验设备",
                    title: "从最小可用原型开始",
                    subtitle: "推荐先完成 MLX90640 + ESP32-S3 数据链路，再升级专业热像仪",
                    trailing: {
                        Text("预算参考 ¥300–600")
                            .font(.system(size: 11, weight: .semibold))
                            .foregroundStyle(.green)
                            .padding(.horizontal, 12)
                            .padding(.vertical, 7)
                            .background(.green.opacity(0.09), in: Capsule())
                            .overlay { Capsule().stroke(.green.opacity(0.22), lineWidth: 1) }
                    }
                )

                recommendationBanner

                PanelCard(title: "推荐入门套件", subtitle: "适合答辩演示与算法验证", icon: "shippingbox.fill") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(starterKit) { item in
                            EquipmentRow(item: item)
                        }
                    }
                }

                PanelCard(title: "升级实验套件", subtitle: "更高分辨率与边缘 AI 推理", icon: "arrow.up.right.circle") {
                    LazyVGrid(columns: [GridItem(.flexible(), spacing: 10), GridItem(.flexible(), spacing: 10)], spacing: 10) {
                        ForEach(advancedKit) { item in
                            EquipmentRow(item: item)
                        }
                    }
                }

                HStack(alignment: .top, spacing: 14) {
                    wiringGuide
                    experimentSteps
                }

                safetyNotice
            }
            .padding(.bottom, 24)
        }
    }

    private var recommendationBanner: some View {
        HStack(spacing: 15) {
            Image(systemName: "sparkles")
                .font(.system(size: 22))
                .foregroundStyle(.cyan)
                .frame(width: 48, height: 48)
                .background(.cyan.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))

            VStack(alignment: .leading, spacing: 5) {
                Text("最佳性价比方案")
                    .font(.system(size: 13, weight: .bold))
                Text("ESP32-S3-DevKitC-1 + MLX90640 是最适合第一版实验的组合：成本低、资料多、可直接输出温度矩阵。")
                    .font(.system(size: 11))
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 3) {
                Text("预计成本")
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                Text("¥300–600")
                    .font(.system(size: 20, weight: .bold))
                    .foregroundStyle(.green)
            }
        }
        .padding(17)
        .background(
            LinearGradient(colors: [.cyan.opacity(0.11), .blue.opacity(0.06)], startPoint: .leading, endPoint: .trailing),
            in: RoundedRectangle(cornerRadius: 15)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 15)
                .stroke(.cyan.opacity(0.18), lineWidth: 1)
        }
    }

    private var wiringGuide: some View {
        PanelCard(title: "MLX90640 接线", subtitle: "ESP32-S3 I²C 连接", icon: "point.3.connected.trianglepath.dotted") {
            VStack(spacing: 0) {
                wiringRow("MLX90640 VIN", "ESP32-S3 3V3")
                wiringRow("MLX90640 GND", "ESP32-S3 GND")
                wiringRow("MLX90640 SDA", "GPIO 8")
                wiringRow("MLX90640 SCL", "GPIO 9")
                wiringRow("ESP32-S3 USB", "Mac USB-C / USB-A", last: true)
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var experimentSteps: some View {
        PanelCard(title: "实验顺序", subtitle: "建议按步骤完成", icon: "list.number") {
            VStack(alignment: .leading, spacing: 14) {
                stepRow(1, "先运行应用内置模拟器，确认界面和风险分级正常。")
                stepRow(2, "连接 ESP32-S3，烧录示例固件，通过 USB 串口输出 JSON。")
                stepRow(3, "在“硬件连接”中选择串口并观察热成像矩阵是否更新。")
                stepRow(4, "切换 Wi-Fi WebSocket，验证局域网无线传输。")
                stepRow(5, "使用受控热源改变温度，记录低/中/高风险阈值表现。")
            }
        }
        .frame(maxWidth: .infinity)
    }

    private var safetyNotice: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "exclamationmark.shield.fill")
                .foregroundStyle(.orange)
                .font(.system(size: 18))
            VStack(alignment: .leading, spacing: 4) {
                Text("实验安全要求")
                    .font(.system(size: 11, weight: .bold))
                Text("不要使用明火、汽油或高温危险源直接测试。建议使用低压加热片、电烙铁余温或热水杯完成温度验证，并保持传感器与热源的安全距离。本系统只用于科研演示，不替代专业消防检测设备。")
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(15)
        .background(.orange.opacity(0.07), in: RoundedRectangle(cornerRadius: 12))
        .overlay {
            RoundedRectangle(cornerRadius: 12)
                .stroke(.orange.opacity(0.18), lineWidth: 1)
        }
    }

    private func wiringRow(_ left: String, _ right: String, last: Bool = false) -> some View {
        VStack(spacing: 0) {
            HStack {
                Text(left).font(.system(size: 10, weight: .medium, design: .monospaced))
                Spacer()
                Image(systemName: "arrow.right").foregroundStyle(.blue)
                Spacer()
                Text(right).font(.system(size: 10, weight: .medium, design: .monospaced)).foregroundStyle(.cyan)
            }
            .padding(.vertical, 10)
            if !last { Divider().overlay(.blue.opacity(0.08)) }
        }
    }

    private func stepRow(_ number: Int, _ text: String) -> some View {
        HStack(alignment: .top, spacing: 10) {
            Text("\(number)")
                .font(.system(size: 9, weight: .bold, design: .monospaced))
                .foregroundStyle(.blue)
                .frame(width: 24, height: 24)
                .background(.blue.opacity(0.1), in: RoundedRectangle(cornerRadius: 6))
            Text(text)
                .font(.system(size: 10))
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

private struct EquipmentRow: View {
    let item: ExperimentEquipment

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: item.icon)
                .font(.system(size: 16))
                .foregroundStyle(.blue)
                .frame(width: 34, height: 34)
                .background(.blue.opacity(0.09), in: RoundedRectangle(cornerRadius: 9))

            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(item.name)
                        .font(.system(size: 11, weight: .semibold))
                    Spacer()
                    Text(item.priority)
                        .font(.system(size: 8, weight: .bold))
                        .foregroundStyle(item.priority == "必备" || item.priority == "推荐" ? .green : .cyan)
                }
                Text(item.model)
                    .font(.system(size: 10, weight: .medium, design: .monospaced))
                    .foregroundStyle(.cyan)
                Text(item.purpose)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
                    .fixedSize(horizontal: false, vertical: true)
                Text(item.price)
                    .font(.system(size: 10, weight: .bold))
                    .foregroundStyle(.orange)
            }
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.black.opacity(0.13), in: RoundedRectangle(cornerRadius: 11))
        .overlay {
            RoundedRectangle(cornerRadius: 11)
                .stroke(.blue.opacity(0.1), lineWidth: 1)
        }
    }
}
