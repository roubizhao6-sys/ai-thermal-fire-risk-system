import Foundation
import Observation

// 用户端状态：我的位置、当前火情、每秒重算的撤离路线。
// 路线完全交给 Core/Evacuation，界面只负责把「往哪走、还有多远」显示出来。

@Observable
final class UserStore {
    struct Position: Equatable {
        var floor: Int = 4
        var spot: String = "C"   // A = A 梯、C = 走廊、B = B 梯
    }

    var position = Position()
    var fire: FireSource?
    var now = Date()
    var headingDegrees: Double?
    var useDeviceHeading = false
    var hint: String?

    private var tickTask: Task<Void, Never>?

    var nodeId: String { Building.positionNodeId(floor: position.floor, spot: position.spot) }

    var elapsed: Double {
        guard let fire else { return 0 }
        return max(0, now.timeIntervalSince(fire.startedAt))
    }

    var route: EvacuationRoute {
        Evacuation.plan(startId: nodeId, fire: fire, elapsed: elapsed)
    }

    /// 下一步要去的节点（路线的第二个点），用来算指针方向
    var nextNodeId: String? {
        let path = route.path
        return path.count > 1 ? path[1] : nil
    }

    var bearing: Double {
        guard let target = nextNodeId ?? (route.ok ? route.exitId : nil) else { return 0 }
        return Evacuation.bearing(from: nodeId, to: target)
    }

    var cardinal: (short: String, label: String) { Evacuation.cardinal(bearing) }

    var distanceToNext: Double {
        guard let next = nextNodeId else { return 0 }
        return Building.edge(from: nodeId, to: next)?.meters ?? 0
    }

    var nextInstruction: RouteStep? {
        route.steps.first { $0.icon != .start }
    }

    func startDrill() {
        let startedAt = Date()
        fire = FireSource(nodeId: "C\(position.floor)", floor: position.floor, startedAt: startedAt, isDrill: true)
        startTicking()
    }

    func stopDrill() {
        fire = nil
        tickTask?.cancel()
        tickTask = nil
    }

    private func startTicking() {
        tickTask?.cancel()
        tickTask = Task { @MainActor [weak self] in
            while !Task.isCancelled {
                self?.now = Date()
                try? await Task.sleep(for: .seconds(1))
            }
        }
    }

    func show(hint text: String) {
        hint = text
        Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(2.6))
            if self?.hint == text { self?.hint = nil }
        }
    }
}
