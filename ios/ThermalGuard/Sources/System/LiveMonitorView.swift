import AVKit
import SwiftUI
import WebKit

// 系统端 · 现场监控
// 把摄像机的实时画面放进指挥视角：HLS 直接播，MJPEG/图片流交给 WebView，
// 没有硬件时用 App 内置的演示流，保证随时能演示。

struct LiveMonitorView: View {
    @Bindable var store: SystemStore

    private var cameras: [CameraSource] { store.cameras }
    private var selected: CameraSource? {
        cameras.first { $0.id == store.selectedCameraId } ?? cameras.first
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                header

                if let camera = selected {
                    LivePlayerView(camera: camera)
                        .aspectRatio(16.0 / 9.0, contentMode: .fit)
                        .clipShape(RoundedRectangle(cornerRadius: 16))
                        .overlay(alignment: .topLeading) { statusChip(for: camera) }
                        .overlay(alignment: .bottomLeading) { nameCard(for: camera) }

                    if let url = camera.url {
                        Text(url)
                            .font(.system(size: 11, design: .monospaced))
                            .foregroundStyle(.white.opacity(0.35))
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }

                HStack {
                    Text("监控点位").font(.system(size: 16, weight: .semibold))
                    Spacer()
                    Text("\(cameras.count) 路").font(.system(size: 12)).foregroundStyle(.white.opacity(0.35))
                }

                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 10) {
                        ForEach(cameras) { camera in
                            Button {
                                store.selectedCameraId = camera.id
                            } label: {
                                VStack(alignment: .leading, spacing: 8) {
                                    ZStack {
                                        RoundedRectangle(cornerRadius: 10).fill(Color.white.opacity(0.06))
                                        Image(systemName: camera.kind == .demo ? "photo.on.rectangle.angled" : "video")
                                            .foregroundStyle(.white.opacity(0.5))
                                    }
                                    .frame(width: 132, height: 74)
                                    VStack(alignment: .leading, spacing: 3) {
                                        Text(camera.name).font(.system(size: 12, weight: .semibold)).lineLimit(1)
                                        Text(camera.location).font(.system(size: 11)).foregroundStyle(.white.opacity(0.4)).lineLimit(1)
                                    }
                                }
                                .padding(10)
                                .frame(width: 152, alignment: .leading)
                                .background(
                                    RoundedRectangle(cornerRadius: 14)
                                        .fill(Color(white: 0.11))
                                        .overlay(
                                            RoundedRectangle(cornerRadius: 14)
                                                .stroke(store.selectedCameraId == camera.id ? Color.alertRed : .clear, lineWidth: 1.5)
                                        )
                                )
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    .padding(.horizontal, 2)
                }

                VStack(alignment: .leading, spacing: 6) {
                    Text("接入方式").font(.system(size: 13, weight: .semibold))
                    Text("RTSP 无法被手机直接播放，需要海康、大华 NVR 或媒体网关转成 HLS/WebRTC。接入后在设置里填流地址即可，App 端会按 HLS 播放。")
                        .font(.system(size: 12))
                        .foregroundStyle(.white.opacity(0.45))
                        .lineSpacing(3)
                }
                .padding(14)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color(white: 0.11), in: RoundedRectangle(cornerRadius: 14))
            }
            .padding(16)
        }
        .background(Color.black)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("现场监控")
                .font(.system(size: 11, weight: .semibold))
                .foregroundStyle(Color.alertRed)
                .textCase(.uppercase)
            Text("楼道实时画面")
                .font(.system(size: 30, weight: .bold))
            Text("与热像检测同一视角，用于复核报警与远程确认现场")
                .font(.system(size: 14))
                .foregroundStyle(.white.opacity(0.5))
        }
        .padding(.top, 8)
    }

    private func statusChip(for camera: CameraSource) -> some View {
        HStack(spacing: 6) {
            Circle().fill(Color.safeGreen).frame(width: 6, height: 6)
            Text(camera.isPublic ? "公开监控" : "本机监控")
                .font(.system(size: 11, weight: .medium))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 6)
        .background(.ultraThinMaterial, in: Capsule())
        .padding(10)
    }

    private func nameCard(for camera: CameraSource) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(camera.name).font(.system(size: 12, weight: .semibold))
            Text(camera.location).font(.system(size: 11)).foregroundStyle(.white.opacity(0.6))
        }
        .padding(.horizontal, 10)
        .padding(.vertical, 8)
        .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 10))
        .padding(10)
    }
}

