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

## 移动端火警报警与逃生指引

移动端 GPS 之外的另一条主线：**检测到高风险 → 全屏报警 → 动态逃生路线**。

### 报警中心

- 图片检测判定为高风险时自动触发全屏警报；中风险只出提示，不打断现场
- 全屏高对比警报：闪屏、图标脉冲、已持续计时；静音/勿扰下仍有画面提示
- Web Audio 双音慢速扫频警笛 + 中文语音循环播报 + 震动（iOS Safari 不支持震动）
- 已知晓静音 / 重新鸣响 / 解除警报；风险未回落时不重新布防，避免反复自动报警
- 未确认升级：默认 30 秒后提高音量并加快播报，可配置或关闭
- 火警演练：指定楼层与起火点，全程标注「演练」
- 可调阈值（高温 / 中风险）与报警记录留痕，均持久化在本机

### 逃生指引

- 楼宇拓扑：8 层示意楼宇，A/B 双楼梯贯通，1 楼大堂正门 + 8 楼天台两个出口
- 危险扩散模型：以火源为中心的图跳数扩散，烟气上行快于下行，半径随起火时间增长
- A\* 动态避障：浓烟重罚、烟气边缘轻罚、起火点不可通行，路线每秒重算
- SVG 平面图：路线虚线 + 方向箭头 + 火源脉冲 + 危险区着色 + 当前位置 + 受阻标记
- 分步文字指引（含距离与预计时间）、大字跟随模式、8 层剖面
- 封锁 A 梯 / B 梯 / 正门 / 天台后自动改道；优先向下撤离，天台仅作向下通道中断时的备选

## 测试

路线规划与热像仪数据源的纯逻辑测试（无需浏览器）：

```bash
pnpm test
```

## macOS 原生 App

安装包下载：[最新 GitHub Release](https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system/releases/latest)

- `AIThermalFireGuard-macOS-1.0.1.dmg`：推荐分享给其他 Mac 用户
- `AIThermalFireGuard-macOS-1.0.1.zip`：ZIP 版本
- 支持 Intel 与 Apple Silicon
- DMG 内包含 ESP32 示例固件和安装说明


原生 SwiftUI 应用位于 `macos/AIThermalFireGuard`，支持：

- 内置模拟热像仪
- ESP32 USB 串口接入
- Wi-Fi WebSocket 接入
- 32×24 热成像矩阵与风险分级
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
