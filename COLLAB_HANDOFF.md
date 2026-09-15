# 协作交接文档 · AI热感火警风险检测系统（燧瞳智感）

> 本文档用于把「对话历史 + 项目当前状态」完整打包给队友，方便队友在另一个 Codex 会话里快速接手继续开发。
> 最新仓库：https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system

---

## 1. 项目是什么
面向**学生科创竞赛答辩**的「AI热感火警风险检测系统」演示原型：用热成像温度数据 + 计算机视觉（YOLO 目标检测）实现早期火灾风险预警，并把检测、监控、疏散、演练、数据看板、3D 数字孪生、AR 实景导航整合到一个产品里。

品牌名：**燧瞳智感**（AI火警网警）。

**核心创新点（答辩主打）**
- AI 当「火灾监测的网警」：风险预测、出口分流、语音疏散、处置单、证据链。
- 热成像 + CV 多维度判断，区分正常热源与火灾隐患，降低误报。
- 适配老旧楼宇/仓库/配电房，无需大规模布线，轻量化模型可边缘部署。
- 火情出现前（明火/烟雾前）识别温度异常，实现「灾前预警」。

---

## 2. 线上链接（当前全部有效，HTTP 200）
- 主网站：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/
- 手机 App（PWA）：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/mobile-app.html
- 手机安装中心：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/mobile-install.html
- iPhone 描述文件：https://roubizhao6-sys.github.io/ai-thermal-fire-risk-system/thermal-guard.mobileconfig
- 校园模型：.../models/must-campus.step 和 must-campus.stl
- Mac 原生 App 下载：https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system/releases/latest
  - 当前最新：`AIThermalFireGuard-macOS-1.0.5.dmg`（无登录版）

---

## 3. 已实现功能清单

### 3.1 桌面网站（`src/App.jsx`）
顶部导航、英雄区、核心功能三点介绍、在线检测（上传热成像图 → 模拟加载 → 风险等级/高温区/最高温/红橙标注框/处置建议）、数据统计看板、项目说明、页脚。

### 3.2 双端拆分（用户端 / 系统端）
- **两端联动（同机）**：用户端「隐患上报（含照片）」写 `thermalGuardHazards`、「被困者问答」写 `thermalGuardUserStatus`，系统端数据看板新增「用户端联动」面板实时读取展示（同源共享 localStorage，storage 事件 + 3s 轮询）。跨设备同步需后端中转。
- **完全独立的两端 App**：用户端 `user/`（`user/index.html` + `user/manifest.webmanifest` + `user/sw.js`，作用域 `/user/`）、系统端 `system/`（同样独立清单与 SW，作用域 `/system/`）。两端各自独立目录、独立 Service Worker 作用域、独立图标与启动页，互不影响。根目录 `user-app.html`/`mobile-app.html` 保留兼容旧链接。
- **系统端 / 物业端**：`mobile-app.html` + `src/mobile/MobileApp.jsx`（完整管理：监控、看板、指挥中心、巡检、隐患、证据链等）。
- **用户端 / 热感哨兵**：`user-app.html` + `src/user/UserApp.jsx`（三个 tab：AR实景逃生 / 首页检测 / 更多功能）。AR tab 含队友 `ArNavigator`（全屏 AR + 表盘兜底 + 切摄像头 + 手电筒）+ **被困者自救问答**（`binaryDialogue.js` 是/否问答，生成指引并写 `thermalGuardUserStatus` 供系统端读取）。更多功能的 GPS 已升级为 `useGeoLocation` + `geo.js`（校园坐标 + 最近安全出口）；并新增「本次升级亮点」总览卡与「我的楼层平面图」（本机保存 + AI 识别疏散通道/出口，复用系统端 `thermalGuardLlm` 配置）。AR tab 排版已向队友版「单屏大表盘」靠拢（大表盘 + 距离读数 + 方向/方位读数 + AR/119/警报工具条）。
- **深度结合队友用户端**：已把队友的 `sensors.js` + `building.js`（8 层楼拓扑）+ `sensorFusion.fuseReadings` 并入，表盘新增「剩余楼层 / 当前位置」并在位置面板里可选楼层(1-8)与位置(A楼梯/走廊/B楼梯)。队友其余源码（`EscapeApp.jsx / MoreSheet.jsx / aiClient.js / aiPhases.js / vitalSigns.js / aiHooks.js / floorplan.js / evacuation.js / thermal.js`）已入库备用。AR 实景逃生合并了队友的 `ArNavigator`（全屏 AR + 表盘兜底 + 前后摄像头切换 + 手电筒 + 接近度），入口在 AR tab「开启 AR 实景导航」；首页检测含三路证据融合判定；更多功能含 GPS定位、消防设施扫码巡检、隐患上报。两端通过「切换到用户端 / 切换到系统端」互跳。
- 桌面网站：`index.html` + `src/App.jsx`。

