import SwiftUI

// 两个 App 共用的主题色：与网页端黑色简约主题同一套 token。
// 系统色对齐 Apple 暗色模式：红 #FF3B30、橙 #FF9F0A、绿 #30D158。

extension Color {
    static let alertRed = Color(red: 1.0, green: 0.23, blue: 0.19)
    static let safeGreen = Color(red: 0.19, green: 0.82, blue: 0.35)
}

extension RiskLevel {
    var color: Color {
        switch self {
        case .high: return .alertRed
        case .medium: return .orange
        case .low: return .safeGreen
        }
    }
}
