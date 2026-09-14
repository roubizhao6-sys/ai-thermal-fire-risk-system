#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$ROOT_DIR/public/voice" "$ROOT_DIR/public/audio"

generate() {
  local index="$1"
  local text="$2"
  say -v Tingting -r 175 -o "$ROOT_DIR/public/voice/scene${index}.aiff" "$text"
  afconvert -f WAVE -d LEI16 "$ROOT_DIR/public/voice/scene${index}.aiff" "$ROOT_DIR/public/audio/scene${index}.wav"
}

generate 1 '欢迎使用 AI 热感火警风险检测系统。本视频演示如何组装硬件，并把热成像监控接入手机 App。'
generate 2 '竞赛演示只买这几样：ESP32-S3、MLX90640、SHT31、蜂鸣器、面包板、杜邦线和充电宝。需要真实监控时，再加一台支持 RTSP 的网络摄像机。'
generate 3 '组装时，将 MLX90640 的 VIN 接到 ESP32-S3 的 3V3，GND 接到 GND，SDA 接到 GPIO 八，SCL 接到 GPIO 九。检查接线后再通电。'
generate 4 '用 USB-C 数据线连接电脑，烧录示例固件。ESP32 只支持二点四 G Wi-Fi。烧录后打开串口监视器，确认设备输出温度矩阵。'
generate 5 '在手机 App 中打开现场监控，添加监控。热成像板使用 WSS 安全网关或模拟热感板；网络摄像机使用 HLS 或 MJPEG 地址。'
generate 6 '进入三维大楼模型，可以查看楼层、传感器、高温热区、摄像头锥和动态疏散路线。点击开始指南针，允许方向权限，手机就会提示转向。'
generate 7 '在关于项目中进入数字消防演练，完成撤离后会自动生成证据链。系统用于科研和竞赛演示，不替代专业消防设备。'
