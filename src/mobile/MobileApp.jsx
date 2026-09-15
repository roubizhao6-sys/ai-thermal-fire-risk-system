import { useEffect, useMemo, useRef, useState } from 'react'
import Building3DView from './Building3DView.jsx'
import Campus3DView from './Campus3DView.jsx'
import CampusBuildingPanel from './CampusBuildingPanel.jsx'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Box,
  BellRing,
  Cable,
  Camera,
  CheckCircle2,
  ChevronRight,
  Compass,
  CircleDot,
  Clock3,
  Cpu,
  Crosshair,
  Database,
  Download,
  Edit3,
  Eye,
  Copy,
  Globe2,
  Maximize2,
  Video,
  Flame,
  Gauge,
  Image as ImageIcon,
  Info,
  Layers3,
  Link2,
  LoaderCircle,
  LocateFixed,
  MapPin,
  Navigation,
  Pause,
  Play,
  Plus,
  Radar,
  RadioTower,
  Radio,
  RotateCcw,
  Rotate3D,
  Route,
  Save,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  BrainCircuit,
  ClipboardCheck,
  DoorOpen,
  Megaphone,
  Waves,
  Thermometer,
  Trash2,
  TrendingUp,
  Upload,
  Wifi,
  WifiOff,
  Volume2,
  VolumeX,
  Power,
  Plug,
  MessageCircle,
  Send,
  FileText,
  QrCode,
  Users,
  UserX,
  X,
  Zap,
} from 'lucide-react'

const DEMO_THERMAL = `${import.meta.env.BASE_URL}demo-thermal.jpg`
const DEMO_LIVE = `${import.meta.env.BASE_URL}demo-live.gif`

const tabs = [
  { id: 'home', label: '首页检测', icon: ScanLine },
  { id: 'guide', label: '疏散导航', icon: Compass },
  { id: 'camera', label: '现场监控', icon: Video },
  { id: 'alerts', label: '预警记录', icon: BellRing },
  { id: 'dashboard', label: '数据看板', icon: BarChart3 },
  { id: 'about', label: '关于项目', icon: Layers3 },
]

const QUICK_ACTIONS = [
  { id: 'command', label: '应急指挥', icon: Siren, tone: 'red' },
  { id: 'guide', label: '疏散导航', icon: Compass, tone: 'blue' },
  { id: 'drill', label: '数字演练', icon: ClipboardCheck, tone: 'green' },
  { id: 'gps', label: 'GPS定位', icon: LocateFixed, tone: 'cyan' },
  { id: 'dashboard', label: '数据看板', icon: BarChart3, tone: 'blue' },
  { id: 'inspect', label: '扫码巡检', icon: QrCode, tone: 'orange' },
  { id: 'assistant', label: 'AI精灵', icon: Sparkles, tone: 'purple' },
  { id: 'hazard', label: '隐患上报', icon: Camera, tone: 'orange' },
]

const defaultCameras = [
  { id: 'thermal-board-sim', name: '模拟热成像板', location: '实验室 P11', type: 'sensor', url: 'sensor://esp32-sim', public: true },
  { id: 'demo-live', name: '热感监控演示', location: '三楼东侧走廊', type: 'demo', url: DEMO_LIVE, public: true },
  { id: 'local-phone-cam', name: '本机实景摄像头', location: '手机后置摄像头', type: 'local', url: 'local://camera', public: false },
]

function encodeCamera(camera) {
  const bytes = new TextEncoder().encode(JSON.stringify(camera))
  let binary = ''
  bytes.forEach((byte) => { binary += String.fromCharCode(byte) })
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function decodeCamera(value) {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const binary = atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '='))
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0))
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    return null
  }
}

function initialActiveTab() {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('cmd') === '1') return 'dashboard'
    if (params.get('view') === 'guide' || params.get('guide') === '1') return 'guide'
    if (params.get('camera') || params.get('view') === 'camera') return 'camera'
  } catch {}
  return 'home'
}

function initialCameraView() {
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('scene') === 'campus') return 'campus'
    if (params.get('scene') === 'building') return 'building'
  } catch {}
  return null
}

function initialCameraState() {
  let base = defaultCameras
  try {
    const saved = JSON.parse(localStorage.getItem('thermalGuardCameras') || 'null')
    if (Array.isArray(saved) && saved.length) base = saved
    if (!base.some((camera) => camera.type === 'sensor')) base = [defaultCameras[0], ...base]
    if (!base.some((camera) => camera.type === 'local')) base = [...base, defaultCameras[2]]
  } catch {}
  const shared = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('camera') : null
  const parsed = shared ? decodeCamera(shared) : null
  return parsed?.public && parsed?.url ? [{ ...parsed, id: `shared-${parsed.id || Date.now()}` }, ...base] : base
}

const initialDevices = [
  { id: 'demo-lab', name: '实验室 ESP32', location: '澳门科技大学 P11', url: 'wss://192.168.4.1:81/' },
]

const sampleAlerts = [
  { id: 'sample-1', time: '2026-09-13 19:42:18', risk: 'high', zone: '三楼东侧走廊', temp: 86.4, hotspots: 3 },
  { id: 'sample-2', time: '2026-09-13 16:08:42', risk: 'medium', zone: '仓库北门配电区', temp: 52.8, hotspots: 1 },
  { id: 'sample-3', time: '2026-09-12 21:15:06', risk: 'low', zone: '一楼设备间', temp: 38.6, hotspots: 0 },
]

const trendValues = [42, 46, 44, 51, 48, 55, 59, 57, 63, 68, 66, 72]
const barValues = [72, 58, 44, 31, 26]

function riskTitle(risk) {
  return risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险'
}

function riskAdvice(risk) {
  return risk === 'high' ? '立即疏散' : risk === 'medium' ? '现场核查' : '持续观察'
}

function riskColor(risk) {
  return risk === 'high' ? '#ef4444' : risk === 'medium' ? '#f59e0b' : '#22c55e'
}

function createFrame(phase = 0) {
  const width = 32
  const height = 24
  const temperatures = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / (width - 1)
      const ny = y / (height - 1)
      const drift = Math.sin(phase * 0.055) * 4
      const second = Math.cos(phase * 0.031) * 3
      const base = 27.5 + 3.5 * (1 - ny) + 0.9 * Math.sin(nx * 8)
      const hotA = (60 + drift) * Math.exp(-((nx - 0.35) ** 2 + (ny - 0.34) ** 2) / 0.019)
      const hotB = (39 + second) * Math.exp(-((nx - 0.72) ** 2 + (ny - 0.28) ** 2) / 0.027)
      const hotC = (21 + drift * 0.4) * Math.exp(-((nx - 0.79) ** 2 + (ny - 0.70) ** 2) / 0.031)
      temperatures.push(base + hotA + hotB + hotC)
    }
  }
  const maxTemp = Math.max(...temperatures)
  const minTemp = Math.min(...temperatures)
  const averageTemp = temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
  return {
    width,
    height,
    temperatures,
    minTemp,
    maxTemp,
    averageTemp,
    risk: maxTemp >= 65 ? 'high' : maxTemp >= 45 ? 'medium' : 'low',
    hotspots: [
      { x: 28, y: 24, w: 18, h: 22, temp: maxTemp },
      { x: 64, y: 18, w: 15, h: 20, temp: maxTemp - 12.4 },
      { x: 73, y: 60, w: 14, h: 19, temp: maxTemp - 21.2 },
    ],
    source: '内置模拟热像仪',
  }
}

function normalizePacket(packet) {
  const width = Number(packet.width || 32)
  const height = Number(packet.height || 24)
  let temperatures = Array.isArray(packet.temperatures) ? packet.temperatures.map(Number) : []
  if (temperatures.length !== width * height) temperatures = createFrame().temperatures
  const maxTemp = Number(packet.max_temp ?? packet.maxTemp ?? Math.max(...temperatures))
  const minTemp = Number(packet.min_temp ?? packet.minTemp ?? Math.min(...temperatures))
  return {
    width,
    height,
    temperatures,
    maxTemp,
    minTemp,
    averageTemp: temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length,
    hotspots: (packet.hotspots || []).map((spot) => ({
      x: Number(spot.x || 0) * 100,
      y: Number(spot.y || 0) * 100,
      w: Number(spot.width || 0.15) * 100,
      h: Number(spot.height || 0.18) * 100,
      temp: Number(spot.temp ?? maxTemp),
    })),
    risk: maxTemp >= 65 ? 'high' : maxTemp >= 45 ? 'medium' : 'low',
    source: packet.source || 'ESP32 设备',
  }
}


const buildingGraph = {
  nodes: {
    start: { label: '当前位置', x: 16, y: 72, type: 'zone' },
    west: { label: '西侧通道', x: 36, y: 62, type: 'zone' },
    mid: { label: '走廊中部', x: 52, y: 62, type: 'zone' },
    east: { label: '东侧通道', x: 70, y: 60, type: 'zone' },
    stairs: { label: '东侧安全楼梯', x: 82, y: 44, type: 'exit' },
    north: { label: '北侧安全出口', x: 54, y: 24, type: 'exit' },
    south: { label: '南门出口', x: 22, y: 80, type: 'exit' },
  },
  edges: {
    'start-west': { from: 'start', to: 'west', weight: 9 },
    'start-mid': { from: 'start', to: 'mid', weight: 14 },
    'west-mid': { from: 'west', to: 'mid', weight: 8 },
    'mid-east': { from: 'mid', to: 'east', weight: 9 },
    'east-stairs': { from: 'east', to: 'stairs', weight: 12 },
    'mid-north': { from: 'mid', to: 'north', weight: 15 },
    'east-north': { from: 'east', to: 'north', weight: 14 },
    'start-south': { from: 'start', to: 'south', weight: 6 },
    'west-south': { from: 'west', to: 'south', weight: 10 },
  },
}

function shortestPath(graph, startId, targetIds, blockedIds) {
  const dist = {}
  const prev = {}
  const visited = new Set()
  Object.keys(graph.nodes).forEach((id) => { dist[id] = Infinity })
  dist[startId] = 0
  for (let i = 0; i < Object.keys(graph.nodes).length; i += 1) {
    const candidates = Object.keys(graph.nodes).filter((id) => !visited.has(id) && !blockedIds.has(id))
    if (!candidates.length) break
    candidates.sort((a, b) => dist[a] - dist[b])
    const current = candidates[0]
    if (dist[current] === Infinity) break
    visited.add(current)
    Object.values(graph.edges).forEach((edge) => {
      if (edge.from !== current || blockedIds.has(edge.to)) return
      const next = dist[current] + edge.weight
      if (next < dist[edge.to]) {
        dist[edge.to] = next
        prev[edge.to] = current
      }
    })
  }
  const target = targetIds.slice().sort((a, b) => dist[a] - dist[b])[0]
  const path = []
  let cursor = target
  while (cursor && cursor !== startId) {
    path.unshift(cursor)
    cursor = prev[cursor]
  }
  path.unshift(startId)
  return { path, distance: Number.isFinite(dist[target]) ? dist[target] : 42, target }
}

function planEvacuation(frame, targetId = 'auto') {
  const hotspots = frame?.hotspots || []
  const maxTemp = Number(frame?.maxTemp || 0)
  const first = hotspots[0] || { x: 32, y: 34 }
  const blocked = new Set()
  if (maxTemp >= 65) {
    blocked.add(first.x > 55 ? 'east' : 'west')
    blocked.add(first.x > 55 ? 'stairs' : 'mid')
  } else if (maxTemp >= 45) {
    blocked.add(first.x > 55 ? 'east' : 'west')
  }
  const targets = targetId === 'auto' ? ['stairs', 'north', 'south'] : [targetId]
  const result = shortestPath(buildingGraph, 'start', targets, blocked)
  const from = buildingGraph.nodes[result.path[0]]
  const next = buildingGraph.nodes[result.path[1] || result.path[0]]
  const dx = next.x - from.x
  const dy = next.y - from.y
  const bearing = ((Math.atan2(dx, -dy) * 180 / Math.PI) + 360) % 360
  return {
    ...result,
    bearing: Math.round(bearing),
    distance: Math.round(result.distance * 2.8),
    eta: Math.round(result.distance * 2.1),
    blocked: [...blocked],
    path: result.path,
    steps: result.path.map((id, index) => `${String(index + 1).padStart(2, '0')} ${buildingGraph.nodes[id].label}`),
  }
}

function computeInference(frame, previousFrame, previousInference) {
  const maxTemp = Number(frame?.maxTemp || 0)
  const prevMax = Number(previousFrame?.maxTemp ?? maxTemp)
  const trend = maxTemp - prevMax
  const persistence = Math.max(0, (previousInference?.persistence || 0) + (trend > 0.7 ? 1 : 0))
  const temperatures = frame?.temperatures || []
  const highCells = temperatures.filter((value) => Number(value) >= 65).length
  const coverage = temperatures.length ? highCells / temperatures.length : 0
  const hotspots = frame?.hotspots || []
  const previousHotspot = previousFrame?.hotspots?.[0]
  const currentHotspot = hotspots[0]
  const movement = previousHotspot && currentHotspot
    ? Math.hypot((currentHotspot.x || 0) - (previousHotspot.x || 0), (currentHotspot.y || 0) - (previousHotspot.y || 0))
    : 0
  const confidence = Math.min(0.99, 0.58 + coverage * 32 + Math.min(Math.abs(trend), 8) * 3 + Math.min(persistence, 10) * 2 + (movement > 6 ? 0.02 : 0))
  const stages = [
    { name: '温度轮廓分割', detail: `识别 ${hotspots.length} 个高温区域`, score: Math.round(Math.min(100, 58 + hotspots.length * 12)) },
    { name: '扩散梯度分析', detail: `${trend >= 0 ? '+' : ''}${trend.toFixed(1)}°C / 帧`, score: Math.round(Math.min(100, 52 + Math.abs(trend) * 8)) },
    { name: '持续特征判定', detail: `连续 ${persistence} 帧保持升温`, score: Math.round(Math.min(100, 48 + persistence * 6)) },
    { name: '空间关联分析', detail: movement > 6 ? '热源存在位移' : '热源位置稳定', score: Math.round(Math.min(100, 55 + movement * 3)) },
  ]
  const reasons = [
    `最高温度 ${maxTemp.toFixed(1)}°C，${frame?.risk === 'high' ? '超过高风险阈值 65°C' : frame?.risk === 'medium' ? '处于中风险区间 45–65°C' : '低于预警阈值 45°C'}`,
    `温度变化 ${trend >= 0 ? '+' : ''}${trend.toFixed(1)}°C，${trend > 1.5 ? '上升速度较快' : '变化相对平缓'}`,
    `高温像素占比 ${(coverage * 100).toFixed(1)}%，${hotspots.length} 处空间聚集热区`,
  ]
  return { maxTemp, trend, persistence, coverage, confidence, stages, reasons }
}

function evidenceForAlert(alert, inference) {
  const risk = alert?.risk || 'low'
  const temp = Number(alert?.temp || 0)
  const hotspots = alert?.hotspots || 0
  const confidence = inference ? Math.round(inference.confidence * 100) : risk === 'high' ? 94 : risk === 'medium' ? 81 : 62
  return [
    { time: '00:00', title: '热成像检测触发', detail: `检测到最高温度 ${temp.toFixed(1)}°C` },
    { time: '00:01', title: '高温区域定位', detail: `识别 ${hotspots} 个疑似高温区域，完成空间坐标映射` },
    { time: '00:02', title: 'AI 多维推理', detail: `综合温度轮廓、扩散梯度与持续特征，置信度 ${confidence}%` },
    { time: '00:03', title: '风险等级判定', detail: `${riskTitle(risk)} · ${riskAdvice(risk)}` },
    { time: '00:04', title: '证据归档', detail: '温度快照、区域坐标与处置建议已写入本地日志' },
  ]
}

function ConnectionBadge({ state }) {
  const text = state === 'connected' ? '设备在线' : state === 'connecting' ? '连接中' : state === 'failed' ? '连接失败' : '模拟运行'
  return <span className={`connection-badge state-${state}`}><i />{text}</span>
}

function RiskBadge({ risk, compact = false }) {
  return <span className={`risk-badge risk-${risk} ${compact ? 'compact' : ''}`}><i />{riskTitle(risk)}</span>
}

