import MapKit
import SwiftUI

// 城市热力地图：把火警放到城市坐标上，一眼看清哪个片区在冒烟。
// 用 MapKit 的 MapCircle 画三层同心热力斑（半径越大越透明）模拟热力扩散。

struct CityHeatMapView: View {
    @Bindable var store: SystemStore
    @State private var camera: MapCameraPosition = .region(
        MKCoordinateRegion(
            center: CLLocationCoordinate2D(latitude: 22.19, longitude: 113.72),
            span: MKCoordinateSpan(latitudeDelta: 0.42, longitudeDelta: 0.42)
        )
    )

    var body: some View {
        ZStack(alignment: .top) {
            Map(position: $camera, interactionModes: .all) {
                ForEach(store.alerts) { point in
                    heatLayers(for: point)
                }
            }
            .mapStyle(.standard(elevation: .flat, pointsOfInterest: .excludingAll))
            .ignoresSafeArea(edges: .bottom)

            VStack(alignment: .leading, spacing: 8) {
                HStack(spacing: 6) {
                    statChip("\(store.highCount) 高风险", color: .alertRed)
                    statChip("\(store.mediumCount) 中风险", color: .orange)
                    statChip("\(store.lowCount) 低风险", color: .safeGreen)
                    statChip("共 \(store.alerts.count) 处", color: .white.opacity(0.65))
                }
                if let fire = store.fire {
                    HStack(spacing: 6) {
                        Image(systemName: "flame.fill")
                        Text("当前火警 · \(fire.floor) 楼")
                    }
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(.white)
                    .padding(.horizontal, 12)
                    .padding(.vertical, 7)
                    .background(Color.alertRed, in: Capsule())
                }
                Spacer()
            }
            .padding(.horizontal, 14)
            .padding(.top, 12)
        }
        .safeAreaInset(edge: .bottom) { pointStrip }
    }

    @MapContentBuilder
    private func heatLayers(for point: AlarmPoint) -> some MapContent {
        let color = color(for: point.risk)
        let coordinate = CLLocationCoordinate2D(latitude: point.latitude, longitude: point.longitude)
        let base: CLLocationDistance = point.risk == .high ? 2600 : point.risk == .medium ? 1700 : 950

        MapCircle(center: coordinate, radius: base)
            .foregroundStyle(color.opacity(0.16))
            .stroke(color.opacity(0.22), lineWidth: 0.5)
        MapCircle(center: coordinate, radius: base * 0.58)
            .foregroundStyle(color.opacity(0.26))
        MapCircle(center: coordinate, radius: base * 0.26)
            .foregroundStyle(color.opacity(0.42))
        Annotation(point.name, coordinate: coordinate) {
            Button {
                store.selectedPointId = point.id
                withAnimation(.easeInOut(duration: 0.5)) {
                    camera = .region(MKCoordinateRegion(center: coordinate,
                                                        span: MKCoordinateSpan(latitudeDelta: 0.05, longitudeDelta: 0.05)))
                }
            } label: {
                Circle()
                    .fill(color)
                    .frame(width: point.risk == .high ? 18 : 14)
                    .overlay(Circle().stroke(.white.opacity(0.85), lineWidth: 2))
            }
            .buttonStyle(.plain)
        }
    }

    private var pointStrip: some View {
        VStack(alignment: .leading, spacing: 8) {
            if let id = store.selectedPointId, let point = store.alerts.first(where: { $0.id == id }) {
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Image(systemName: "exclamationmark.shield.fill")
                            .foregroundStyle(color(for: point.risk))
                        Text(point.name).font(.system(size: 15, weight: .semibold))
                        Spacer()
                        Button("关闭") { store.selectedPointId = nil }
                            .font(.system(size: 12))
                            .foregroundStyle(.white.opacity(0.5))
                    }
                    HStack(spacing: 16) {
                        detail("最高温度", String(format: "%.1f°C", point.temperature))
                        detail("高温区域", "\(point.hotspots) 处")
                        detail("风险等级", point.risk.label)
                    }
                }
                .padding(14)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 18))
            } else {
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(store.alerts.prefix(6)) { point in
                            Button {
                                store.selectedPointId = point.id
                            } label: {
                                HStack(spacing: 8) {
                                    Circle().fill(color(for: point.risk)).frame(width: 8, height: 8)
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(point.name).font(.system(size: 12, weight: .semibold))
                                        Text("\(point.area) · \(point.time)")
                                            .font(.system(size: 11))
                                            .foregroundStyle(.white.opacity(0.4))
                                    }
                                    Text(String(format: "%.1f°", point.temperature))
                                        .font(.system(size: 12, weight: .semibold))
                                        .foregroundStyle(color(for: point.risk))
                                }
                                .padding(.horizontal, 12)
                                .padding(.vertical, 10)
                                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 14))
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 14)
                }
            }
        }
        .padding(.bottom, 8)
    }

    private func detail(_ label: String, _ value: String) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(label).font(.system(size: 11)).foregroundStyle(.white.opacity(0.4))
            Text(value).font(.system(size: 13, weight: .semibold))
        }
    }

    private func statChip(_ text: String, color: Color) -> some View {
        Text(text)
            .font(.system(size: 11, weight: .medium))
            .foregroundStyle(color)
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(.ultraThinMaterial, in: Capsule())
    }

    private func color(for risk: RiskLevel) -> Color {
        switch risk {
        case .high: return .alertRed
        case .medium: return .orange
        case .low: return .safeGreen
        }
    }
}
