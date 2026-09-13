import Foundation

final class SimulatorHardwareClient: HardwareClient {
    var onFrame: ((ThermalFrame) -> Void)?
    var onStateChange: ((ConnectionState) -> Void)?

    private var task: Task<Void, Never>?
    private var phase = 0

    func connect() async throws {
        await disconnect()
        onStateChange?(.simulator)

        task = Task { [weak self] in
            guard let self else { return }
            while !Task.isCancelled {
                let frame = self.makeFrame()
                await MainActor.run {
                    self.onFrame?(frame)
                }
                try? await Task.sleep(for: .milliseconds(320))
            }
        }
    }

    func disconnect() async {
        task?.cancel()
        task = nil
    }

    private func makeFrame() -> ThermalFrame {
        phase += 1
        let width = 32
        let height = 24
        let drift = sin(Double(phase) * 0.055)
        let secondaryDrift = cos(Double(phase) * 0.031)
        var values: [Double] = []
        values.reserveCapacity(width * height)

        for y in 0..<height {
            for x in 0..<width {
                let nx = Double(x) / Double(width - 1)
                let ny = Double(y) / Double(height - 1)
                let base = 27.5 + 3.5 * (1 - ny) + 0.9 * sin(nx * 8)
                let hotA = (60 + drift * 4) * exp(-(pow(nx - 0.35, 2) + pow(ny - 0.34, 2)) / 0.019)
                let hotB = (39 + secondaryDrift * 3) * exp(-(pow(nx - 0.72, 2) + pow(ny - 0.28, 2)) / 0.027)
                let hotC = (21 + drift * 2) * exp(-(pow(nx - 0.79, 2) + pow(ny - 0.70, 2)) / 0.031)
                let noise = sin(Double(x * 17 + y * 23 + phase)) * 0.45
                values.append(base + hotA + hotB + hotC + noise)
            }
        }

        let maxTemp = values.max() ?? 87
        let minTemp = values.min() ?? 27
        let average = values.reduce(0, +) / Double(values.count)
        let risk = RiskLevel.from(temperature: maxTemp)
        let hotspots = [
            ThermalHotspot(x: 0.28, y: 0.24, width: 0.18, height: 0.21, temperature: maxTemp, confidence: 0.968),
            ThermalHotspot(x: 0.64, y: 0.18, width: 0.15, height: 0.20, temperature: maxTemp - 12.4, confidence: 0.917),
            ThermalHotspot(x: 0.73, y: 0.60, width: 0.14, height: 0.19, temperature: maxTemp - 21.2, confidence: 0.876)
        ]

        return ThermalFrame(
            width: width,
            height: height,
            temperatures: values,
            minTemperature: minTemp,
            maxTemperature: maxTemp,
            averageTemperature: average,
            hotspots: risk == .low ? Array(hotspots.prefix(1)) : hotspots,
            risk: risk,
            timestamp: Date(),
            source: "内置模拟热像仪"
        )
    }

    deinit {
        task?.cancel()
    }
}
