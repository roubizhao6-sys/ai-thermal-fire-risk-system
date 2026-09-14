// @ts-nocheck
import { Audio } from "@remotion/media";
import {
  AbsoluteFill,
  Composition,
  Easing,
  Img,
  interpolate,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

type Props = {};

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const FPS = 24;
const DURATIONS = [10, 21, 21, 24, 20, 19];
const C = {
  bg: "#050d19",
  panel: "#0a1729",
  line: "rgba(96,165,250,.2)",
  blue: "#3b82f6",
  cyan: "#38bdf8",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  yellow: "#facc15",
  text: "#f4f8ff",
  muted: "#8da5c0",
};

export const HardwareLinkageComposition = () => {
  const duration = DURATIONS.reduce((sum, value) => sum + value * FPS, 0);
  return (
    <Composition
      id="HardwareLinkageTutorial"
      component={HardwareLinkageTutorial}
      durationInFrames={duration}
      fps={FPS}
      width={1920}
      height={1080}
    />
  );
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 12, duration - 14, duration], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

const Shell: React.FC<{
  index: string;
  title: string;
  subtitle: string;
  duration: number;
  color?: string;
  children: React.ReactNode;
}> = ({ index, title, subtitle, duration, color = C.cyan, children }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: FPS, config: { damping: 18, stiffness: 105 } });
  return (
    <AbsoluteFill style={{ background: C.bg, color: C.text, fontFamily: FONT, opacity: fade(frame, duration) }}>
      <AbsoluteFill style={styles.grid} />
      <div style={{ ...styles.header, opacity: enter, translate: interpolate(enter, [0, 1], [0, 24]) }}>
        <span style={{ ...styles.index, color, borderColor: `${color}66`, background: `${color}18` }}>{index}</span>
        <div><h1 style={{ ...styles.title, color }}>{title}</h1><p style={styles.subtitle}>{subtitle}</p></div>
      </div>
      {children}
      <div style={styles.brand}>热感哨兵 · 硬件组装与手机 App 联动教学</div>
    </AbsoluteFill>
  );
};

const Photo: React.FC<{ src: string; style?: React.CSSProperties; fit?: "contain" | "cover" }> = ({ src, style, fit = "contain" }) => (
  <div style={{ ...styles.photoFrame, ...style }}>
    <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: fit, objectPosition: "center" }} />
  </div>
);

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const rise = spring({ frame, fps: FPS, config: { damping: 17, stiffness: 90 } });
  return (
    <Shell index="00" title="硬件安装与手机 App 联动" subtitle="从购买实物到监控接入的完整操作演示" duration={DURATIONS[0] * FPS}>
      <div style={{ ...styles.introWrap, opacity: rise, translate: interpolate(rise, [0, 1], [0, 36]) }}>
        <div style={styles.photoRow}>
          <Photo src="photos/esp32-s3.jpg" style={{ width: 330, height: 300, rotate: "-5deg", translate: "0 18px", zIndex: 3 }} />
          <Photo src="photos/mlx90640.jpg" style={{ width: 420, height: 340, zIndex: 3 }} />
          <Photo src="photos/ip-camera.jpg" style={{ width: 350, height: 300, rotate: "6deg", translate: "0 24px", zIndex: 3 }} />
        </div>
        <div style={styles.signalRow}>
          {["热成像节点", "网络监控", "手机 App"].map((item, index) => <div key={item} style={styles.signalChip}><i style={{ background: [C.cyan, C.orange, C.green][index] }} />{item}</div>)}
        </div>
        <p style={styles.introHint}>真实产品照片 + 接线动画 + 网络拓扑 + App 操作界面</p>
      </div>
    </Shell>
  );
};

const PurchaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const products = [
    ["ESP32-S3", "主控开发板", "photos/esp32-s3.jpg", "¥60–120", C.cyan],
    ["MLX90640", "32×24 热成像模块", "photos/mlx90640.jpg", "¥300–550", C.orange],
    ["SHT31", "温湿度传感器", "photos/sht31.jpg", "¥30–80", C.green],
    ["网络摄像机", "支持 RTSP", "photos/ip-camera.jpg", "¥200–500", C.red],
    ["PoE 交换机", "摄像机和供网", "photos/poe-switch.jpg", "¥150–600", C.yellow],
    ["NVR / 网关", "录像与协议转换", "photos/nvr.jpg", "¥700–1,500", C.blue],
  ] as const;
  return (
    <Shell index="01" title="先准备这些硬件" subtitle="竞赛演示只需要核心节点，监控部分按实际需要增加" duration={DURATIONS[1] * FPS}>
      <div style={styles.productGrid}>
        {products.map(([name, model, src, price, color], index) => {
          const p = spring({ frame: frame - index * 9, fps: FPS, config: { damping: 17, stiffness: 100 } });
          return (
            <div key={name} style={{ ...styles.productCard, opacity: p, translate: interpolate(p, [0, 1], [0, 40]), borderColor: `${color}66` }}>
              <Photo src={src} style={{ height: 205, marginBottom: 13 }} />
              <div style={styles.productText}>
                <span style={{ color }}>{name}</span>
                <strong>{model}</strong>
                <b>{price}</b>
              </div>
            </div>
          );
        })}
      </div>
      <div style={styles.purchaseFooter}>推荐顺序：热成像节点 → 手机 App 联动 → 网络摄像机 → NVR / 网关</div>
    </Shell>
  );
};

