import SwiftUI

struct MetricCard: View {
    let title: String
    let value: String
    let unit: String
    let detail: String
    let icon: String
    let color: Color

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack {
                Image(systemName: icon)
                    .font(.system(size: 15, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 32, height: 32)
                    .background(color.opacity(0.1), in: RoundedRectangle(cornerRadius: 8))
                Spacer()
                Text(detail)
                    .font(.system(size: 9))
                    .foregroundStyle(.secondary)
            }

            Text(title)
                .font(.system(size: 11))
                .foregroundStyle(.secondary)

            HStack(alignment: .firstTextBaseline, spacing: 4) {
                Text(value)
                    .font(.system(size: 27, weight: .bold, design: .rounded))
                    .monospacedDigit()
                Text(unit)
                    .font(.system(size: 10))
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [color.opacity(0.08), Color(red: 0.04, green: 0.07, blue: 0.13)],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay {
            RoundedRectangle(cornerRadius: 14)
                .stroke(color.opacity(0.18), lineWidth: 1)
        }
        .overlay(alignment: .bottom) {
            Rectangle()
                .fill(LinearGradient(colors: [color, .clear], startPoint: .leading, endPoint: .trailing))
                .frame(height: 2)
                .clipShape(RoundedRectangle(cornerRadius: 2))
        }
    }
}
