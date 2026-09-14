import Foundation

// 危险扩散模型 + A* 动态避障 + 逃生指令生成。
// 与 Web 端 evacuation.js 同一套规则：
//   · 烟气向上蔓延快于向下（上行权重 0.7 / 下行 1.1）
//   · 起火点本身永不可通行；核心火源区只允许从当前位置迈出第一步
//   · 浓烟重罚、烟气边缘轻罚，危险半径随起火时间增长

enum HazardLevel: String {
    case fire, smoke, warn, clear

    var label: String {
        switch self {
        case .fire: return "火源核心"
        case .smoke: return "浓烟"
        case .warn: return "烟气边缘"
        case .clear: return "正常"
        }
    }
}

struct HazardSample {
    let level: HazardLevel
    let depth: Double
}

struct FireSource: Equatable {
    var nodeId: String
    var floor: Int
    var startedAt: Date
    var isDrill: Bool
}

struct RouteStep: Identifiable {
    let id: String
    let title: String
    let detail: String
    let icon: Icon

    enum Icon { case start, walk, stair, exit }
}

struct EvacuationRoute {
    let ok: Bool
    let path: [String]
    let exitId: String
    let exitLabel: String
    let meters: Double
    let seconds: Int
    let steps: [RouteStep]
    let warnings: [String]
    let hazard: [String: HazardSample]
    let reason: String?
}

enum Evacuation {
    private static let hopCorridor = 1.0
    private static let hopStairUp = 0.7
    private static let hopStairDown = 1.1

    private static let fireDepth = 0.5
    private static let smokeDepth = 2.4
    private static let warnDepth = 4.0

    private static let firePenalty = 100.0
    private static let smokePenalty = 45.0
    private static let warnPenalty = 14.0
    private static let walkingSpeed = 1.15

    /// 以火源为起点的加权跳数扩散，再按时间放大危险半径
    static func computeHazard(fire: FireSource?, elapsed: Double) -> [String: HazardSample] {
        var hazard: [String: HazardSample] = [:]
        for id in Building.nodes.keys { hazard[id] = HazardSample(level: .clear, depth: .infinity) }
        guard let fire, Building.node(fire.nodeId) != nil else { return hazard }

        let spread = 1 + min(max(elapsed, 0) / 55, 1.5)
        var depths: [String: Double] = [fire.nodeId: 0]
        var settled: Set<String> = []

        while settled.count < Building.nodes.count {
            var current: String?
            var best = Double.infinity
            for (id, depth) in depths where !settled.contains(id) && depth < best {
                best = depth
                current = id
            }
            guard let current else { break }
            settled.insert(current)

            for edge in Building.neighbors(current) {
                let next = edge.a == current ? edge.b : edge.a
                var hop = hopCorridor
                if edge.kind == .stair {
                    let from = Building.node(current)?.floor ?? 1
                    let to = Building.node(next)?.floor ?? 1
                    hop = to > from ? hopStairUp : hopStairDown
                }
                let candidate = best + hop
                if candidate < (depths[next] ?? .infinity) { depths[next] = candidate }
            }
        }

        for (id, depth) in depths {
            let effective = depth / spread
            let level: HazardLevel
            if effective <= fireDepth { level = .fire }
            else if effective <= smokeDepth { level = .smoke }
            else if effective <= warnDepth { level = .warn }
            else { level = .clear }
            hazard[id] = HazardSample(level: level, depth: effective)
        }
        return hazard
    }

    private static func heuristic(_ from: String, _ to: String) -> Double {
        guard let a = Building.node(from), let b = Building.node(to) else { return 0 }
        // 可采纳下界：垂直 12 米/层，水平 0.2 米/坐标单位
        return 12 * Double(abs(a.floor - b.floor)) + 0.2 * (abs(a.x - b.x) + abs(a.y - b.y))
    }

