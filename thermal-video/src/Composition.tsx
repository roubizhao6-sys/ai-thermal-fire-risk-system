// @ts-nocheck
import { Audio } from "@remotion/media";
import { ThreeCanvas } from "@remotion/three";
import type { CalculateMetadataFunction } from "remotion";
import {
  AbsoluteFill,
  Composition,
  Easing,
  interpolate,
  Series,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import * as THREE from "three";

type Props = {};

const COLORS = {
  bg: "#050d19",
  panel: "#0b1729",
  blue: "#3b82f6",
  cyan: "#38bdf8",
  green: "#22c55e",
  orange: "#f97316",
  red: "#ef4444",
  yellow: "#facc15",
  text: "#f3f8ff",
  muted: "#8ba3bf",
};

const FONT = '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif';
const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';
const FPS = 24;
const DURATIONS = [11, 21, 21, 15, 18, 16, 13];

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return { durationInFrames: DURATIONS.reduce((sum, value) => sum + value * FPS, 0) };
};

export const ThermalTutorialComposition = () => {
  return (
    <Composition
      id="ThermalAssemblyTutorial"
      component={ThermalTutorial}
      durationInFrames={DURATIONS.reduce((sum, value) => sum + value * FPS, 0)}
      fps={FPS}
      width={1920}
      height={1080}
      calculateMetadata={calculateMetadata}
    />
  );
};

