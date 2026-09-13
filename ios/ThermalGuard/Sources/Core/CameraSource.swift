import Foundation

// 现场监控点位：与网页版 defaultCameras 对应，真实部署时换成设备上报的流地址。

struct CameraSource: Identifiable, Hashable {
    enum Kind: String {
        case demo   // App 内置演示流（动图）
        case hls    // HLS / m3u8，AVPlayer 原生播放
        case mjpeg  // MJPEG 或图片轮询，用 WKWebView 承载

        var label: String {
            switch self {
            case .demo: return "演示流"
            case .hls: return "HLS"
            case .mjpeg: return "MJPEG"
            }
        }
    }

    let id: String
    let name: String
    let location: String
    let kind: Kind
    let url: String?
    let isPublic: Bool

    static let demo: [CameraSource] = [
        CameraSource(id: "demo-live", name: "热感监控演示", location: "三楼东侧走廊", kind: .demo, url: nil, isPublic: true),
    ]

    /// 真实部署时的常见形态：摄像机经 NVR / 媒体网关转成 HLS
    static func exampleHLS(url: String) -> CameraSource {
        CameraSource(id: "hls-\(UUID().uuidString)", name: "现场摄像机", location: "待设置", kind: .hls, url: url, isPublic: false)
    }
}