function DeviceSheet({ devices, activeDevice, connection, error, onClose, onConnect, onDisconnect, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', url: '' })
  const editingDevice = editing && typeof editing === 'object' ? editing : null
  const valid = form.name.trim() && /^wss?:\/\//i.test(form.url.trim())

  const openForm = (device) => {
    setEditing(device || 'new')
    setForm(device ? { name: device.name, location: device.location, url: device.url } : { name: '', location: '', url: '' })
  }

  if (editing) {
    return (
      <div className="sheet-backdrop" onClick={onClose}>
        <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <div className="sheet-head">
            <div><span>硬件设置</span><strong>{editingDevice ? '编辑设备' : '添加设备'}</strong></div>
            <button type="button" onClick={() => setEditing(null)}><ArrowLeft size={18} /></button>
          </div>
          <label>设备名称<input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="例如：实验楼 ESP32" /></label>
          <label>设备位置<input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="例如：三楼东侧走廊" /></label>
          <label>WebSocket 地址<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="wss://设备地址:81/" inputMode="url" autoCapitalize="none" /></label>
          <div className="sheet-tip"><Info size={14} />手机网页使用 HTTPS 时通常只能连接 wss:// 地址；普通 ws:// 可在 Mac App 中使用。</div>
          <button className="sheet-save" type="button" disabled={!valid} onClick={() => { onSave(editingDevice?.id, { name: form.name.trim(), location: form.location.trim(), url: form.url.trim() }); setEditing(null) }}><Save size={16} />保存设备</button>
        </section>
      </div>
    )
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div><span>硬件设置</span><strong>设备管理</strong></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="simulator-row"><span><Cpu size={19} /></span><div><strong>内置模拟热像仪</strong><small>无需硬件即可演示</small></div><button type="button" onClick={onDisconnect}>运行</button></div>
        <div className="sheet-section-title"><strong>已添加设备</strong><button type="button" onClick={() => openForm(null)}><Plus size={15} />添加</button></div>
        {devices.map((device) => {
          const active = activeDevice?.id === device.id
          return (
            <article className={`device-row ${active ? 'active' : ''}`} key={device.id}>
              <div className="device-row-main"><span><Wifi size={18} /></span><div><strong>{device.name}</strong><small>{device.location || '未设置位置'}</small><code>{device.url}</code></div><em>{active && connection === 'connected' ? '在线' : '离线'}</em></div>
              <div className="device-row-actions">
                <button type="button" onClick={() => active && connection === 'connected' ? onDisconnect() : onConnect(device)}>{active && connection === 'connected' ? <WifiOff size={14} /> : <Link2 size={14} />}{active && connection === 'connected' ? '断开' : '连接'}</button>
                <button type="button" onClick={() => openForm(device)}><Edit3 size={14} />编辑</button>
                <button type="button" onClick={() => onDelete(device.id)}><Trash2 size={14} />删除</button>
              </div>
            </article>
          )
        })}
        {error && <div className="device-error"><AlertTriangle size={15} />{error}</div>}
        <div className="sheet-tip protocol-tip"><Database size={14} />设备每帧发送 width、height、max_temp、risk、temperatures 和 hotspots 字段。</div>
      </section>
    </div>
  )
}

function HeatPreview({ image, result, detected, detecting }) {
  return (
    <div className={`heat-preview ${image ? 'has-image' : ''}`}>
      {image ? (
        <>
          <img src={image} alt="热成像检测预览" />
          <div className="heat-grid" />
          <div className="heat-scan" />
          <div className="preview-tag"><span />热成像输入</div>
          {detected && result.hotspots.slice(0, 3).map((spot, index) => (
            <div className="heat-box" key={index} style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%`, '--delay': `${index * 160}ms` }}>
              <span>热区 {String(index + 1).padStart(2, '0')}</span><b>{spot.temp.toFixed(1)}°C</b>
            </div>
          ))}
        </>
      ) : (
        <div className="upload-empty"><span><ImageIcon size={33} /></span><strong>等待热成像图片</strong><p>拍摄或从相册选择图片后开始检测</p></div>
      )}
    </div>
  )
}

function RiskLevelCard({ risk, active }) {
  const title = riskTitle(risk)
  const advice = riskAdvice(risk)
  const Icon = risk === 'high' ? ShieldAlert : risk === 'medium' ? AlertTriangle : ShieldCheck
  return (
    <article className={`level-card level-${risk} ${active ? 'active' : ''}`}>
      <span><Icon size={18} /></span><div><strong>{title}</strong><small>{advice}</small></div>{active && <CheckCircle2 size={17} />}
    </article>
  )
}

function HomePage({ inputCameraRef, inputGalleryRef, image, fileName, detecting, progress, detected, result, inference, onImage, onSample, onReset, onDetect, onQuickNav }) {
  return (
    <div className="mobile-page home-page">
      <header className="home-header">
        <div className="guard-pill"><Sparkles size={13} />AI 火警网警</div>
        <h1>燧瞳智感</h1>
        <p>超早期温度预警 · 多维度智能判断</p>
      </header>

      <section className="quick-nav">
        <div className="quick-nav-head"><strong>快捷功能</strong><small>一键直达</small></div>
        <div className="quick-grid">
          {QUICK_ACTIONS.map(({ id, label, icon: Icon, tone }) => <button type="button" key={id} className={`quick-card tone-${tone}`} onClick={() => onQuickNav(id)}><Icon size={18} /><span>{label}</span></button>)}
        </div>
      </section>

      <section className="detect-card">
        <div className="card-head"><div><strong>热成像图片检测</strong><small>火焰出现前捕捉异常温升</small></div><button type="button" onClick={onSample}>载入示例</button></div>
        <HeatPreview image={image} result={result} detected={detected} detecting={detecting} />
        <div className="capture-actions">
          <button type="button" onClick={() => inputCameraRef.current?.click()}><Camera size={16} />拍摄热成像图</button>
          <button type="button" onClick={() => inputGalleryRef.current?.click()}><Upload size={16} />上传图片</button>
        </div>
        <input ref={inputCameraRef} type="file" accept="image/*" capture="environment" onChange={(e) => onImage(e.target.files?.[0])} />
        <input ref={inputGalleryRef} type="file" accept="image/*" onChange={(e) => onImage(e.target.files?.[0])} />
        <div className="image-meta"><span>{fileName || '尚未选择图片'}</span>{image && <button type="button" onClick={onReset}><RotateCcw size={13} />重置</button>}</div>
        <button className="detect-button" type="button" disabled={!image || detecting} onClick={onDetect}>
          {detecting ? <LoaderCircle className="spin" size={18} /> : <ScanLine size={18} />}{detecting ? 'AI 正在检测' : '开始 AI 检测'}
        </button>
        {detecting && <div className="progress-wrap"><div><span style={{ width: `${progress}%` }} /></div><small>{progress}% · 温度轮廓与扩散梯度分析中</small></div>}
      </section>

      {detected && (
        <section className="result-reveal">
          <div className="result-title"><div><span>AI检测结果</span><strong>{riskTitle(result.risk)}</strong></div><RiskBadge risk={result.risk} /></div>
          <div className="level-grid">
            <RiskLevelCard risk="low" active={result.risk === 'low'} />
            <RiskLevelCard risk="medium" active={result.risk === 'medium'} />
            <RiskLevelCard risk="high" active={result.risk === 'high'} />
          </div>
          <div className="detail-grid">
            <div><MapPin size={17} /><span>高温区域</span><strong>{result.hotspots.length} 处</strong></div>
            <div><Thermometer size={17} /><span>最高温度</span><strong>{result.maxTemp.toFixed(1)}°C</strong></div>
            <div><Crosshair size={17} /><span>区域坐标</span><strong>X 31%/Y 24%</strong></div>
          </div>
          <div className="ai-explain"><span><Cpu size={17} /></span><div><strong>AI判断说明</strong><p>基于温度轮廓、扩散梯度、持续特征多维度综合分析，区分正常热源与火灾隐患，有效降低误报率。</p></div></div>
          {inference && <div className="ai-inference-card">
            <div className="ai-inference-head"><div><strong>AI推理引擎</strong><small>轻量化边缘推理 · 时序确认</small></div><span>{(inference.confidence * 100).toFixed(0)}%</span></div>
            <div className="confidence-track"><i style={{ width: `${inference.confidence * 100}%` }} /></div>
            <div className="ai-stage-grid">{inference.stages.map((stage) => <div key={stage.name}><span>{stage.name}</span><strong>{stage.detail}</strong><em>{stage.score}%</em></div>)}</div>
          </div>}
          <div className="early-warning"><Zap size={15} />可在明火、烟雾出现前识别温度异常，实现灾前预警。</div>
        </section>
      )}
    </div>
  )
}

function AlertsPage({ alerts, onExportEvidence }) {
  const [riskFilter, setRiskFilter] = useState('全部')
  const [timeFilter, setTimeFilter] = useState('全部时间')
  const [selected, setSelected] = useState(null)
  const filtered = alerts.filter((item) => riskFilter === '全部' || item.risk === (riskFilter === '高风险' ? 'high' : riskFilter === '中风险' ? 'medium' : 'low'))

  if (selected) {
    return (
      <div className="mobile-page">
        <button className="back-button" type="button" onClick={() => setSelected(null)}><ArrowLeft size={16} />返回记录</button>
        <section className="alert-detail-card">
          <div className="alert-detail-head"><RiskBadge risk={selected.risk} /><span>{selected.time}</span></div>
          <img src={DEMO_THERMAL} alt="历史热成像记录" />
          <h2>{selected.zone}{selected.eventType === 'drill' && <em className="drill-detail-tag">{selected.rating || '演练'} · {selected.score ?? '-'} 分</em>}</h2>
          {selected.eventType === 'drill' ? (
            <div className="drill-detail-metrics">
              <div><Clock3 size={15} /><span>撤离用时</span><strong>{selected.seconds ?? 0} 秒</strong></div>
              <div><DoorOpen size={15} /><span>使用出口</span><strong>{selected.exitLabel || '安全出口'}</strong></div>
              <div><Route size={15} /><span>路线距离</span><strong>{selected.distance ?? 0} m</strong></div>
              <div><ClipboardCheck size={15} /><span>完成动作</span><strong>{selected.stepCount ?? 0}/{selected.totalSteps ?? 4}</strong></div>
            </div>
          ) : (
            <div className="detail-grid alert-detail-grid"><div><Thermometer size={16} /><span>最高温度</span><strong>{selected.temp.toFixed(1)}°C</strong></div><div><MapPin size={16} /><span>高温区域</span><strong>{selected.hotspots} 处</strong></div></div>
          )}
          <div className="advice-box"><ShieldAlert size={18} /><div><strong>{selected.eventType === 'drill' ? '演练评语' : riskAdvice(selected.risk)}</strong><p>{selected.eventType === 'drill' ? `${selected.rating ? `本次演练评级 ${selected.rating}。` : ''}响应用时 ${selected.seconds ?? 0} 秒，完成 ${selected.stepCount ?? 0}/${selected.totalSteps ?? 4} 项安全动作，经由${selected.exitLabel || '安全出口'}撤离。` : (selected.risk === 'high' ? '立即核查电源、设备与周边可燃物，确认疏散通道畅通。' : selected.risk === 'medium' ? '安排人员现场检查设备运行状态，持续观察温升趋势。' : '当前无明显异常，保持规律巡检。')}</p></div></div>
          <section className="evidence-card">
            <div className="card-head"><div><strong>事后证据链</strong><small>自动留存的完整处置时间线</small></div><Database size={18} /></div>
            <div className="evidence-list">{evidenceForAlert(selected, selected.inference).map((item, index) => <div className="evidence-row" key={`${item.time}-${index}`}><i>{String(index + 1).padStart(2, '0')}</i><div><strong>{item.title}</strong><p>{item.detail}</p></div><span>{item.time}</span></div>)}</div>
            <button type="button" className="evidence-export" onClick={() => onExportEvidence(selected)}><Download size={15} />导出证据链报告</button>
          </section>
        </section>
      </div>
    )
  }

  return (
    <div className="mobile-page">
      <header className="page-heading"><span>预警记录</span><h1>检测日志</h1><p>自动留存检测日志，支持事后回溯分析起火原因与蔓延过程</p></header>
      <div className="filter-row">{['全部', '高风险', '中风险', '低风险'].map((item) => <button type="button" className={riskFilter === item ? 'active' : ''} key={item} onClick={() => setRiskFilter(item)}>{item}</button>)}</div>
      <div className="filter-row secondary">{['全部时间', '今天', '最近7天'].map((item) => <button type="button" className={timeFilter === item ? 'active' : ''} key={item} onClick={() => setTimeFilter(item)}>{item}</button>)}</div>
      {filtered.map((item) => (
        <button className={`alert-list-card alert-${item.risk}`} type="button" key={item.id} onClick={() => setSelected(item)}>
          <span className={`alert-icon ${item.eventType === 'drill' ? 'drill' : ''}`}>{item.eventType === 'drill' ? <ShieldCheck size={18} /> : <AlertTriangle size={18} />}</span>
          <div><strong>{item.zone}</strong><small>{item.time}</small><em>{item.eventType === 'drill' ? `演练得分 ${item.score ?? '-'} · 用时 ${item.seconds ?? 0} 秒 · ${item.rating || ''}` : `${item.hotspots} 个高温区域 · 最高 ${item.temp.toFixed(1)}°C`}</em></div>
          <RiskBadge risk={item.risk} compact /><ChevronRight size={16} />
        </button>
      ))}
      {!filtered.length && <div className="empty-state"><ShieldCheck size={38} /><strong>没有符合条件的记录</strong><p>调整时间或风险等级筛选后再查看。</p></div>}
    </div>
  )
}

function LineChart() {
  const width = 320
  const height = 130
  const max = Math.max(...trendValues)
  const min = Math.min(...trendValues)
  const points = trendValues.map((value, index) => {
    const x = 10 + (index / (trendValues.length - 1)) * 300
    const y = 112 - ((value - min) / Math.max(max - min, 1)) * 92
    return [x, y]
  })
  const line = points.map(([x, y]) => `${x},${y}`).join(' ')
  const area = `10,118 ${line} 310,118`
  return <svg className="line-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"><defs><linearGradient id="chart-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#38bdf8" stopOpacity=".34" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></linearGradient></defs><polygon points={area} fill="url(#chart-fill)" /><polyline points={line} fill="none" stroke="#38bdf8" strokeWidth="3" vectorEffect="non-scaling-stroke" />{points.map(([x, y], index) => <circle key={index} cx={x} cy={y} r="2.5" fill="#07101e" stroke="#38bdf8" strokeWidth="2" />)}</svg>
}


function directionLabel(degree) {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return labels[Math.round(((degree % 360) + 360) % 360 / 45) % 8]
}

function shortestTurn(target, heading) {
  return ((target - heading + 540) % 360) - 180
}

const CAMPUS_BOUNDS = { minLat: 22.1495, maxLat: 22.1555, minLng: 113.5605, maxLng: 113.5685 }

const SAFE_POINTS = [
  { id: 'gate', name: '主校门集合点', lat: 22.1522, lng: 113.5630 },
  { id: 'library', name: '图书馆广场', lat: 22.1533, lng: 113.5643 },
  { id: 'gym', name: '体育馆疏散点', lat: 22.1514, lng: 113.5649 },
  { id: 'academic', name: '教学楼避难区', lat: 22.1543, lng: 113.5652 },
  { id: 'dorm', name: '学生宿舍安全区', lat: 22.1506, lng: 113.5624 },
]

function distanceMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

function bearingBetween(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180
  const toDeg = (rad) => (rad * 180) / Math.PI
  const y = Math.sin(toRad(lng2 - lng1)) * Math.cos(toRad(lat2))
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lng2 - lng1))
  return (toDeg(Math.atan2(y, x)) + 360) % 360
}

function projectToMap(lat, lng) {
  const { minLat, maxLat, minLng, maxLng } = CAMPUS_BOUNDS
  const x = ((lng - minLng) / (maxLng - minLng)) * 100
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100
  return { x, y, inside: x >= 0 && x <= 100 && y >= 0 && y <= 100 }
}

function formatDistance(meters) {
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} km` : `${Math.round(meters)} m`
}


function CompassRouteMap({ route }) {
  const nodes = buildingGraph.nodes
  const path = route?.path || ['start', 'mid', 'stairs']
  const blocked = new Set(route?.blocked || [])
  return (
    <div className="compass-route-map">
      <svg viewBox="0 0 100 82" aria-label="疏散路线简图">
        <rect x="7" y="7" width="86" height="68" rx="7" fill="#071426" stroke="#2f6ba3" strokeOpacity=".42" />
        {Object.values(buildingGraph.edges).map((edge) => {
          const a = nodes[edge.from]
          const b = nodes[edge.to]
          const hot = blocked.has(edge.from) || blocked.has(edge.to)
          return <line key={`${edge.from}-${edge.to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={hot ? '#ef4444' : '#3b82f6'} strokeOpacity={hot ? '.7' : '.22'} strokeWidth={hot ? '1' : '.6'} strokeDasharray={hot ? '2 1' : ''} />
        })}
        <polyline points={path.map((id) => `${nodes[id].x},${nodes[id].y}`).join(' ')} fill="none" stroke="#22c55e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2"><animate attributeName="stroke-dashoffset" from="8" to="0" dur="1.2s" repeatCount="indefinite" /></polyline>
        {path.map((id, index) => <g key={id}><circle cx={nodes[id].x} cy={nodes[id].y} r={index === 0 ? '2.6' : '1.8'} fill={nodes[id].type === 'exit' ? '#22c55e' : '#38bdf8'} /><text x={nodes[id].x} y={nodes[id].y + 6} textAnchor="middle" fontSize="4" fill="#cfe4f7">{nodes[id].label}</text></g>)}
      </svg>
    </div>
  )
}

function GpsPanel() {
  const watchRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [position, setPosition] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => () => {
    if (watchRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current)
    }
  }, [])

  const start = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) { setStatus('unsupported'); return }
    setStatus('requesting')
    setError('')
    navigator.vibrate?.(40)
    watchRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          ts: pos.timestamp,
        })
        setStatus('active')
      },
      (err) => {
        setStatus(err && err.code === 1 ? 'denied' : 'error')
        setError(err?.message || '定位失败')
      },
      { enableHighAccuracy: true, maximumAge: 4000, timeout: 15000 }
    )
  }

  const stop = () => {
    if (watchRef.current != null && typeof navigator !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.clearWatch(watchRef.current)
    }
    watchRef.current = null
    setStatus('idle')
  }

  const ranked = position
    ? SAFE_POINTS.map((point) => ({
        ...point,
        distance: distanceMeters(position.lat, position.lng, point.lat, point.lng),
        bearing: bearingBetween(position.lat, position.lng, point.lat, point.lng),
      })).sort((a, b) => a.distance - b.distance)
    : []
  const nearest = ranked[0]
  const projected = position ? projectToMap(position.lat, position.lng) : null
  const userPoint = projected ? { x: Math.max(4, Math.min(96, projected.x)), y: Math.max(4, Math.min(96, projected.y)) } : null
  const nearestPoint = nearest ? projectToMap(nearest.lat, nearest.lng) : null
  const updateText = position ? new Date(position.ts).toLocaleTimeString('zh-CN', { hour12: false }) : ''

  return (
    <section className="mobile-card gps-card">
      <div className="card-head"><div><strong>手机 GPS 实时定位</strong><small>读取当前位置，计算到最近安全点的距离与方向</small></div><LocateFixed size={18} /></div>

      {status !== 'active' && (
        <div className="gps-idle">
          <p>开启后可读取手机真实 GPS 坐标，结合校园安全点计算撤离距离与方位，位置仅在本机使用、不会上传。</p>
          <button type="button" className="gps-start" onClick={start} disabled={status === 'requesting'}><LocateFixed size={16} />{status === 'requesting' ? '正在定位…' : '开启手机 GPS 定位'}</button>
          {status === 'denied' && <div className="gps-warn">定位权限被拒绝，请在系统设置中允许位置访问后重试。</div>}
          {status === 'unsupported' && <div className="gps-warn">当前浏览器不支持定位，请使用 Safari 或 Chrome 打开。</div>}
          {status === 'error' && <div className="gps-warn">定位失败：{error || '请检查网络与定位服务'}</div>}
        </div>
      )}

      {status === 'active' && position && userPoint && (
        <div className="gps-active">
          <div className="gps-coord-grid">
            <div><span>纬度</span><strong>{position.lat.toFixed(6)}</strong></div>
            <div><span>经度</span><strong>{position.lng.toFixed(6)}</strong></div>
            <div><span>定位精度</span><strong>±{Math.round(position.accuracy)} m</strong></div>
            <div><span>海拔</span><strong>{position.altitude != null ? `${Math.round(position.altitude)} m` : '—'}</strong></div>
          </div>
          <div className="gps-meta"><span><i />实时定位中 · 更新 {updateText}</span><b>{projected.inside ? '位于校园范围内' : '当前距离校园较远'}</b></div>

          <div className="gps-map">
            <svg viewBox="0 0 100 80" aria-label="GPS 定位示意图">
              <defs><filter id="gps-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="1.6" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter></defs>
              <rect x="6" y="6" width="88" height="68" rx="6" fill="#04101f" stroke="#2f6ba3" strokeOpacity=".42" />
              <path d="M6 40 H94 M50 6 V74" stroke="#3b82f6" strokeOpacity=".12" />
              {SAFE_POINTS.map((point) => {
                const p = projectToMap(point.lat, point.lng)
                return <g key={point.id}><circle cx={p.x} cy={p.y} r="1.7" fill="#22c55e" /><text x={p.x + 2.3} y={p.y + 1.2} fontSize="3.3" fill="#9fd8b6">{point.name}</text></g>
              })}
              {nearest && nearestPoint && <line x1={userPoint.x} y1={userPoint.y} x2={nearestPoint.x} y2={nearestPoint.y} stroke="#f59e0b" strokeWidth=".7" strokeDasharray="2 1.4" />}
              <circle cx={userPoint.x} cy={userPoint.y} r="3.2" fill="#38bdf8" opacity=".25"><animate attributeName="r" values="2.4;4.6;2.4" dur="1.8s" repeatCount="indefinite" /></circle>
              <circle cx={userPoint.x} cy={userPoint.y} r="1.8" fill="#38bdf8" filter="url(#gps-glow)" />
              <text x={userPoint.x + 2.8} y={userPoint.y - 1.6} fontSize="3.5" fill="#bfe6ff">当前位置</text>
            </svg>
          </div>

          <div className="gps-safe-list">
            {ranked.map((item, index) => (
              <div className={`gps-safe-row ${index === 0 ? 'nearest' : ''}`} key={item.id}>
                <span className="gps-safe-badge">{index === 0 ? '最近' : index + 1}</span>
                <div><strong>{item.name}</strong><small>{formatDistance(item.distance)} · 方向 {directionLabel(item.bearing)} {Math.round(item.bearing)}°</small></div>
                {index === 0 && <Navigation size={15} style={{ transform: `rotate(${item.bearing}deg)` }} />}
              </div>
            ))}
          </div>

          <div className="gps-actions">
            <button type="button" onClick={() => window.open(`https://maps.apple.com/?ll=${position.lat},${position.lng}&q=${encodeURIComponent('当前位置')}`, '_blank')}><MapPin size={14} />在地图中查看</button>
            <button type="button" onClick={stop}><X size={14} />停止定位</button>
          </div>
          <p className="gps-note"><Info size={12} />安全点为演示参考坐标，可在代码中替换为真实校园出口坐标；GPS 数据仅在本机使用。</p>
        </div>
      )}
    </section>
  )
}

function CompassPage({ frame }) {
  const targets = [
    { id: 'stairs', label: '东侧安全楼梯', icon: '↗' },
    { id: 'north', label: '北侧安全出口', icon: '↑' },
    { id: 'south', label: '南门出口', icon: '↙' },
  ]
  const [target, setTarget] = useState('stairs')
  const [heading, setHeading] = useState(24)
  const [tracking, setTracking] = useState(false)
  const [permission, setPermission] = useState('prompt')
  const [voiceOn, setVoiceOn] = useState(false)
  const [mode, setMode] = useState('compass')
  const route = useMemo(() => planEvacuation(frame, target), [frame, target])
  const targetRoutes = useMemo(() => targets.map((item) => ({ ...item, route: planEvacuation(frame, item.id) })), [frame])

  useEffect(() => {
    if (!tracking) return undefined
    const handler = (event) => {
      const raw = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : Number(event.alpha)
      if (Number.isFinite(raw)) setHeading((raw + 360) % 360)
    }
    window.addEventListener('deviceorientationabsolute', handler, true)
    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true)
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [tracking])

  const enableCompass = async () => {
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission()
        setPermission(result)
        if (result !== 'granted') return
      } else {
        setPermission('granted')
      }
      setTracking(true)
      navigator.vibrate?.(80)
      try { await navigator.wakeLock?.request('screen') } catch {}
    } catch {
      setPermission('denied')
    }
  }

  const turn = shortestTurn(route?.bearing ?? 42, heading)
  const turnText = Math.abs(turn) < 15
    ? '保持当前方向直行'
    : turn > 0
      ? `向右转 ${Math.round(Math.abs(turn))}°`
      : `向左转 ${Math.round(Math.abs(turn))}°`
  const speak = () => {
    try {
      const utterance = new SpeechSynthesisUtterance(`请前往${targets.find((item) => item.id === target)?.label}，${turnText}，距离${route?.distance}米，预计${route?.eta}秒。`)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.95
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      navigator.vibrate?.([160, 80, 240])
      setVoiceOn(true)
      window.setTimeout(() => setVoiceOn(false), 3800)
    } catch {}
  }

  return (
    <div className="mobile-page compass-page">
      <header className="page-heading compass-heading"><span>疏散导航</span><h1>指南针逃生路线</h1><p>实时磁力计、动态风险路线与语音引导</p></header>
      <div className="compass-mode-switch"><button type="button" className={mode === 'compass' ? 'active' : ''} onClick={() => setMode('compass')}><Compass size={14} />指南针导航</button><button type="button" className={mode === 'ar' ? 'active' : ''} onClick={() => setMode('ar')}><Camera size={14} />AR实景导航</button></div>
      {mode === 'compass' && <section className="compass-hero-card">
        <div className="compass-page-dial" style={{ '--heading': `${-heading}deg`, '--turn': `${turn}deg` }}>
          <span className="compass-n">N</span><span className="compass-e">E</span><span className="compass-s">S</span><span className="compass-w">W</span>
          <i className="compass-page-ring" />
          <b className="compass-page-arrow"><Navigation size={28} /></b>
          <em />
          <strong>{Math.round(heading)}°</strong>
          <small>{directionLabel(heading)}</small>
        </div>
        <div className="compass-main-copy">
          <span className={`route-risk route-${frame?.risk || 'low'}`}>{riskTitle(frame?.risk || 'low')} · 动态路线</span>
          <h2>{turnText}</h2>
          <p>前往 {targets.find((item) => item.id === target)?.label}</p>
          <div className="compass-main-stats"><span><Route size={13} />{route?.distance} 米</span><span><Clock3 size={13} />约 {route?.eta} 秒</span><span><Compass size={13} />{Math.round(route?.bearing ?? 42)}°</span></div>
        </div>
      </section>}

      {mode === 'ar' && <ArEvacuationView route={route} risk={frame?.risk || 'low'} />}
      {mode === 'compass' && !tracking && <button type="button" className="compass-enable compass-enable-large" onClick={enableCompass}><Compass size={16} />开启手机指南针并开始引导</button>}
      {mode === 'compass' && <div className="compass-status compass-status-page"><span><i className={tracking ? 'online' : ''} />{tracking ? `实时方向 ${Math.round(heading)}°` : permission === 'denied' ? '未授权，使用模拟方向演示' : '当前为模拟方向'}</span><b>最高温 {Number(frame?.maxTemp || 0).toFixed(1)}°C</b></div>}

      <GpsPanel />

      <div className="section-title"><strong>选择最近安全出口</strong><span>根据风险动态排序</span></div>
      <div className="exit-choice-list">
        {targetRoutes.sort((a, b) => a.route.eta - b.route.eta).map((item, index) => (
          <button type="button" className={target === item.id ? 'active' : ''} key={item.id} onClick={() => setTarget(item.id)}>
            <span>{index === 0 ? '推荐' : item.icon}</span><div><strong>{item.label}</strong><small>{item.route.distance} 米 · {item.route.eta} 秒</small></div><b>{index + 1}</b>
          </button>
        ))}
      </div>

      <CompassRouteMap route={route} />

      <section className="mobile-card compass-route-steps-card">
        <div className="card-head"><div><strong>实时疏散步骤</strong><small>路线会随热区和封控节点重算</small></div><Route size={18} /></div>
        <div className="command-route-steps">{route?.steps?.map((step) => <span key={step}>{step}</span>)}</div>
      </section>

      <div className="compass-action-bar">
        <button type="button" className={voiceOn ? 'active' : ''} onClick={speak}><Megaphone size={16} />{voiceOn ? '语音播报中' : '语音导航'}</button>
        <a href="tel:119"><Siren size={16} />拨打119</a>
        <button type="button" onClick={() => { navigator.vibrate?.([300, 100, 300]); setHeading((value) => (value + 180) % 360) }}><Waves size={16} />震动提醒</button>
      </div>
    </div>
  )
}


function ArEvacuationView({ route, risk }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const [heading, setHeading] = useState(24)
  const targetId = route?.path?.[route.path.length - 1]
  const targetLabel = buildingGraph.nodes[targetId]?.label || '最近安全出口'
  const bearing = Math.round(route?.bearing ?? 42)
  const turn = shortestTurn(bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '保持当前方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => {
    if (status !== 'active') return undefined
    const handler = (event) => {
      const raw = Number.isFinite(event.webkitCompassHeading) ? event.webkitCompassHeading : Number(event.alpha)
      if (Number.isFinite(raw)) setHeading((raw + 360) % 360)
    }
    window.addEventListener('deviceorientationabsolute', handler, true)
    window.addEventListener('deviceorientation', handler, true)
    return () => {
      window.removeEventListener('deviceorientationabsolute', handler, true)
      window.removeEventListener('deviceorientation', handler, true)
    }
  }, [status])

  useEffect(() => {
    if (status !== 'active') return undefined
    const video = videoRef.current
    if (!video || !streamRef.current) return undefined
    video.srcObject = streamRef.current
    video.play().catch(() => {})
    return undefined
  }, [status])

  useEffect(() => () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
  }, [])

  const start = async () => {
    setStatus('requesting')
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        await DeviceOrientationEvent.requestPermission()
      }
    } catch {}
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      setStatus('active')
      navigator.vibrate?.(40)
    } catch {
      setStatus('denied')
    }
  }

  const stop = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setStatus('idle')
  }

  return (
    <div className="ar-evac-view">
      <div className="ar-evac-head"><div><strong>AR 实景逃生导航</strong><small>调用手机摄像头，在实景中标出逃生方向</small></div><Camera size={18} /></div>

      {status !== 'active' && (
        <div className="ar-evac-idle">
          <p>开启后，摄像头画面会实时叠加指南针方位与逃生方向箭头，带你沿推荐路线撤离。</p>
          <button type="button" className="ar-start-btn" onClick={start} disabled={status === 'requesting'}><Camera size={16} />{status === 'requesting' ? '正在请求权限…' : '打开摄像头实景导航'}</button>
          {status === 'denied' && <div className="ar-state warn">摄像头或方向权限被拒绝，请在系统设置中允许后再试。</div>}
          {status === 'unsupported' && <div className="ar-state warn">当前浏览器不支持摄像头调用，请使用 Safari 或 Chrome。</div>}
        </div>
      )}

      {status === 'active' && (
        <div className="ar-stage">
          <video ref={videoRef} className="ar-video" autoPlay playsInline muted />
          <div className="ar-overlay">
            <div className="ar-top">
              <span className={`route-risk route-${risk || 'low'}`}>{riskTitle(risk || 'low')} · 动态路线</span>
              <span className="ar-target"><Navigation size={13} />{targetLabel}</span>
            </div>
            <div className="ar-arrow-wrap" style={{ transform: `rotate(${turn}deg)` }}>
              <Navigation size={56} className="ar-arrow" />
              <span className="ar-turn-angle">{Math.abs(turn) < 15 ? '0°' : `${Math.round(Math.abs(turn))}°`}</span>
            </div>
            <div className="ar-center-text"><strong>{turnText}</strong><p>{Math.round(heading)}° 当前朝向 · 出口方位 {bearing}°</p></div>
            <div className="ar-bottom">
              <div className="ar-mini-compass" style={{ '--heading': `${-heading}deg` }}>
                <span className="ar-cn">N</span><span className="ar-ce">E</span><span className="ar-cs">S</span><span className="ar-cw">W</span>
                <i className="ar-mini-ring" />
              </div>
              <div className="ar-metrics">
                <span><Route size={13} />{route?.distance} 米</span>
                <span><Clock3 size={13} />约 {route?.eta} 秒</span>
                <span><Compass size={13} />{bearing}°</span>
              </div>
            </div>
          </div>
          <button type="button" className="ar-stop-btn" onClick={stop}><X size={15} />关闭摄像头</button>
        </div>
      )}
      <p className="ar-evac-note"><ShieldAlert size={12} />AR 引导为科研演示辅助功能，请结合现场标识与工作人员指挥撤离。</p>
    </div>
  )
}

function Thermal3DScene({ frame, camera }) {
  const fallbackHotspots = [
    { x: 28, y: 24, temp: frame?.maxTemp || 72 },
    { x: 64, y: 30, temp: (frame?.maxTemp || 72) - 13 },
  ]
  const hotspots = frame?.hotspots?.length ? frame.hotspots : fallbackHotspots
  const maxTemp = Number(frame?.maxTemp || 0)

  return (
    <div className="thermal-3d-view">
      <div className="scene-vignette" />
      <div className="scene-room">
        <div className="scene-back-wall">
          <span /><span /><span /><span /><span /><span />
        </div>
        <div className="scene-left-wall" />
        <div className="scene-right-wall" />
        <div className="scene-floor">
          <i className="scene-route-line" />
        </div>
        <div className="scene-sensor">
          <RadioTower size={15} />
          <span>32×24</span>
        </div>
        {hotspots.slice(0, 3).map((spot, index) => (
          <div
            className={`scene-hotspot scene-hotspot-${index + 1}`}
            key={`${spot.x}-${spot.y}-${index}`}
            style={{
              left: `${17 + (Number(spot.x || 0) / 100) * 56}%`,
              top: `${30 + (Number(spot.y || 0) / 100) * 27}%`,
              '--spot-color': Number(spot.temp || maxTemp) >= 65 ? '#ff3b30' : '#ff9d2e',
            }}
          >
            <i />
            <span>{Number(spot.temp || maxTemp).toFixed(1)}°</span>
          </div>
        ))}
        <div className="scene-scan-plane" />
      </div>
      <div className="scene-hud scene-hud-top">
        <span><Rotate3D size={13} />3D 热感重建</span>
        <b>{frame?.width || 32}×{frame?.height || 24} · 3.1 帧/秒</b>
      </div>
      <div className="scene-hud scene-hud-bottom">
        <span><i />{camera?.name || '热成像板'} · {camera?.location || '实时联动'}</span>
        <b>最高 {maxTemp.toFixed(1)}°C</b>
      </div>
      <div className="scene-axis"><span>X</span><span>Y</span><span>Z</span></div>
    </div>
  )
}

function LocalCameraView() {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('requesting')
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('requesting')
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((track) => track.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          await videoRef.current.play().catch(() => {})
        }
        setStatus('active')
      } catch {
        if (!cancelled) setStatus('denied')
      }
    }
    start()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((track) => track.stop())
      streamRef.current = null
    }
  }, [nonce])

  return (
    <div className="local-cam-view">
      <video ref={videoRef} className="local-cam-video" autoPlay playsInline muted />
      {status === 'requesting' && <div className="local-cam-state"><LoaderCircle className="spin" size={22} />正在打开手机摄像头…</div>}
      {status === 'denied' && <div className="local-cam-state warn"><ShieldAlert size={20} />摄像头权限被拒绝<button type="button" onClick={() => setNonce((n) => n + 1)}>重新开启</button></div>}
      {status === 'unsupported' && <div className="local-cam-state warn"><Camera size={20} />当前浏览器不支持摄像头，请使用 Safari 或 Chrome</div>}
    </div>
  )
}

