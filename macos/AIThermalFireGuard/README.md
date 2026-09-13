# AI热感火警风险检测系统 macOS App

原生 SwiftUI macOS 应用，支持内置模拟器、ESP32 USB 串口和 Wi-Fi WebSocket 三种数据接入方式。

## 运行

```bash
./script/build_and_run.sh
```

或者：

```bash
./script/build_and_run.sh --verify
./script/build_and_run.sh --logs
```

应用包输出到 `dist/AIThermalFireGuard.app`。

## 硬件数据协议

每帧发送一条 JSON：

```json
{
  "width": 32,
  "height": 24,
  "min_temp": 28.2,
  "max_temp": 86.4,
  "average_temp": 36.8,
  "risk": "high",
  "temperatures": [28.2, 29.1, 30.0],
  "hotspots": [
    {
      "x": 0.31,
      "y": 0.24,
      "width": 0.18,
      "height": 0.22,
      "temp": 86.4,
      "confidence": 0.968
    }
  ]
}
```

- 串口：115200 波特率，每行一条 JSON。
- Wi-Fi：默认地址 `ws://<ESP32-IP>:81/`，示例固件为 `firmware/esp32_mlx90640/esp32_mlx90640.ino`。

## 推荐采购方案

### 第一版最低成本方案（约 ¥300–600）

| 设备 | 推荐型号 | 用途 |
| --- | --- | --- |
| 主控 | ESP32-S3-DevKitC-1 | 采集热成像矩阵并通过 USB/Wi-Fi 发送数据 |
| 热成像 | MLX90640 32×24 | 输出 768 点温度矩阵 |
| 环境传感器 | SHT31 或 DHT22 | 温湿度辅助判断 |
| 报警 | 有源蜂鸣器 + RGB LED | 本地声光报警 |
| 连接 | 面包板、杜邦线、USB 数据线 | 搭建电路 |

### 高分辨率升级方案（约 ¥2500–6000）

| 设备 | 推荐型号 | 用途 |
| --- | --- | --- |
| 热成像 | FLIR Lepton 3.5 + PureThermal 2 | 160×120 辐射热成像 |
| 边缘计算 | Raspberry Pi 5 8GB | 运行 YOLO 与数据服务 |
| 或边缘计算 | Jetson Orin Nano Super | 更高性能视觉推理 |
| USB 热像仪 | InfiRay P2 Pro / Topdon TC001 | 快速验证热成像接入 |

## 安全说明

请勿使用明火、汽油或危险高温源直接实验。建议使用低压加热片、热水杯或电烙铁余温完成温度验证。本系统为科研演示原型，不替代专业消防检测设备。