const fade = (frame: number, duration: number) =>
  interpolate(frame, [0, 12, duration - 14, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

const SceneShell: React.FC<{
  index: string;
  title: string;
  subtitle: string;
  color?: string;
  children: React.ReactNode;
  duration: number;
}> = ({ index, title, subtitle, color = COLORS.cyan, children, duration }) => {
  const frame = useCurrentFrame();
  const enter = spring({ frame, fps: FPS, config: { damping: 18, stiffness: 110 } });
  return (
    <AbsoluteFill style={{ opacity: fade(frame, duration), fontFamily: FONT }}>
      <AbsoluteFill style={styles.grid} />
      <div style={{ ...styles.header, opacity: enter, translate: interpolate(enter, [0, 1], [0, 24]) }}>
        <span style={{ ...styles.index, color, borderColor: `${color}55`, background: `${color}18` }}>{index}</span>
        <div>
          <h1 style={{ ...styles.title, color }}>{title}</h1>
          <p style={styles.subtitle}>{subtitle}</p>
        </div>
      </div>
      {children}
      <div style={styles.brand}>热感哨兵 · AI火警网警</div>
    </AbsoluteFill>
  );
};

const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const scale = spring({ frame, fps: FPS, config: { damping: 16, stiffness: 90 } });
  return (
    <SceneShell index="00" title="AI热感火警风险检测系统" subtitle="硬件组装与手机 App 联动 3D 教学" duration={DURATIONS[0] * FPS}>
      <ThreeCanvas width={width} height={height} camera={{ position: [8, 5, 10], fov: 38 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#050d19"]} />
        <ambientLight intensity={1.3} />
        <directionalLight position={[8, 12, 8]} intensity={2.2} />
        <group rotation={[0, frame * 0.006, 0]} scale={scale}>
          <mesh position={[0, 2.5, 0]}>
            <boxGeometry args={[5.1, 5, 4]} />
            <meshStandardMaterial color="#0d2942" emissive="#071b2c" roughness={0.48} />
          </mesh>
          {[1, 2, 3, 4].map((floor) => (
            <mesh key={floor} position={[0, floor, 2.03]}>
              <planeGeometry args={[4.6, 0.42]} />
              <meshBasicMaterial color={floor % 2 === 0 ? "#38bdf8" : "#3b82f6"} />
            </mesh>
          ))}
          <mesh position={[0, 5.35, 0]}>
            <boxGeometry args={[5.5, 0.35, 4.4]} />
            <meshStandardMaterial color="#12334f" emissive="#0b1f33" />
          </mesh>
          <mesh position={[0, 6.05, 0]}>
            <cylinderGeometry args={[0.04, 0.04, 1.3, 12]} />
            <meshStandardMaterial color="#b9d3e8" metalness={0.8} roughness={0.2} />
          </mesh>
          <mesh position={[1.4, 1.2, 2.12]}>
            <sphereGeometry args={[0.48, 24, 24]} />
            <meshBasicMaterial color="#ff3b30" />
          </mesh>
        </group>
      </ThreeCanvas>
      <div style={{ ...styles.introCopy, opacity: scale, translate: interpolate(scale, [0, 1], [0, 30]) }}>
        <p style={styles.eyebrow}>学生竞赛演示版 · 3D 教学视频</p>
        <h1 style={styles.hero}>从一块开发板到手机上的3D火警监控</h1>
        <p style={styles.heroSub}>采购 · 接线 · 烧录 · WebSocket · 手机 App · 3D大楼 · 疏散演练</p>
      </div>
    </SceneShell>
  );
};

const PurchaseScene: React.FC = () => {
  const frame = useCurrentFrame();
  const items = [
    ["ESP32-S3", "主控开发板", "¥60–120", "采集并发送温度矩阵", COLORS.cyan],
    ["MLX90640", "32×24 热成像", "¥300–550", "输出768点温度数据", COLORS.orange],
    ["SHT31", "温湿度传感器", "¥30–80", "辅助降低误报", COLORS.green],
    ["声光报警", "蜂鸣器 + RGB LED", "¥10–30", "本地风险提示", COLORS.red],
    ["接线与供电", "面包板、杜邦线、充电宝", "¥50–150", "移动演示", COLORS.yellow],
    ["网络摄像机", "支持 RTSP 的型号", "¥200–500", "真实监控接入", COLORS.blue],
  ] as const;
  return (
    <SceneShell index="01" title="竞赛演示采购清单" subtitle="先完成热成像数据闭环，再增加真实监控" duration={DURATIONS[1] * FPS}>
      <div style={styles.purchaseGrid}>
        {items.map(([name, model, price, purpose, color], index) => {
          const progress = spring({ frame: frame - index * 9, fps: FPS, config: { damping: 18, stiffness: 100 } });
          return (
            <div
              key={name}
              style={{
                ...styles.purchaseCard,
                borderColor: `${color}55`,
                opacity: progress,
                translate: interpolate(progress, [0, 1], [0, 42]),
                rotate: interpolate(progress, [0, 1], ["-2deg", "0deg"]),
              }}
            >
              <span style={{ ...styles.purchaseIndex, color, background: `${color}18` }}>{String(index + 1).padStart(2, "0")}</span>
              <h2 style={{ ...styles.purchaseName, color }}>{name}</h2>
              <p style={styles.purchaseModel}>{model}</p>
              <strong style={styles.purchasePrice}>{price}</strong>
              <p style={styles.purchasePurpose}>{purpose}</p>
            </div>
          );
        })}
      </div>
      <div style={styles.budgetBar}>
        <span>最低演示预算</span><strong>¥500–900</strong>
        <i />
        <span>带监控和网关</span><strong>¥1,500–2,500</strong>
      </div>
    </SceneShell>
  );
};

const Wire3D: React.FC<{
  start: [number, number, number];
  end: [number, number, number];
  color: string;
  progress: number;
}> = ({ start, end, color, progress }) => {
  const startVector = new THREE.Vector3(...start);
  const endVector = new THREE.Vector3(...end);
  const direction = endVector.clone().sub(startVector);
  const length = direction.length();
  const midpoint = startVector.clone().add(endVector).multiplyScalar(0.5);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
  const visibleLength = Math.max(0.001, length * progress);
  const particlePosition = startVector.clone().lerp(endVector, (progress * 1.7) % 1);
  return (
    <group>
      <mesh position={midpoint} quaternion={quaternion}>
        <cylinderGeometry args={[0.035, 0.035, visibleLength, 12]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.8} />
      </mesh>
      {progress > 0.2 && (
        <mesh position={particlePosition}>
          <sphereGeometry args={[0.08, 14, 14]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      )}
    </group>
  );
};

const Esp32Board3D: React.FC<{ position?: [number, number, number]; scale?: number }> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh position={[0, 0, 0]}>
      <boxGeometry args={[3.4, 0.18, 2.1]} />
      <meshStandardMaterial color="#0b5e48" metalness={0.3} roughness={0.42} />
    </mesh>
    <mesh position={[-0.45, 0.2, -0.15]}>
      <boxGeometry args={[0.9, 0.28, 0.9]} />
      <meshStandardMaterial color="#0b1118" metalness={0.55} roughness={0.28} />
    </mesh>
    <mesh position={[0.8, 0.16, 0.1]}>
      <boxGeometry args={[0.74, 0.2, 0.52]} />
      <meshStandardMaterial color="#d1d5db" metalness={0.75} roughness={0.2} />
    </mesh>
    <mesh position={[-1.42, 0.15, 0]}>
      <boxGeometry args={[0.55, 0.32, 0.72]} />
      <meshStandardMaterial color="#aeb8c4" metalness={0.8} roughness={0.22} />
    </mesh>
    {[-0.75, -0.2, 0.35, 0.9].map((x) => (
      <mesh key={x} position={[x, 0.16, 1.1]}>
        <boxGeometry args={[0.08, 0.24, 0.18]} />
        <meshStandardMaterial color="#facc15" metalness={0.65} roughness={0.2} />
      </mesh>
    ))}
    <mesh position={[1.25, 0.28, -0.6]}>
      <sphereGeometry args={[0.1, 14, 14]} />
      <meshBasicMaterial color="#22c55e" />
    </mesh>
  </group>
);

const SensorBoard3D: React.FC<{ position?: [number, number, number]; scale?: number }> = ({ position = [0, 0, 0], scale = 1 }) => (
  <group position={position} scale={scale}>
    <mesh>
      <boxGeometry args={[2.1, 0.18, 1.65]} />
      <meshStandardMaterial color="#12395c" metalness={0.35} roughness={0.38} />
    </mesh>
    <mesh position={[0, 0.3, 0]}>
      <boxGeometry args={[0.92, 0.43, 0.78]} />
      <meshStandardMaterial color="#111827" emissive="#071421" metalness={0.6} roughness={0.18} />
    </mesh>
    <mesh position={[0, 0.55, 0]}>
      <cylinderGeometry args={[0.28, 0.28, 0.13, 24]} />
      <meshStandardMaterial color="#50677d" metalness={0.9} roughness={0.12} />
    </mesh>
    {[-0.75, -0.25, 0.25, 0.75].map((x) => (
      <mesh key={x} position={[x, 0.16, 0.82]}>
        <boxGeometry args={[0.1, 0.25, 0.16]} />
        <meshStandardMaterial color="#facc15" metalness={0.7} roughness={0.2} />
      </mesh>
    ))}
  </group>
);

const AssemblyScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const progress = interpolate(frame, [24, 108], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const callouts = [
    ["VIN → 3V3", "使用3.3V供电", COLORS.red],
    ["GND → GND", "必须共地", "#111827"],
    ["SDA → GPIO 8", "I²C 数据线", COLORS.cyan],
    ["SCL → GPIO 9", "I²C 时钟线", COLORS.blue],
  ] as const;
  return (
    <SceneShell index="02" title="第一步 硬件接线" subtitle="MLX90640 通过 I²C 连接 ESP32-S3，确认接线后再通电" duration={DURATIONS[2] * FPS}>
      <ThreeCanvas width={width} height={height} camera={{ position: [0, 4.8, 9.5], fov: 40 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#050d19"]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[3, 9, 7]} intensity={2.4} />
        <pointLight position={[-3, 4, 4]} intensity={1.2} color="#38bdf8" />
        <group position={[0, -0.4, 0]} rotation={[0.05, -0.15, 0]}>
          <Esp32Board3D position={[-2.3, 0.25, 0]} scale={1.28} />
          <SensorBoard3D position={[2.4, 0.35, 0]} scale={1.18} />
          <Wire3D start={[-1.15, 0.55, 0.8]} end={[1.42, 0.75, 0.8]} color={COLORS.red} progress={progress} />
          <Wire3D start={[-1.0, 0.42, 0.55]} end={[1.3, 0.42, 0.55]} color="#111827" progress={progress} />
          <Wire3D start={[-0.86, 0.5, 0.32]} end={[1.18, 0.56, 0.32]} color={COLORS.cyan} progress={progress} />
          <Wire3D start={[-0.72, 0.58, 0.1]} end={[1.08, 0.7, 0.1]} color={COLORS.blue} progress={progress} />
          <mesh position={[0, 0.05, 0]}>
            <boxGeometry args={[9.3, 0.08, 4.8]} />
            <meshStandardMaterial color="#081321" metalness={0.3} roughness={0.65} />
          </mesh>
        </group>
      </ThreeCanvas>
      <div style={styles.calloutColumn}>
        {callouts.map(([label, detail, color], index) => {
          const item = spring({ frame: frame - 52 - index * 8, fps: FPS, config: { damping: 16 } });
          return (
            <div key={label} style={{ ...styles.callout, opacity: item, translate: interpolate(item, [0, 1], [36, 0]), borderColor: `${color}66` }}>
              <i style={{ background: color }} /><div><strong>{label}</strong><span>{detail}</span></div>
            </div>
          );
        })}
      </div>
      <div style={styles.boardLabelLeft}>ESP32-S3 主控板</div>
      <div style={styles.boardLabelRight}>MLX90640 热成像模块</div>
    </SceneShell>
  );
};

const Laptop3D: React.FC = () => (
  <group position={[0, -1.1, 0]} rotation={[0.05, -0.3, 0]}>
    <mesh position={[0, 1.15, -0.7]} rotation={[-0.18, 0, 0]}>
      <boxGeometry args={[4.6, 2.7, 0.12]} />
      <meshStandardMaterial color="#1c2430" metalness={0.55} roughness={0.3} />
    </mesh>
    <mesh position={[0, 1.1, -0.62]} rotation={[-0.18, 0, 0]}>
      <planeGeometry args={[4.05, 2.18]} />
      <meshBasicMaterial color="#0b1729" />
    </mesh>
    <mesh position={[0, -0.25, 0.2]} rotation={[-0.15, 0, 0]}>
      <boxGeometry args={[4.7, 0.14, 3]} />
      <meshStandardMaterial color="#263445" metalness={0.65} roughness={0.28} />
    </mesh>
  </group>
);

const FirmwareScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const cableProgress = interpolate(frame, [24, 90], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const terminalLines = [
    "Connecting to WiFi........",
    "WebSocket: ws://192.168.4.1:81/",
    "Frame 32×24  max=86.4°C  risk=high",
    "Temperatures: 768 points  hotspots: 3",
  ];
  return (
    <SceneShell index="03" title="第二步 烧录与联网" subtitle="使用 2.4GHz Wi-Fi，烧录后确认串口持续输出温度矩阵" duration={DURATIONS[3] * FPS}>
      <ThreeCanvas width={width} height={height} camera={{ position: [7, 4.3, 9], fov: 40 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#050d19"]} />
        <ambientLight intensity={1.4} />
        <directionalLight position={[5, 8, 7]} intensity={2.2} />
        <Laptop3D />
        <Esp32Board3D position={[2.9, -0.7, 0.6]} scale={0.72} />
        <Wire3D start={[-2.1, -0.55, 0.9]} end={[2.15, -0.45, 0.55]} color="#cbd5e1" progress={cableProgress} />
      </ThreeCanvas>
      <div style={styles.terminal}>
        <div style={styles.terminalHead}><i /><i /><i /><span>串口监视器 · 115200</span></div>
        {terminalLines.map((line, index) => {
          const opacity = interpolate(frame, [40 + index * 18, 48 + index * 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
          return <code key={line} style={{ ...styles.terminalLine, opacity }}>{line}</code>;
        })}
      </div>
      <div style={styles.usbHint}>USB-C 数据线</div>
    </SceneShell>
  );
};

const PhoneScene: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = (Math.sin(frame * 0.12) + 1) * 0.5;
  const monitorItems = ["模拟热感板", "HLS 实时流", "MJPEG 监控", "添加监控"];
  const appItems = ["现场监控", "3D大楼模型", "动态疏散路线", "开启指南针"];
  return (
    <SceneShell index="04" title="第三步 手机 App 联动" subtitle="热感板使用 WSS 安全网关，摄像机转换为 HLS 或 MJPEG" duration={DURATIONS[4] * FPS}>
      <div style={styles.linkScene}>
        <div style={styles.devicePanel}>
          <span style={styles.panelTag}>硬件数据</span>
          <h2>ESP32-S3</h2>
          <p>ws://192.168.4.1:81/</p>
          {monitorItems.map((item) => <div key={item} style={styles.linkRow}><i />{item}</div>)}
        </div>
        <div style={styles.dataFlow}>
          <span style={{ opacity: 0.55 + pulse * 0.45 }}>JSON 温度矩阵</span>
          <strong>WSS</strong>
          <div style={styles.flowLine}><i style={{ left: `${(frame * 2.2) % 100}%` }} /></div>
          <span>与手机安全连接</span>
        </div>
        <div style={styles.phoneFrame}>
          <div style={styles.phoneNotch} />
          <div style={styles.phoneScreen}>
            <div style={styles.phoneStatus}>09:41 <span>5G · 100%</span></div>
            <h3>热感哨兵</h3>
            <p>AI火警网警</p>
            <div style={styles.phoneHero}><span style={{ scale: 0.94 + pulse * 0.08 }}>3D</span><div><b>三维大楼监控</b><small>楼层 · 热区 · 传感器</small></div></div>
            {appItems.map((item, index) => <div key={item} style={{ ...styles.appRow, borderColor: index === 0 ? `${COLORS.cyan}88` : "#20364e" }}><i>{String(index + 1).padStart(2, "0")}</i><span>{item}</span><b>›</b></div>)}
          </div>
        </div>
      </div>
      <div style={styles.linkTips}>
        <div><strong>热感板</strong><span>WSS 安全地址或内置模拟板</span></div>
        <div><strong>摄像机</strong><span>RTSP → 网关 → HLS/MJPEG</span></div>
        <div><strong>指南针</strong><span>点击后允许运动与方向权限</span></div>
      </div>
    </SceneShell>
  );
};

const BuildingModel: React.FC = () => {
  const frame = useCurrentFrame();
  const pulse = 1 + Math.sin(frame * 0.16) * 0.16;
  return (
    <group rotation={[0, frame * 0.008, 0]} position={[0, -2.1, 0]}>
      <mesh position={[0, 3.4, 0]}>
        <boxGeometry args={[5.1, 6.8, 3.6]} />
        <meshStandardMaterial color="#0d2942" emissive="#071b2c" metalness={0.18} roughness={0.44} />
      </mesh>
      {[1.2, 2.6, 4, 5.4].map((y) => (
        <mesh key={y} position={[0, y, 0]}>
          <boxGeometry args={[5.34, 0.12, 3.84]} />
          <meshStandardMaterial color="#2b6fa5" emissive="#0a3150" />
        </mesh>
      ))}
      {[0.9, 2.2, 3.5, 4.8, 6.1].map((y) =>
        [-1.8, -0.8, 0.2, 1.2, 2.0].map((x) => (
          <mesh key={`${x}-${y}`} position={[x, y, 1.82]}>
            <planeGeometry args={[0.46, 0.5]} />
            <meshBasicMaterial color="#56c8ff" />
          </mesh>
        )),
      )}
      {[[-1.15, 2.7, 1.98, COLORS.red], [1.25, 4.1, 1.98, COLORS.orange], [0.2, 1.6, -1.98, COLORS.red]].map(([x, y, z, color], index) => (
        <group key={index} position={[Number(x), Number(y), Number(z)]}>
          <mesh scale={pulse}>
            <sphereGeometry args={[0.28, 20, 20]} />
            <meshBasicMaterial color={String(color)} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.5, 0.03, 10, 28]} />
            <meshBasicMaterial color={String(color)} transparent opacity={0.75} />
          </mesh>
        </group>
      ))}
      {[[-3.1, 2.2, 0.8], [3.1, 4.2, -0.4], [2.5, 6.2, 1.2]].map((position, index) => (
        <group key={index} position={position as [number, number, number]}>
          <mesh>
            <boxGeometry args={[0.32, 0.2, 0.24]} />
            <meshStandardMaterial color="#0c2b44" emissive="#38bdf8" emissiveIntensity={1.2} />
          </mesh>
          <mesh position={[0, -1.1, 0.6]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.78, 2.1, 16]} />
            <meshBasicMaterial color="#38bdf8" transparent opacity={0.13} />
          </mesh>
        </group>
      ))}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[new Float32Array([-2.6, 0.2, 2.5, 2.7, 0.2, 2.5, 2.7, 0.2, -2.5]), 3]} />
        </bufferGeometry>
        <lineBasicMaterial color={COLORS.green} linewidth={3} />
      </line>
    </group>
  );
};

const BuildingScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <SceneShell index="05" title="第四步 实时3D大楼监控" subtitle="三维楼层、热感传感器、摄像机锥和高温热区在同一模型中联动" duration={DURATIONS[5] * FPS}>
      <ThreeCanvas width={width} height={height} camera={{ position: [9, 7, 11], fov: 39 }} style={{ position: "absolute", inset: 0 }}>
        <color attach="background" args={["#050d19"]} />
        <ambientLight intensity={1.35} />
        <directionalLight position={[5, 10, 8]} intensity={2.4} />
        <pointLight position={[0, 4, 3]} intensity={1.4} color="#38bdf8" />
        <BuildingModel />
      </ThreeCanvas>
      <div style={styles.buildingHud}>
        <div><i style={{ background: COLORS.cyan }} />热感传感器</div>
        <div><i style={{ background: COLORS.red }} />高温热区</div>
        <div><i style={{ background: COLORS.green }} />动态疏散路线</div>
      </div>
      <div style={styles.monitorCard}>
        <span>实时监控状态</span>
        <strong>{interpolate(frame, [0, DURATIONS[5] * FPS], [0, 86.4]).toFixed(1)}°C</strong>
        <p>最高温度估算</p>
        <div style={styles.miniBars}>{[62, 78, 86, 71, 58, 91, 83, 68].map((value, index) => <i key={index} style={{ height: `${value}%`, opacity: 0.45 + index * 0.06 }} />)}</div>
      </div>
    </SceneShell>
  );
};

const EvacuationScene: React.FC = () => {
  const frame = useCurrentFrame();
  const turn = interpolate(frame, [24, 120], [-120, 48], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.bezier(0.16, 1, 0.3, 1) });
  const routeSteps = ["离开当前高温区域", "向西侧通道移动", "进入东侧安全楼梯", "到达一楼集合点"];
  return (
    <SceneShell index="06" title="第五步 疏散演练与证据链" subtitle="指南针给出转向提示，演练结束后自动生成处置记录" duration={DURATIONS[6] * FPS}>
      <div style={styles.evacuationLayout}>
        <div style={styles.compassBox}>
          <div style={styles.compassDial}>
            <span style={styles.compassN}>N</span><span style={styles.compassE}>E</span><span style={styles.compassS}>S</span><span style={styles.compassW}>W</span>
            {Array.from({ length: 24 }).map((_, index) => <i key={index} style={{ rotate: `${index * 15}deg` }} />)}
            <b style={{ rotate: `${turn}deg` }}>▲</b>
            <em />
          </div>
          <h2>向右前方撤离</h2>
          <p>距离安全出口 86 米 · 预计 42 秒</p>
        </div>
        <div style={styles.routePanel}>
          <span style={styles.panelTag}>动态疏散路线</span>
          {routeSteps.map((step, index) => <div key={step} style={styles.routeStep}><i>{String(index + 1).padStart(2, "0")}</i><span>{step}</span></div>)}
          <div style={styles.evidenceStrip}>
            <strong>证据链已生成</strong>
            <span>检测 00:00</span><span>定位 00:01</span><span>研判 00:02</span><span>处置 00:04</span>
          </div>
        </div>
      </div>
      <div style={styles.finalLine}>科研演示原型 · 不替代专业消防检测设备与灭火系统</div>
    </SceneShell>
  );
};

const ThermalTutorial: React.FC<Props> = () => {
  return (
    <AbsoluteFill style={styles.root}>
      <Series>
        <Series.Sequence durationInFrames={DURATIONS[0] * FPS}><IntroScene /><Audio src={staticFile("audio/scene1.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[1] * FPS}><PurchaseScene /><Audio src={staticFile("audio/scene2.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[2] * FPS}><AssemblyScene /><Audio src={staticFile("audio/scene3.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[3] * FPS}><FirmwareScene /><Audio src={staticFile("audio/scene4.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[4] * FPS}><PhoneScene /><Audio src={staticFile("audio/scene5.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[5] * FPS}><BuildingScene /><Audio src={staticFile("audio/scene6.wav")} /></Series.Sequence>
        <Series.Sequence durationInFrames={DURATIONS[6] * FPS}><EvacuationScene /><Audio src={staticFile("audio/scene7.wav")} /></Series.Sequence>
      </Series>
    </AbsoluteFill>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: { background: COLORS.bg, color: COLORS.text },
  phoneHero: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: 14, borderRadius: 14, background: "linear-gradient(110deg, rgba(37,99,235,.4), rgba(56,189,248,.14))" },
  grid: {
    backgroundImage: "linear-gradient(rgba(56,189,248,.055) 1px, transparent 1px), linear-gradient(90deg, rgba(56,189,248,.055) 1px, transparent 1px), radial-gradient(circle at 72% 16%, rgba(37,99,235,.22), transparent 30%), radial-gradient(circle at 18% 80%, rgba(239,68,68,.09), transparent 28%)",
    backgroundSize: "56px 56px, 56px 56px, auto, auto",
  },
  header: { position: "absolute", left: 96, top: 72, display: "flex", alignItems: "center", gap: 22, zIndex: 12 },
  index: { width: 72, height: 72, display: "grid", placeItems: "center", border: "1px solid", borderRadius: 18, fontFamily: MONO, fontSize: 26, fontWeight: 900 },
  title: { margin: 0, fontSize: 58, lineHeight: 1.08, letterSpacing: -2 },
  subtitle: { margin: "12px 0 0", color: COLORS.muted, fontSize: 26, lineHeight: 1.45 },
  brand: { position: "absolute", right: 72, bottom: 44, color: "#66819d", fontSize: 20, letterSpacing: 2 },
  introCopy: { position: "absolute", left: 112, top: 286, width: 820, zIndex: 12 },
  eyebrow: { margin: 0, color: COLORS.cyan, fontSize: 24, fontWeight: 800, letterSpacing: 5 },
  hero: { margin: "28px 0 0", fontSize: 76, lineHeight: 1.08, letterSpacing: -3 },
  heroSub: { margin: "32px 0 0", color: "#91abc7", fontSize: 28, lineHeight: 1.7 },
  purchaseGrid: { position: "absolute", left: 96, right: 96, top: 236, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 22, zIndex: 10 },
  purchaseCard: { minHeight: 210, padding: 28, border: "1px solid", borderRadius: 22, background: "linear-gradient(145deg, rgba(17,35,58,.94), rgba(7,15,28,.94))", boxShadow: "0 24px 60px rgba(0,0,0,.28)" },
  purchaseIndex: { display: "inline-grid", placeItems: "center", width: 45, height: 34, borderRadius: 10, fontFamily: MONO, fontSize: 18, fontWeight: 800 },
  purchaseName: { margin: "18px 0 2px", fontSize: 32 },
  purchaseModel: { margin: 0, color: COLORS.muted, fontSize: 19 },
  purchasePrice: { display: "block", marginTop: 18, fontSize: 25, color: "#e8f4ff" },
  purchasePurpose: { margin: "12px 0 0", color: "#7891ad", fontSize: 18 },
  budgetBar: { position: "absolute", left: 96, right: 96, bottom: 86, display: "flex", alignItems: "center", justifyContent: "center", gap: 28, padding: 22, border: "1px solid rgba(56,189,248,.2)", borderRadius: 18, background: "rgba(5,15,29,.82)", fontSize: 20, color: COLORS.muted },
  calloutColumn: { position: "absolute", right: 90, top: 290, display: "flex", flexDirection: "column", gap: 16, zIndex: 12 },
  callout: { display: "flex", alignItems: "center", gap: 14, minWidth: 300, padding: 17, border: "1px solid", borderRadius: 14, background: "rgba(6,16,30,.88)", boxShadow: "0 14px 36px rgba(0,0,0,.24)" },
  boardLabelLeft: { position: "absolute", left: 230, bottom: 100, color: COLORS.cyan, fontSize: 24, fontWeight: 800 },
  boardLabelRight: { position: "absolute", right: 230, bottom: 100, color: COLORS.orange, fontSize: 24, fontWeight: 800 },
  terminal: { position: "absolute", left: 120, right: 850, bottom: 120, padding: 24, border: "1px solid rgba(56,189,248,.22)", borderRadius: 18, background: "rgba(3,10,20,.9)", zIndex: 12 },
  terminalHead: { display: "flex", alignItems: "center", gap: 9, marginBottom: 18, color: "#8ca6bf", fontSize: 18 },
  terminalLine: { display: "block", marginTop: 13, color: "#9be7ff", fontFamily: MONO, fontSize: 21 },
  usbHint: { position: "absolute", left: "45%", bottom: 100, color: "#d9e8f7", fontSize: 22, fontWeight: 700 },
  linkScene: { position: "absolute", left: 100, right: 100, top: 250, height: 650, display: "grid", gridTemplateColumns: "330px 1fr 390px", alignItems: "center", gap: 34, zIndex: 10 },
  devicePanel: { padding: 28, border: "1px solid rgba(56,189,248,.22)", borderRadius: 22, background: "rgba(8,19,36,.9)" },
  panelTag: { color: COLORS.cyan, fontSize: 19, fontWeight: 800, letterSpacing: 2 },
  linkRow: { display: "flex", alignItems: "center", gap: 12, marginTop: 18, padding: 14, borderRadius: 10, background: "rgba(59,130,246,.08)", color: "#b8cce0", fontSize: 19 },
  dataFlow: { display: "flex", flexDirection: "column", alignItems: "center", gap: 18, color: COLORS.muted, fontSize: 20 },
  flowLine: { position: "relative", width: "100%", height: 8, overflow: "hidden", borderRadius: 999, background: "rgba(56,189,248,.14)" },
  phoneFrame: { position: "relative", width: 360, height: 650, padding: 15, border: "3px solid #61758b", borderRadius: 48, background: "#111827", boxShadow: "0 30px 90px rgba(0,0,0,.45), 0 0 50px rgba(56,189,248,.13)", rotate: "3deg", scale: 0.96 },
  phoneNotch: { position: "absolute", left: "50%", top: 12, width: 108, height: 25, borderRadius: 999, background: "#05070c", transform: "translateX(-50%)", zIndex: 3 },
  phoneScreen: { height: "100%", padding: "58px 18px 18px", borderRadius: 36, background: "linear-gradient(180deg, #081426, #050b14)" },
  phoneStatus: { display: "flex", justifyContent: "space-between", color: "#8fa6be", fontSize: 13, marginBottom: 18 },
  appRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 11, padding: 12, border: "1px solid", borderRadius: 11, color: "#c7d9ed", fontSize: 16 },
  linkTips: { position: "absolute", left: 110, right: 110, bottom: 76, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 18, zIndex: 12 },
  buildingHud: { position: "absolute", left: 110, bottom: 82, display: "flex", gap: 24, padding: 18, border: "1px solid rgba(56,189,248,.2)", borderRadius: 15, background: "rgba(4,13,27,.84)", fontSize: 19, color: "#a4bdd5", zIndex: 12 },
  monitorCard: { position: "absolute", right: 108, top: 270, width: 290, padding: 24, border: "1px solid rgba(56,189,248,.2)", borderRadius: 18, background: "rgba(5,15,29,.86)", zIndex: 12 },
  miniBars: { height: 86, display: "flex", alignItems: "flex-end", gap: 8, marginTop: 20 },
  evacuationLayout: { position: "absolute", left: 120, right: 120, top: 270, display: "grid", gridTemplateColumns: "520px 1fr", gap: 44, alignItems: "center", zIndex: 10 },
  compassBox: { display: "flex", flexDirection: "column", alignItems: "center", padding: 30, border: "1px solid rgba(56,189,248,.22)", borderRadius: 24, background: "rgba(6,16,30,.88)" },
  compassDial: { position: "relative", width: 300, height: 300, border: "2px solid rgba(56,189,248,.3)", borderRadius: "50%", background: "radial-gradient(circle, rgba(15,50,86,.72), rgba(3,10,22,.96) 68%)" },
  compassN: { position: "absolute", left: "50%", top: 16, color: "#ff6b78", fontSize: 20, fontWeight: 900, transform: "translateX(-50%)" },
  compassE: { position: "absolute", right: 18, top: "50%", color: "#7d96b1", fontSize: 18, transform: "translateY(-50%)" },
  compassS: { position: "absolute", left: "50%", bottom: 16, color: "#7d96b1", fontSize: 18, transform: "translateX(-50%)" },
  compassW: { position: "absolute", left: 18, top: "50%", color: "#7d96b1", fontSize: 18, transform: "translateY(-50%)" },
  routePanel: { padding: 32, border: "1px solid rgba(56,189,248,.18)", borderRadius: 22, background: "rgba(6,16,30,.86)" },
  routeStep: { display: "flex", alignItems: "center", gap: 18, marginTop: 18, padding: 17, borderRadius: 12, background: "rgba(59,130,246,.07)", color: "#c9d9e8", fontSize: 22 },
  evidenceStrip: { display: "flex", flexWrap: "wrap", gap: 12, marginTop: 24, padding: 18, border: "1px solid rgba(34,197,94,.22)", borderRadius: 14, background: "rgba(34,197,94,.06)", color: "#8fd5a9", fontSize: 18 },
  finalLine: { position: "absolute", left: 120, right: 120, bottom: 60, textAlign: "center", color: "#6f899f", fontSize: 20, zIndex: 12 },
};
