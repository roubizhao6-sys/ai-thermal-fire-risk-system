import Foundation
import Observation

// 系统检测端状态：热像帧、预警记录、城市点位、当前火情。

@Observable
final class SystemStore {
    var frame: ThermalFrame = .simulated(phase: 0)
    var alerts: [AlarmPoint] = AlarmPoint.demo
    var selectedPointId: String?
    var fire: FireSource?
    var phase: Double = 0
    var isDetecting = false
    var progress: Double = 0
    var showAlarm = false

    private var tickTask: Task<Void, Never>?

    var highCount: Int { alerts.filter { $0.risk == .high }.count }
    var mediumCount: Int { alerts.filter { $0.risk == .medium }.count }
    var lowCount: Int { alerts.filter { $0.risk == .low }.count }

    func startSimulator() {
        tickTask?.cancel()
        tickTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                guard let self else { return }
                phase += 1
                frame = .simulated(phase: phase)
                try? await Task.sleep(for: .milliseconds(320))
            }
        }
    }

    func stopSimulator() {
        tickTask?.cancel()
        tickTask = nil
    }

    /// 演示用的检测流程：进度条走完后给出结果，高风险时直接进入报警
    func runDetection() {
        guard !isDetecting else { return }
        isDetecting = true
        progress = 0
        Task { @MainActor [weak self] in
            while let self, progress < 1 {
                try? await Task.sleep(for: .milliseconds(90))
                progress = min(1, progress + Double.random(in: 0.08...0.17))
            }
            guard let self else { return }
            let result = ThermalFrame.simulated(phase: phase, profile: .fire)
            frame = result
            isDetecting = false
            let point = AlarmPoint(
                id: "local-\(Int(Date().timeIntervalSince1970))",
                name: "手机端实时检测",
                area: "现场",
                latitude: 22.1516,
                longitude: 113.5676,
                risk: result.risk(),
                temperature: result.maxTemp,
                hotspots: result.hotspots.count,
                time: Date().formatted(date: .omitted, time: .shortened)
            )
            alerts.insert(point, at: 0)
            if result.risk() == .high { triggerAlarm(floor: 4) }
        }
    }

    func triggerAlarm(floor: Int) {
        fire = FireSource(nodeId: "C\(floor)", floor: floor, startedAt: Date(), isDrill: false)
        showAlarm = true
    }

    func startDrill(floor: Int) {
        fire = FireSource(nodeId: "C\(floor)", floor: floor, startedAt: Date(), isDrill: true)
        showAlarm = true
    }

    func resolveAlarm() {
        fire = nil
        showAlarm = false
    }
}