### 3.2 手机 App（`src/mobile/MobileApp.jsx`，重点迭代对象）
底部 6 个 tab：
1. **首页检测**：拍摄/上传热成像图、AI 检测、三级风险卡片、高温区标注。
2. **现场监控**：监控列表、HLS/MJPEG/演示流、3D 热感板、3D 大楼、科大校园、**本机实景摄像头**、AI 网关面板、动态疏散图。
3. **预警记录**：风险/时间筛选、详情、事后证据链、导出证据链报告、数字消防演练记录。
4. **数据看板**：累计检测/预警/中高风险占比/平均响应时间、趋势图、隐患分布图、AI 火警网警指挥中心入口。
5. **疏散导航**：指南针逃生路线（磁力计 + 动态路线 + 语音引导 + 119 拨打 + 震动）与 **AR 实景导航**。
6. **关于项目**：技术原理、项目优势、免责声明、**数字消防演练**入口。

附加能力：
- **数字消防演练**：准备 → 3 秒倒计时 → 计时撤离 + 疏散动作清单（可勾选）+ 暂停/继续/取消 → 自动评分（优秀/良好/合格/需改进）+ AI 点评 + 证据记录。
- **AR 实景逃生导航**：调用手机后置摄像头，画面叠加指南针方位 + 逃生方向箭头 + 距离/用时/出口方位。
- **本机实景摄像头**：现场监控页直接显示手机摄像头实时画面。
- **AI 检测网关**：`gateway/` 提供 `/ws/detections` WebSocket，支持模拟 + 可选 YOLO/OpenCV 检测。
- **科大校园 3D**：澳门科技大学校园模型（`public/models/must-campus.stl/.step`）+ 官方地图/OSM 建筑 + 720 云全景。
- **指南针疏散**：磁力计航向 + 最近安全出口动态排序。
- **手机 GPS 定位**：`GpsPanel` 读取手机真实 GPS 坐标，展示经纬度/精度/海拔，计算到最近校园安全点的距离与方位，并在迷你地图上标出当前位置。

### 3.3 macOS 原生 App（`macos/AIThermalFireGuard/`）
SwiftUI 原生 App，支持模拟热像仪、ESP32 USB 串口、Wi-Fi WebSocket、32×24 热成像矩阵、风险分级、SceneKit 3D 热源重建、指南针疏散。构建：`cd macos/AIThermalFireGuard && ./script/build_and_run.sh`。

附加能力（近期新增）：
- **自动处置联动**：声光报警、应急广播、非消防电源断电、电梯迫降、消防泵启动（WebAudio 警报音 + 一键全部启动）。
- **疏散人员清点**：撤离后逐一点名，统计已确认/未确认人员。
- **热力历史回放**：拖动时间轴回放「常温 → 升温 → 触发预警」。
- **校园全域态势图**：各楼栋实时风险热力 + 告警点。
- **一键导出 PDF 报告**：`openPdfReport()` 打开打印友好页面。
- **告警通知**：Notification API 推送（Chrome/Android）。
- **消防设施扫码巡检**：摄像头取景器 + jsQR 实时识别二维码，自动匹配设施编号并登记检查（iOS Safari 也可用）。
- **AI 消防知识助手**（本地知识库）、**隐患随手拍上报**（存 localStorage）。
- **AI 火警精灵**：悬浮按钮常驻右下角，可本地知识库问答，也可在设置里填入 OpenAI 兼容 API（endpoint/key/model，存 localStorage）接入联网大模型，任意问题联网回答。
- **后端 LLM 代理**：`gateway/llm-proxy/`（Cloudflare Worker），Key 放服务端，前端填「代理地址」即可使用，无需用户提供 Key。
- **三路证据融合判定（合并自队友）**：`src/mobile/sensorFusion.js` + `PreventionPanel.jsx`（系统端）+ 用户端 `src/user/UserApp.jsx` 内嵌 FusionPanel（复用同一 `fusePreventionSignals`）。视觉火焰 + 烟雾 + 热像三路联合，单路不报警、两路或完整热像证据链才确认，输出判据得分与判定结果（正常/关注/火警），可一键触发全屏报警。入口：数据看板。
- **人流监看（CrowdPanel + crowd.js）**：火警时按优先级疏散每层人数，实时显示已撤离/剩余、撤离曲线、楼梯负载与拥堵提示。入口：系统端数据看板。
- **城市热力地图（CityMap + leaflet）**：澳门/香港多点火警热力分布 + 现场设备实时点位。入口：系统端数据看板。
- **队友 3D 校园（Campus3D）**：`src/mobile/Campus3D.jsx` + `campus.js` + `public/models/must-campus.glb` + `textures/`。three.js 微缩校园，拖动旋转/滚轮缩放/点击楼体进入楼层视角、逐层切换、楼层展开、火源楼层变红定位。入口：系统端「现场监控」→「科大校园」。
- **火警报警中心（合并自队友 zhenghaotiansky666-dot）**：`src/mobile/alarm.js` + `AlarmOverlay.jsx` + `AlarmCenterView.jsx`。全屏警报（警笛+语音+震动+升级）、布防/手动触发/火警演练（指定楼层与起火点）、报警设置（阈值/未确认升级）、报警记录与处理、报警链路说明。入口：顶部铃铛「报警中心」。
- **首页快捷功能网格**：8 个快捷入口（应急指挥/疏散导航/数字演练/GPS/数据看板/扫码巡检/AI精灵/隐患上报）一键直达。
- **离线 PWA 缓存**：`public/sw.js`（v17）预缓存应用外壳 + 离线导航回退。