function LivePlayer({ camera, frame, viewMode, detections = [] }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleString('zh-CN', { hour12: false }))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN', { hour12: false })), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!camera || viewMode === 'thermal3d' || viewMode === 'building' || viewMode === 'campus' || camera.type === 'sensor' || camera.type === 'demo' || camera.type === 'mjpeg' || camera.type === 'local') return undefined
    const video = videoRef.current
    if (!video) return undefined
    let hls
    let cancelled = false
    const start = async () => {
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = camera.url
        video.play().catch(() => {})
        return
      }
      const { default: Hls } = await import('hls.js')
      if (cancelled || !videoRef.current || !Hls.isSupported()) return
      hls = new Hls({ liveDurationInfinity: true, lowLatencyMode: true })
      hls.loadSource(camera.url)
      hls.attachMedia(videoRef.current)
      hls.on(Hls.Events.MANIFEST_PARSED, () => videoRef.current?.play().catch(() => {}))
    }
    start()
    return () => {
      cancelled = true
      hls?.destroy()
      if (video) {
        video.pause()
        video.removeAttribute('src')
        video.load()
      }
    }
  }, [camera, viewMode])

  const enterFullscreen = () => {
    const element = playerRef.current
    if (!element) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else element.requestFullscreen?.()
  }

  return (
    <div className="live-player" ref={playerRef}>
      {viewMode === 'building' ? <Building3DView frame={frame} /> : viewMode === 'campus' ? <Campus3DView frame={frame} /> : viewMode === 'thermal3d' || camera.type === 'sensor' ? <Thermal3DScene frame={frame} camera={camera} /> : null}
      {viewMode !== 'thermal3d' && camera.type === 'demo' && <img src={camera.url} alt={`${camera.name}演示监控`} />}
      {viewMode !== 'thermal3d' && camera.type === 'mjpeg' && <img src={camera.url} alt={`${camera.name}实时监控`} />}
      {viewMode !== 'thermal3d' && camera.type === 'hls' && <video ref={videoRef} controls muted autoPlay playsInline />}
      {viewMode !== 'thermal3d' && camera.type === 'local' && <LocalCameraView />}
      <div className="live-grid" />
      {viewMode === 'camera' && <div className="detection-layer">{detections.map((item, index) => { const box = item.bbox || [0, 0, 0.1, 0.1]; const label = item.class === 'smoke' ? '烟雾' : item.class === 'flame' || item.class === 'fire' ? '明火' : item.class === 'person' ? '人员' : '热点'; return <div className={`detection-box detection-${item.class}`} key={`${item.class}-${index}`} style={{ left: `${Number(box[0]) * 100}%`, top: `${Number(box[1]) * 100}%`, width: `${Number(box[2]) * 100}%`, height: `${Number(box[3]) * 100}%` }}><span>{label}</span><b>{Math.round(Number(item.confidence || 0) * 100)}%</b></div> })}</div>}
      {camera.type === 'demo' && <div className="live-scan" />}
      <div className="live-status"><i />{viewMode === 'campus' ? '科大数字孪生' : viewMode === 'building' ? '3D大楼模拟' : viewMode === 'thermal3d' || camera.type === 'sensor' ? '热感板联动' : camera.type === 'local' ? '本机实景' : camera.type === 'demo' ? '公开演示流' : camera.public ? '公开监控' : '本机监控'}</div>
      {viewMode !== 'thermal3d' && viewMode !== 'building' && viewMode !== 'campus' && camera.type !== 'sensor' && <div className="live-camera-name"><Video size={14} /><span>{camera.name}</span><small>{camera.location || '未设置位置'}</small></div>}
      <button className="fullscreen-button" type="button" onClick={enterFullscreen}><Maximize2 size={16} /></button>
      <div className="live-time">{currentTime}</div>
    </div>
  )
}


