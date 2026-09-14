# AI热感火警风险检测系统 3D 教学视频

这是使用 Remotion、React Three Fiber 和 Three.js 制作的硬件组装与手机 App 联动教学视频。

## 视频内容

1. 学生竞赛演示采购清单
2. ESP32-S3 与 MLX90640 接线
3. 固件烧录与 2.4GHz Wi-Fi
4. WebSocket 与手机 App 联动
5. 三维大楼实时监控
6. 指南针、动态疏散与证据链

## 重新生成

```bash
pnpm install --ignore-workspace
pnpm run voice
pnpm run render
```

视频输出到 `out/thermal-tutorial.mp4`，分辨率 1920×1080，约 115 秒。

## 硬件安装与手机联动版

```bash
pnpm run render:hardware
```

输出文件：`out/hardware-linkage-tutorial.mp4`。视频使用 Espressif、Adafruit 与 Wikimedia Commons 的公开设备照片，仅用于教学演示。
