# App Store Connect 元数据

> 标记为“待填写”的内容必须使用 Apple Developer 账号中的真实信息，不能使用昵称或虚假主体。

## App 信息

- App 名称：AI热感火警风险检测
- 副标题：热成像早期火情风险科研演示
- Bundle ID：com.thermalguard.AIThermalFireGuard
- SKU：AIThermalFireGuard-2026
- 主要语言：简体中文
- 类别：工具
- 年龄分级：4+
- 版权：待填写（应与 Apple Developer 账号主体一致）
- 价格：免费
- 支持网址：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/support.html
- 隐私政策网址：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/privacy.html

## 关键词

```text
热成像,火警,AI,消防,温度检测,YOLO,风险预警,科研
```

## 宣传文本

原生 macOS 热成像风险检测演示工具，支持模拟数据和 ESP32 Wi-Fi WebSocket 数据流，可展示温度矩阵、最高温度、高温区域定位与三级风险评估。

## 完整描述

AI热感火警风险检测系统是一款面向科研演示和项目答辩的原生 macOS 工具。

主要功能：

- 内置模拟热像仪，无需硬件即可运行
- 接收 ESP32-S3 发送的 WebSocket 热成像数据
- 显示 32×24 温度矩阵和热成像色阶
- 估算最高温度、最低温度和平均温度
- 标注疑似高温区域
- 输出低风险、中风险和高风险三级结果
- 展示最高温度变化趋势和预警记录
- 提供实验设备、接线方式和数据协议说明

说明：

本应用为科研演示原型，不替代专业消防检测设备，不能作为火灾报警、消防验收或生命安全的唯一依据。

## 审核备注

- App 启动后默认使用内置模拟器，无需账号或硬件即可测试全部主要界面。
- App 不收集用户数据，不包含广告与追踪 SDK。
- 商店版支持本地网络 WebSocket，用于接收同一局域网内 ESP32 设备发送的科研实验数据。
- App Store 版本不提供直接访问系统串口的能力。
- 本应用不宣称替代专业消防设备。
- 当前版本无内购、无登录、无订阅。

## 建议截图

1. 运行总览与热成像矩阵
2. 实时热成像与高温区域
3. 硬件连接和数据协议
4. 实验设备采购指南
5. 风险预警记录