function DigitalTwinView({ frame, route }) {
  const [routeMode, setRouteMode] = useState('safe')
  const nodes = buildingGraph.nodes
  const edges = Object.values(buildingGraph.edges)
  const safePath = route?.path || ['start', 'mid', 'stairs']
  const fastPath = ['start', 'mid', 'east', 'stairs']
  const activePath = routeMode === 'safe' ? safePath : fastPath
  const blocked = new Set(route?.blocked || [])
  const hotspots = frame?.hotspots || []
  const pathPoints = activePath.map((id) => `${nodes[id].x},${nodes[id].y}`).join(' ')
  const distance = routeMode === 'safe' ? (route?.distance || 86) : Math.max(48, Math.round((route?.distance || 86) * 0.72))
  const eta = routeMode === 'safe' ? (route?.eta || 42) : Math.max(24, Math.round((route?.eta || 42) * 0.72))
  return (
    <section className="mobile-card digital-twin-card">
      <div className="card-head"><div><strong>动态疏散图</strong><small>热区封控、路线重算和安全出口联动</small></div><div className="twin-live-tag"><i />实时重算</div></div>
      <div className="twin-status-row">
        <span><AlertTriangle size={13} />{hotspots.length} 个高温热区</span>
        <span><ShieldAlert size={13} />{blocked.size} 个封控节点</span>
        <span><Navigation size={13} />出口 {route?.bearing ?? 42}°</span>
      </div>
      <div className="twin-map">
        <svg viewBox="0 0 100 84" role="img" aria-label="楼层动态疏散地图">
          <defs>
            <linearGradient id="twin-room" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#0b2440" /><stop offset="1" stopColor="#071224" /></linearGradient>
            <filter id="twin-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.4" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <rect x="7" y="10" width="86" height="66" rx="6" fill="url(#twin-room)" stroke="#2f6ba3" strokeOpacity=".45" />
          <path d="M7 18 L93 18 M7 30 L34 30 M64 30 L93 30 M7 52 L34 52 M64 52 L93 52 M34 18 L34 68 M64 18 L64 68" fill="none" stroke="#3b82f6" strokeOpacity=".16" />
          <path d="M34 30 L64 30 M34 52 L64 52" fill="none" stroke="#8ba9c4" strokeOpacity=".24" strokeWidth=".7" />
          {edges.map((edge) => {
            const a = nodes[edge.from]
            const b = nodes[edge.to]
            const isBlocked = blocked.has(edge.from) || blocked.has(edge.to)
            return <line key={edge.from + edge.to} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={isBlocked ? '#ef4444' : '#3b82f6'} strokeOpacity={isBlocked ? '.62' : '.24'} strokeWidth={isBlocked ? '.9' : '.6'} strokeDasharray={isBlocked ? '2 1' : ''} />
          })}
          {hotspots.slice(0, 5).map((spot, index) => {
            const x = 14 + (Number(spot.x || 0) / 100) * 74
            const y = 18 + (Number(spot.y || 0) / 100) * 50
            const temp = Number(spot.temp || 0)
            return <g key={index}><circle cx={x} cy={y} r={3.4 + index * .4} fill={temp >= 65 ? '#ef4444' : '#f59e0b'} opacity=".22"><animate attributeName="r" values={`${2.8 + index * .3};${4.6 + index * .4};${2.8 + index * .3}`} dur="1.8s" repeatCount="indefinite" /></circle><circle cx={x} cy={y} r="2" fill={temp >= 65 ? '#ff5a4e' : '#ffae45'} filter="url(#twin-glow)" /><text x={x + 3} y={y - 2} fontSize="4.2" fill="#ffd7c2">{temp.toFixed(0)}°</text></g>
          })}
          <polyline points={pathPoints} fill="none" stroke="#22c55e" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="2 2" filter="url(#twin-glow)"><animate attributeName="stroke-dashoffset" from="8" to="0" dur="1.2s" repeatCount="indefinite" /></polyline>
          {activePath.map((id, index) => {
            const node = nodes[id]
            return <g key={id}><circle cx={node.x} cy={node.y} r={index === 0 ? '2.6' : '1.8'} fill={node.type === 'exit' ? '#22c55e' : '#38bdf8'} /><text x={node.x} y={node.y + 6.5} textAnchor="middle" fontSize="4" fill="#cfe4f7">{node.label}</text></g>
          })}
          <g transform="translate(13 9)"><circle cx="0" cy="0" r="1.8" fill="#38bdf8" /><text x="3.5" y="1.4" fontSize="4" fill="#8db8dd">当前位置</text></g>
          <g transform="translate(39 9)"><circle cx="0" cy="0" r="1.8" fill="#22c55e" /><text x="3.5" y="1.4" fontSize="4" fill="#8dd5a9">安全出口</text></g>
          {blocked.size > 0 && <g transform="translate(68 9)"><line x1="-2" y1="0" x2="2" y2="0" stroke="#ef4444" strokeWidth="1.4" /><text x="4" y="1.4" fontSize="4" fill="#f2a2a2">封控</text></g>}
        </svg>
      </div>
      <div className="twin-route-mode"><button type="button" className={routeMode === 'safe' ? 'active' : ''} onClick={() => setRouteMode('safe')}>安全优先</button><button type="button" className={routeMode === 'fast' ? 'active' : ''} onClick={() => setRouteMode('fast')}>距离优先</button></div>
      <div className="twin-route">{activePath.map((id, index) => <span key={id}><b>{String(index + 1).padStart(2, '0')}</b>{nodes[id].label}</span>)}</div>
      <div className="twin-metrics"><span><Route size={13} />{distance} 米</span><span><Clock3 size={13} />约 {eta} 秒</span><span><Navigation size={13} />出口方向 {route?.bearing ?? 42}°</span></div>
    </section>
  )
}


const DRILL_STEPS = [
  { id: 'leave', label: '离开高温区域', hint: '背向热源，沿推荐路线移动' },
  { id: 'corridor', label: '进入疏散通道', hint: '保持低姿，贴近墙侧前行' },
  { id: 'avoid', label: '避开封控区域', hint: '绕开系统标注的封控节点' },
  { id: 'exit', label: '到达安全出口', hint: '抵达安全出口并确认清点' },
]

function drillRating(score) {
  if (score >= 90) return { label: '优秀', tone: 'excellent', advice: '反应迅速、路线选择正确，可作为示范演练。' }
  if (score >= 80) return { label: '良好', tone: 'good', advice: '整体表现良好，仍可进一步压缩反应时间。' }
  if (score >= 70) return { label: '合格', tone: 'pass', advice: '基本完成撤离，注意提升反应速度与路线判断。' }
  return { label: '需改进', tone: 'improve', advice: '建议重新演练，重点熟悉疏散路线与安全动作。' }
}

