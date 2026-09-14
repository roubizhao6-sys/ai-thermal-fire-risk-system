# AI热感火警风险检测系统

基于热成像与计算机视觉的早期火灾预警科研演示原型。

## 在线访问

网站通过 GitHub Pages 自动发布：

https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/

## 功能

- 热成像图片上传、拖拽与本地预览
- 模拟 AI 检测加载与进度反馈
- 低、中、高风险三级预警
- 高温疑似区域框选与温度估算
- 检测数据统计、趋势图与风险分布
- 桌面端与移动端响应式适配

## macOS 原生 App

安装包下载：[最新 GitHub Release](https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system/releases/latest)

- `AIThermalFireGuard-macOS-1.0.4.dmg`：推荐分享给其他 Mac 用户
- `AIThermalFireGuard-macOS-1.0.4.zip`：ZIP 版本
- 支持 Intel 与 Apple Silicon
- DMG 内包含 ESP32 示例固件和安装说明


原生 SwiftUI 应用位于 `macos/AIThermalFireGuard`，支持：

- 内置模拟热像仪
- ESP32 USB 串口接入
- Wi-Fi WebSocket 接入
- 32×24 热成像矩阵与风险分级
- SceneKit 3D 热源重建与实时监控
- 指南针方向提示与推荐疏散路线
- 本机账号密码登录与退出
- 实验设备采购、接线与固件示例

运行：

```bash
cd macos/AIThermalFireGuard
./script/build_and_run.sh
```

## 本地运行

```bash
pnpm install
pnpm dev
```

生产构建：

```bash
pnpm build
```

> 本系统为科研演示原型，不替代专业消防检测设备。
