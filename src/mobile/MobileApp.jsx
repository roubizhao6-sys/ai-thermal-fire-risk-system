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
  X,
  Zap,
} from 'lucide-react'

const DEMO_THERMAL = `${import.meta.env.BASE_URL}demo-thermal.jpg`
const DEMO_LIVE = `${import.meta.env.BASE_URL}demo-live.gif`

const tabs = [
  { id: 'home', label: '首页检测', icon: ScanLine },
  { id: 'camera', label: '现场监控', icon: Video },
  { id: 'alerts', label: '预警记录', icon: BellRing },
  { id: 'dashboard', label: '数据看板', icon: BarChart3 },
  { id: 'guide', label: '疏散导航', icon: Compass },
  { id: 'about', label: '关于项目', icon: Layers3 },
]

const defaultCameras = [
  { id: 'thermal-board-sim', name: '模拟热成像板', location: '实验室 P11', type: 'sensor', url: 'sensor://esp32-sim', public: true },
  { id: 'demo-live', name: '热感监控演示', location: '三楼东侧走廊', type: 'demo', url: DEMO_LIVE, public: true },
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

function HomePage({ inputCameraRef, inputGalleryRef, image, fileName, detecting, progress, detected, result, inference, onImage, onSample, onReset, onDetect }) {
  return (
    <div className="mobile-page home-page">
      <header className="home-header">
        <div className="guard-pill"><Sparkles size={13} />AI 火警网警</div>
        <h1>AI热感火警风险检测</h1>
        <p>超早期温度预警 · 多维度智能判断</p>
      </header>

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
          <h2>{selected.zone}</h2>
          <div className="detail-grid alert-detail-grid"><div><Thermometer size={16} /><span>最高温度</span><strong>{selected.temp.toFixed(1)}°C</strong></div><div><MapPin size={16} /><span>高温区域</span><strong>{selected.hotspots} 处</strong></div></div>
          <div className="advice-box"><ShieldAlert size={18} /><div><strong>{riskAdvice(selected.risk)}</strong><p>{selected.risk === 'high' ? '立即核查电源、设备与周边可燃物，确认疏散通道畅通。' : selected.risk === 'medium' ? '安排人员现场检查设备运行状态，持续观察温升趋势。' : '当前无明显异常，保持规律巡检。'}</p></div></div>
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
          <span className="alert-icon"><AlertTriangle size={18} /></span>
          <div><strong>{item.zone}</strong><small>{item.time}</small><em>{item.hotspots} 个高温区域 · 最高 {item.temp.toFixed(1)}°C</em></div>
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
      <section className="compass-hero-card">
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
      </section>

      {!tracking && <button type="button" className="compass-enable compass-enable-large" onClick={enableCompass}><Compass size={16} />开启手机指南针并开始引导</button>}
      <div className="compass-status compass-status-page"><span><i className={tracking ? 'online' : ''} />{tracking ? `实时方向 ${Math.round(heading)}°` : permission === 'denied' ? '未授权，使用模拟方向演示' : '当前为模拟方向'}</span><b>最高温 {Number(frame?.maxTemp || 0).toFixed(1)}°C</b></div>

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

function LivePlayer({ camera, frame, viewMode, detections = [] }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleString('zh-CN', { hour12: false }))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN', { hour12: false })), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!camera || viewMode === 'thermal3d' || viewMode === 'building' || viewMode === 'campus' || camera.type === 'sensor' || camera.type === 'demo' || camera.type === 'mjpeg') return undefined
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
      <div className="live-grid" />
      {viewMode === 'camera' && <div className="detection-layer">{detections.map((item, index) => { const box = item.bbox || [0, 0, 0.1, 0.1]; const label = item.class === 'smoke' ? '烟雾' : item.class === 'flame' || item.class === 'fire' ? '明火' : item.class === 'person' ? '人员' : '热点'; return <div className={`detection-box detection-${item.class}`} key={`${item.class}-${index}`} style={{ left: `${Number(box[0]) * 100}%`, top: `${Number(box[1]) * 100}%`, width: `${Number(box[2]) * 100}%`, height: `${Number(box[3]) * 100}%` }}><span>{label}</span><b>{Math.round(Number(item.confidence || 0) * 100)}%</b></div> })}</div>}
      {camera.type === 'demo' && <div className="live-scan" />}
      <div className="live-status"><i />{viewMode === 'campus' ? '科大数字孪生' : viewMode === 'building' ? '3D大楼模拟' : viewMode === 'thermal3d' || camera.type === 'sensor' ? '热感板联动' : camera.type === 'demo' ? '公开演示流' : camera.public ? '公开监控' : '本机监控'}</div>
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


function DrillMode({ frame, onClose, onComplete }) {
  const [phase, setPhase] = useState('ready')
  const [countdown, setCountdown] = useState(3)
  const [elapsed, setElapsed] = useState(0)
  const [result, setResult] = useState(null)
  const route = useMemo(() => planEvacuation(frame), [frame])

  useEffect(() => {
    if (phase === 'running' && countdown > 0) {
      const timer = setTimeout(() => setCountdown((value) => value - 1), 1000)
      return () => clearTimeout(timer)
    }
    if (phase === 'running' && countdown === 0) {
      const timer = setInterval(() => setElapsed((value) => value + 1), 1000)
      return () => clearInterval(timer)
    }
    return undefined
  }, [phase, countdown])

  const finishDrill = () => {
    const score = Math.max(60, Math.min(100, 100 - elapsed + (frame?.risk === 'high' ? 4 : 0)))
    const next = {
      score,
      seconds: elapsed,
      route,
      risk: frame?.risk || 'low',
      maxTemp: Number(frame?.maxTemp || 0),
      time: new Date().toLocaleString('zh-CN', { hour12: false }),
    }
    setResult(next)
    setPhase('complete')
    onComplete(next)
  }

  return (
    <div className="drill-overlay">
      <section className="drill-sheet">
        <div className="sheet-handle" />
        <div className="drill-head"><div><span>数字消防演练</span><strong>{phase === 'ready' ? '演练准备' : phase === 'complete' ? '演练完成' : '正在演练'}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        {phase === 'ready' && <div className="drill-body">
          <div className="drill-scenario"><ShieldAlert size={20} /><p>模拟场景：<strong>{riskTitle(frame?.risk || 'low')}</strong>，最高温度 {Number(frame?.maxTemp || 0).toFixed(1)}°C。请按推荐路线完成撤离，并记录你的反应时间。</p></div>
          <button type="button" className="sheet-save" onClick={() => { setPhase('running'); setCountdown(3); setElapsed(0) }}><Play size={16} />开始演练</button>
        </div>}
        {phase === 'running' && <div className="drill-body">
          {countdown > 0 ? <div className="drill-countdown">{countdown}</div> : <div className="drill-running">
            <div className="drill-timer"><Clock3 size={15} />已用时 <strong>{elapsed}</strong> 秒</div>
            <AIGatewayPanel url={aiGatewayUrl} onChange={onAIUrlChange} status={aiConnection} detections={aiDetections} onConnect={onConnectAI} onDisconnect={onDisconnectAI} />
      {viewMode === 'campus' && <CampusBuildingPanel />}
      <DigitalTwinView frame={frame} route={route} />
            <button type="button" className="sheet-save" onClick={finishDrill}><CheckCircle2 size={16} />已完成撤离</button>
          </div>}
        </div>}
        {phase === 'complete' && <div className="drill-body drill-result">
          <div className="drill-score"><strong>{result?.score ?? 92}</strong><span>演练得分</span></div>
          <p>本次撤离用时 {result?.seconds ?? 0} 秒，系统已生成一条证据记录，可到“预警记录”中查看。</p>
          <button type="button" className="sheet-save" onClick={onClose}>关闭演练</button>
        </div>}
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
  const valid = name.trim() && (type === 'demo' || type === 'sensor' || /^https?:\/\//i.test(url.trim()))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><div><span>监控联动</span><strong>{editing ? '编辑监控' : '添加监控'}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        <label>监控名称<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：三楼东侧走廊" /></label>
        <label>安装位置<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：消防通道入口" /></label>
        <label>监控类型<select value={type} onChange={(e) => { setType(e.target.value); if (e.target.value === 'demo') setUrl(DEMO_LIVE); if (e.target.value === 'sensor') setUrl('sensor://esp32-sim') }}><option value="hls">HLS 实时流</option><option value="mjpeg">MJPEG 实时流</option><option value="sensor">3D 热感模拟板</option><option value="demo">内置公开演示流</option></select></label>
        <label>监控地址<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/live.m3u8" inputMode="url" autoCapitalize="none" disabled={type === 'demo' || type === 'sensor'} /></label>
        <label className="public-toggle"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /><span><strong>允许通过分享链接公开查看</strong><small>请勿公开包含人员、住宅、门禁或消防设施细节的画面</small></span></label>
        <div className="sheet-tip"><Info size={14} />RTSP 地址不能被手机浏览器直接播放，需要海康、大华 NVR 或媒体网关转换为 HLS/WebRTC。</div>
        <button className="sheet-save" type="button" disabled={!valid} onClick={() => onSave({ name: name.trim(), location: location.trim(), type, url: type === 'demo' ? DEMO_LIVE : type === 'sensor' ? 'sensor://esp32-sim' : url.trim(), public: isPublic })}><Save size={16} />保存监控</button>
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
            <div className="camera-info"><strong>{camera.name}</strong><small>{camera.location || '未设置位置'}</small><em>{camera.type === 'sensor' ? '3D热感板' : camera.type === 'demo' ? '演示流' : camera.type.toUpperCase()}</em></div>
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
      <div className="dashboard-grid">{stats.map(([label, value, unit, change, Icon, tone]) => <article className={`dashboard-stat tone-${tone}`} key={label}><span><Icon size={16} /></span><p>{label}</p><strong>{value}<small>{unit}</small></strong><em>{change}</em></article>)}</div>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>风险趋势</strong><small>近30日最高温度预警指数</small></div><TrendingUp size={18} /></div><LineChart /></section>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>隐患类型分布</strong><small>高频隐患分类统计</small></div><BarChart3 size={18} /></div><div className="bar-chart">{[['电气过热', 72], ['设备异常', 58], ['环境温升', 44], ['线路老化', 31], ['其他', 26]].map(([label, value], index) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${value}%`, '--bar-delay': `${index * 90}ms` }} /></div><b>{value}</b></div>)}</div></section>
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
  const downloadReport = () => {
    const report = {
      system: 'AI热感火警风险检测系统',
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
        <div className="command-actions">
          <button type="button" className={broadcast ? 'active' : ''} onClick={speak}><Megaphone size={16} />{broadcast ? '正在广播' : '语音疏散广播'}</button>
          <button type="button" onClick={onStartDrill}><ClipboardCheck size={16} />启动数字演练</button>
          <button type="button" onClick={downloadReport}><Download size={16} />生成处置单</button>
        </div>
      </section>
    </div>
  )
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
      system: 'AI热感火警风险检测系统',
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
    anchor.download = `热感哨兵-证据链-${alert.id || Date.now()}.json`
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
      hotspots: 1,
      inference: { confidence: result.score / 100, stages: [], reasons: [`演练得分 ${result.score}`, `撤离用时 ${result.seconds} 秒`] },
    }
    setAlerts((current) => [evidence, ...current].slice(0, 30))
    setToast(`演练完成，得分 ${result.score}`)
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

  const page = useMemo(() => {
    if (activeTab === 'camera') return <CameraPage cameras={cameras} selectedCamera={selectedCamera} frame={frame} connection={connection} inference={inference} aiGatewayUrl={aiGatewayUrl} onAIUrlChange={setAiGatewayUrl} aiConnection={aiConnection} aiDetections={aiDetections} onConnectAI={connectAIGateway} onDisconnectAI={disconnectAIGateway} onSelect={(camera) => setSelectedCameraId(camera.id)} onAdd={() => setCameraSheet({ camera: null })} onEdit={(camera) => setCameraSheet({ camera })} onDelete={(id) => { setCameras((current) => current.filter((camera) => camera.id !== id)); if (selectedCameraId === id) setSelectedCameraId(cameras.find((camera) => camera.id !== id)?.id || '') }} canShare={Boolean(selectedCamera?.public)} onShare={shareCamera} />
    if (activeTab === 'alerts') return <AlertsPage alerts={alerts} onExportEvidence={exportEvidence} />
    if (activeTab === 'dashboard') return <DashboardPage frame={frame} inference={inference} onOpenCommand={() => setShowCommandCenter(true)} />
    if (activeTab === 'guide') return <CompassPage frame={frame} />
    if (activeTab === 'about') return <AboutPage onStartDrill={() => setShowDrill(true)} />
    return <HomePage inputCameraRef={inputCameraRef} inputGalleryRef={inputGalleryRef} image={image} fileName={fileName} detecting={detecting} progress={progress} detected={detected} result={result} inference={inference} onImage={handleImage} onSample={() => { setImage(DEMO_THERMAL); setFileName('示例热成像-01.jpg'); setDetected(false) }} onReset={resetDetection} onDetect={runDetection} />
  }, [activeTab, alerts, cameras, selectedCamera, selectedCameraId, frame, connection, inference, aiGatewayUrl, aiConnection, aiDetections, image, fileName, detecting, progress, detected, result, phase])

  return (
    <div className="mobile-app-shell">
      <header className="mobile-topbar">
        <div className="mobile-brand"><span><Flame size={19} /></span><div><strong>热感哨兵</strong><small>AI火警网警</small></div></div>
        <div className="top-actions"><ConnectionBadge state={connection} /><button type="button" aria-label="AI指挥中心" onClick={() => setShowCommandCenter(true)}><Siren size={18} /></button><button type="button" aria-label="设备管理" onClick={() => setShowDevices(true)}><Cable size={18} /></button></div>
      </header>
      <main className="mobile-main">{page}</main>
      <nav className="mobile-tabs">
        {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      {showDevices && <DeviceSheet devices={devices} activeDevice={activeDevice} connection={connection} error={error} onClose={() => setShowDevices(false)} onConnect={connectDevice} onDisconnect={disconnect} onSave={saveDevice} onDelete={(id) => setDevices((current) => current.filter((device) => device.id !== id))} />}
      {cameraSheet && <CameraSheet editing={cameraSheet.camera} onClose={() => setCameraSheet(null)} onSave={saveCamera} />}
      {showDrill && <DrillMode frame={frame} onClose={() => setShowDrill(false)} onComplete={completeDrill} />}
      {showCommandCenter && <CommandCenter frame={frame} inference={inference} onClose={() => setShowCommandCenter(false)} onStartDrill={() => { setShowCommandCenter(false); setShowDrill(true) }} />}
      {toast && <div className="toast-message">{toast}</div>}
    </div>
  )
}