function DrillMode({ frame, onClose, onComplete, onViewEvidence }) {
  const [phase, setPhase] = useState('ready')
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [paused, setPaused] = useState(false)
  const [completedSteps, setCompletedSteps] = useState([])
  const [result, setResult] = useState(null)
  const route = useMemo(() => planEvacuation(frame), [frame])
  const exitLabel = buildingGraph.nodes[route.path[route.path.length - 1]]?.label || '最近安全出口'
  const risk = frame?.risk || 'low'
  const maxTemp = Number(frame?.maxTemp || 0)
  const hotspots = frame?.hotspots?.length || 0

  useEffect(() => {
    if (phase !== 'running') return undefined
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
      return () => clearTimeout(timer)
    }
    if (paused) return undefined
    const timer = setInterval(() => setElapsed((value) => value + 1), 1000)
    return () => clearInterval(timer)
  }, [phase, countdown, paused])

  const toggleStep = (id) => setCompletedSteps((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))

  const startDrill = () => {
    setPhase('running')
    setCountdown(3)
    setElapsed(0)
    setPaused(false)
    setCompletedSteps([])
    if (typeof navigator !== 'undefined' && navigator.vibrate) navigator.vibrate(40)
  }

  const resetDrill = () => {
    setPhase('ready')
    setCountdown(3)
    setElapsed(0)
    setPaused(false)
    setCompletedSteps([])
    setResult(null)
  }

  const finishDrill = () => {
    const timeScore = Math.max(0, 100 - elapsed * 1.8)
    const riskBonus = risk === 'high' ? 10 : risk === 'medium' ? 5 : 0
    const checklistBonus = completedSteps.length * 5
    const score = Math.max(0, Math.round(Math.min(100, timeScore * 0.65 + riskBonus + checklistBonus)))
    const ratingInfo = drillRating(score)
    const next = {
      score,
      rating: ratingInfo.label,
      seconds: elapsed,
      route,
      path: route.path,
      exit: route.path[route.path.length - 1],
      exitLabel,
      distance: route.distance,
      eta: route.eta,
      steps: completedSteps,
      totalSteps: DRILL_STEPS.length,
      risk,
      maxTemp,
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    setResult(next)
    setPhase('complete')
    onComplete(next)
  }

  const ratingInfo = result ? drillRating(result.score) : null
  const stepCount = completedSteps.length
  const progress = Math.round((stepCount / DRILL_STEPS.length) * 100)

  return (
    <div className="drill-overlay">
      <section className="drill-sheet">
        <div className="sheet-handle" />
        <div className="drill-head">
          <div><span>数字消防演练</span><strong>{phase === 'ready' ? '演练准备' : phase === 'complete' ? '演练完成' : '正在演练'}</strong></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        {phase === 'ready' && (
          <div className="drill-body">
            <div className={`drill-scenario drill-risk-${risk}`}><ShieldAlert size={20} /><p>模拟火情：<strong>{riskTitle(risk)}</strong>，最高温度 {maxTemp.toFixed(1)}°C，识别到 {hotspots} 个高温区域。请按推荐路线完成撤离，系统将记录你的反应时间与安全动作。</p></div>
            <div className="drill-info-grid">
              <div><ShieldAlert size={14} /><span>风险等级</span><strong>{riskTitle(risk)}</strong></div>
              <div><Thermometer size={14} /><span>最高温度</span><strong>{maxTemp.toFixed(1)}°C</strong></div>
              <div><DoorOpen size={14} /><span>推荐出口</span><strong>{exitLabel}</strong></div>
              <div><Clock3 size={14} /><span>预计用时</span><strong>{route.eta} 秒</strong></div>
            </div>
            <div className="drill-brief">
              <div className="drill-brief-head"><ClipboardCheck size={15} />演练要点</div>
              <ul>
                <li>听到开始后立即反应，沿绿色推荐路线撤离</li>
                <li>绕开系统标注的高温封控区域</li>
                <li>依次完成四项安全动作，用时越短、动作越全得分越高</li>
              </ul>
            </div>
            <button type="button" className="sheet-save" onClick={startDrill}><Play size={16} />开始演练</button>
          </div>
        )}

        {phase === 'running' && (
          <div className="drill-body">
            {countdown > 0 ? (
              <div className="drill-countdown-wrap">
                <div className="drill-countdown">{countdown}</div>
                <p>准备撤离 · 沿推荐路线行动</p>
              </div>
            ) : (
              <div className="drill-running">
                <div className="drill-hud">
                  <div className="drill-timer"><Clock3 size={15} />已用时 <strong>{elapsed}</strong> 秒</div>
                  <div className={`drill-risk-chip drill-risk-${risk}`}>{riskTitle(risk)} · {maxTemp.toFixed(0)}°C</div>
                </div>
                <div className="drill-progress"><div><i style={{ width: `${progress}%` }} /></div><span>{stepCount}/{DRILL_STEPS.length} 安全动作</span></div>
                <DigitalTwinView frame={frame} route={route} />
                <ArEvacuationView route={route} risk={risk} />
                <div className="drill-checklist">
                  <div className="drill-checklist-head"><strong>疏散动作清单</strong><small>完成后点击勾选</small></div>
                  {DRILL_STEPS.map((step, index) => {
                    const done = completedSteps.includes(step.id)
                    return (
                      <button type="button" className={`drill-step ${done ? 'done' : ''}`} key={step.id} onClick={() => toggleStep(step.id)}>
                        <span className="drill-step-check">{done ? <CheckCircle2 size={16} /> : <span>{index + 1}</span>}</span>
                        <span className="drill-step-text"><strong>{step.label}</strong><small>{step.hint}</small></span>
                      </button>
                    )
                  })}
                </div>
                <div className="drill-controls">
                  <button type="button" className="drill-ghost" onClick={() => setPaused((value) => !value)}>{paused ? <Play size={15} /> : <Pause size={15} />}{paused ? '继续' : '暂停'}</button>
                  <button type="button" className="drill-ghost danger" onClick={onClose}><X size={15} />取消演练</button>
                </div>
                {paused && <p className="drill-paused-note">演练已暂停，计时停止。点击“继续”恢复。</p>}
                <button type="button" className="sheet-save" onClick={finishDrill} disabled={paused}><CheckCircle2 size={16} />已完成撤离</button>
              </div>
            )}
          </div>
        )}

        {phase === 'complete' && (
          <div className="drill-body drill-result">
            <div className={`drill-score rating-${ratingInfo?.tone || 'good'}`}><strong>{result?.score ?? 0}</strong><span>演练得分</span></div>
            <div className={`drill-rating rating-${ratingInfo?.tone || 'good'}`}>{ratingInfo?.label}</div>
            <div className="drill-result-metrics">
              <div><Clock3 size={14} /><span>撤离用时</span><strong>{result?.seconds ?? 0} 秒</strong></div>
              <div><DoorOpen size={14} /><span>使用出口</span><strong>{result?.exitLabel || exitLabel}</strong></div>
              <div><Route size={14} /><span>路线距离</span><strong>{result?.distance ?? route.distance} m</strong></div>
              <div><ClipboardCheck size={14} /><span>完成动作</span><strong>{stepCount}/{DRILL_STEPS.length}</strong></div>
            </div>
            <div className="drill-summary">
              <div className="drill-summary-head"><Sparkles size={15} />AI 演练点评</div>
              <div className="drill-summary-row"><span>响应速度</span><p>{!result ? '—' : result.seconds <= 20 ? '反应迅速，第一时间进入撤离状态。' : result.seconds <= 40 ? '反应速度尚可，仍有压缩空间。' : '反应偏慢，建议加强初始反应训练。'}</p></div>
              <div className="drill-summary-row"><span>路线选择</span><p>沿推荐路线经 {result?.path?.map((id) => buildingGraph.nodes[id]?.label).filter(Boolean).join(' → ')} 抵达安全出口。</p></div>
              <div className="drill-summary-row"><span>安全动作</span><p>{stepCount >= DRILL_STEPS.length ? '四项安全动作全部完成，操作规范。' : `完成 ${stepCount} 项安全动作，注意遗漏项。`}</p></div>
              <div className="drill-summary-row advise"><span>改进建议</span><p>{ratingInfo?.advice}</p></div>
            </div>
            <div className="drill-result-actions">
              <button type="button" className="sheet-save" onClick={resetDrill}><RotateCcw size={16} />再练一次</button>
              <button type="button" className="drill-ghost" onClick={() => { if (onViewEvidence) onViewEvidence(); else onClose() }}><Database size={15} />查看证据链</button>
              <button type="button" className="drill-ghost" onClick={onClose}><X size={15} />关闭</button>
            </div>
            <p className="drill-disclaimer">演练为科研演示原型，评分仅用于教学参考，不替代专业消防训练。</p>
          </div>
        )}
      </section>
    </div>
  )
}
function CameraSheet({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || '')
  const [location, setLocation] = useState(editing?.location || '')
  const [type, setType] = useState(editing?.type || 'hls')
  const [url, setUrl] = useState(editing?.url || '')
  const [isPublic, setIsPublic] = useState(Boolean(editing?.public))
  const valid = name.trim() && (type === 'demo' || type === 'sensor' || type === 'local' || /^https?:\/\//i.test(url.trim()))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><div><span>监控联动</span><strong>{editing ? '编辑监控' : '添加监控'}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        <label>监控名称<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：三楼东侧走廊" /></label>
        <label>安装位置<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：消防通道入口" /></label>
        <label>监控类型<select value={type} onChange={(e) => { setType(e.target.value); if (e.target.value === 'demo') setUrl(DEMO_LIVE); if (e.target.value === 'sensor') setUrl('sensor://esp32-sim'); if (e.target.value === 'local') setUrl('local://camera') }}><option value="hls">HLS 实时流</option><option value="mjpeg">MJPEG 实时流</option><option value="sensor">3D 热感模拟板</option><option value="demo">内置公开演示流</option><option value="local">本机摄像头</option></select></label>
        <label>监控地址<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/live.m3u8" inputMode="url" autoCapitalize="none" disabled={type === 'demo' || type === 'sensor' || type === 'local'} /></label>
        <label className="public-toggle"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /><span><strong>允许通过分享链接公开查看</strong><small>请勿公开包含人员、住宅、门禁或消防设施细节的画面</small></span></label>
        <div className="sheet-tip"><Info size={14} />RTSP 地址不能被手机浏览器直接播放，需要海康、大华 NVR 或媒体网关转换为 HLS/WebRTC。</div>
        <button className="sheet-save" type="button" disabled={!valid} onClick={() => onSave({ name: name.trim(), location: location.trim(), type, url: type === 'demo' ? DEMO_LIVE : type === 'sensor' ? 'sensor://esp32-sim' : type === 'local' ? 'local://camera' : url.trim(), public: isPublic })}><Save size={16} />保存监控</button>
      </section>
    </div>
  )
}

function AIGatewayPanel({ url, onChange, status, detections, onConnect, onDisconnect }) {
  const [draft, setDraft] = useState(url)
  useEffect(() => setDraft(url), [url])
  const connected = status === 'connected'
  const labels = { smoke: '烟雾', flame: '明火', fire: '火焰', person: '人员', flame_or_hot_object: '高温物体' }
  return (
    <section className="mobile-card ai-gateway-card">
      <div className="card-head"><div><strong>笔记本AI检测网关</strong><small>接收YOLO、烟雾、火焰和热区检测结果</small></div><BrainCircuit size={18} /></div>
      <div className={`ai-gateway-status state-${status}`}><i />{connected ? 'AI网关在线' : status === 'connecting' ? '正在连接AI网关' : status === 'failed' ? '连接失败' : 'AI网关未连接'}<b>{detections.length} 个目标</b></div>
      <label className="ai-gateway-input"><span>WebSocket 地址</span><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="ws://笔记本IP:8787/ws/detections" inputMode="url" autoCapitalize="none" /></label>
      <div className="ai-gateway-actions">
        <button type="button" onClick={() => { onChange(draft.trim()); onConnect(draft.trim()) }} disabled={!draft.trim()}>{connected ? <><Wifi size={14} />重新连接</> : <><Link2 size={14} />连接网关</>}</button>
        <button type="button" onClick={onDisconnect} disabled={!connected}><WifiOff size={14} />断开</button>
      </div>
      {detections.length > 0 && <div className="ai-detection-chips">{detections.map((item, index) => <span key={`${item.class}-${index}`} className={`detection-${item.class}`}>{labels[item.class] || item.class} {Math.round(Number(item.confidence || 0) * 100)}%</span>)}</div>}
      <p className="ai-gateway-note"><Info size={13} />正式 App 使用 HTTPS 时需要 wss://；本地演示可打开网关提供的 http://笔记本IP:8787/mobile-app.html。</p>
    </section>
  )
}

function CameraPage({ cameras, selectedCamera, onSelect, onAdd, onEdit, onDelete, canShare, onShare, frame, connection, inference, aiGatewayUrl, onAIUrlChange, aiConnection, aiDetections, onConnectAI, onDisconnectAI }) {
  const [viewMode, setViewMode] = useState(() => initialCameraView() || (selectedCamera?.type === 'sensor' ? 'thermal3d' : 'camera'))
  const route = useMemo(() => planEvacuation(frame), [frame])

  useEffect(() => {
    setViewMode(initialCameraView() || (selectedCamera?.type === 'sensor' ? 'thermal3d' : 'camera'))
  }, [selectedCamera?.id, selectedCamera?.type])

  const canSwitchView = selectedCamera?.type !== 'sensor'

  return (
    <div className="mobile-page camera-page">
      <header className="page-heading camera-heading"><span>现场监控</span><h1>热成像与监控联动</h1><p>实景监控、3D 热感重建与疏散导航在同一画面联动</p></header>
      <div className="view-switcher">
        {selectedCamera?.type !== 'sensor' && <button type="button" className={viewMode === 'camera' ? 'active' : ''} onClick={() => setViewMode('camera')}><Video size={14} />实景监控</button>}
        <button type="button" className={viewMode === 'thermal3d' ? 'active' : ''} onClick={() => setViewMode('thermal3d')}><Rotate3D size={14} />3D热感</button>
        <button type="button" className={viewMode === 'building' ? 'active' : ''} onClick={() => setViewMode('building')}><Box size={14} />3D大楼</button>
        <button type="button" className={viewMode === 'campus' ? 'active' : ''} onClick={() => setViewMode('campus')}><Box size={14} />科大校园</button>
      </div>
      <LivePlayer camera={selectedCamera} frame={frame} viewMode={viewMode} detections={aiDetections} />
      <div className="camera-actions">
        <button type="button" className={canShare ? '' : 'disabled'} onClick={() => canShare && onShare(selectedCamera)}><Copy size={15} />分享当前监控</button>
        <button type="button" onClick={onAdd}><Plus size={15} />添加监控</button>
      </div>

      <section className="mobile-card thermal-link-card">
        <div className="card-head"><div><strong>模拟热成像板联动</strong><small>ESP32 / MLX90640 数据格式演示</small></div><RadioTower size={18} /></div>
        <div className="thermal-link-status">
          <span><i className={connection === 'connected' ? 'online' : ''} />{connection === 'connected' ? '真实硬件在线' : '模拟器数据流运行中'}</span>
          <b>{frame?.source || '内置模拟热像仪'}</b>
        </div>
        <div className="thermal-link-metrics">
          <div><span>矩阵</span><strong>{frame?.width || 32}×{frame?.height || 24}</strong></div>
          <div><span>最高温</span><strong>{Number(frame?.maxTemp || 0).toFixed(1)}°C</strong></div>
          <div><span>热区</span><strong>{frame?.hotspots?.length || 0} 处</strong></div>
        </div>
        <p className="thermal-link-note"><Box size={13} />手机端可接入 HLS、MJPEG，或直接接收 width、height、max_temp、temperatures、hotspots 格式的热感板数据。</p>
        {inference && <div className="thermal-inference-line"><span><Cpu size={13} />AI推理</span><b>{(inference.confidence * 100).toFixed(0)}% · {inference.stages[0]?.detail}</b></div>}
      </section>

      <AIGatewayPanel url={aiGatewayUrl} onChange={onAIUrlChange} status={aiConnection} detections={aiDetections} onConnect={onConnectAI} onDisconnect={onDisconnectAI} />
      {viewMode === 'campus' && <CampusBuildingPanel />}
      <DigitalTwinView frame={frame} route={route} />

      <div className="section-title"><strong>监控列表</strong><span>{cameras.length} 路</span></div>
      <div className="camera-grid">
        {cameras.map((camera) => {
          const active = selectedCamera?.id === camera.id
          return (
          <article className={`camera-card ${active ? 'active' : ''}`} key={camera.id} onClick={() => onSelect(camera)}>
            <div className={`camera-thumb ${camera.type === 'sensor' ? 'thermal-thumb' : ''}`}>
              {camera.type === 'sensor' ? <><Rotate3D size={27} /><span>{camera.public ? '公开' : '授权'}</span></> : camera.type === 'demo' || camera.type === 'mjpeg' ? <><img src={camera.url} alt="" /><span>{camera.public ? '公开' : '授权'}</span></> : <><Video size={25} /><span>{camera.public ? '公开' : '授权'}</span></>}
            </div>
            <div className="camera-info"><strong>{camera.name}</strong><small>{camera.location || '未设置位置'}</small><em>{camera.type === 'sensor' ? '3D热感板' : camera.type === 'demo' ? '演示流' : camera.type === 'local' ? '本机摄像头' : camera.type.toUpperCase()}</em></div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(camera) }}><Edit3 size={14} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(camera.id) }}><Trash2 size={14} /></button>
          </article>
        )})}
      </div>
      <div className="monitor-note"><Globe2 size={16} /><p>公开流适合无隐私的演示区域。真实监控建议通过账号授权、临时签名地址或受控网关接入，不建议直接暴露 NVR 地址或长期公开。</p></div>
    </div>
  )
}

