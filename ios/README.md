# 热感哨兵 · iOS

两个 App，一套核心逻辑：

| Target | 定位 | 主界面 |
| --- | --- | --- |
| `ThermalGuardUser` | **用户端**：火灾逃生路线指引 | 指南针式单屏表盘 |
| `ThermalGuardSystem` | **系统检测端**：消防监控 | 城市热力地图 / 检测 / 预警 / 逃生 |

## 结构

```
ios/ThermalGuard/
  project.yml                 XcodeGen 工程描述（改结构就改它）
  ThermalGuard.xcodeproj      生成产物，已入库方便直接打开
  Sources/Core/               两个 App 共享
    Building.swift            楼宇拓扑（8 层 / A、B 梯 / 正门 / 天台）
    Evacuation.swift          危险扩散 + A* 动态避障 + 逃生指令
    ThermalFrame.swift        热像帧、热区检测、风险分级、城市点位
    Theme.swift               主题色（与网页端同一套 token）
  Sources/User/               用户端：表盘、朝向、位置、状态
  Sources/System/             系统端：地图、检测、预警、报警
  Info/                       生成的两份 Info.plist
```

核心算法与 Web 端 `src/mobile/building.js`、`evacuation.js`、`thermal.js` 同构，
三端（网页 / iOS / macOS）算出的路线与风险等级应当一致。

## 构建与运行

```bash
cd ios/ThermalGuard

# 需要 XcodeGen 时（改过 project.yml 才需要）
xcodegen generate

# 命令行构建
xcodebuild -project ThermalGuard.xcodeproj -scheme ThermalGuardUser \
  -sdk iphonesimulator -destination 'platform=iOS Simulator,name=iPhone 17 Pro' build

# 装到模拟器并运行
xcrun simctl boot 'iPhone 17 Pro'
xcrun simctl install booted <DerivedData>/Build/Products/Debug-iphonesimulator/ThermalGuardUser.app
xcrun simctl launch booted com.thermalguard.user
```

## 演示与截图用启动参数

| 参数 | 作用 |
| --- | --- |
| `-demoFire` | 启动即进入火警 / 演练状态 |
| `-demoFloor 6` | 用户端指定所在楼层 |
| `-startTab map\|detect\|alerts\|escape` | 系统端指定初始标签 |

例如：

```bash
xcrun simctl launch booted com.thermalguard.user -demoFire -demoFloor 6
xcrun simctl launch booted com.thermalguard.system -startTab map -demoFire
```

## 已知前置条件

- 部署目标 iOS 17.0，Swift 5 语言模式
- 用户端的真机罗盘需要定位权限（`NSLocationWhenInUseUsageDescription` 已配置）；
  拿不到权限时自动保持固定指北
- 两个 App 之间目前各自独立，真实部署时由后端经 APNs 下发报警；
  同一台设备上跨 App 共享火情状态需要配置 App Group
