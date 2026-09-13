import SwiftUI

enum ThermalPalette {
    private static let stops: [(position: Double, r: Double, g: Double, b: Double)] = [
        (0.00, 0.02, 0.05, 0.15),
        (0.18, 0.12, 0.15, 0.52),
        (0.36, 0.42, 0.08, 0.52),
        (0.52, 0.73, 0.05, 0.28),
        (0.68, 0.92, 0.23, 0.12),
        (0.82, 1.00, 0.57, 0.06),
        (0.93, 1.00, 0.86, 0.12),
        (1.00, 1.00, 0.98, 0.82)
    ]

    static func color(for value: Double) -> Color {
        let clamped = min(max(value, 0), 1)
        guard let upperIndex = stops.firstIndex(where: { $0.position >= clamped }) else {
            let last = stops[stops.count - 1]
            return Color(red: last.r, green: last.g, blue: last.b)
        }
        if upperIndex == 0 {
            let first = stops[0]
            return Color(red: first.r, green: first.g, blue: first.b)
        }

        let lower = stops[upperIndex - 1]
        let upper = stops[upperIndex]
        let span = max(upper.position - lower.position, 0.0001)
        let t = (clamped - lower.position) / span
        return Color(
            red: lower.r + (upper.r - lower.r) * t,
            green: lower.g + (upper.g - lower.g) * t,
            blue: lower.b + (upper.b - lower.b) * t
        )
    }

    static func normalized(temperature: Double, frame: ThermalFrame) -> Double {
        let span = max(frame.maxTemperature - frame.minTemperature, 0.1)
        return min(max((temperature - frame.minTemperature) / span, 0), 1)
    }
}

extension RiskLevel {
    var color: Color {
        switch self {
        case .low: .green
        case .medium: .orange
        case .high: .red
        }
    }
}

extension Double {
    var temperatureText: String { String(format: "%.1f°C", self) }
    var percentText: String { String(format: "%.1f%%", self * 100) }
}
