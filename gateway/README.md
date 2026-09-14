# 笔记本 AI 网关

把 Mac 或 Windows 笔记本作为手机 App 的 AI 火警检测网关。

## 模拟模式

在项目根目录执行：

```bash
pnpm build
node gateway/ai-gateway.mjs --mode simulator --port 8787
```

浏览器打开：

- 本机：`http://127.0.0.1:8787/mobile-app.html`
- 手机：`http://<笔记本局域网IP>:8787/mobile-app.html`

在 App 的现场监控中填写：

```text
ws://<笔记本局域网IP>:8787/ws/detections
```

## 接入真实摄像机

安装可选依赖：

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install ultralytics opencv-python
```

运行：

```bash
node gateway/ai-gateway.mjs \
  --mode detector \
  --source 'rtsp://用户名:密码@摄像机IP:554/Streaming/Channels/101' \
  --model '/path/to/fire-smoke.pt' \
  --camera-id 'cam-03' \
  --port 8787
```

如果模型没有火焰或烟雾类别，YOLO只能识别它训练过的类别。没有模型时，网关会使用红色高亮/高温区域启发式检测，仅用于演示。

## 手机 HTTPS 与 WSS

GitHub Pages 的 App 使用 HTTPS 时不能连接 `ws://`。两种方案：

1. 演示时直接打开本地 HTTP App：`http://<笔记本IP>:8787/mobile-app.html`，使用 `ws://`。
2. 使用 Tailscale、Cloudflare Tunnel 或 Nginx/caddy 为网关提供 HTTPS，然后在正式 App 中使用 `wss://`。

## AI网关输出

WebSocket 地址：`/ws/detections`

```json
{
  "camera_id": "cam-03",
  "risk": "high",
  "max_temp": 86.4,
  "detections": [
    {"class": "smoke", "confidence": 0.92, "bbox": [0.31, 0.22, 0.15, 0.18]}
  ],
  "hotspots": [
    {"x": 0.34, "y": 0.26, "width": 0.18, "height": 0.21, "temp": 86.4}
  ]
}
```