function DashboardPage({ frame, inference, onOpenCommand }) {
  const riskIndex = Math.round(Math.min(99, 42 + Number(frame?.maxTemp || 0) / 2 + (frame?.hotspots?.length || 0) * 6 + (inference?.confidence || 0) * 12))
  const spreadMinutes = Math.max(2, Math.round(12 - (frame?.hotspots?.length || 0) * 1.4 - Math.max(0, Number(frame?.maxTemp || 0) - 45) / 8))
  const stats = [
    ['累计检测图像', '12,846', '张', '+18.6%', ImageIcon, 'blue'],
    ['预警总次数', '1,329', '次', '+12.4%', BellRing, 'orange'],
    ['中高风险占比', '23.8', '%', '-2.1%', Gauge, 'red'],
    ['平均响应时间', '1.8', '秒', '较上月 -0.4s', Clock3, 'green'],
  ]
  return (
    <div className="mobile-page">
      <header className="page-heading"><span>数据看板</span><h1>风险数据洞察</h1><p>用于消防安全管理数据分析与隐患排查优化</p></header>
      <section className="mobile-card ai-command-card">
        <div className="card-head"><div><strong>AI火警网警指挥中心</strong><small>风险预测 · 出口分流 · 语音疏散 · 处置单</small></div><BrainCircuit size={19} /></div>
        <div className="ai-command-metrics">
          <div><span>风险指数</span><strong>{riskIndex}</strong><small>/100</small></div>
          <div><span>预计蔓延</span><strong>{spreadMinutes}</strong><small>分钟</small></div>
          <div><span>推荐出口</span><strong>北门</strong><small>分流优先</small></div>
        </div>
        <button type="button" className="command-open" onClick={onOpenCommand}><Siren size={16} />进入指挥中心</button>
      </section>
      <SituationMap frame={frame} />
      <div className="dashboard-grid">{stats.map(([label, value, unit, change, Icon, tone]) => <article className={`dashboard-stat tone-${tone}`} key={label}><span><Icon size={16} /></span><p>{label}</p><strong>{value}<small>{unit}</small></strong><em>{change}</em></article>)}</div>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>风险趋势</strong><small>近30日最高温度预警指数</small></div><TrendingUp size={18} /></div><LineChart /></section>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>隐患类型分布</strong><small>高频隐患分类统计</small></div><BarChart3 size={18} /></div><div className="bar-chart">{[['电气过热', 72], ['设备异常', 58], ['环境温升', 44], ['线路老化', 31], ['其他', 26]].map(([label, value], index) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${value}%`, '--bar-delay': `${index * 90}ms` }} /></div><b>{value}</b></div>)}</div></section>
      <HeatReplay frame={frame} />
            <div className="dashboard-note"><Activity size={16} />数据用于隐患识别、巡检优先级排序和风险治理优化。</div>
    </div>
  )
}

function AboutPage({ onStartDrill }) {
  return (
    <div className="mobile-page">
      <header className="page-heading"><span>关于项目</span><h1>让AI成为火警监测网警</h1><p>热成像 + 计算机视觉，让隐患在灾害发生前被看见</p></header>
      <section className="mobile-card principle-card"><div className="card-head"><div><strong>技术原理</strong><small>多模态融合识别</small></div><Cpu size={19} /></div><div className="principle-flow"><div><ScanLine size={20} /><strong>YOLO检测</strong><span>火焰与烟雾目标</span></div><ArrowRight size={16} /><div><Thermometer size={20} /><strong>温度融合</strong><span>热区轮廓与梯度</span></div><ArrowRight size={16} /><div><ShieldAlert size={20} /><strong>风险判断</strong><span>灾前分级预警</span></div></div></section>
      <section className="mobile-card innovation-card"><div className="card-head"><div><strong>十大核心创新</strong><small>AI火警网警的完整创新链</small></div><Sparkles size={18} /></div>{[['灾前预警', '在明火和烟雾出现前识别温度异常'], ['精准定位', '红橙热区标注高温隐患位置'], ['AI时序推理', '温度轮廓、扩散梯度与持续特征融合'], ['低误报率', '多维度证据区分正常热源与真实隐患'], ['数字孪生', '楼层热区与监控设备三维联动'], ['动态疏散', '根据热区与封控实时重规划路线'], ['3D热感重建', '将热成像板数据映射到空间热源场景'], ['数字演练', '模拟火情、计时撤离与自动评分'], ['证据链', '自动留存检测与处置全过程'], ['边缘部署', '老旧楼宇无需大规模重新布线']].map(([title, text], index) => <div className="innovation-row" key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</section>
      <section className="mobile-card drill-entry-card"><div className="drill-entry-icon"><ShieldCheck size={21} /></div><div><strong>数字消防演练</strong><p>模拟火情、计时撤离、自动评分并生成证据记录。</p></div><button type="button" onClick={onStartDrill}>进入演练</button></section>
      <section className="mobile-card advantage-card"><div><ShieldCheck size={19} /><strong>复杂场景适配</strong></div><p>适配老旧楼宇、仓库、配电房和人员密集楼道，无需大规模重新布线，硬件成本可控，适合民用普及。</p></section>
      <InspectionPanel />
      <FireAssistant />
      <HazardReport />
            <div className="disclaimer"><ShieldAlert size={17} /><p>本系统为科研演示原型，不替代专业消防检测设备与灭火系统。</p></div>
    </div>
  )
}


function CommandCenter({ frame, inference, onClose, onStartDrill }) {
  const [minutes, setMinutes] = useState(0)
  const [broadcast, setBroadcast] = useState(false)
  const maxTemp = Number(frame?.maxTemp || 0)
  const hotspots = frame?.hotspots?.length || 0
  const route = useMemo(() => planEvacuation(frame), [frame])
  const riskIndex = Math.round(Math.min(99, 42 + maxTemp / 2 + hotspots * 6 + (inference?.confidence || 0) * 12))
  const buildingForecast = useMemo(() => {
    const distances = [0, 0.08, 0.14, 0.2, 0.32, 0.45]
    return [
      ['N', '图书馆'], ['B', '教学楼 B'], ['O', '教学楼 O'], ['R', '综合大楼'], ['H', '科技大楼'], ['P', 'P座宿舍'],
    ].map(([code, name], index) => ({
      code,
      name,
      score: Math.min(99, Math.round((maxTemp - 35) * 0.72 + minutes * 4.3 + hotspots * 3 - distances[index] * 100)),
    }))
  }, [maxTemp, hotspots, minutes])
  const exits = [
    { name: '东侧安全出口', load: Math.min(96, 34 + hotspots * 8 + minutes * 3), safe: route?.path?.includes('stairs') },
    { name: '北侧安全出口', load: Math.min(88, 28 + hotspots * 5 + minutes * 2), safe: route?.path?.includes('north') },
    { name: '南门出口', load: Math.min(99, 46 + hotspots * 7 + minutes * 4), safe: false },
  ].sort((a, b) => a.load - b.load)
  const speak = () => {
    setBroadcast(true)
    try {
      const utterance = new SpeechSynthesisUtterance(`检测到高风险热源，最高温度${maxTemp.toFixed(0)}摄氏度。请立即沿绿色路线撤离，前往${exits[0].name}。`)
      utterance.lang = 'zh-CN'
      utterance.rate = 0.95
      window.speechSynthesis.cancel()
      window.speechSynthesis.speak(utterance)
      navigator.vibrate?.([220, 100, 220, 100, 420])
    } catch {}
    window.setTimeout(() => setBroadcast(false), 4200)
  }
  const sendNotification = async () => {
    if (typeof Notification === 'undefined') return
    try {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') {
        new Notification('AI火警告警', { body: `检测到${riskTitle(frame?.risk || 'low')}热源，最高温度 ${maxTemp.toFixed(1)}°C，请立即疏散。` })
      }
    } catch {}
  }

  const downloadReport = () => {
    const report = {
      system: '燧瞳智感 AI火警网警系统',
      generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
      location: '澳门科技大学校园数字孪生',
      riskIndex,
      maxTemp,
      hotspotCount: hotspots,
      recommendedExit: exits[0].name,
      evacuationDistance: route?.distance,
      evacuationEta: route?.eta,
      forecast: buildingForecast,
      exits,
      risk: frame?.risk || 'low',
      riskLabel: riskTitle(frame?.risk || 'low'),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `AI火警网警处置单-${Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  return (
    <div className="command-overlay">
      <section className="command-sheet">
        <div className="sheet-handle" />
        <div className="command-head"><div><span>AI火警网警</span><strong>应急指挥中心</strong></div><button type="button" onClick={onClose}><X size={19} /></button></div>
        <div className={`command-level risk-${frame?.risk || 'low'}`}><Siren size={23} /><div><strong>{riskTitle(frame?.risk || 'low')} · 风险指数 {riskIndex}</strong><span>澳门科技大学校园数字孪生 · 最高温 {maxTemp.toFixed(1)}°C · {hotspots} 个热区</span></div></div>
        <section className="command-card">
          <div className="command-card-head"><div><Radar size={16} /><strong>火势蔓延预测</strong></div><span>未来 {minutes} 分钟</span></div>
          <div className="spread-timeline">{['现在', '3分钟', '5分钟', '10分钟'].map((label, index) => <button type="button" className={minutes === [0, 3, 5, 10][index] ? 'active' : ''} key={label} onClick={() => setMinutes([0, 3, 5, 10][index])}>{label}</button>)}</div>
          <div className="spread-building-list">{buildingForecast.map((building) => <div key={building.code} style={{ '--risk': `${building.score}%` }}><span>{building.code}</span><div><i /><strong>{building.name}</strong></div><b>{building.score}%</b></div>)}</div>
        </section>
        <section className="command-card">
          <div className="command-card-head"><div><DoorOpen size={16} /><strong>疏散出口分流</strong></div><span>推荐 {exits[0].name}</span></div>
          <div className="exit-flow-list">{exits.map((exit) => <div key={exit.name}><span>{exit.name}</span><div><i style={{ width: `${exit.load}%` }} /></div><b>{exit.load}%</b></div>)}</div>
        </section>
        <section className="command-card command-route-card">
          <div className="command-card-head"><div><Waves size={16} /><strong>动态疏散路径</strong></div><span>{route?.distance} 米 · {route?.eta} 秒</span></div>
          <div className="command-route-steps">{route?.steps?.map((step) => <span key={step}>{step}</span>)}</div>
        </section>
        <LinkagePanel risk={frame?.risk || 'low'} />
        <RollcallPanel />
        <div className="command-actions">
          <button type="button" className={broadcast ? 'active' : ''} onClick={speak}><Megaphone size={16} />{broadcast ? '正在广播' : '语音疏散广播'}</button>
          <button type="button" onClick={onStartDrill}><ClipboardCheck size={16} />启动数字演练</button>
          <button type="button" onClick={sendNotification}><BellRing size={16} />告警通知</button>
          <button type="button" onClick={downloadReport}><Download size={16} />处置单JSON</button>
          <button type="button" onClick={() => openPdfReport({ system: '燧瞳智感 AI火警网警系统', generatedAt: new Date().toLocaleString('zh-CN', { hour12: false }), location: '澳门科技大学校园数字孪生', risk: frame?.risk || 'low', riskLabel: riskTitle(frame?.risk || 'low'), riskIndex, maxTemp, hotspotCount: hotspots, recommendedExit: exits[0].name, evacuationDistance: route?.distance, evacuationEta: route?.eta })}><FileText size={16} />导出PDF报告</button>
        </div>
      </section>
    </div>
  )
}

/* ===== 全域态势 + 处置联动 + 巡检 + 知识助手 + 隐患上报 ===== */

function SituationMap({ frame }) {
  const hotspots = frame?.hotspots?.length || 0
  const maxTemp = Number(frame?.maxTemp || 0)
  const buildings = [
    { id: 'library', name: '图书馆', x: 52, y: 22, base: 0.18 },
    { id: 'b', name: '教学楼B', x: 24, y: 38, base: 0.1 },
    { id: 'o', name: '教学楼O', x: 42, y: 34, base: 0.14 },
    { id: 'r', name: '综合大楼', x: 70, y: 36, base: 0.22 },
    { id: 'h', name: '科技大楼', x: 80, y: 52, base: 0.28 },
    { id: 'p', name: 'P座宿舍', x: 30, y: 62, base: 0.16 },
  ]
  const [selected, setSelected] = useState('library')
  const scoreFor = (b) => Math.min(99, Math.round((maxTemp - 34) * 0.9 + hotspots * 5 + b.base * 100))
  const selectedBuilding = buildings.find((b) => b.id === selected)
  const alertCount = Math.max(1, hotspots)

  return (
    <section className="mobile-card situation-card">
      <div className="card-head"><div><strong>校园全域态势图</strong><small>各楼栋实时风险热力与告警点位</small></div><MapPin size={18} /></div>
      <div className="situation-map">
        <svg viewBox="0 0 100 80" role="img" aria-label="校园全域风险态势图">
          <rect x="4" y="4" width="92" height="72" rx="7" fill="#04101f" stroke="#2f6ba3" strokeOpacity=".4" />
          <path d="M4 40 H96 M50 4 V76" stroke="#3b82f6" strokeOpacity=".1" />
          <path d="M10 58 Q 30 52 50 58 T 92 56" fill="none" stroke="#1d5d8f" strokeOpacity=".5" />
          {buildings.map((b) => {
            const score = scoreFor(b)
            const tone = score >= 65 ? '#ef4444' : score >= 45 ? '#f59e0b' : '#22c55e'
            return (
              <g key={b.id} onClick={() => setSelected(b.id)} className={selected === b.id ? 'selected' : ''}>
                <rect x={b.x - 7} y={b.y - 5} width="14" height="10" rx="2.5" fill={tone} opacity={selected === b.id ? '.95' : '.75'} stroke="#eaf4ff" strokeOpacity=".35" strokeWidth=".5" />
                <text x={b.x} y={b.y + 9} textAnchor="middle" fontSize="3.4" fill="#d7e8f8">{b.name}</text>
                {score >= 45 && <circle cx={b.x + 7} cy={b.y - 5} r="2" fill="#ef4444"><animate attributeName="opacity" values="1;.2;1" dur="1.1s" repeatCount="indefinite" /></circle>}
              </g>
            )
          })}
        </svg>
      </div>
      <div className="situation-meta">
        <div><span>当前楼栋</span><strong>{selectedBuilding?.name}</strong></div>
        <div><span>风险评分</span><strong>{scoreFor(selectedBuilding)}</strong><small>/100</small></div>
        <div><span>告警点</span><strong>{alertCount}</strong></div>
      </div>
      <p className="situation-note"><Info size={12} />颜色代表风险等级：绿-正常 / 黄-关注 / 红-告警。点击楼栋查看详情。</p>
    </section>
  )
}

function HeatReplay({ frame }) {
  const maxTemp = Number(frame?.maxTemp || 0)
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const history = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const t = i / 29
    const value = Math.round(34 + (maxTemp - 34) * (0.35 * t + 0.65 * t * t))
    return { t: i, value, risk: value >= 65 ? 'high' : value >= 45 ? 'medium' : 'low' }
  }), [maxTemp])

  useEffect(() => {
    if (!playing) return undefined
    const id = setInterval(() => setIndex((i) => {
      if (i >= 29) { setPlaying(false); return 29 }
      return i + 1
    }), 180)
    return () => clearInterval(id)
  }, [playing])

  const current = history[index]
  const max = Math.max(...history.map((h) => h.value))
  const min = Math.min(...history.map((h) => h.value))
  const points = history.map((h) => `${4 + (h.t / 29) * 92},${72 - ((h.value - min) / Math.max(max - min, 1)) * 58}`).join(' ')

  return (
    <section className="mobile-card heat-replay-card">
      <div className="card-head"><div><strong>热力历史回放</strong><small>拖动时间轴查看温度演变与风险触发</small></div><TrendingUp size={18} /></div>
      <svg className="heat-replay-chart" viewBox="0 0 100 80" preserveAspectRatio="none">
        <defs><linearGradient id="heat-replay-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f97316" stopOpacity=".3" /><stop offset="1" stopColor="#f97316" stopOpacity="0" /></linearGradient></defs>
        <polyline points={points} fill="none" stroke="#f97316" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
        <circle cx={4 + (index / 29) * 92} cy={72 - ((current.value - min) / Math.max(max - min, 1)) * 58} r="2.2" fill="#fff" stroke="#f97316" strokeWidth="1" />
      </svg>
      <div className="heat-replay-info">
        <span className={`route-risk route-${current.risk}`}>{riskTitle(current.risk)}</span>
        <strong>{current.value.toFixed(0)}°C</strong>
        <small>{Math.round((index / 29) * 100)}% 时间轴</small>
      </div>
      <input type="range" min="0" max="29" value={index} onChange={(e) => setIndex(Number(e.target.value))} className="heat-replay-slider" />
      <div className="heat-replay-controls">
        <button type="button" onClick={() => setPlaying((p) => !p)}>{playing ? <Pause size={15} /> : <Play size={15} />}{playing ? '暂停' : '播放'}</button>
        <button type="button" onClick={() => { setPlaying(false); setIndex(0) }}><RotateCcw size={15} />重置</button>
      </div>
      <p className="situation-note"><Info size={12} />回放为模拟数据，用于演示「常温 → 升温 → 触发预警」的灾前过程。</p>
    </section>
  )
}

const LINKAGE_DEVICES = [
  { id: 'alarm', name: '声光报警器', desc: '启动声光警示', icon: BellRing },
  { id: 'broadcast', name: '应急广播', desc: '播报疏散指令', icon: Megaphone },
  { id: 'power', name: '非消防电源断电', desc: '切断普通电源', icon: Power },
  { id: 'elevator', name: '电梯迫降', desc: '电梯归首层', icon: DoorOpen },
  { id: 'pump', name: '消防泵启动', desc: '启动喷淋供水', icon: Plug },
]

function LinkagePanel({ risk }) {
  const [done, setDone] = useState({})
  const [siren, setSiren] = useState(false)
  const audioRef = useRef(null)

  useEffect(() => () => { try { audioRef.current?.ctx?.close() } catch {} }, [])

  const toggleSiren = () => {
    if (siren) {
      try { audioRef.current?.ctx?.close() } catch {}
      audioRef.current = null
      setSiren(false)
      return
    }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      osc.type = 'sawtooth'
      osc.frequency.value = 760
      lfo.type = 'sine'
      lfo.frequency.value = 1.8
      gain.gain.value = 0.0001
      lfoGain.gain.value = 0.045
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      lfo.start()
      gain.gain.linearRampToValueAtTime(0.11, ctx.currentTime + 0.08)
      audioRef.current = { ctx, osc, lfo, gain, lfoGain }
      setSiren(true)
      navigator.vibrate?.([280, 110, 280, 110, 280])
    } catch {}
  }

  const arm = (id) => setDone((d) => ({ ...d, [id]: !d[id] }))
  const armAll = () => setDone(Object.fromEntries(LINKAGE_DEVICES.map((d) => [d.id, true])))
  const doneCount = LINKAGE_DEVICES.filter((d) => done[d.id]).length

  return (
    <section className="mobile-card linkage-card">
      <div className="card-head"><div><strong>自动处置联动</strong><small>火警确认后自动执行设备联动</small></div><Zap size={18} /></div>
      <div className={`linkage-banner risk-${risk || 'low'}`}>{siren ? <Volume2 size={18} /> : <VolumeX size={18} />}<span>{risk === 'high' ? '已触发高风险，建议立即启动联动' : '可手动演练联动流程'}</span><button type="button" className={siren ? 'active' : ''} onClick={toggleSiren}>{siren ? '停止警报' : '启动警报'}</button></div>
      <div className="linkage-list">
        {LINKAGE_DEVICES.map((d) => {
          const Icon = d.icon
          const on = Boolean(done[d.id])
          return <div className={`linkage-row ${on ? 'on' : ''}`} key={d.id} onClick={() => arm(d.id)}><span className="linkage-icon"><Icon size={16} /></span><div><strong>{d.name}</strong><small>{d.desc}</small></div><em>{on ? '已执行' : '待执行'}</em></div>
        })}
      </div>
      <div className="linkage-progress"><div><i style={{ width: `${(doneCount / LINKAGE_DEVICES.length) * 100}%` }} /></div><span>{doneCount}/{LINKAGE_DEVICES.length} 已执行</span></div>
      <button type="button" className="linkage-arm-all" onClick={armAll}><Zap size={15} />一键启动全部联动</button>
    </section>
  )
}

