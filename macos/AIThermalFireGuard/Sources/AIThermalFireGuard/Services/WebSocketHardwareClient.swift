import Foundation

final class WebSocketHardwareClient: HardwareClient {
    var onFrame: ((ThermalFrame) -> Void)?
    var onStateChange: ((ConnectionState) -> Void)?

    private let endpoint: String
    private let session: URLSession
    private var socketTask: URLSessionWebSocketTask?
    private var receiveTask: Task<Void, Never>?

    init(endpoint: String) {
        self.endpoint = endpoint
        let configuration = URLSessionConfiguration.default
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 60 * 60
        self.session = URLSession(configuration: configuration)
    }

    func connect() async throws {
        guard let url = URL(string: endpoint), let scheme = url.scheme?.lowercased(), scheme == "ws" || scheme == "wss" else {
            throw HardwareError.invalidEndpoint("请输入有效的 ws:// 或 wss:// 地址")
        }

        await disconnect()
        onStateChange?(.connecting)
        let task = session.webSocketTask(with: url)
        socketTask = task
        task.resume()
        onStateChange?(.connected)
        receiveTask = Task { [weak self] in
            await self?.receiveLoop(task)
        }
    }

    func disconnect() async {
        receiveTask?.cancel()
        receiveTask = nil
        socketTask?.cancel(with: .normalClosure, reason: nil)
        socketTask = nil
        onStateChange?(.disconnected)
    }

    private func receiveLoop(_ task: URLSessionWebSocketTask) async {
        while !Task.isCancelled {
            do {
                let message = try await task.receive()
                let data: Data?
                switch message {
                case .data(let payload): data = payload
                case .string(let text): data = Data(text.utf8)
                @unknown default: data = nil
                }
                guard let data else { continue }
                let decoder = JSONDecoder()
                decoder.keyDecodingStrategy = .convertFromSnakeCase
                let packet = try decoder.decode(ThermalPacket.self, from: data)
                let frame = packet.normalizedFrame(defaultSource: "ESP32 Wi-Fi")
                await MainActor.run {
                    self.onFrame?(frame)
                }
            } catch {
                guard !Task.isCancelled else { return }
                await MainActor.run {
                    self.onStateChange?(.failed("WebSocket 数据中断：\(error.localizedDescription)"))
                }
                return
            }
        }
    }

    deinit {
        receiveTask?.cancel()
        socketTask?.cancel(with: .goingAway, reason: nil)
    }
}

enum HardwareError: LocalizedError {
    case invalidEndpoint(String)
    case portUnavailable(String)
    case serialConfiguration(String)

    var errorDescription: String? {
        switch self {
        case .invalidEndpoint(let message), .portUnavailable(let message), .serialConfiguration(let message):
            message
        }
    }
}