### 3.4 教学视频（`thermal-video/`）
Remotion 生成的「硬件安装与手机 App 联动 3D 教学视频」，成品在 `output/`。

---

## 4. 目录结构
```
├── src/                 # 前端源码
│   ├── App.jsx / styles.css          # 桌面网站
│   └── mobile/                        # 手机 App（核心）
│       ├── MobileApp.jsx / mobile.css
│       ├── Building3DView.jsx / Campus3DView.jsx / CampusBuildingPanel.jsx
├── macos/AIThermalFireGuard/          # macOS 原生 App
├── gateway/                           # AI 检测网关（mjs + python + start.sh）
├── cad/                               # 校园 CAD 建模脚本
├── thermal-video/                     # Remotion 教学视频
├── output/                            # 视频/文档成品
├── public/                            # 静态资源、模型、manifest、mobileconfig
├── index.html / mobile-app.html       # Vite 入口
└── package.json / pnpm-lock.yaml
```

---

## 5. 构建与部署
```bash
pnpm install
pnpm build      # 提交前必跑
pnpm preview
```
部署：`git push origin main` → GitHub Actions 自动构建并发布到 GitHub Pages。

> node/pnpm 不在 PATH 时：
> `export PATH="$HOME/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH"`

---

## 6. 最近改动（git log 摘要）
- `7f95e53` fix: 修复 AR 摄像头视频流未挂载（黑屏）→ 视频元素挂载后再赋 srcObject
- `db8be97` feat: 现场监控新增「本机实景摄像头」
- `8939b9c` feat: 演练 + 疏散导航接入 AR 实景逃生导航
- `ad0a38b` feat: 重做数字消防演练（评分/清单/暂停/证据链）
- `a13cdff` revert: **移除登录功能**（用户明确不要）
- `cf22651` feat: 笔记本 AI 网关 + 实时检测叠加
- 更早：AI 指挥中心、动态疏散、指南针页、科大校园 3D、720 全景、教学视频、采购清单文档等。

---

## 7. 关键实现要点 / 易错点
1. **AR 摄像头视频流**：`<video>` 只在 active 状态渲染，因此必须在 `useEffect([status])` 中给 `videoRef.current.srcObject` 赋值，不能在 getUserMedia 回调里直接赋（视频元素还没挂载，会黑屏）。—— 这是最近踩过的坑。
2. **登录已移除**：`src/mobile/AuthGate.jsx` 已删除，不要再引用；任何「账号/登录」功能都不要加回。
3. **演练评分逻辑**（`DrillMode`）：`timeScore = max(0, 100 - elapsed*1.8)`，`score = round(min(100, timeScore*0.65 + 风险加分 + 动作完成*5))`。
4. **免责声明**必须保留，避免被误认为专业消防设备。
5. 手机相机需 HTTPS + Safari/Chrome + 用户授权；首次弹权限必须点「允许」。

---

## 8. 硬件采购与联动（队友若做实物实验）
项目里已有完整文档（`output/` 下多个 .docx），核心结论：
- **热成像模块比单纯红外传感器更必要**：本项目主打热成像测温定位，推荐 **MLX90640（32×24）/ AMG8833（8×8）**。
- 主控：**ESP32**（USB 串口或 Wi-Fi WebSocket 接 Mac App / 网关）。
- 网关：普通笔记本即可，跑 `gateway/ai-gateway.mjs` + `detector.py`（可选 YOLO）。
- 密集楼道推荐：热成像点式测温 + 多路监控 + 网关集中研判 + 手机端疏散导航。
- App 联动数据格式：`width / height / max_temp / temperatures / hotspots`，或 HLS/MJPEG 监控流。

---

## 9. 可继续拓展方向
- AR 实景导航：语音转向播报、地面透视路线（真 AR）。
- 数字消防演练：难度分级、语音播报、多场景火情。
- 网关：真实 YOLO 火焰/烟雾检测接入、多路摄像头并发。
- 二维码下载页（答辩现场扫码装 App）。
- macOS App 打包签名/公证（Gatekeeper 更友好）。

---

## 10. 队友接手步骤
1. `git clone https://github.com/roubizhao6-sys/ai-thermal-fire-risk-system.git`
2. `pnpm install && pnpm dev`
3. 让 Codex 读 `AGENTS.md` + `COLLAB_HANDOFF.md` 即可获得全部背景。
4. 改动 → `pnpm build` → commit → push main → 自动发布。
