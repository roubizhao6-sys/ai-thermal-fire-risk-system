// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "AIThermalFireGuard",
    platforms: [.macOS(.v14)],
    products: [
        .executable(name: "AIThermalFireGuard", targets: ["AIThermalFireGuard"])
    ],
    targets: [
        .executableTarget(
            name: "AIThermalFireGuard",
            path: "Sources/AIThermalFireGuard"
        )
    ]
)
