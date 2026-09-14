import Foundation

// 楼宇拓扑：8 层示意楼宇，A/B 两条楼梯贯通，1 楼大堂正门与 8 楼天台两个出口。
// 与 Web 端 building.js 保持同构，三端算出的路线必须一致。

struct BuildingNode: Hashable {
    enum Kind: Hashable { case stair, corridor, exit }

    let id: String
    let floor: Int
    let x: Double   // 0–100，向东为正
    let y: Double   // 0–100，向南为正
    let kind: Kind
    let stair: String?
}

struct BuildingEdge: Hashable {
    enum Kind: Hashable { case corridor, stair }

    let a: String
    let b: String
    let meters: Double
    let kind: Kind
    let stair: String?
}

enum Building {
    static let floorCount = 8

    private static let layout = (west: 10.0, mid: 50.0, east: 90.0, corridor: 48.0, lobby: 74.0, roof: 22.0)

    static let nodes: [String: BuildingNode] = {
        var nodes: [String: BuildingNode] = [:]
        for floor in 1...floorCount {
            nodes["A\(floor)"] = BuildingNode(id: "A\(floor)", floor: floor, x: layout.west, y: layout.corridor, kind: .stair, stair: "A")
            nodes["C\(floor)"] = BuildingNode(id: "C\(floor)", floor: floor, x: layout.mid, y: layout.corridor, kind: .corridor, stair: nil)
            nodes["B\(floor)"] = BuildingNode(id: "B\(floor)", floor: floor, x: layout.east, y: layout.corridor, kind: .stair, stair: "B")
        }
        nodes["L1"] = BuildingNode(id: "L1", floor: 1, x: layout.mid, y: layout.lobby, kind: .exit, stair: nil)
        nodes["ROOF"] = BuildingNode(id: "ROOF", floor: floorCount, x: layout.mid, y: layout.roof, kind: .exit, stair: nil)
        return nodes
    }()

    static let edges: [BuildingEdge] = {
        var edges: [BuildingEdge] = []
        for floor in 1...floorCount {
            edges.append(BuildingEdge(a: "A\(floor)", b: "C\(floor)", meters: 16, kind: .corridor, stair: nil))
            edges.append(BuildingEdge(a: "C\(floor)", b: "B\(floor)", meters: 16, kind: .corridor, stair: nil))
            if floor < floorCount {
                edges.append(BuildingEdge(a: "A\(floor)", b: "A\(floor + 1)", meters: 12, kind: .stair, stair: "A"))
                edges.append(BuildingEdge(a: "B\(floor)", b: "B\(floor + 1)", meters: 12, kind: .stair, stair: "B"))
            }
        }
        edges.append(BuildingEdge(a: "C1", b: "L1", meters: 8, kind: .corridor, stair: nil))
        edges.append(BuildingEdge(a: "C\(floorCount)", b: "ROOF", meters: 10, kind: .corridor, stair: nil))
        return edges
    }()

    static let adjacency: [String: [BuildingEdge]] = {
        var map: [String: [BuildingEdge]] = [:]
        for id in nodes.keys { map[id] = [] }
        for edge in edges {
            map[edge.a, default: []].append(edge)
            map[edge.b, default: []].append(edge)
        }
        return map
    }()

    /// 出口与其附加代价：天台只在向下通道不可通行时才会被选中
    static let exits: [(id: String, label: String, penalty: Double)] = [
        (id: "L1", label: "1 楼大堂正门", penalty: 0),
        (id: "ROOF", label: "8 楼天台避难区", penalty: 400),
    ]

    static func node(_ id: String) -> BuildingNode? { nodes[id] }

    static func label(_ id: String) -> String {
        switch id {
        case "L1": return "1 楼大堂正门"
        case "ROOF": return "8 楼天台避难区"
        default:
            guard let node = nodes[id] else { return id }
            let spot = node.kind == .stair ? "\(node.stair ?? "") 楼梯口" : "走廊中段"
            return "\(node.floor) 楼\(spot)"
        }
    }

    static func positionNodeId(floor: Int, spot: String) -> String { "\(spot)\(floor)" }

    static func neighbors(_ id: String) -> [BuildingEdge] { adjacency[id] ?? [] }

    static func edge(from: String, to: String) -> BuildingEdge? {
        neighbors(from).first { $0.a == to || $0.b == to }
    }
}