    private static func aStar(start: String, goal: String, hazard: [String: HazardSample], blocked: Set<String>, origin: String?) -> (path: [String], cost: Double)? {
        let startNeighbors = Set(Building.neighbors(start).map { $0.a == start ? $0.b : $0.a })

        func allowed(_ id: String) -> Bool {
            if blocked.contains(id) { return false }
            if id == start { return true }
            if id == origin { return false }
            let depth = hazard[id]?.depth ?? .infinity
            if depth <= fireDepth { return startNeighbors.contains(id) }
            return true
        }

        func penalty(_ id: String) -> Double {
            if id == start { return 0 }
            let depth = hazard[id]?.depth ?? .infinity
            if depth <= fireDepth { return firePenalty }
            if depth <= smokeDepth { return smokePenalty }
            if depth <= warnDepth { return warnPenalty }
            return 0
        }

        var open: [String: Double] = [start: heuristic(start, goal)]
        var gScore: [String: Double] = [start: 0]
        var cameFrom: [String: String] = [:]
        var closed: Set<String> = []

        while !open.isEmpty {
            var current: String?
            var best = Double.infinity
            for (id, score) in open where score < best {
                best = score
                current = id
            }
            guard let current else { break }
            open[current] = nil

            if current == goal {
                var path = [current]
                var cursor = current
                while let previous = cameFrom[cursor] {
                    cursor = previous
                    path.insert(previous, at: 0)
                }
                return (path, gScore[current] ?? 0)
            }

            closed.insert(current)
            for edge in Building.neighbors(current) {
                let next = edge.a == current ? edge.b : edge.a
                if closed.contains(next) || !allowed(next) { continue }
                let tentative = (gScore[current] ?? 0) + edge.meters + penalty(next)
                if tentative < (gScore[next] ?? .infinity) {
                    cameFrom[next] = current
                    gScore[next] = tentative
                    open[next] = tentative + heuristic(next, goal)
                }
            }
        }
        return nil
    }

    static func plan(startId: String, fire: FireSource?, elapsed: Double, blocked: Set<String> = []) -> EvacuationRoute {
        let hazard = computeHazard(fire: fire, elapsed: elapsed)
        let start = Building.node(startId) != nil ? startId : "C3"

        var candidates: [(path: [String], cost: Double, meters: Double, exitId: String, exitLabel: String)] = []
        for exit in Building.exits {
            guard !blocked.contains(exit.id) else { continue }
            guard (hazard[exit.id]?.level ?? .clear) != .fire else { continue }
            guard let found = aStar(start: start, goal: exit.id, hazard: hazard, blocked: blocked, origin: fire?.nodeId) else { continue }
            let meters = zip(found.path, found.path.dropFirst()).reduce(0.0) { total, pair in
                total + (Building.edge(from: pair.0, to: pair.1)?.meters ?? 0)
            }
            candidates.append((found.path, found.cost + exit.penalty, meters, exit.id, exit.label))
        }

        candidates.sort { $0.cost < $1.cost }
        guard let best = candidates.first else {
            return EvacuationRoute(ok: false, path: [], exitId: "", exitLabel: "", meters: 0, seconds: 0, steps: [],
                                   warnings: [], hazard: hazard,
                                   reason: "所有常规逃生通道均已受阻，请退回房间关闭房门、封堵门缝并等待救援")
        }

        let built = buildSteps(path: best.path, hazard: hazard)
        var warnings = built.warnings
        let crossings = best.path.filter { hazard[$0]?.level == .fire }.count
        if crossings > 0 {
            warnings.insert("路线需紧邻火源通过 \(crossings) 处核心高温区：请低姿快速通过；若浓烟已无法看清路面，请退回房间关门封缝等待救援", at: 0)
        }
        if hazard[start]?.level == .fire {
            warnings.insert("您所在位置正处于火源核心区，请立刻沿指引撤离，不要收整物品", at: 0)
        } else if hazard[start]?.level == .smoke {
            warnings.insert("您所在区域已有浓烟，请保持低姿并尽快离开", at: 0)
        }

        return EvacuationRoute(
            ok: true,
            path: best.path,
            exitId: best.exitId,
            exitLabel: best.exitLabel,
            meters: best.meters,
            seconds: max(1, Int((best.meters / walkingSpeed).rounded())),
            steps: built.steps,
            warnings: warnings,
            hazard: hazard,
            reason: nil
        )
    }