const WiringScene: React.FC = () => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [20, 110], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const wires = [
    ["VIN", "3V3", C.red, 24],
    ["GND", "GND", "#d1d5db", 76],
    ["SDA", "GPIO 8", C.cyan, 128],
    ["SCL", "GPIO 9", C.blue, 180],
  ] as const;
  return (
    <Shell index="02" title="第一步 组装和接线" subtitle="MLX90640 通过 I²C 连接 ESP32-S3，检查无误后再通电" duration={DURATIONS[2] * FPS}>
      <div style={styles.wiringScene}>
        <div style={styles.boardStage}>
          <Photo src="photos/esp32-s3.jpg" style={{ position: "absolute", left: 70, top: 110, width: 480, height: 360, rotate: "-2deg" }} />
          <Photo src="photos/mlx90640.jpg" style={{ position: "absolute", right: 70, top: 100, width: 430, height: 350, rotate: "2deg" }} />
          <svg style={styles.wireSvg} viewBox="0 0 1020 540">
            {wires.map(([, , color], index) => {
              const y1 = 210 + index * 28;
              const y2 = 205 + index * 30;
              return <path key={index} d={`M 400 ${y1} C 470 ${y1 - 30}, 550 ${y2 + 30}, 620 ${y2}`} fill="none" stroke={color} strokeWidth="7" strokeLinecap="round" strokeDasharray="700" strokeDashoffset={700 * (1 - progress)} />;
            })}
            {progress > 0.3 && wires.map(([, , color], index) => <circle key={index} cx={400 + 220 * ((frame * 0.018 + index * 0.2) % 1)} cy={210 + index * 29} r="7" fill={color} />)}
          </svg>
          <div style={styles.boardCaptionLeft}>ESP32-S3</div>
          <div style={styles.boardCaptionRight}>MLX90640</div>
        </div>
        <div style={styles.wireList}>
          <span style={styles.panelTag}>接线表</span>
          {wires.map(([from, to, color], index) => {
            const p = spring({ frame: frame - 30 - index * 8, fps: FPS, config: { damping: 16 } });
            return <div key={from} style={{ ...styles.wireRow, opacity: p, translate: interpolate(p, [0, 1], [25, 0]), borderColor: `${color}66` }}><i style={{ background: color }} /><strong>{from}</strong><span>→</span><b>{to}</b></div>;
          })}
          <div style={styles.safetyNote}>先断电接线，确认 3.3V、GND 和 I²C 地址后再通电。</div>
        </div>
      </div>
    </Shell>
  );
};

const MonitorScene: React.FC = () => {
  const frame = useCurrentFrame();
  const nodes = [
    ["网络摄像机", "photos/ip-camera.jpg", "RTSP", C.orange],
    ["PoE 交换机", "photos/poe-switch.jpg", "供电 + 网络", C.yellow],
    ["NVR", "photos/nvr.jpg", "录像与转发", C.blue],
    ["Raspberry Pi", "photos/raspberry-pi-5.jpg", "RTSP → HLS", C.green],
  ] as const;
  return (
    <Shell index="03" title="第二步 安装监控与网关" subtitle="摄像机先接入 PoE 交换机，再由 NVR 或 Raspberry Pi 转换给手机" duration={DURATIONS[3] * FPS}>
      <div style={styles.networkScene}>
        {nodes.map(([name, src, detail, color], index) => {
          const p = spring({ frame: frame - index * 15, fps: FPS, config: { damping: 18 } });
          return (
            <div key={name} style={{ ...styles.networkNode, opacity: p, borderColor: `${color}66`, translate: interpolate(p, [0, 1], [0, 35]) }}>
              <Photo src={src} style={{ height: 210 }} />
              <strong style={{ color }}>{name}</strong>
              <span>{detail}</span>
            </div>
          );
        })}
        <svg style={styles.networkLines} viewBox="0 0 1500 300" preserveAspectRatio="none">
          {[0, 1, 2].map((index) => {
            const x1 = 310 + index * 330;
            const x2 = 640 + index * 330;
            return <g key={index}><line x1={x1} y1="150" x2={x2} y2="150" stroke="#3b82f6" strokeOpacity=".35" strokeWidth="4" strokeDasharray="10 8" /><circle cx={x1 + (x2 - x1) * ((frame * 0.02 + index * 0.25) % 1)} cy="150" r="8" fill="#38bdf8" /></g>;
          })}
        </svg>
      </div>
      <div style={styles.monitorSteps}>
        <div><b>01</b><span>摄像机接 PoE 交换机</span></div>
        <div><b>02</b><span>获取 RTSP 地址</span></div>
        <div><b>03</b><span>NVR 或网关转 HLS</span></div>
        <div><b>04</b><span>手机添加监控地址</span></div>
      </div>
    </Shell>
  );
};

