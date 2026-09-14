import Foundation

// 系统端把警情推给用户端用的链接格式：thermalguarduser://fire?floor=6
// 解析逻辑放在 Core 里，方便单元测试；真实产品应改由 APNs 下发。

enum FireLink {
    static let scheme = "thermalguarduser"

    enum Action: Equatable {
        case fire(floor: Int)
        case clear
    }

    static func parse(_ url: URL) -> Action? {
        guard url.scheme == scheme else { return nil }
        let items = URLComponents(url: url, resolvingAgainstBaseURL: false)?.queryItems
        let floorValue = items?.first { $0.name == "floor" }?.value

        switch url.host {
        case "fire":
            let floor = Int(floorValue ?? "") ?? 4
            return .fire(floor: min(max(floor, 1), Building.floorCount))
        case "clear":
            return .clear
        default:
            return nil
        }
    }

    static func makeFireURL(floor: Int) -> URL? {
        URL(string: "\(scheme)://fire?floor=\(min(max(floor, 1), Building.floorCount))")
    }
}
