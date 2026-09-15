# AGENTS.md — 燧瞳智感 · AI热感火警风险检测系统

这是「AI热感火警风险检测系统」科创项目仓库。请先阅读 `COLLAB_HANDOFF.md` 获取完整背景与历史决策，本文件是给新 Codex 会话的快速上手说明。

## 一句话
基于热成像 + 计算机视觉的早期火灾预警演示原型（桌面网站 + 手机 PWA + macOS 原生 App + 3D 数字孪生 + AR 实景疏散）。

## 关键约束（必须遵守）
- 所有用户可见 UI 文字用**简体中文**。
- **已移除登录/账号功能**，不要再加回来（用户明确要求）。
- 始终保留「本系统为科研演示原型，不替代专业消防检测设备」免责声明。
- 视觉风格：深空蓝 `#0f172a` + 科技蓝 `#3b82f6`，警示色橙红渐变；科技感（网格、微光、卡片阴影）。
- 代码改动后必须 `pnpm build` 通过，再提交。

## 核心代码位置
- 手机 App（核心，正在重点迭代）：`src/mobile/MobileApp.jsx` + `src/mobile/mobile.css`
- 手机 3D 组件：`src/mobile/Building3DView.jsx`、`Campus3DView.jsx`、`CampusBuildingPanel.jsx`
- 桌面网站：`src/App.jsx` + `src/styles.css`
- 用户端（逃生指引）：`src/user/UserApp.jsx` + `src/user/user.css`（入口 `user-app.html`）
- macOS 原生 App（SwiftUI）：`macos/AIThermalFireGuard/`
- AI 检测网关：`gateway/`（`ai-gateway.mjs`、`detector.py`、`start.sh`）
- CAD/校园模型脚本：`cad/`
- 教学视频（Remotion）：`thermal-video/`

## 常用命令
```bash
pnpm install
pnpm dev          # 本地开发
pnpm build        # 生产构建（提交前必跑）
pnpm preview      # 预览构建产物
```

> 若本机 `node`/`pnpm` 不在 PATH，先 `export PATH="/Users/<你>/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`。

## 发布方式（已配置）
GitHub Pages 自动部署：`git push origin main` 后会自动跑 `Deploy to GitHub Pages` 工作流。
- 网站：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/
- 手机版：.../mobile-app.html
- 手机安装中心：.../mobile-install.html
- Mac 安装包：https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system/releases/latest

## 手机 App 页面结构（底部 6 个 tab）
首页检测 / 现场监控 / 预警记录 / 数据看板 / 疏散导航 / 关于项目
另有：数字消防演练、AR 实景导航、本机摄像头、手机 GPS 实时定位（GpsPanel）、AI 火警网警指挥中心、科大校园 3D、指南针疏散等。
