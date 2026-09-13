import Foundation

enum RiskLevel: String, Codable, CaseIterable, Identifiable {
    case low
    case medium
    case high

    var id: String { rawValue }

    var title: String {
        switch self {
        case .low: "低风险"
        case .medium: "中风险"
        case .high: "高风险"
        }
    }

    var shortDescription: String {
        switch self {
        case .low: "温度稳定，继续监测"
        case .medium: "存在异常温升，安排复核"
        case .high: "疑似火情热源，立即处置"
        }
    }

    static func from(temperature: Double) -> RiskLevel {
        if temperature >= 65 { return .high }
        if temperature >= 45 { return .medium }
        return .low
    }
}

struct ThermalHotspot: Identifiable, Equatable {
    var x: Double
    var y: Double
    var width: Double
    var height: Double
    var temperature: Double
    var confidence: Double

    var id: String { "\(x)-\(y)-\(temperature)" }
}

struct ThermalFrame: Identifiable, Equatable {
    var id: String { "\(timestamp.timeIntervalSinceReferenceDate)-\(maxTemperature)" }
    var width: Int
    var height: Int
    var temperatures: [Double]
    var minTemperature: Double
    var maxTemperature: Double
    var averageTemperature: Double
    var hotspots: [ThermalHotspot]
    var risk: RiskLevel
    var timestamp: Date
    var source: String

    static let placeholder = ThermalFrame(
        width: 32,
        height: 24,
        temperatures: Array(repeating: 30, count: 32 * 24),
        minTemperature: 26,
        maxTemperature: 31,
        averageTemperature: 29,
        hotspots: [],
        risk: .low,
        timestamp: Date(),
        source: "等待数据"
    )
}

struct TemperatureSample: Identifiable, Equatable {
    let id = UUID()
    let timestamp: Date
    let maxTemperature: Double
}

struct ThermalPacket: Codable {
    var width: Int?
    var height: Int?
    var temperatures: [Double]?
    var minTemp: Double?
    var maxTemp: Double?
    var hotspotCount: Int?
    var hotspots: [HotspotPacket]?
    var risk: String?
    var source: String?
    var timestamp: Double?

    struct HotspotPacket: Codable {
        var x: Double
        var y: Double
        var width: Double?
        var height: Double?
        var temp: Double?
        var confidence: Double?
    }

    func normalizedFrame(defaultSource: String) -> ThermalFrame {
        let gridWidth = max(width ?? 32, 2)
        let gridHeight = max(height ?? 24, 2)
        let expectedCount = gridWidth * gridHeight
        var grid = temperatures ?? []
        if grid.count != expectedCount {
            grid = Self.syntheticGrid(width: gridWidth, height: gridHeight)
        }

        let actualMin = minTemp ?? grid.min() ?? 26
        let actualMax = maxTemp ?? grid.max() ?? 31
        let average = grid.isEmpty ? 0 : grid.reduce(0, +) / Double(grid.count)
        let riskValue = risk.flatMap { RiskLevel(rawValue: $0.lowercased()) }
        let inferredRisk = riskValue ?? RiskLevel.from(temperature: actualMax)
        let hotspotModels = (hotspots ?? []).map {
            ThermalHotspot(
                x: $0.x,
                y: $0.y,
                width: $0.width ?? 0.12,
                height: $0.height ?? 0.14,
                temperature: $0.temp ?? actualMax,
                confidence: $0.confidence ?? 0.9
            )
        }

        return ThermalFrame(
            width: gridWidth,
            height: gridHeight,
            temperatures: grid,
            minTemperature: actualMin,
            maxTemperature: actualMax,
            averageTemperature: average,
            hotspots: hotspotModels,
            risk: inferredRisk,
            timestamp: Date(),
            source: source ?? defaultSource
        )
    }

    static func syntheticGrid(width: Int, height: Int) -> [Double] {
        var values: [Double] = []
        values.reserveCapacity(width * height)
        for y in 0..<height {
            for x in 0..<width {
                let nx = Double(x) / Double(max(width - 1, 1))
                let ny = Double(y) / Double(max(height - 1, 1))
                let base = 27.5 + 4.2 * (1 - ny) + 1.1 * sin(nx * 7)
                let hotA = 58 * exp(-(pow(nx - 0.36, 2) + pow(ny - 0.34, 2)) / 0.018)
                let hotB = 38 * exp(-(pow(nx - 0.72, 2) + pow(ny - 0.27, 2)) / 0.028)
                let hotC = 20 * exp(-(pow(nx - 0.79, 2) + pow(ny - 0.70, 2)) / 0.030)
                values.append(base + hotA + hotB + hotC)
            }
        }
        return values
    }
}

enum HardwareSource: String, CaseIterable, Identifiable {
    case simulator
    case serial
    case webSocket

    var id: String { rawValue }

    var title: String {
        switch self {
        case .simulator: "模拟器"
        case .serial: "USB 串口"
        case .webSocket: "Wi-Fi WebSocket"
        }
    }

    var subtitle: String {
        switch self {
        case .simulator: "无需硬件即可演示"
        case .serial: "ESP32-S3 通过 USB 传输"
        case .webSocket: "ESP32-S3 通过局域网传输"
        }
    }

    var icon: String {
        switch self {
        case .simulator: "waveform.path.ecg"
        case .serial: "cable.connector"
        case .webSocket: "wifi"
        }
    }

    static var availableCases: [HardwareSource] {
#if APP_STORE
        [.simulator, .webSocket]
#else
        allCases
#endif
    }
}

enum ConnectionState: Equatable {
    case disconnected
    case connecting
    case connected
    case simulator
    case failed(String)

    var title: String {
        switch self {
        case .disconnected: "未连接"
        case .connecting: "连接中"
        case .connected: "硬件在线"
        case .simulator: "模拟运行"
        case .failed: "连接失败"
        }
    }
}

struct ExperimentEquipment: Identifiable {
    let id = UUID()
    let name: String
    let model: String
    let purpose: String
    let price: String
    let priority: String
    let icon: String
}
