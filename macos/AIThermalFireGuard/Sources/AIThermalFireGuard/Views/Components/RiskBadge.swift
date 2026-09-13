import SwiftUI

struct RiskBadge: View {
    let risk: RiskLevel
    var compact = false

    var body: some View {
        HStack(spacing: 7) {
            Circle()
                .fill(risk.color)
                .frame(width: 7, height: 7)
                .shadow(color: risk.color.opacity(0.8), radius: 5)
            Text(risk.title)
                .font(.system(size: compact ? 10 : 12, weight: .semibold))
        }
        .foregroundStyle(risk.color)
        .padding(.horizontal, compact ? 8 : 10)
        .padding(.vertical, compact ? 5 : 7)
        .background(risk.color.opacity(0.1), in: Capsule())
        .overlay {
            Capsule().stroke(risk.color.opacity(0.25), lineWidth: 1)
        }
    }
}
