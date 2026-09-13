#if !APP_STORE
import Foundation

final class SerialHardwareClient: HardwareClient {
    var onFrame: ((ThermalFrame) -> Void)?
    var onStateChange: ((ConnectionState) -> Void)?

    private let portPath: String
    private let baudRate: Int
    private var fileHandle: FileHandle?
    private var buffer = Data()

    init(portPath: String, baudRate: Int = 115200) {
        self.portPath = portPath
        self.baudRate = baudRate
    }

    static func availablePorts() -> [String] {
        let fileManager = FileManager.default
        let entries = (try? fileManager.contentsOfDirectory(atPath: "/dev")) ?? []
        return entries
            .filter { $0.hasPrefix("cu.") }
            .map { "/dev/\($0)" }
            .sorted()
    }

    func connect() async throws {
        await disconnect()
        guard FileManager.default.fileExists(atPath: portPath) else {
            throw HardwareError.portUnavailable("未找到串口：\(portPath)")
        }

        onStateChange?(.connecting)
        try configureSerialPort()

        guard let handle = FileHandle(forUpdatingAtPath: portPath) else {
            throw HardwareError.portUnavailable("无法打开串口：\(portPath)")
        }

        fileHandle = handle
        handle.readabilityHandler = { [weak self] readableHandle in
            let data = readableHandle.availableData
            guard !data.isEmpty else { return }
            self?.append(data)
        }
        onStateChange?(.connected)
    }

    func disconnect() async {
        fileHandle?.readabilityHandler = nil
        try? fileHandle?.close()
        fileHandle = nil
        buffer.removeAll(keepingCapacity: true)
        onStateChange?(.disconnected)
    }

    private func configureSerialPort() throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/stty")
        process.arguments = [
            "-f", portPath,
            String(baudRate),
            "cs8",
            "-cstopb",
            "-parenb",
            "-icanon",
            "-echo",
            "raw"
        ]

        let errorPipe = Pipe()
        process.standardError = errorPipe
        try process.run()
        process.waitUntilExit()

        guard process.terminationStatus == 0 else {
            let data = errorPipe.fileHandleForReading.readDataToEndOfFile()
            let message = String(data: data, encoding: .utf8) ?? "未知串口配置错误"
            throw HardwareError.serialConfiguration("串口配置失败：\(message.trimmingCharacters(in: .whitespacesAndNewlines))")
        }
    }

    private func append(_ data: Data) {
        buffer.append(data)
        let newline = Data([0x0A])
        while let range = buffer.range(of: newline) {
            let lineData = buffer.subdata(in: 0..<range.lowerBound)
            buffer.removeSubrange(0...range.lowerBound)
            guard !lineData.isEmpty else { continue }
            parse(lineData)
        }
    }

    private func parse(_ data: Data) {
        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        do {
            let packet = try decoder.decode(ThermalPacket.self, from: data)
            let frame = packet.normalizedFrame(defaultSource: "ESP32 串口")
            DispatchQueue.main.async { [weak self] in
                self?.onFrame?(frame)
            }
        } catch {
            let text = String(data: data, encoding: .utf8) ?? ""
            guard !text.isEmpty else { return }
            DispatchQueue.main.async { [weak self] in
                self?.onStateChange?(.failed("串口 JSON 解析失败"))
            }
        }
    }

    deinit {
        fileHandle?.readabilityHandler = nil
        try? fileHandle?.close()
    }
}

#endif
