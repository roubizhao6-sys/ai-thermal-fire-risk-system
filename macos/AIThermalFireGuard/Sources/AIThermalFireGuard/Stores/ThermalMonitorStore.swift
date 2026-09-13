import Foundation
import SwiftUI

@MainActor
final class ThermalMonitorStore: ObservableObject {
    @Published var selectedSection: AppSection? = .dashboard
    @Published var frame: ThermalFrame = .placeholder
    @Published var connectionState: ConnectionState = .simulator
    @Published var source: HardwareSource = .simulator
    @Published var serialPath = "/dev/cu.usbserial-0001"
    @Published var serialPorts: [String] = []
    @Published var webSocketURL = "ws://192.168.4.1:81/"
    @Published var statusMessage = "内置模拟器正在生成热成像数据"
    @Published var history: [TemperatureSample] = []
    @Published var alertFrames: [ThermalFrame] = []
    @Published var isMonitoring = true

    private var client: HardwareClient?
    private var lastAlertDate: Date?

    init() {
        refreshSerialPorts()
        connectSimulator()
    }

    var isConnected: Bool {
        connectionState == .connected || connectionState == .simulator
    }

    var packetRateText: String {
        source == .simulator ? "3.1 帧/秒" : "实时"
    }

    func refreshSerialPorts() {
#if APP_STORE
        serialPorts = []
#else
        serialPorts = SerialHardwareClient.availablePorts()
        if let first = serialPorts.first, !serialPorts.contains(serialPath) {
            serialPath = first
        }
#endif
    }

    func connectSimulator() {
        source = .simulator
        install(
            SimulatorHardwareClient(),
            successMessage: "内置模拟器已启动，可无硬件演示完整流程"
        )
    }

    func connectHardware() {
        switch source {
        case .simulator:
            connectSimulator()
        case .serial:
#if APP_STORE
            connectionState = .failed("App Store 版本不提供直接串口访问，请使用 Wi-Fi WebSocket")
            statusMessage = "App Store 版本使用 Wi-Fi WebSocket 接入 ESP32"
#else
            install(
                SerialHardwareClient(portPath: serialPath),
                successMessage: "已连接 ESP32 串口 \(serialPath)"
            )
#endif
        case .webSocket:
            install(
                WebSocketHardwareClient(endpoint: webSocketURL),
                successMessage: "正在连接 \(webSocketURL)"
            )
        }
    }

    func stop() {
        let currentClient = client
        client = nil
        connectionState = .disconnected
        statusMessage = "监测已停止"
        Task { await currentClient?.disconnect() }
    }

    private func install(_ newClient: HardwareClient, successMessage: String) {
        let previousClient = client
        client = nil
        Task { await previousClient?.disconnect() }

        newClient.onFrame = { [weak self] frame in
            guard let self else { return }
            Task { @MainActor in
                self.receive(frame)
            }
        }
        newClient.onStateChange = { [weak self] state in
            guard let self else { return }
            Task { @MainActor in
                self.connectionState = state
                if case .failed(let message) = state {
                    self.statusMessage = message
                } else if state == .connected || state == .simulator {
                    self.statusMessage = successMessage
                }
            }
        }

        client = newClient
        connectionState = .connecting
        statusMessage = "正在建立数据连接…"

        Task {
            do {
                try await newClient.connect()
            } catch {
                self.connectionState = .failed(error.localizedDescription)
                self.statusMessage = error.localizedDescription
            }
        }
    }

    private func receive(_ newFrame: ThermalFrame) {
        guard isMonitoring else { return }
        frame = newFrame
        statusMessage = "\(newFrame.source) · 数据正常"

        history.append(TemperatureSample(timestamp: newFrame.timestamp, maxTemperature: newFrame.maxTemperature))
        if history.count > 80 {
            history.removeFirst(history.count - 80)
        }

        guard newFrame.risk != .low else { return }
        let shouldRecord = lastAlertDate.map { newFrame.timestamp.timeIntervalSince($0) > 3.5 } ?? true
        if shouldRecord {
            alertFrames.insert(newFrame, at: 0)
            if alertFrames.count > 30 {
                alertFrames.removeLast(alertFrames.count - 30)
            }
            lastAlertDate = newFrame.timestamp
        }
    }
}
