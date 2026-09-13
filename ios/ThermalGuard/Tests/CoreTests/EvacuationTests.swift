import XCTest

// 核心逻辑回归：断言与 Web 端 tests/*.test.mjs 同一组不变量，
// 用来证明 iOS / 网页 / macOS 三端的路线与风险判定是一致的。

final class EvacuationTests: XCTestCase {
    private func route(start: String, fire: FireSource? = nil, elapsed: Double = 0, blocked: Set<String> = []) -> EvacuationRoute {
        Evacuation.plan(startId: start, fire: fire, elapsed: elapsed, blocked: blocked)
    }

    func testRouteWithoutFireGoesToLobby() {
        let result = route(start: "C4")
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.exitId, "L1")
        XCTAssertEqual(result.meters, 76, accuracy: 0.001)
        XCTAssertGreaterThanOrEqual(result.steps.count, 4)
    }

    func testRouteAvoidsTheStairOnFire() {
        let fire = FireSource(nodeId: "A4", floor: 4, startedAt: Date(), isDrill: true)
        let result = route(start: "C4", fire: fire)
        XCTAssertTrue(result.ok)
        XCTAssertFalse(result.path.contains("A4"), "起火楼梯不应出现在路线里")
        XCTAssertTrue(result.path.contains("B4"), "应改走另一侧楼梯")
    }

    func testStartOnFireStillEscapes() {
        let fire = FireSource(nodeId: "C4", floor: 4, startedAt: Date(), isDrill: true)
        let result = route(start: "C4", fire: fire)
        XCTAssertTrue(result.ok)
        XCTAssertFalse(result.warnings.isEmpty, "应给出火势警告")
        XCTAssertEqual(result.exitId, "L1")
    }

    func testNoExitAvailableReportsReason() {
        let fire = FireSource(nodeId: "C2", floor: 2, startedAt: Date(), isDrill: true)
        let result = route(start: "C1", fire: fire, elapsed: 300, blocked: ["L1", "ROOF"])
        XCTAssertFalse(result.ok)
        XCTAssertFalse(result.reason?.isEmpty ?? true)
    }

    func testFallsBackToRoofWhenDescentBlocked() {
        let fire = FireSource(nodeId: "C2", floor: 2, startedAt: Date(), isDrill: true)
        let blocked: Set<String> = ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3", "B4", "B5"]
        let result = route(start: "C6", fire: fire, blocked: blocked)
        XCTAssertTrue(result.ok)
        XCTAssertEqual(result.exitId, "ROOF")
    }

    func testHazardGrowsWithTime() {
        let fire = FireSource(nodeId: "C4", floor: 4, startedAt: Date(), isDrill: true)
        let early = Evacuation.computeHazard(fire: fire, elapsed: 0)
        let late = Evacuation.computeHazard(fire: fire, elapsed: 120)
        let earlySmoke = early.values.filter { $0.level == .smoke }.count
        let lateSmoke = late.values.filter { $0.level == .smoke || $0.level == .fire }.count
        XCTAssertGreaterThan(lateSmoke, earlySmoke)
    }

    func testBearingCardinalMapping() {
        // 平面图里 x 向东、y 向南，因此正北 = -y
        XCTAssertEqual(Evacuation.bearing(from: "C8", to: "ROOF"), 0, accuracy: 0.001, "y 减小为正北")
        XCTAssertEqual(Evacuation.bearing(from: "C1", to: "L1"), 180, accuracy: 0.001, "y 增大为正南")
        XCTAssertEqual(Evacuation.bearing(from: "A4", to: "C4"), 90, accuracy: 0.001, "x 增大为正东")
        XCTAssertEqual(Evacuation.bearing(from: "B5", to: "C5"), 270, accuracy: 0.001, "x 减小为正西")
        XCTAssertEqual(Evacuation.cardinal(90).short, "E")
        XCTAssertEqual(Evacuation.cardinal(0).short, "N")
        XCTAssertEqual(Evacuation.cardinal(315).label, "西北")
    }
}

final class ThermalFrameTests: XCTestCase {
    func testNormalProfileIsLowRisk() {
        let frame = ThermalFrame.simulated(phase: 0, profile: .normal)
        XCTAssertEqual(frame.risk(), .low)
        XCTAssertTrue(frame.hotspots.isEmpty, "室温画面不应检出热区")
    }

    func testFireProfileIsHighRisk() {
        let frame = ThermalFrame.simulated(phase: 10, profile: .fire)
        XCTAssertEqual(frame.risk(), .high)
        XCTAssertGreaterThan(frame.maxTemp, 80)
        XCTAssertFalse(frame.hotspots.isEmpty)
    }

    func testWarmingCrossesThresholdsOverTime() {
        let risks = [0.0, 20.0, 45.0].map { ThermalFrame.simulated(phase: $0, profile: .warming).risk() }
        XCTAssertEqual(risks.first, .low)
        XCTAssertEqual(risks.last, .high)
        XCTAssertTrue(risks.contains(.medium), "中途应经过中风险")
    }

    func testThresholdsAreConfigurable() {
        let frame = ThermalFrame.simulated(phase: 10, profile: .fire)
        XCTAssertEqual(frame.risk(high: 200, medium: 40), .medium)
        XCTAssertEqual(frame.risk(high: 40, medium: 30), .high)
    }
}

// 系统端 → 用户端的警情链接解析
final class FireLinkTests: XCTestCase {
    func testParsesFireWithFloor() {
        let url = URL(string: "thermalguarduser://fire?floor=6")!
        XCTAssertEqual(FireLink.parse(url), .fire(floor: 6))
    }

    func testClampsOutOfRangeFloor() {
        XCTAssertEqual(FireLink.parse(URL(string: "thermalguarduser://fire?floor=99")!), .fire(floor: Building.floorCount))
        XCTAssertEqual(FireLink.parse(URL(string: "thermalguarduser://fire?floor=0")!), .fire(floor: 1))
    }

    func testDefaultsToFourthFloorWhenMissing() {
        XCTAssertEqual(FireLink.parse(URL(string: "thermalguarduser://fire")!), .fire(floor: 4))
    }

    func testParsesClear() {
        XCTAssertEqual(FireLink.parse(URL(string: "thermalguarduser://clear")!), .clear)
    }

    func testRejectsOtherSchemesAndHosts() {
        XCTAssertNil(FireLink.parse(URL(string: "https://example.com/fire?floor=6")!))
        XCTAssertNil(FireLink.parse(URL(string: "thermalguarduser://unknown")!))
    }

    func testRoundTrip() {
        let url = FireLink.makeFireURL(floor: 7)!
        XCTAssertEqual(FireLink.parse(url), .fire(floor: 7))
    }
}