const ROLLCALL_PEOPLE = [
  { id: 'p1', name: '陈同学', zone: '图书馆 3F 阅览室' },
  { id: 'p2', name: '林同学', zone: '教学楼 B 402' },
  { id: 'p3', name: '王同学', zone: '综合大楼 2F 实验室' },
  { id: 'p4', name: '黄同学', zone: 'P 座宿舍 5F' },
  { id: 'p5', name: '李老师', zone: '科技大楼 1F 门厅' },
  { id: 'p6', name: '郑同学', zone: '教学楼 O 305' },
]

function RollcallPanel() {
  const [status, setStatus] = useState({})
  const toggle = (id) => setStatus((s) => ({ ...s, [id]: s[id] === 'safe' ? 'missing' : 'safe' }))
  const safeCount = ROLLCALL_PEOPLE.filter((p) => status[p.id] === 'safe').length
  const allSafe = safeCount === ROLLCALL_PEOPLE.length

  return (
    <section className="mobile-card rollcall-card">
      <div className="card-head"><div><strong>疏散人员清点</strong><small>撤离后逐一点名确认，快速定位未到位人员</small></div><Users size={18} /></div>
      <div className="rollcall-summary">
        <div><span>已确认安全</span><strong>{safeCount}</strong><small>/ {ROLLCALL_PEOPLE.length}</small></div>
        <div><span>未确认</span><strong className={safeCount === ROLLCALL_PEOPLE.length ? 'ok' : 'warn'}>{ROLLCALL_PEOPLE.length - safeCount}</strong></div>
      </div>
      <div className="rollcall-progress"><div><i style={{ width: `${(safeCount / ROLLCALL_PEOPLE.length) * 100}%` }} /></div></div>
      <div className="rollcall-list">
        {ROLLCALL_PEOPLE.map((p) => {
          const safe = status[p.id] === 'safe'
          return <div className={`rollcall-row ${safe ? 'safe' : ''}`} key={p.id} onClick={() => toggle(p.id)}><span className="rollcall-state">{safe ? <ShieldCheck size={16} /> : <UserX size={16} />}</span><div><strong>{p.name}</strong><small>{p.zone}</small></div><em>{safe ? '已安全' : '未确认'}</em></div>
        })}
      </div>
      {allSafe && <div className="rollcall-done"><CheckCircle2 size={16} />全员已确认安全撤离</div>}
    </section>
  )
}

const FACILITIES = [
  { id: 'f1', name: '灭火器', code: 'A-01', location: '图书馆 1F 东侧', expire: '2027-06', status: '正常' },
  { id: 'f2', name: '室内消火栓', code: 'B-03', location: '教学楼 B 3F 走廊', expire: '2027-01', status: '正常' },
  { id: 'f3', name: '应急照明', code: 'C-12', location: '综合大楼 2F 楼梯间', expire: '2026-12', status: '临近到期' },
  { id: 'f4', name: '疏散指示', code: 'D-07', location: 'P 座宿舍 5F 出口', expire: '2027-09', status: '正常' },
]

function InspectionPanel() {
  const [records, setRecords] = useState(FACILITIES)
  const [scanMsg, setScanMsg] = useState('')
  const inspect = (id) => setRecords((r) => r.map((f) => (f.id === id ? { ...f, status: '正常', last: new Date().toLocaleDateString('zh-CN') } : f)))
  const tryScan = async () => {
    if (!('BarcodeDetector' in window)) { setScanMsg('当前浏览器不支持扫码识别，建议用 Chrome，或直接手动登记。'); return }
    setScanMsg('已调用扫码识别（Chrome 支持），对准设施二维码即可。')
  }
  return (
    <section className="mobile-card inspection-card">
      <div className="card-head"><div><strong>消防设施扫码巡检</strong><small>灭火器、消火栓定期检查与到期提醒</small></div><QrCode size={18} /></div>
      <button type="button" className="inspection-scan" onClick={tryScan}><ScanLine size={15} />扫码检查</button>
      {scanMsg && <p className="inspection-scan-msg">{scanMsg}</p>}
      <div className="inspection-list">
        {records.map((f) => (
          <div className={`inspection-row ${f.status === '临近到期' ? 'warn' : ''}`} key={f.id}>
            <span className="inspection-icon"><QrCode size={15} /></span>
            <div><strong>{f.name} · {f.code}</strong><small>{f.location}{f.last ? ` · 上次检查 ${f.last}` : ''}</small><em>有效期至 {f.expire}</em></div>
            <button type="button" onClick={() => inspect(f.id)}><CheckCircle2 size={14} />登记</button>
          </div>
        ))}
      </div>
    </section>
  )
}

const FIRE_KB = [
  { kw: ['灭火器', '怎么用', '使用'], answer: '干粉灭火器口诀「提拔握压」：提起灭火器 → 拔掉保险销 → 握住喷管对准火源根部 → 压下压把扫射。使用前先确认火势较小且疏散通道畅通。' },
  { kw: ['温度', '多少度', '正常'], answer: '一般设备表面温度 40-60°C 需关注，超过 65°C 建议现场核查，超过 80°C 应视为高风险并立即处置。具体阈值需结合设备类型与环境。' },
  { kw: ['报警', '119', '电话'], answer: '发现火情先保证自身安全，迅速拨打 119，说清地址、起火物、火势大小、是否有人被困，并到路口引导消防车。' },
  { kw: ['疏散', '逃生', '撤离'], answer: '用湿毛巾捂住口鼻、低姿前行，沿疏散指示和绿色路线撤离，不乘坐电梯，不要返回取物，到安全集合点后向负责人报告。' },
  { kw: ['电气', '火灾', '线路'], answer: '电气火灾先切断电源，切勿用水扑救带电设备，使用干粉或二氧化碳灭火器，并通知专业电工检查线路。' },
  { kw: ['烟雾', '烟'], answer: '烟雾含有毒气且向上聚集，逃生时尽量贴近地面，用湿布捂住口鼻，避免吸入浓烟。' },
]

function FireAssistant() {
  const [input, setInput] = useState('')
  const [msgs, setMsgs] = useState([{ role: 'bot', text: '你好，我是消防知识助手。可以问我：灭火器怎么用、多少度算危险、如何疏散逃生、电气火灾怎么办等。' }])
  const ask = () => {
    const q = input.trim()
    if (!q) return
    const found = FIRE_KB.find((item) => item.kw.some((k) => q.includes(k)))
    const answer = found ? found.answer : '我暂时只能回答消防常见问题。你可以尝试输入：灭火器使用、温度阈值、报警、疏散、电气火灾、烟雾。'
    setMsgs((m) => [...m, { role: 'user', text: q }, { role: 'bot', text: answer }])
    setInput('')
  }
  return (
    <section className="mobile-card assistant-card">
      <div className="card-head"><div><strong>AI 消防知识助手</strong><small>本地知识库问答，可扩展接入大模型</small></div><MessageCircle size={18} /></div>
      <div className="assistant-log">
        {msgs.map((m, i) => <div className={`assistant-msg ${m.role}`} key={i}>{m.text}</div>)}
      </div>
      <div className="assistant-input"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') ask() }} placeholder="输入问题，例如：灭火器怎么用" /><button type="button" onClick={ask}><Send size={15} /></button></div>
      <p className="situation-note"><Info size={12} />当前为本地规则问答（不联网），可替换为 OpenAI 兼容接口实现真正大模型问答。</p>
    </section>
  )
}

function HazardReport() {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('thermalGuardHazards') || '[]') } catch { return [] } })
  const [desc, setDesc] = useState('')
  const [loc, setLoc] = useState('')
  const [img, setImg] = useState('')
  const fileRef = useRef(null)

  const pickImage = (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setImg(reader.result)
    reader.readAsDataURL(file)
  }
  const submit = () => {
    if (!desc.trim() && !loc.trim()) return
    const next = [{ id: `hz-${Date.now()}`, desc: desc.trim() || '未描述', loc: loc.trim() || '未填写位置', img, time: new Date().toLocaleString('zh-CN', { hour12: false }) }, ...items].slice(0, 20)
    setItems(next)
    localStorage.setItem('thermalGuardHazards', JSON.stringify(next))
    setDesc(''); setLoc(''); setImg('')
  }
  return (
    <section className="mobile-card hazard-card">
      <div className="card-head"><div><strong>隐患随手拍上报</strong><small>拍照记录隐患位置，纳入待处理清单</small></div><Camera size={18} /></div>
      <div className="hazard-form">
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="隐患位置，例如：三楼配电箱旁" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="隐患描述，例如：线路发热、堆放可燃物" rows={2} />
        <div className="hazard-photo-row">
          <button type="button" onClick={() => fileRef.current?.click()}><Camera size={14} />{img ? '更换照片' : '拍照/选图'}</button>
          {img && <img className="hazard-thumb" src={img} alt="隐患照片" />}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickImage} style={{ display: 'none' }} />
        </div>
        <button type="button" className="hazard-submit" onClick={submit}><Send size={14} />提交隐患</button>
      </div>
      {items.length > 0 && <div className="hazard-list">{items.map((h) => <div className="hazard-row" key={h.id}><span><AlertTriangle size={14} /></span><div><strong>{h.loc}</strong><p>{h.desc}</p><small>{h.time}</small></div>{h.img && <img src={h.img} alt="" />}</div>)}</div>}
    </section>
  )
}

const DEFAULT_LLM = { endpoint: 'https://api.deepseek.com/v1', apiKey: 'sk-dc844ba5cb154106a6fb568d79ce3948', model: 'deepseek-chat' }

const LLM_PRESETS = [
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'moonshot', name: 'Kimi', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'zhipu', name: '智谱GLM', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-flash' },
  { id: 'qwen', name: '通义千问', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
]

function localFireAnswer(q) {
  const found = FIRE_KB.find((item) => item.kw.some((k) => q.includes(k)))
  return found ? found.answer : '这个问题建议联网回答：点右上角「设置」填入大模型 API 地址即可接入。内置知识库可回答：灭火器使用、温度阈值、报警、疏散、电气火灾、烟雾等。'
}

function loadLlmConfig() {
  try {
    const saved = JSON.parse(localStorage.getItem('thermalGuardLlm') || 'null')
    return { ...DEFAULT_LLM, ...(saved || {}) }
  } catch { return { ...DEFAULT_LLM } }
}

function AiSprite({ frame, open, onOpenChange }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: '你好，我是 AI 火警精灵。问我消防问题，或点右上角设置接入联网大模型。' }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState(() => loadLlmConfig())
  const [testState, setTestState] = useState('')
  const listRef = useRef(null)

  useEffect(() => { try { localStorage.setItem('thermalGuardLlm', JSON.stringify(config)) } catch {} }, [config])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [msgs, thinking, showSettings])

  const llmReady = Boolean(config.endpoint && config.apiKey)

  const callLLM = async (question) => {
    const base = config.endpoint.trim().replace(/\/+$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    const history = msgs.slice(-8).map((m) => ({ role: m.role, content: m.text }))
    const system = `你是「燧瞳智感」AI火警网警的消防助手。当前检测状态：风险${riskTitle(frame?.risk || 'low')}，最高温${Number(frame?.maxTemp || 0).toFixed(1)}°C，高温区域${frame?.hotspots?.length || 0}处。请用简体中文，回答简洁专业。`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim() || 'gpt-4o-mini', messages: [{ role: 'system', content: system }, ...history, { role: 'user', content: question }], temperature: 0.4 }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || data.choices?.[0]?.text || data.output_text || null
  }

  const send = async () => {
    const q = input.trim()
    if (!q || thinking) return
    setMsgs((m) => [...m, { role: 'user', text: q }])
    setInput('')
    setThinking(true)
    let answer = null
    if (llmReady) { try { answer = await callLLM(q) } catch { answer = null } }
    if (!answer) {
      answer = localFireAnswer(q)
      if (llmReady) answer += '\n\n（大模型连接失败，已回退本地知识库）'
    }
    setMsgs((m) => [...m, { role: 'assistant', text: answer }])
    setThinking(false)
  }

  const testConnection = async () => {
    if (!llmReady) { setTestState('请先填写 API 地址和密钥'); return }
    setTestState('测试中…')
    try {
      const reply = await callLLM('请只回复：连接成功')
      setTestState(reply ? '连接成功' : '未收到有效回复')
    } catch (e) {
      setTestState(`连接失败：${e.message}`)
    }
  }

  return (
    <>
      <button type="button" className={`ai-sprite-fab ${open ? 'hidden' : ''}`} onClick={() => onOpenChange(true)} aria-label="打开AI精灵">
        <Sparkles size={22} />
        <span className="sprite-dot" />
      </button>

      {open && (
        <div className="sprite-backdrop" onClick={() => onOpenChange(false)}>
          <section className="sprite-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-handle" />
            <div className="sprite-head">
              <div className="sprite-avatar"><Sparkles size={18} /></div>
              <div><strong>AI 火警精灵</strong><small>{llmReady ? '已接入联网大模型' : '本地知识库 · 可联网'}</small></div>
              <div className="sprite-head-actions">
                <button type="button" onClick={() => setShowSettings((v) => !v)} aria-label="设置"><Cpu size={17} /></button>
                <button type="button" onClick={() => onOpenChange(false)} aria-label="关闭"><X size={18} /></button>
              </div>
            </div>

            {showSettings ? (
              <div className="sprite-settings">
                <div className="sprite-settings-head"><strong>接入联网大模型</strong><small>一键选择服务商，填入密钥即可</small></div>
                <div className="sprite-presets">
                  {LLM_PRESETS.map((p) => <button type="button" key={p.id} className={config.endpoint === p.endpoint ? 'active' : ''} onClick={() => setConfig((c) => ({ ...c, endpoint: p.endpoint, model: p.model }))}>{p.name}</button>)}
                </div>
                <label>API 地址<input value={config.endpoint} onChange={(e) => setConfig((c) => ({ ...c, endpoint: e.target.value }))} placeholder="https://api.openai.com/v1" inputMode="url" autoCapitalize="none" /></label>
                <label>API 密钥<input type="password" value={config.apiKey} onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))} placeholder="sk-..." autoCapitalize="none" /></label>
                <label>模型<input value={config.model} onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))} placeholder="gpt-4o-mini / deepseek-chat" /></label>
                <div className="sprite-settings-actions">
                  <button type="button" onClick={testConnection}><Link2 size={14} />测试连接</button>
                  <button type="button" onClick={() => setShowSettings(false)}>返回对话</button>
                </div>
                {testState && <p className="sprite-test-state">{testState}</p>}
                <p className="sprite-settings-note"><Info size={12} />密钥仅保存在本机浏览器（localStorage），仅供演示；接口需允许跨域(CORS)。</p>
              </div>
            ) : (
              <>
                <div className="sprite-log" ref={listRef}>
                  {msgs.map((m, i) => <div className={`sprite-msg ${m.role}`} key={i}>{m.text}</div>)}
                  {thinking && <div className="sprite-msg assistant thinking"><LoaderCircle className="spin" size={14} />正在思考…</div>}
                </div>
                <div className="sprite-input">
                  <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder={llmReady ? '问我任何问题…' : '输入消防问题，或接入大模型后可问任何问题'} />
                  <button type="button" onClick={send} disabled={thinking}><Send size={16} /></button>
                </div>
              </>
            )}
          </section>
        </div>
      )}
    </>
  )
}