/// 按流类型选择播放器：HLS 用 AVPlayer，MJPEG/图片流用 WKWebView，演示流用内置动图
struct LivePlayerView: View {
    let camera: CameraSource

    var body: some View {
        Group {
            switch camera.kind {
            case .demo:
                AnimatedGifView(resourceName: "demo-live")
            case .hls:
                if let urlString = camera.url, let url = URL(string: urlString) {
                    VideoPlayer(player: AVPlayer(url: url))
                } else {
                    placeholder
                }
            case .mjpeg:
                if let urlString = camera.url, let url = URL(string: urlString) {
                    MJPEGWebView(url: url)
                } else {
                    placeholder
                }
            }
        }
        .background(Color(white: 0.04))
    }

    private var placeholder: some View {
        ZStack {
            Color(white: 0.04)
            VStack(spacing: 8) {
                Image(systemName: "video.slash").font(.system(size: 28)).foregroundStyle(.white.opacity(0.3))
                Text("未配置流地址").font(.system(size: 12)).foregroundStyle(.white.opacity(0.4))
            }
        }
    }
}

/// 播放 bundle 里的动图（演示流）
struct AnimatedGifView: UIViewRepresentable {
    let resourceName: String

    func makeUIView(context: Context) -> UIImageView {
        let view = UIImageView()
        view.contentMode = .scaleAspectFill
        view.clipsToBounds = true
        if let url = Bundle.main.url(forResource: resourceName, withExtension: "gif"),
           let data = try? Data(contentsOf: url),
           let image = UIImage.animatedImage(withGIFData: data) {
            view.image = image
            view.startAnimating()
        }
        return view
    }

    func updateUIView(_ uiView: UIImageView, context: Context) {}
}

private extension UIImage {
    static func animatedImage(withGIFData data: Data) -> UIImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        let count = CGImageSourceGetCount(source)
        var images: [UIImage] = []
        var duration: Double = 0

        for index in 0..<count {
            guard let cgImage = CGImageSourceCreateImageAtIndex(source, index, nil) else { continue }
            images.append(UIImage(cgImage: cgImage))
            duration += frameDuration(source: source, index: index)
        }
        guard !images.isEmpty else { return nil }
        return UIImage.animatedImage(with: images, duration: max(duration, 0.1))
    }

    private static func frameDuration(source: CGImageSource, index: Int) -> Double {
        guard let properties = CGImageSourceCopyPropertiesAtIndex(source, index, nil) as? [CFString: Any],
              let gif = properties[kCGImagePropertyGIFDictionary] as? [CFString: Any] else { return 0.1 }
        let unclamped = gif[kCGImagePropertyGIFUnclampedDelayTime] as? Double
        let clamped = gif[kCGImagePropertyGIFDelayTime] as? Double
        let value = unclamped ?? clamped ?? 0.1
        return value < 0.02 ? 0.1 : value
    }
}

/// MJPEG / 图片轮询流交给 WebView 承载，避免自己解析 multipart
struct MJPEGWebView: UIViewRepresentable {
    let url: URL

    func makeUIView(context: Context) -> WKWebView {
        let view = WKWebView()
        view.isOpaque = false
        view.backgroundColor = .black
        view.scrollView.isScrollEnabled = false
        let html = """
        <html><body style="margin:0;background:#000;">
        <img src="\(url.absoluteString)" style="width:100%;height:100%;object-fit:contain;">
        </body></html>
        """
        view.loadHTMLString(html, baseURL: nil)
        return view
    }

    func updateUIView(_ uiView: WKWebView, context: Context) {}
}