const PhoneLinkScene: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = (Math.sin(frame * 0.12) + 1) * 0.5;
  const items = ["添加设备", "连接 WSS", "添加监控", "开启指南针"];
  return (
    <Shell index="04" title="第三步 手机 App 联动" subtitle="设备数据和监控地址都从 App 的添加/连接入口完成" duration={DURATIONS[4] * FPS}>
      <div style={styles.phoneScene}>
        <div style={styles.sourcePanel}>
          <span style={styles.panelTag}>硬件与监控</span>
          <Photo src="photos/esp32-s3.jpg" style={{ height: 210, marginTop: 24 }} />
          <div style={styles.sourceLine}><i style={{ background: C.cyan }} />ESP32-S3 热成像节点</div>
          <div style={styles.sourceLine}><i style={{ background: C.orange }} />IP 摄像机 / NVR</div>
          <div style={styles.sourceLine}><i style={{ background: C.green }} />Raspberry Pi 网关</div>
        </div>
        <div style={styles.linkFlow}>
          <span>JSON 温度矩阵</span>
          <div style={styles.flowRail}><i style={{ left: `${(frame * 2.1) % 100}%` }} /></div>
          <strong>WSS / HLS</strong>
          <p>手机 HTTPS 页面不能直接播放 RTSP，需要安全网关或转码服务。</p>
        </div>
        <div style={styles.phoneMock}>
          <div style={styles.phoneSpeaker} />
          <div style={styles.phoneScreen}>
            <div style={styles.phoneStatus}><span>09:41</span><span>5G · 100%</span></div>
            <div style={styles.phoneLogo}>热感哨兵</div>
            <p style={styles.phoneSub}>AI火警网警</p>
            <div style={styles.phoneHero}><b>现场监控</b><small>3D大楼 · 实时热区 · 疏散导航</small></div>
            {items.map((item, index) => <div key={item} style={{ ...styles.appItem, borderColor: index === 1 ? `${C.cyan}88` : "#20364e" }}><i>{String(index + 1).padStart(2, "0")}</i><span>{item}</span><b>›</b></div>)}
          </div>
        </div>
      </div>
      <div style={styles.phoneTips}><span>wss:// 安全地址</span><span>HLS / MJPEG 监控地址</span><span>允许方向权限</span></div>
    </Shell>
  );
};

const ChecklistScene: React.FC = () => {
  const frame = useCurrentFrame();
  const checks = ["热成像节点输出 32×24 温度矩阵", "ESP32 与手机处于可访问网络", "摄像机地址已转换为 HLS 或 MJPEG", "App 中添加监控并成功预览", "指南针权限已开启", "证据链与演练记录正常生成"];
  return (
    <Shell index="05" title="最后检查清单" subtitle="按顺序核对，现场演示就不会中断" duration={DURATIONS[5] * FPS}>
      <div style={styles.checklistScene}>
        <div style={styles.checklist}>
          {checks.map((item, index) => {
            const p = spring({ frame: frame - index * 10, fps: FPS, config: { damping: 16 } });
            return <div key={item} style={{ ...styles.checkRow, opacity: p, translate: interpolate(p, [0, 1], [0, 22]) }}><i>✓</i><span>{item}</span></div>;
          })}
        </div>
        <div style={styles.qrPanel}>
          <span>手机 App 入口</span>
          <div style={styles.fakeQr}>{Array.from({ length: 100 }).map((_, index) => <i key={index} style={{ opacity: (index * 7 + 3) % 5 === 0 ? 0 : 1 }} />)}</div>
          <strong>打开手机版 App</strong>
          <p>扫描二维码或直接访问安装页</p>
          <code>mobile-app.html</code>
        </div>
      </div>
      <div style={styles.credit}>图片素材来源：Espressif、Adafruit、Wikimedia Commons 官方与公开产品页，仅用于教学演示。</div>
    </Shell>
  );
};

