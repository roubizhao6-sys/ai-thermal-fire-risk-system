# App Store 构建配置

该目录包含 Mac App Store 专用配置：

- `Info.plist`：由 XcodeGen 生成。
- `AIThermalFireGuard.entitlements`：启用 App Sandbox 和外发网络。
- `Resources/PrivacyInfo.xcprivacy`：隐私清单。
- `Resources/Assets.xcassets`：macOS App 图标。

商店版通过 `APP_STORE` 编译条件仅保留模拟器和 Wi-Fi WebSocket 接入。直接读取 `/dev/cu.*` 的串口功能保留在开源本地构建中，不建议用于 App Store 版本。

生成 Xcode 工程：

```bash
../.tools/xcodegen/bin/xcodegen generate
```

归档：

```bash
xcodebuild -project AIThermalFireGuard.xcodeproj \
  -scheme AIThermalFireGuard \
  -configuration Release \
  -destination 'generic/platform=macOS' \
  -archivePath build/AIThermalFireGuard.xcarchive archive
```
