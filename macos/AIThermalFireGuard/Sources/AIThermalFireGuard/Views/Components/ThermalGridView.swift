import SwiftUI

struct ThermalGridView: View {
    let frame: ThermalFrame
    var showHotspots = true
    var compact = false

    var body: some View {
        GeometryReader { proxy in
            TimelineView(.animation(minimumInterval: 1 / 24)) { timeline in
                let scanPosition = timeline.date.timeIntervalSinceReferenceDate.truncatingRemainder(dividingBy: 3.8) / 3.8

                Canvas { context, size in
                    let columns = max(frame.width, 1)
                    let rows = max(frame.height, 1)
                    let cellWidth = size.width / CGFloat(columns)
                    let cellHeight = size.height / CGFloat(rows)

                    context.fill(Path(CGRect(origin: .zero, size: size)), with: .color(Color(red: 0.01, green: 0.025, blue: 0.06)))

                    guard frame.temperatures.count >= columns * rows else { return }

                    for row in 0..<rows {
                        for column in 0..<columns {
                            let index = row * columns + column
                            let temperature = frame.temperatures[index]
                            let normalized = ThermalPalette.normalized(temperature: temperature, frame: frame)
                            let rect = CGRect(
                                x: CGFloat(column) * cellWidth,
                                y: CGFloat(row) * cellHeight,
                                width: cellWidth + 0.7,
                                height: cellHeight + 0.7
                            )
                            context.fill(Path(rect), with: .color(ThermalPalette.color(for: normalized)))
                        }
                    }

                    var grid = Path()
                    for column in stride(from: 0, through: columns, by: 4) {
                        let x = CGFloat(column) * cellWidth
                        grid.move(to: CGPoint(x: x, y: 0))
                        grid.addLine(to: CGPoint(x: x, y: size.height))
                    }
                    for row in stride(from: 0, through: rows, by: 4) {
                        let y = CGFloat(row) * cellHeight
                        grid.move(to: CGPoint(x: 0, y: y))
                        grid.addLine(to: CGPoint(x: size.width, y: y))
                    }
                    context.stroke(grid, with: .color(.cyan.opacity(0.12)), lineWidth: 0.6)

                    if showHotspots {
                        for hotspot in frame.hotspots {
                            let rect = CGRect(
                                x: hotspot.x * size.width,
                                y: hotspot.y * size.height,
                                width: hotspot.width * size.width,
                                height: hotspot.height * size.height
                            )
                            context.stroke(Path(rect), with: .color(.orange), lineWidth: 1.7)
                            context.fill(Path(rect), with: .color(.orange.opacity(0.06)))
                        }
                    }

                    let scanY = CGFloat(scanPosition) * size.height
                    var scanPath = Path()
                    scanPath.move(to: CGPoint(x: 0, y: scanY))
                    scanPath.addLine(to: CGPoint(x: size.width, y: scanY))
                    context.stroke(scanPath, with: .color(.cyan.opacity(0.78)), lineWidth: 1.2)
                }
            }
        }
        .aspectRatio(4 / 3, contentMode: .fit)
        .clipShape(RoundedRectangle(cornerRadius: compact ? 10 : 14))
        .overlay {
            RoundedRectangle(cornerRadius: compact ? 10 : 14)
                .stroke(Color.cyan.opacity(0.22), lineWidth: 1)
        }
        .overlay(alignment: .topLeading) {
            HStack(spacing: 6) {
                Circle().fill(.green).frame(width: 6, height: 6)
                Text(frame.source)
                    .font(.system(size: 9, weight: .medium))
                    .foregroundStyle(.white.opacity(0.8))
            }
            .padding(9)
            .background(.black.opacity(0.48), in: Capsule())
            .padding(10)
        }
        .overlay(alignment: .bottomTrailing) {
            HStack(spacing: 7) {
                Text(frame.minTemperature.temperatureText)
                LinearGradient(colors: [.blue, .purple, .red, .orange, .yellow, .white], startPoint: .leading, endPoint: .trailing)
                    .frame(width: compact ? 72 : 110, height: 6)
                    .clipShape(Capsule())
                Text(frame.maxTemperature.temperatureText)
            }
            .font(.system(size: 8, weight: .medium, design: .monospaced))
            .foregroundStyle(.white.opacity(0.78))
            .padding(.horizontal, 9)
            .padding(.vertical, 7)
            .background(.black.opacity(0.5), in: Capsule())
            .padding(10)
        }
        .overlay {
            ForEach(Array(frame.hotspots.prefix(3).enumerated()), id: \.element.id) { index, hotspot in
                GeometryReader { proxy in
                    Text(hotspot.temperature.temperatureText)
                        .font(.system(size: 8, weight: .bold, design: .monospaced))
                        .foregroundStyle(.white)
                        .padding(.horizontal, 5)
                        .padding(.vertical, 3)
                        .background(Color.orange.opacity(0.88), in: RoundedRectangle(cornerRadius: 3))
                        .position(
                            x: min(max(hotspot.x * proxy.size.width, 32), proxy.size.width - 38),
                            y: max(hotspot.y * proxy.size.height - 13, 12)
                        )
                }
            }
        }
    }
}