const HardwareLinkageTutorial: React.FC<Props> = () => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      <Series>
        <Series.Sequence durationInFrames={DURATIONS[0] * FPS}><IntroScene /><Audio src={staticFile("audio/scene1.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[1] * FPS}><PurchaseScene /><Audio src={staticFile("audio/scene2.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[2] * FPS}><WiringScene /><Audio src={staticFile("audio/scene3.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[3] * FPS}><MonitorScene /><Audio src={staticFile("audio/monitor.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[4] * FPS}><PhoneLinkScene /><Audio src={staticFile("audio/scene5.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[5] * FPS}><ChecklistScene /><Audio src={staticFile("audio/checklist.wav")} /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  grid: { backgroundImage: "linear-gradient(rgba(56,189,248,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.055) 1px, transparent 1px), radial-gradient(circle at 75% 8%, rgba(37,99,235,.22), transparent 32%), radial-gradient(circle at 15% 85%, rgba(249,115,22,.09), transparent 30%)", backgroundSize: "56px 56px,56px 56px,auto,auto" },
  header: { position: "absolute", left: 86, top: 62, display: "flex", alignItems: "center", gap: 22, zIndex: 20 },
  index: { width: 72, height: 72, display: "grid", placeItems: "center", border: "1px solid", borderRadius: 18, fontFamily: MONO, fontSize: 26, fontWeight: 900 },
  title: { margin: 0, fontSize: 55, lineHeight: 1.08, letterSpacing: -2 },
  subtitle: { margin: "12px 0 0", color: C.muted, fontSize: 25, lineHeight: 1.45 },
  brand: { position: "absolute", right: 68, bottom: 38, color: "#66819d", fontSize: 19, letterSpacing: 1.5 },
  photoFrame: { overflow: "hidden", border: "1px solid rgba(96,165,250,.25)", borderRadius: 22, background: "linear-gradient(145deg, #0b1729, #050b14)", boxShadow: "0 24px 55px rgba(0,0,0,.32)" },
  introWrap: { position: "absolute", left: 130, right: 130, top: 270, display: "flex", flexDirection: "column", alignItems: "center", zIndex: 10 },
  photoRow: { display: "flex", alignItems: "center", justifyContent: "center", gap: 28 },
  signalRow: { display: "flex", gap: 18, marginTop: 42 },
  signalChip: { display: "flex", alignItems: "center", gap: 9, padding: "13px 18px", border: "1px solid rgba(96,165,250,.18)", borderRadius: 999, background: "rgba(5,15,29,.82)", color: "#bed4e9", fontSize: 20 },
  introHint: { marginTop: 28, color: "#738da8", fontSize: 20 },
  productGrid: { position: "absolute", left: 86, right: 86, top: 220, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 20, zIndex: 10 },
  productCard: { padding: 16, border: "1px solid", borderRadius: 20, background: "linear-gradient(145deg, rgba(17,35,58,.94), rgba(7,15,28,.94))", boxShadow: "0 20px 50px rgba(0,0,0,.25)" },
  productText: { display: "grid", gridTemplateColumns: "1fr auto", alignItems: "center", gap: 6 },
  purchaseFooter: { position: "absolute", left: 86, right: 86, bottom: 78, padding: 20, textAlign: "center", color: "#8fa8c2", border: "1px solid rgba(56,189,248,.18)", borderRadius: 15, background: "rgba(5,15,29,.8)", fontSize: 20, zIndex: 10 },
  wiringScene: { position: "absolute", left: 86, right: 86, top: 220, bottom: 80, display: "grid", gridTemplateColumns: "1fr 330px", gap: 28, zIndex: 10 },
  boardStage: { position: "relative", minHeight: 700, border: "1px solid rgba(96,165,250,.18)", borderRadius: 24, background: "linear-gradient(145deg, rgba(9,24,43,.94), rgba(4,10,19,.95))", perspective: 900, overflow: "hidden" },
  wireSvg: { position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" },
  boardCaptionLeft: { position: "absolute", left: 160, bottom: 48, color: C.cyan, fontSize: 24, fontWeight: 800 },
  boardCaptionRight: { position: "absolute", right: 135, bottom: 48, color: C.orange, fontSize: 24, fontWeight: 800 },
  wireList: { display: "flex", flexDirection: "column", gap: 13, padding: 24, border: "1px solid rgba(96,165,250,.16)", borderRadius: 20, background: "rgba(6,16,30,.86)" },
  panelTag: { color: C.cyan, fontSize: 18, fontWeight: 800, letterSpacing: 2 },
  wireRow: { display: "grid", gridTemplateColumns: "10px 90px 20px 1fr", alignItems: "center", gap: 8, padding: 14, border: "1px solid", borderRadius: 12, background: "rgba(59,130,246,.06)", color: "#b9cee1", fontSize: 18 },
  safetyNote: { marginTop: "auto", padding: 16, color: "#f8c98d", border: "1px solid rgba(249,115,22,.22)", borderRadius: 12, background: "rgba(249,115,22,.06)", fontSize: 17, lineHeight: 1.6 },
  networkScene: { position: "absolute", left: 90, right: 90, top: 250, height: 480, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 30, alignItems: "center", zIndex: 10 },
  networkNode: { position: "relative", zIndex: 3, padding: 14, border: "1px solid", borderRadius: 18, background: "rgba(7,18,33,.94)", textAlign: "center", fontSize: 20 },
  networkLines: { position: "absolute", left: "8%", right: "8%", top: 125, height: 80, width: "84%", zIndex: 1 },
  monitorSteps: { position: "absolute", left: 130, right: 130, bottom: 72, display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, zIndex: 10 },
  phoneScene: { position: "absolute", left: 96, right: 96, top: 230, height: 730, display: "grid", gridTemplateColumns: "360px 1fr 390px", gap: 34, alignItems: "center", zIndex: 10 },
  sourcePanel: { padding: 24, border: "1px solid rgba(96,165,250,.18)", borderRadius: 22, background: "rgba(7,18,33,.92)" },
  sourceLine: { display: "flex", alignItems: "center", gap: 10, marginTop: 14, color: "#bed2e5", fontSize: 18 },
  linkFlow: { display: "flex", flexDirection: "column", alignItems: "center", gap: 22, color: C.muted, fontSize: 19, textAlign: "center" },
  flowRail: { position: "relative", width: "100%", height: 8, overflow: "hidden", borderRadius: 999, background: "rgba(56,189,248,.14)" },
  phoneMock: { position: "relative", width: 360, height: 650, padding: 15, border: "3px solid #61758b", borderRadius: 48, background: "#111827", boxShadow: "0 30px 90px rgba(0,0,0,.42), 0 0 50px rgba(56,189,248,.13)", rotate: "3deg" },
  phoneSpeaker: { position: "absolute", left: "50%", top: 12, width: 108, height: 25, borderRadius: 999, background: "#05070c", transform: "translateX(-50%)", zIndex: 3 },
  phoneScreen: { height: "100%", padding: "58px 18px 18px", borderRadius: 36, background: "linear-gradient(180deg,#081426,#050b14)" },
  phoneStatus: { display: "flex", justifyContent: "space-between", color: "#8fa6be", fontSize: 13 },
  phoneLogo: { marginTop: 23, color: "#e7f3ff", fontSize: 27, fontWeight: 800 },
  phoneSub: { margin: "4px 0 0", color: "#4fa8f5", fontSize: 14 },
  phoneHero: { display: "flex", flexDirection: "column", gap: 4, marginTop: 20, padding: 15, borderRadius: 14, background: "linear-gradient(110deg,rgba(37,99,235,.4),rgba(56,189,248,.14))" },
  appItem: { display: "flex", alignItems: "center", gap: 10, marginTop: 11, padding: 12, border: "1px solid", borderRadius: 11, color: "#c7d9ed", fontSize: 16 },
  phoneTips: { position: "absolute", left: 180, right: 180, bottom: 70, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, zIndex: 10 },
  checklistScene: { position: "absolute", left: 120, right: 120, top: 250, display: "grid", gridTemplateColumns: "1fr 420px", gap: 55, alignItems: "center", zIndex: 10 },
  checklist: { display: "flex", flexDirection: "column", gap: 13 },
  checkRow: { display: "flex", alignItems: "center", gap: 14, padding: 17, border: "1px solid rgba(34,197,94,.18)", borderRadius: 13, background: "rgba(34,197,94,.06)", color: "#cce3d6", fontSize: 22 },
  qrPanel: { padding: 30, textAlign: "center", border: "1px solid rgba(56,189,248,.22)", borderRadius: 24, background: "rgba(7,18,33,.9)" },
  fakeQr: { display: "grid", gridTemplateColumns: "repeat(10,1fr)", gap: 4, width: 240, height: 240, margin: "26px auto", padding: 12, background: "white", borderRadius: 12 },
  credit: { position: "absolute", left: 120, right: 120, bottom: 50, color: "#607b94", fontSize: 16, textAlign: "center" },
};