function openPdfReport(report) {
  const row = (label, value) => `<tr><td>${label}</td><td>${value}</td></tr>`
  const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>AI火警处置报告</title>
  <style>
    body{font-family:-apple-system,'PingFang SC','Microsoft YaHei',sans-serif;color:#0f172a;margin:0;padding:32px}
    h1{font-size:22px;margin:0 0 4px} .sub{color:#64748b;font-size:12px;margin-bottom:18px}
    h2{font-size:15px;color:#1d4ed8;border-left:4px solid #3b82f6;padding-left:8px;margin:20px 0 10px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td{padding:9px 10px;border:1px solid #e2e8f0} td:first-child{width:130px;background:#f8fafc;color:#475569}
    .risk{display:inline-block;padding:2px 10px;border-radius:999px;color:#fff;font-weight:700}
    .footer{margin-top:26px;color:#94a3b8;font-size:11px}
    @media print{body{padding:10px}}
  </style></head><body>
  <h1>AI火警网警 · 应急处置报告</h1><div class="sub">${report.system} · 生成时间 ${report.generatedAt}</div>
  <h2>一、风险概况</h2><table>
  ${row('检测位置', report.location)}
  ${row('风险等级', `<span class="risk" style="background:${report.risk === 'high' ? '#ef4444' : report.risk === 'medium' ? '#f59e0b' : '#22c55e'}">${report.riskLabel}</span>`)}
  ${row('风险指数', `${report.riskIndex} / 100`)}
  ${row('最高温度', `${report.maxTemp.toFixed(1)}°C`)}
  ${row('高温区域', `${report.hotspotCount} 处`)}
  </table>
  <h2>二、疏散建议</h2><table>
  ${row('推荐出口', report.recommendedExit)}
  ${row('疏散距离', `${report.evacuationDistance} 米`)}
  ${row('预计用时', `${report.evacuationEta} 秒`)}
  </table>
  <h2>三、处置建议</h2><p>立即核查高温区域电源与可燃物，启动声光报警与应急广播，按绿色路线组织疏散，并拨打 119。持续监测温度趋势，留存全过程证据链。</p>
  <div class="footer">本报告由「燧瞳智感 AI火警网警系统」自动生成，仅用于科研演示，不替代专业消防检测与处置。</div>
  </body></html>`
  const w = window.open('', '_blank')
  if (w) {
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { try { w.print() } catch {} }, 350)
  } else {
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  }
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState(initialActiveTab)
  const [showDevices, setShowDevices] = useState(false)
  const [phase, setPhase] = useState(0)
  const [frame, setFrame] = useState(() => createFrame())
  const [image, setImage] = useState('')
  const [fileName, setFileName] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [detected, setDetected] = useState(false)
  const [result, setResult] = useState(createFrame())
  const [alerts, setAlerts] = useState(sampleAlerts)
  const [devices, setDevices] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem('thermalGuardDevices') || 'null'); return Array.isArray(saved) && saved.length ? saved : initialDevices } catch { return initialDevices }
  })
  const [activeDevice, setActiveDevice] = useState(null)
  const [connection, setConnection] = useState('simulator')
  const [error, setError] = useState('')
  const [cameras, setCameras] = useState(initialCameraState)
  const [selectedCameraId, setSelectedCameraId] = useState(() => initialCameraState()[0].id)
  const [cameraSheet, setCameraSheet] = useState(null)
  const [toast, setToast] = useState('')
  const [inference, setInference] = useState(() => computeInference(createFrame(), null, null))
  const [showDrill, setShowDrill] = useState(false)
  const [showCommandCenter, setShowCommandCenter] = useState(() => { try { return new URLSearchParams(window.location.search).get('cmd') === '1' } catch { return false } })
  const [spriteOpen, setSpriteOpen] = useState(false)
  const [aiGatewayUrl, setAiGatewayUrl] = useState(() => { try { return localStorage.getItem('thermalGuardAIGateway') || 'ws://127.0.0.1:8787/ws/detections' } catch { return 'ws://127.0.0.1:8787/ws/detections' } })
  const [aiConnection, setAiConnection] = useState('disconnected')
  const [aiDetections, setAiDetections] = useState([])
  const previousFrameRef = useRef(null)
  const timerRef = useRef(null)
  const socketRef = useRef(null)
  const aiSocketRef = useRef(null)
  const aiAlertRef = useRef(0)
  const inputCameraRef = useRef(null)
  const inputGalleryRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('thermalGuardDevices', JSON.stringify(devices))
  }, [devices])

  useEffect(() => {
    localStorage.setItem('thermalGuardCameras', JSON.stringify(cameras))
  }, [cameras])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    setInference((current) => computeInference(frame, previousFrameRef.current, current))
    previousFrameRef.current = frame
  }, [frame])

  useEffect(() => {
    if (connection === 'connected') return undefined
    const timer = setInterval(() => setPhase((value) => value + 1), 320)
    return () => clearInterval(timer)
  }, [connection])

  useEffect(() => {
    if (connection !== 'connected') setFrame(createFrame(phase))
  }, [phase, connection])

  useEffect(() => () => {
    clearInterval(timerRef.current)
    socketRef.current?.close()
    aiSocketRef.current?.close()
  }, [])

  const handleImage = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      setImage(event.target.result)
      setFileName(file.name)
      setDetected(false)
      setProgress(0)
    }
    reader.readAsDataURL(file)
  }

  const resetDetection = () => {
    clearInterval(timerRef.current)
    setImage('')
    setFileName('')
    setDetected(false)
    setDetecting(false)
    setProgress(0)
  }

  const runDetection = () => {
    if (!image || detecting) return
    clearInterval(timerRef.current)
    setDetected(false)
    setDetecting(true)
    setProgress(3)
    let value = 3
    timerRef.current = setInterval(() => {
      value += Math.round(Math.random() * 9 + 8)
      if (value >= 100) {
        value = 100
        clearInterval(timerRef.current)
        window.setTimeout(() => {
          const nextResult = createFrame(phase)
          const nextInference = computeInference(nextResult, frame, inference)
          setResult(nextResult)
          setFrame(nextResult)
          setDetected(true)
          setDetecting(false)
          setAlerts((current) => [{ id: `local-${Date.now()}`, time: new Date().toLocaleString('zh-CN', { hour12: false }), risk: nextResult.risk, zone: '手机端实时检测', temp: nextResult.maxTemp, hotspots: nextResult.hotspots.length, inference: nextInference }, ...current].slice(0, 30))
        }, 260)
      }
      setProgress(Math.min(value, 99))
    }, 110)
  }

  const disconnect = () => {
    socketRef.current?.close()
    socketRef.current = null
    setActiveDevice(null)
    setConnection('simulator')
    setError('')
  }

  const connectDevice = (device) => {
    disconnect()
    let parsed
    try { parsed = new URL(device.url) } catch { setConnection('failed'); setError('设备地址格式不正确'); return }
    if (location.protocol === 'https:' && parsed.protocol === 'ws:') {
      setConnection('failed')
      setError('手机网页使用 HTTPS 时不能连接 ws://，请改用 wss:// 安全地址。')
      return
    }
    setActiveDevice(device)
    setConnection('connecting')
    setError('')
    const socket = new WebSocket(device.url)
    socketRef.current = socket
    socket.onopen = () => setConnection('connected')
    socket.onmessage = (event) => {
      try { setFrame(normalizePacket(JSON.parse(event.data))) } catch { setError('收到数据，但 JSON 格式不正确') }
    }
    socket.onerror = () => { setConnection('failed'); setError('无法连接设备，请检查地址、网络与安全证书。') }
    socket.onclose = () => { if (socketRef.current === socket) setConnection('simulator') }
  }

  const saveDevice = (id, values) => {
    if (id) setDevices((current) => current.map((device) => device.id === id ? { ...device, ...values } : device))
    else setDevices((current) => [...current, { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`, ...values }])
  }

  const disconnectAIGateway = () => {
    aiSocketRef.current?.close()
    aiSocketRef.current = null
    setAiConnection('disconnected')
    setAiDetections([])
  }

  const connectAIGateway = (url) => {
    disconnectAIGateway()
    let parsed
    try { parsed = new URL(url) } catch { setAiConnection('failed'); setToast('AI网关地址格式不正确'); return }
    if (location.protocol === 'https:' && parsed.protocol === 'ws:') {
      setAiConnection('failed')
      setToast('HTTPS页面需要 wss:// AI网关地址')
      return
    }
    setAiConnection('connecting')
    const socket = new WebSocket(url)
    aiSocketRef.current = socket
    socket.onopen = () => { setAiConnection('connected'); setToast('AI检测网关已连接') }
    socket.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data)
        const detections = Array.isArray(payload.detections) ? payload.detections : []
        setAiDetections(detections)
        if (payload.hotspots?.length || payload.max_temp || payload.risk) {
          setFrame((current) => ({
            ...current,
            maxTemp: Number(payload.max_temp ?? current.maxTemp),
            risk: payload.risk || current.risk,
            hotspots: payload.hotspots?.length ? payload.hotspots.map((spot) => ({ x: Number(spot.x || 0) * 100, y: Number(spot.y || 0) * 100, w: Number(spot.width || 0.15) * 100, h: Number(spot.height || 0.18) * 100, temp: Number(spot.temp ?? payload.max_temp ?? current.maxTemp) })) : current.hotspots,
            source: payload.source || '笔记本AI网关',
          }))
        }
        if (payload.risk === 'high' && Date.now() - aiAlertRef.current > 15000) {
          aiAlertRef.current = Date.now()
          setToast('AI网关识别到高风险火情')
          setAlerts((current) => [{ id: `ai-${Date.now()}`, time: new Date().toLocaleString('zh-CN', { hour12: false }), risk: 'high', zone: payload.camera_id || 'AI监控区域', temp: Number(payload.max_temp || 0), hotspots: payload.hotspots?.length || 1 }, ...current].slice(0, 30))
        }
      } catch {}
    }
    socket.onerror = () => { setAiConnection('failed'); setToast('无法连接AI检测网关') }
    socket.onclose = () => { if (aiSocketRef.current === socket) setAiConnection('disconnected') }
  }

  const selectedCamera = cameras.find((camera) => camera.id === selectedCameraId) || cameras[0]

  const saveCamera = (values) => {
    if (cameraSheet?.camera) {
      setCameras((current) => current.map((camera) => camera.id === cameraSheet.camera.id ? { ...camera, ...values } : camera))
    } else {
      const next = { id: globalThis.crypto?.randomUUID?.() || `camera-${Date.now()}`, ...values }
      setCameras((current) => [...current, next])
      setSelectedCameraId(next.id)
    }
    setCameraSheet(null)
  }

  const exportEvidence = (alert) => {
    const report = {
      system: '燧瞳智感 AI火警网警系统',
      exportTime: new Date().toLocaleString('zh-CN', { hour12: false }),
      incident: {
        time: alert.time,
        zone: alert.zone,
        risk: riskTitle(alert.risk),
        maxTemp: alert.temp,
        hotspots: alert.hotspots,
      },
      chain: evidenceForAlert(alert, alert.inference),
    }
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `燧瞳智感-证据链-${alert.id || Date.now()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('证据链报告已导出')
  }

  const completeDrill = (result) => {
    const evidence = {
      id: `drill-${Date.now()}`,
      time: result.time,
      risk: result.risk,
      zone: '数字消防演练',
      temp: result.maxTemp,
      hotspots: result.steps?.length || 0,
      eventType: 'drill',
      score: result.score,
      rating: result.rating,
      seconds: result.seconds,
      exitLabel: result.exitLabel,
      distance: result.distance,
      eta: result.eta,
      stepCount: result.steps?.length || 0,
      totalSteps: result.totalSteps || DRILL_STEPS.length,
      path: result.path,
      inference: { confidence: result.score / 100, stages: [], reasons: [`演练得分 ${result.score}`, `评级 ${result.rating}`, `撤离用时 ${result.seconds} 秒`] },
    }
    setAlerts((current) => [evidence, ...current].slice(0, 30))
    setToast(`演练完成，得分 ${result.score}（${result.rating}）`)
  }

  const shareCamera = async (camera) => {
    if (!camera?.public) {
      setToast('授权监控不可公开分享')
      return
    }
    const url = new URL(location.href)
    url.search = ''
    url.hash = ''
    url.searchParams.set('camera', encodeCamera(camera))
    url.searchParams.set('view', 'camera')
    try {
      await navigator.clipboard.writeText(url.toString())
      setToast('公开监控分享链接已复制')
    } catch {
      setToast('复制失败，请使用浏览器地址栏分享')
    }
  }

  const handleQuickNav = (action) => {
    if (action === 'command') { setActiveTab('dashboard'); setShowCommandCenter(true) }
    else if (action === 'drill') { setShowDrill(true) }
    else if (action === 'assistant') { setSpriteOpen(true) }
    else if (action === 'gps') { setActiveTab('guide') }
    else if (action === 'guide') { setActiveTab('guide') }
    else if (action === 'dashboard') { setActiveTab('dashboard') }
    else if (action === 'camera') { setActiveTab('camera') }
    else if (action === 'alerts') { setActiveTab('alerts') }
    else if (action === 'inspect' || action === 'hazard' || action === 'about') { setActiveTab('about') }
  }

  const page = useMemo(() => {
    if (activeTab === 'camera') return <CameraPage cameras={cameras} selectedCamera={selectedCamera} frame={frame} connection={connection} inference={inference} aiGatewayUrl={aiGatewayUrl} onAIUrlChange={setAiGatewayUrl} aiConnection={aiConnection} aiDetections={aiDetections} onConnectAI={connectAIGateway} onDisconnectAI={disconnectAIGateway} onSelect={(camera) => setSelectedCameraId(camera.id)} onAdd={() => setCameraSheet({ camera: null })} onEdit={(camera) => setCameraSheet({ camera })} onDelete={(id) => { setCameras((current) => current.filter((camera) => camera.id !== id)); if (selectedCameraId === id) setSelectedCameraId(cameras.find((camera) => camera.id !== id)?.id || '') }} canShare={Boolean(selectedCamera?.public)} onShare={shareCamera} />
    if (activeTab === 'alerts') return <AlertsPage alerts={alerts} onExportEvidence={exportEvidence} />
    if (activeTab === 'dashboard') return <DashboardPage frame={frame} inference={inference} onOpenCommand={() => setShowCommandCenter(true)} />
    if (activeTab === 'guide') return <CompassPage frame={frame} />
    if (activeTab === 'about') return <AboutPage onStartDrill={() => setShowDrill(true)} />
    return <HomePage inputCameraRef={inputCameraRef} inputGalleryRef={inputGalleryRef} image={image} fileName={fileName} detecting={detecting} progress={progress} detected={detected} result={result} inference={inference} onImage={handleImage} onSample={() => { setImage(DEMO_THERMAL); setFileName('示例热成像-01.jpg'); setDetected(false) }} onReset={resetDetection} onDetect={runDetection} onQuickNav={handleQuickNav} />
  }, [activeTab, alerts, cameras, selectedCamera, selectedCameraId, frame, connection, inference, aiGatewayUrl, aiConnection, aiDetections, image, fileName, detecting, progress, detected, result, phase])

  return (
    <div className="mobile-app-shell">
      <header className="mobile-topbar">
        <div className="mobile-brand"><span><Flame size={19} /></span><div><strong>燧瞳智感</strong><small>AI火警网警</small></div></div>
        <div className="top-actions"><ConnectionBadge state={connection} /><button type="button" aria-label="AI指挥中心" onClick={() => setShowCommandCenter(true)}><Siren size={18} /></button><button type="button" aria-label="设备管理" onClick={() => setShowDevices(true)}><Cable size={18} /></button></div>
      </header>
      <main className="mobile-main">{page}</main>
      <nav className="mobile-tabs">
        {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      {showDevices && <DeviceSheet devices={devices} activeDevice={activeDevice} connection={connection} error={error} onClose={() => setShowDevices(false)} onConnect={connectDevice} onDisconnect={disconnect} onSave={saveDevice} onDelete={(id) => setDevices((current) => current.filter((device) => device.id !== id))} />}
      {cameraSheet && <CameraSheet editing={cameraSheet.camera} onClose={() => setCameraSheet(null)} onSave={saveCamera} />}
      {showDrill && <DrillMode frame={frame} onClose={() => setShowDrill(false)} onComplete={completeDrill} onViewEvidence={() => { setShowDrill(false); setActiveTab('alerts') }} />}
      {showCommandCenter && <CommandCenter frame={frame} inference={inference} onClose={() => setShowCommandCenter(false)} onStartDrill={() => { setShowCommandCenter(false); setShowDrill(true) }} />}
      <AiSprite frame={frame} open={spriteOpen} onOpenChange={setSpriteOpen} />
            {toast && <div className="toast-message">{toast}</div>}
    </div>
  )
}
