import Foundation

protocol HardwareClient: AnyObject {
    var onFrame: ((ThermalFrame) -> Void)? { get set }
    var onStateChange: ((ConnectionState) -> Void)? { get set }
    func connect() async throws
    func disconnect() async
}