    private static func buildSteps(path: [String], hazard: [String: HazardSample]) -> (steps: [RouteStep], warnings: [String]) {
        var steps: [RouteStep] = []
        var warnings: [String] = []
        guard let first = path.first else { return (steps, warnings) }

        steps.append(RouteStep(id: "start", title: "从\(Building.label(first))出发",
                               detail: path.count > 1 ? "先确认身后无可燃物，全程保持低姿" : "您已在安全出口位置",
                               icon: .start))

        var walk: (start: String, end: String, meters: Double, floor: Int, heading: String)?
        var stair: (stair: String, dir: Int, levels: Int, from: String, endFloor: Int)?

        func flushWalk() {
            guard let walk else { return }
            steps.append(RouteStep(id: "walk-\(walk.start)-\(walk.end)",
                                   title: "沿 \(walk.floor) 楼走廊\(walk.heading)前行 \(Int(walk.meters.rounded())) 米",
                                   detail: "到达\(Building.label(walk.end))", icon: .walk))
        }
        func flushStair() {
            guard let stair else { return }
            steps.append(RouteStep(id: "stair-\(stair.stair)-\(stair.from)",
                                   title: "经 \(stair.stair) 楼梯\(stair.dir > 0 ? "向上" : "向下") \(stair.levels) 层",
                                   detail: "到达 \(stair.endFloor) 楼，切勿使用电梯", icon: .stair))
        }

        for index in 1..<path.count {
            let fromId = path[index - 1]
            let toId = path[index]
            guard let from = Building.node(fromId), let to = Building.node(toId),
                  let edge = Building.edge(from: fromId, to: toId) else { continue }

            if let level = hazard[toId]?.level, level == .smoke {
                warnings.append("\(Building.label(toId))有浓烟，请低姿并用湿毛巾捂住口鼻通过")
            } else if let level = hazard[toId]?.level, level == .warn {
                warnings.append("\(Building.label(toId))附近有烟气扩散，注意观察前方")
            }

            if to.kind == .exit {
                flushWalk()
                flushStair()
                steps.append(RouteStep(id: "exit-\(toId)",
                                       title: toId == "ROOF" ? "抵达 8 楼天台避难区" : "抵达 1 楼大堂，从正门撤离",
                                       detail: toId == "ROOF" ? "关闭防火门阻隔烟气，在明显位置等待消防救援" : "离开建筑后前往空旷集合点，不要返回取物",
                                       icon: .exit))
                continue
            }

            if edge.kind == .stair {
                flushWalk()
                let direction = to.floor > from.floor ? 1 : -1
                if var current = stair, current.stair == edge.stair, current.dir == direction {
                    current.levels += 1
                    current.endFloor = to.floor
                    stair = current
                } else {
                    flushStair()
                    stair = (edge.stair ?? "A", direction, 1, fromId, to.floor)
                }
                continue
            }

            flushStair()
            let dx = to.x - from.x
            let dy = to.y - from.y
            let heading: String
            if abs(dx) >= abs(dy) { heading = dx > 0 ? "向东" : "向西" }
            else { heading = dy > 0 ? "向南" : "向北" }

            if var current = walk, current.floor == to.floor, current.heading == heading {
                current.end = toId
                current.meters += edge.meters
                walk = current
            } else {
                flushWalk()
                walk = (fromId, toId, edge.meters, to.floor, heading)
            }
        }

        flushWalk()
        flushStair()
        return (steps, Array(Set(warnings)).sorted())
    }

    /// 平面图坐标系下的方位角：正北为 -y，向东为 +x
    static func bearing(from: String, to: String) -> Double {
        guard let a = Building.node(from), let b = Building.node(to) else { return 0 }
        let dx = b.x - a.x
        let dy = b.y - a.y
        let degrees = atan2(dx, -dy) * 180 / .pi
        return (degrees + 360).truncatingRemainder(dividingBy: 360)
    }

    static func cardinal(_ bearing: Double) -> (short: String, label: String) {
        let table: [(String, String)] = [
            ("N", "北"), ("NE", "东北"), ("E", "东"), ("SE", "东南"),
            ("S", "南"), ("SW", "西南"), ("W", "西"), ("NW", "西北"),
        ]
        let index = Int((bearing / 45).rounded()) % 8
        let item = table[(index + 8) % 8]
        return (item.0, item.1)
    }
}
