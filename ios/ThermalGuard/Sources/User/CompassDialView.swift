import SwiftUI

// 表盘：刻度环 + 四向字母 + 指向撤离方向的指针。
// 用 Canvas 一次画完，刻度与字母随手机朝向整体旋转（跟随模式）或保持指北。

struct CompassDialView: View {
    let dialRotation: Double      // 表盘旋转角（跟随手机朝向时为 -heading）
    let needleRotation: Double    // 指针旋转角（目标方位 - 表盘旋转角）
    let isAlert: Bool

    var body: some View {
        GeometryReader { proxy in
            let size = min(proxy.size.width, proxy.size.height)
            let center = CGPoint(x: proxy.size.width / 2, y: proxy.size.height / 2)
            let outer = size / 2 - 6

            ZStack {
                Canvas { context, _ in
                    drawTicks(context: context, center: center, outer: outer)
                    drawCardinals(context: context, center: center, outer: outer)
                }
                .rotationEffect(.degrees(dialRotation))
                .animation(.easeOut(duration: 0.25), value: dialRotation)

                NeedleShape()
                    .fill(isAlert ? Color.alertRed : Color.safeGreen)
                    .frame(width: size * 0.09, height: outer * 0.42)
                    .offset(y: -(outer * 0.42) / 2 - outer * 0.16)
                    .rotationEffect(.degrees(needleRotation))
                    .animation(.spring(response: 0.45, dampingFraction: 0.78), value: needleRotation)

                Circle()
                    .fill(Color.white.opacity(0.28))
                    .frame(width: 6, height: 6)
            }
        }
        .aspectRatio(1, contentMode: .fit)
    }

    private func drawTicks(context: GraphicsContext, center: CGPoint, outer: CGFloat) {
        for degree in stride(from: 0, to: 360, by: 5) {
            let isMajor = degree % 45 == 0
            let isMedium = degree % 15 == 0
            let inner = outer - (isMajor ? 18 : isMedium ? 11 : 7)
            let angle = Angle.degrees(Double(degree) - 90)

            var path = Path()
            path.move(to: point(center: center, radius: inner, angle: angle))
            path.addLine(to: point(center: center, radius: outer, angle: angle))

            let opacity = isMajor ? 0.55 : isMedium ? 0.34 : 0.2
            context.stroke(
                path,
                with: .color(.white.opacity(opacity)),
                lineWidth: isMajor ? 1.6 : 1
            )
        }
    }

    private func drawCardinals(context: GraphicsContext, center: CGPoint, outer: CGFloat) {
        let labels = ["N", "E", "S", "W"]
        for (index, label) in labels.enumerated() {
            let angle = Angle.degrees(Double(index) * 90 - 90)
            let position = point(center: center, radius: outer - 44, angle: angle)
            let text = context.resolve(
                Text(label)
                    .font(.system(size: 14, weight: .semibold, design: .rounded))
                    .foregroundStyle(label == "N" ? Color.white : Color.white.opacity(0.55))
            )
            context.draw(text, at: position, anchor: .center)
        }
    }

    private func point(center: CGPoint, radius: CGFloat, angle: Angle) -> CGPoint {
        CGPoint(
            x: center.x + radius * cos(angle.radians),
            y: center.y + radius * sin(angle.radians)
        )
    }
}

private struct NeedleShape: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.maxY))
        path.closeSubpath()
        return path
    }
}
