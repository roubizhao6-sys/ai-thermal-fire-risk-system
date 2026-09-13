import CoreLocation
import Foundation
import Observation

// 真机罗盘：读 CoreLocation 的磁航向，让表盘跟着手机转，
// 指针就能指向真实世界里的撤离方向。授权拿不到时保持固定指北。

@Observable
final class HeadingProvider: NSObject, CLLocationManagerDelegate {
    var heading: Double?
    var authorized = false

    private let manager = CLLocationManager()

    override init() {
        super.init()
        manager.delegate = self
        manager.headingFilter = 1
    }

    func start() {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            authorized = true
            manager.startUpdatingHeading()
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
        default:
            authorized = false
        }
    }

    func stop() {
        manager.stopUpdatingHeading()
    }

    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        Task { @MainActor in
            switch status {
            case .authorizedWhenInUse, .authorizedAlways:
                authorized = true
                manager.startUpdatingHeading()
            case .denied, .restricted:
                authorized = false
            default:
                break
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateHeading newHeading: CLHeading) {
        let value = newHeading.trueHeading >= 0 ? newHeading.trueHeading : newHeading.magneticHeading
        Task { @MainActor in
            heading = value
        }
    }
}
