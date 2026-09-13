import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BarChart3,
  BellRing,
  Cable,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Cpu,
  Crosshair,
  Database,
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
  MapPin,
  Navigation,
  Plus,
  Radio,
  RotateCcw,
  Save,
  ScanLine,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Thermometer,
  Trash2,
  TrendingUp,
  TriangleAlert,
  Upload,
  Volume2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'

import AlarmCenterView from './AlarmCenterView.jsx'
import AlarmOverlay from './AlarmOverlay.jsx'
import EvacuationView from './EvacuationView.jsx'
import { positionNodeId } from './building.js'
import { planRoute } from './evacuation.js'
import { DEFAULT_THRESHOLDS, createFrame, normalizePacket, riskFromMaxTemp } from './thermal.js'
import {
  ALARM_VIBRATION_INTERVAL,
  isAudioUnlocked,
  speak,
  startSiren,
  stopSpeak,
  stopSiren,
  stopVibrate,
  supportsVibration,
  unlockAudio,
  vibrateAlarm,
} from './alarm.js'

const DEMO_THERMAL = `${import.meta.env.BASE_URL}demo-thermal.jpg`
const DEMO_LIVE = `${import.meta.env.BASE_URL}demo-live.gif`

const tabs = [
  { id: 'home', label: '首页检测', icon: ScanLine },
  { id: 'camera', label: '现场监控', icon: Video },
  { id: 'alerts', label: '预警记录', icon: BellRing },
  { id: 'alarm', label: '报警中心', icon: ShieldAlert },
  { id: 'evacuation', label: '逃生指引', icon: Navigation },
  { id: 'dashboard', label: '数据看板', icon: BarChart3 },
  { id: 'about', label: '关于项目', icon: Layers3 },
]

const DEFAULT_ALARM_SETTINGS = {
  sound: true,
  voice: true,
  vibrate: true,
  autoTrigger: true,
  escalateSec: 30,
  highThreshold: DEFAULT_THRESHOLDS.high,
  mediumThreshold: DEFAULT_THRESHOLDS.medium,
}

const SPOT_LABELS = { A: 'A 楼梯口', C: '走廊中段', B: 'B 楼梯口' }

function loadStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function nowText() {
  return new Date().toLocaleString('zh-CN', { hour12: false })
}

const defaultCameras = [
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
    if (params.get('camera') || params.get('view') === 'camera') return 'camera'
  } catch {}
  return 'home'
}

function initialCameraState() {
  let base = defaultCameras
  try {
    const saved = JSON.parse(localStorage.getItem('thermalGuardCameras') || 'null')
    if (Array.isArray(saved) && saved.length) base = saved
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

function ConnectionBadge({ state }) {
  const text = state === 'connected' ? '设备在线' : state === 'connecting' ? '连接中' : state === 'failed' ? '连接失败' : '模拟运行'
  return <span className={`connection-badge state-${state}`}><i />{text}</span>
}

function RiskBadge({ risk, compact = false }) {
  return <span className={`risk-badge risk-${risk} ${compact ? 'compact' : ''}`}><i />{riskTitle(risk)}</span>
}

function DeviceSheet({ devices, activeDevice, connection, error, onClose, onConnect, onDisconnect, onSave, onDelete }) {
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', location: '', url: '', floor: 4 })
  const editingDevice = editing && typeof editing === 'object' ? editing : null
  const valid = form.name.trim() && /^wss?:\/\//i.test(form.url.trim())

  const openForm = (device) => {
    setEditing(device || 'new')
    setForm(device ? { name: device.name, location: device.location, url: device.url, floor: device.floor || 4 } : { name: '', location: '', url: '', floor: 4 })
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
          <label>
            安装楼层
            <select value={form.floor} onChange={(e) => setForm({ ...form, floor: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((value) => <option key={value} value={value}>{value} 楼</option>)}
            </select>
          </label>
          <label>WebSocket 地址<input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="wss://设备地址:81/" inputMode="url" autoCapitalize="none" /></label>
          <div className="sheet-tip"><Info size={14} />手机网页使用 HTTPS 时通常只能连接 wss:// 地址；普通 ws:// 可在 Mac App 中使用。</div>
          <button className="sheet-save" type="button" disabled={!valid} onClick={() => { onSave(editingDevice?.id, { name: form.name.trim(), location: form.location.trim(), url: form.url.trim(), floor: form.floor }); setEditing(null) }}><Save size={16} />保存设备</button>
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

function HomePage({ inputCameraRef, inputGalleryRef, image, fileName, detecting, progress, detected, result, onImage, onSample, onReset, onDetect }) {
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
          <div className="early-warning"><Zap size={15} />可在明火、烟雾出现前识别温度异常，实现灾前预警。</div>
        </section>
      )}
    </div>
  )
}

function AlertsPage({ alerts }) {
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


function LivePlayer({ camera }) {
  const videoRef = useRef(null)
  const playerRef = useRef(null)
  const [currentTime, setCurrentTime] = useState(() => new Date().toLocaleString('zh-CN', { hour12: false }))

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date().toLocaleString('zh-CN', { hour12: false })), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!camera || camera.type === 'demo' || camera.type === 'mjpeg') return undefined
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
  }, [camera])

  const enterFullscreen = () => {
    const element = playerRef.current
    if (!element) return
    if (document.fullscreenElement) document.exitFullscreen?.()
    else element.requestFullscreen?.()
  }

  return (
    <div className="live-player" ref={playerRef}>
      {camera.type === 'demo' && <img src={camera.url} alt={`${camera.name}演示监控`} />}
      {camera.type === 'mjpeg' && <img src={camera.url} alt={`${camera.name}实时监控`} />}
      {camera.type === 'hls' && <video ref={videoRef} controls muted autoPlay playsInline />}
      <div className="live-grid" />
      {camera.type === 'demo' && <div className="live-scan" />}
      <div className="live-status"><i />{camera.type === 'demo' ? '公开演示流' : camera.public ? '公开监控' : '本机监控'}</div>
      <div className="live-camera-name"><Video size={14} /><span>{camera.name}</span><small>{camera.location || '未设置位置'}</small></div>
      <button className="fullscreen-button" type="button" onClick={enterFullscreen}><Maximize2 size={16} /></button>
      <div className="live-time">{currentTime}</div>
    </div>
  )
}

function CameraSheet({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || '')
  const [location, setLocation] = useState(editing?.location || '')
  const [type, setType] = useState(editing?.type || 'hls')
  const [url, setUrl] = useState(editing?.url || '')
  const [isPublic, setIsPublic] = useState(Boolean(editing?.public))
  const valid = name.trim() && (type === 'demo' || /^https?:\/\//i.test(url.trim()))

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head"><div><span>监控联动</span><strong>{editing ? '编辑监控' : '添加监控'}</strong></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        <label>监控名称<input value={name} onChange={(e) => setName(e.target.value)} placeholder="例如：三楼东侧走廊" /></label>
        <label>安装位置<input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="例如：消防通道入口" /></label>
        <label>监控类型<select value={type} onChange={(e) => { setType(e.target.value); if (e.target.value === 'demo') setUrl(DEMO_LIVE) }}><option value="hls">HLS 实时流</option><option value="mjpeg">MJPEG 实时流</option><option value="demo">内置公开演示流</option></select></label>
        <label>监控地址<input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com/live.m3u8" inputMode="url" autoCapitalize="none" disabled={type === 'demo'} /></label>
        <label className="public-toggle"><input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} /><span><strong>允许通过分享链接公开查看</strong><small>请勿公开包含人员、住宅、门禁或消防设施细节的画面</small></span></label>
        <div className="sheet-tip"><Info size={14} />RTSP 地址不能被手机浏览器直接播放，需要海康、大华 NVR 或媒体网关转换为 HLS/WebRTC。</div>
        <button className="sheet-save" type="button" disabled={!valid} onClick={() => onSave({ name: name.trim(), location: location.trim(), type, url: type === 'demo' ? DEMO_LIVE : url.trim(), public: isPublic })}><Save size={16} />保存监控</button>
      </section>
    </div>
  )
}

function CameraPage({ cameras, selectedCamera, onSelect, onAdd, onEdit, onDelete, canShare, onShare }) {
  return (
    <div className="mobile-page">
      <header className="page-heading camera-heading"><span>现场监控</span><h1>热成像与监控联动</h1><p>实时查看现场画面，高温预警可直接对应到监控区域</p></header>
      <LivePlayer camera={selectedCamera} />
      <div className="camera-actions">
        <button type="button" className={canShare ? '' : 'disabled'} onClick={() => canShare && onShare(selectedCamera)}><Copy size={15} />分享当前监控</button>
        <button type="button" onClick={onAdd}><Plus size={15} />添加监控</button>
      </div>
      <div className="section-title"><strong>监控列表</strong><span>{cameras.length} 路</span></div>
      <div className="camera-grid">
        {cameras.map((camera) => (
          <article className={`camera-card ${selectedCamera?.id === camera.id ? 'active' : ''}`} key={camera.id} onClick={() => onSelect(camera)}>
            <div className="camera-thumb">{camera.type === 'demo' || camera.type === 'mjpeg' ? <img src={camera.url} alt="" /> : <Video size={25} />}<span>{camera.public ? '公开' : '授权'}</span></div>
            <div className="camera-info"><strong>{camera.name}</strong><small>{camera.location || '未设置位置'}</small><em>{camera.type === 'demo' ? '演示流' : camera.type === 'mjpeg' ? 'MJPEG' : 'HLS直播'}</em></div>
            <button type="button" onClick={(event) => { event.stopPropagation(); onEdit(camera) }}><Edit3 size={14} /></button>
            <button type="button" onClick={(event) => { event.stopPropagation(); onDelete(camera.id) }}><Trash2 size={14} /></button>
          </article>
        ))}
      </div>
      <div className="monitor-note"><Globe2 size={16} /><p>公开流适合无隐私的演示区域。真实监控建议通过账号授权、临时签名地址或受控网关接入，不建议直接暴露 NVR 地址或长期公开。</p></div>
    </div>
  )
}

function DashboardPage() {
  const stats = [
    ['累计检测图像', '12,846', '张', '+18.6%', ImageIcon, 'blue'],
    ['预警总次数', '1,329', '次', '+12.4%', BellRing, 'orange'],
    ['中高风险占比', '23.8', '%', '-2.1%', Gauge, 'red'],
    ['平均响应时间', '1.8', '秒', '较上月 -0.4s', Clock3, 'green'],
  ]
  return (
    <div className="mobile-page">
      <header className="page-heading"><span>数据看板</span><h1>风险数据洞察</h1><p>用于消防安全管理数据分析与隐患排查优化</p></header>
      <div className="dashboard-grid">{stats.map(([label, value, unit, change, Icon, tone]) => <article className={`dashboard-stat tone-${tone}`} key={label}><span><Icon size={16} /></span><p>{label}</p><strong>{value}<small>{unit}</small></strong><em>{change}</em></article>)}</div>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>风险趋势</strong><small>近30日最高温度预警指数</small></div><TrendingUp size={18} /></div><LineChart /></section>
      <section className="mobile-card chart-card"><div className="card-head"><div><strong>隐患类型分布</strong><small>高频隐患分类统计</small></div><BarChart3 size={18} /></div><div className="bar-chart">{[['电气过热', 72], ['设备异常', 58], ['环境温升', 44], ['线路老化', 31], ['其他', 26]].map(([label, value], index) => <div className="bar-row" key={label}><span>{label}</span><div><i style={{ width: `${value}%`, '--bar-delay': `${index * 90}ms` }} /></div><b>{value}</b></div>)}</div></section>
      <div className="dashboard-note"><Activity size={16} />数据用于隐患识别、巡检优先级排序和风险治理优化。</div>
    </div>
  )
}

function AboutPage() {
  return (
    <div className="mobile-page">
      <header className="page-heading"><span>关于项目</span><h1>让AI成为火警监测网警</h1><p>热成像 + 计算机视觉，让隐患在灾害发生前被看见</p></header>
      <section className="mobile-card principle-card"><div className="card-head"><div><strong>技术原理</strong><small>多模态融合识别</small></div><Cpu size={19} /></div><div className="principle-flow"><div><ScanLine size={20} /><strong>YOLO检测</strong><span>火焰与烟雾目标</span></div><ArrowRight size={16} /><div><Thermometer size={20} /><strong>温度融合</strong><span>热区轮廓与梯度</span></div><ArrowRight size={16} /><div><ShieldAlert size={20} /><strong>风险判断</strong><span>灾前分级预警</span></div></div></section>
      <section className="mobile-card innovation-card"><div className="card-head"><div><strong>五大核心创新</strong><small>AI火警网警的优势</small></div><Sparkles size={18} /></div>{[['灾前预警', '在明火和烟雾出现前识别温度异常'], ['精准定位', '红橙热区标注高温隐患位置'], ['多级研判', '温度轮廓、扩散梯度、持续特征综合分析'], ['低误报率', '区分人员、设备和正常热源'], ['轻量部署', '边缘设备可运行，老旧楼宇改造成本低']].map(([title, text], index) => <div className="innovation-row" key={title}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{title}</strong><p>{text}</p></div></div>)}</section>
      <section className="mobile-card advantage-card"><div><ShieldCheck size={19} /><strong>复杂场景适配</strong></div><p>适配老旧楼宇、仓库、配电房和人员密集楼道，无需大规模重新布线，硬件成本可控，适合民用普及。</p></section>
      <div className="disclaimer"><ShieldAlert size={17} /><p>本系统为科研演示原型，不替代专业消防检测设备与灭火系统。</p></div>
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
  const [alerts, setAlerts] = useState(() => loadStored('thermalGuardAlerts', sampleAlerts))
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
  const [settings, setSettings] = useState(() => ({ ...DEFAULT_ALARM_SETTINGS, ...loadStored('thermalGuardAlarmSettings', {}) }))
  const [alarm, setAlarm] = useState(null)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [fire, setFire] = useState(null)
  const [position, setPosition] = useState({ floor: 4, spot: 'C' })
  const [blockedNodes, setBlockedNodes] = useState([])
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [audioReady, setAudioReady] = useState(() => isAudioUnlocked())
  const [notice, setNotice] = useState(null)
  const timerRef = useRef(null)
  const socketRef = useRef(null)
  const inputCameraRef = useRef(null)
  const inputGalleryRef = useRef(null)
  const armedRef = useRef(true)

  useEffect(() => {
    localStorage.setItem('thermalGuardDevices', JSON.stringify(devices))
  }, [devices])

  useEffect(() => {
    localStorage.setItem('thermalGuardAlerts', JSON.stringify(alerts.slice(0, 60)))
  }, [alerts])

  useEffect(() => {
    localStorage.setItem('thermalGuardAlarmSettings', JSON.stringify(settings))
  }, [settings])

  // 报警或火情进行时开启 1 秒心跳，用于计时与路线重算
  useEffect(() => {
    if (!alarm && !fire) return undefined
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [alarm, fire])

  // 首次用户交互时解锁音频（浏览器自动播放策略）
  useEffect(() => {
    const unlock = async () => {
      const ok = await unlockAudio()
      if (ok) setAudioReady(true)
    }
    window.addEventListener('pointerdown', unlock)
    window.addEventListener('keydown', unlock)
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('thermalGuardCameras', JSON.stringify(cameras))
  }, [cameras])

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(''), 2400)
    return () => clearTimeout(timer)
  }, [toast])

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
  }, [])

  const handleImage = (file) => {
    if (!file) return
    armedRef.current = true
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
    armedRef.current = true
    setImage('')
    setFileName('')
    setDetected(false)
    setDetecting(false)
    setProgress(0)
  }

  const runDetection = () => {
    if (!image || detecting) return
    clearInterval(timerRef.current)
    armedRef.current = true
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
          // 检测场景按火情工况生成，保证演示结果与后续报警、逃生长流程一致
          const nextResult = createFrame(phase, 'fire')
          setResult(nextResult)
          setFrame(nextResult)
          setDetected(true)
          setDetecting(false)
          const effectiveRisk = riskFromMaxTemp(nextResult.maxTemp, { high: settings.highThreshold, medium: settings.mediumThreshold })
          setAlerts((current) => [{ id: `local-${Date.now()}`, time: nowText(), risk: effectiveRisk, zone: activeDevice?.location || '手机端实时检测', temp: nextResult.maxTemp, hotspots: nextResult.hotspots.length, kind: 'detection', handled: false }, ...current].slice(0, 60))
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

  /* ---------------- 报警系统 ---------------- */

  // 检测结果的最终风险等级按用户配置的阈值换算，保证设置真正生效
  const resultRisk = useMemo(
    () => riskFromMaxTemp(result.maxTemp, { high: settings.highThreshold, medium: settings.mediumThreshold }),
    [result.maxTemp, settings.highThreshold, settings.mediumThreshold],
  )
  const riskAdjustedResult = useMemo(() => ({ ...result, risk: resultRisk }), [result, resultRisk])

  const elapsedSec = fire ? Math.max(0, (nowMs - fire.startedAt) / 1000) : 0
  const route = useMemo(
    () => planRoute({ startId: positionNodeId(position.floor, position.spot), fire, elapsedSec, blocked: blockedNodes }),
    [position.floor, position.spot, fire, elapsedSec, blockedNodes],
  )

  const alarmActive = Boolean(alarm && !alarm.acknowledged)
  const alarmId = alarm?.id
  const alarmEscalated = Boolean(alarm?.escalated)
  const alarmMode = fire?.mode || alarm?.mode || 'live'

  const pushAlarm = (payload) => {
    const id = `alarm-${payload.startedAt}-${Math.random().toString(36).slice(2, 6)}`
    setAlarm({ id, acknowledged: false, escalated: false, risk: 'high', sourceLabel: '热成像 AI 检测', mode: 'live', ...payload })
    setOverlayOpen(true)
    setNowMs(Date.now())
    setActiveTab('evacuation')
    setAlerts((current) => [{
      id,
      kind: 'alarm',
      mode: payload.mode || 'live',
      risk: 'high',
      temp: payload.temp,
      time: nowText(),
      zone: payload.location || '手机端实时检测',
      hotspots: payload.hotspots ?? 0,
      handled: false,
      acknowledged: false,
    }, ...current].slice(0, 60))
  }

  // 检测判定为高风险时自动触发报警；中风险只出提示，不打断现场
  useEffect(() => {
    if (!settings.autoTrigger || !detected) return
    if (resultRisk === 'low') {
      armedRef.current = true
      return
    }
    if (resultRisk === 'medium') {
      if (armedRef.current) setNotice({ id: Date.now(), text: `检测到中风险温升 ${result.maxTemp.toFixed(1)}°C，建议现场核查`, tone: 'warn' })
      return
    }
    if (resultRisk === 'high' && armedRef.current) {
      armedRef.current = false
      const floor = activeDevice?.floor || position.floor
      const startedAt = Date.now()
      setFire({ nodeId: `C${floor}`, floor, startedAt, mode: 'live' })
      pushAlarm({
        mode: 'live',
        startedAt,
        temp: result.maxTemp,
        hotspots: result.hotspots.length,
        location: `${activeDevice?.location || '手机端实时检测'} · ${floor} 楼`,
      })
    }
  }, [detected, resultRisk, result.maxTemp])

  // 警笛
  useEffect(() => {
    if (!alarmActive || !settings.sound || !audioReady) {
      stopSiren()
      return undefined
    }
    startSiren(alarmEscalated ? 'escalated' : alarmMode === 'drill' ? 'drill' : 'normal')
    return () => stopSiren()
  }, [alarmId, alarmActive, alarmEscalated, alarmMode, settings.sound, audioReady])

  // 震动（iOS Safari 不支持）
  useEffect(() => {
    if (!alarmActive || !settings.vibrate || !supportsVibration()) return undefined
    vibrateAlarm()
    const timer = setInterval(vibrateAlarm, ALARM_VIBRATION_INTERVAL)
    return () => {
      clearInterval(timer)
      stopVibrate()
    }
  }, [alarmId, alarmActive, settings.vibrate])

  // 语音播报
  useEffect(() => {
    if (!alarmActive || !settings.voice) {
      stopSpeak()
      return undefined
    }
    const text = alarmMode === 'drill' ? '这是一次火警演练，请沿逃生路线离开' : '检测到火警，请立即沿逃生路线撤离，不要搭乘电梯'
    speak(text)
    const timer = setInterval(() => speak(text), alarmEscalated ? 5000 : 9000)
    return () => {
      clearInterval(timer)
      stopSpeak()
    }
  }, [alarmId, alarmActive, alarmEscalated, alarmMode, settings.voice])

  // 未确认升级
  useEffect(() => {
    if (!alarm || alarm.acknowledged || !settings.escalateSec) return undefined
    const delay = Math.max(0, alarm.startedAt + settings.escalateSec * 1000 - Date.now())
    const timer = setTimeout(() => {
      setAlarm((current) => (current && !current.acknowledged ? { ...current, escalated: true } : current))
    }, delay)
    return () => clearTimeout(timer)
  }, [alarmId, alarm?.acknowledged, alarm?.startedAt, settings.escalateSec])

  // 标签页闪烁提醒
  useEffect(() => {
    if (!alarmActive) return undefined
    const original = document.title
    let flip = false
    const timer = setInterval(() => {
      flip = !flip
      document.title = flip ? '🚨 火警警报' : '请立即撤离'
    }, 900)
    return () => {
      clearInterval(timer)
      document.title = original
    }
  }, [alarmId, alarmActive])

  useEffect(() => {
    if (!notice || notice.tone !== 'warn') return undefined
    const timer = setTimeout(() => setNotice(null), 9000)
    return () => clearTimeout(timer)
  }, [notice])

  const enableSound = async () => {
    const ok = await unlockAudio()
    setAudioReady(ok)
  }

  const acknowledgeAlarm = () => {
    if (!alarm) return
    stopSiren()
    stopSpeak()
    stopVibrate()
    setAlarm({ ...alarm, acknowledged: true, acknowledgedAt: Date.now() })
    setAlerts((current) => current.map((item) => (item.id === alarm.id ? { ...item, acknowledged: true } : item)))
  }

  const reenforceAlarm = () => {
    stopSiren()
    stopSpeak()
    setAlarm((current) => (current ? { ...current, acknowledged: false, escalated: false, startedAt: Date.now() } : current))
    setNowMs(Date.now())
  }

  const resolveAlarm = () => {
    stopSiren()
    stopSpeak()
    stopVibrate()
    setAlarm(null)
    setOverlayOpen(false)
    setFire(null)
    if (resultRisk === 'low') {
      armedRef.current = true
    } else {
      setNotice({ id: Date.now(), text: `已解除警报，但检测结果仍为${riskTitle(resultRisk)}，请确认现场安全后再重新布防`, tone: 'info' })
    }
  }

  const startDrill = (floor, spot) => {
    const startedAt = Date.now()
    armedRef.current = false
    setPosition((current) => (current.floor === floor ? current : { ...current, floor }))
    setFire({ nodeId: `${spot}${floor}`, floor, startedAt, mode: 'drill' })
    pushAlarm({
      mode: 'drill',
      startedAt,
      temp: result.maxTemp,
      hotspots: result.hotspots.length,
      location: `演练：${floor} 楼${SPOT_LABELS[spot] || '走廊中段'}`,
      sourceLabel: '火警演练',
    })
  }

  const stopDrill = () => {
    stopSiren()
    stopSpeak()
    stopVibrate()
    setAlarm(null)
    setOverlayOpen(false)
    setFire(null)
  }

  // 保证中风险阈值始终低于高温报警阈值
  const updateSettings = (patch) => setSettings((current) => {
    const next = { ...current, ...patch }
    if (next.mediumThreshold >= next.highThreshold) {
      if ('highThreshold' in patch) next.mediumThreshold = Math.max(35, next.highThreshold - 5)
      else next.highThreshold = Math.min(90, next.mediumThreshold + 5)
    }
    return next
  })

  const toggleBlockedNode = (id) => {
    setBlockedNodes((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))
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
    if (activeTab === 'camera') return <CameraPage cameras={cameras} selectedCamera={selectedCamera} onSelect={(camera) => setSelectedCameraId(camera.id)} onAdd={() => setCameraSheet({ camera: null })} onEdit={(camera) => setCameraSheet({ camera })} onDelete={(id) => { setCameras((current) => current.filter((camera) => camera.id !== id)); if (selectedCameraId === id) setSelectedCameraId(cameras.find((camera) => camera.id !== id)?.id || '') }} canShare={Boolean(selectedCamera?.public)} onShare={shareCamera} />
    if (activeTab === 'alerts') return <AlertsPage alerts={alerts} />
    if (activeTab === 'alarm') {
      return (
        <AlarmCenterView
          alarm={alarm}
          fire={fire}
          alerts={alerts}
          settings={settings}
          audioReady={audioReady}
          onSettingsChange={updateSettings}
          onManualAlarm={() => pushAlarm({ mode: 'manual', startedAt: Date.now(), temp: result.maxTemp, hotspots: result.hotspots.length, location: '手动触发（自检）', sourceLabel: '手动报警' })}
          onStartDrill={startDrill}
          onStopDrill={stopDrill}
          onClearFire={() => setFire(null)}
          onEnableSound={enableSound}
          onMarkHandled={(id) => setAlerts((current) => current.map((item) => (item.id === id ? { ...item, handled: true } : item)))}
          onClearAlerts={() => setAlerts([])}
        />
      )
    }
    if (activeTab === 'evacuation') {
      return (
        <EvacuationView
          route={route}
          fire={fire}
          position={position}
          blocked={blockedNodes}
          nowMs={nowMs}
          onPositionChange={setPosition}
          onToggleBlock={toggleBlockedNode}
          onStartDrillAt={(nodeId, floor) => startDrill(floor, nodeId[0])}
          onClearFire={() => setFire(null)}
        />
      )
    }
    if (activeTab === 'dashboard') return <DashboardPage />
    if (activeTab === 'about') return <AboutPage />
    return <HomePage inputCameraRef={inputCameraRef} inputGalleryRef={inputGalleryRef} image={image} fileName={fileName} detecting={detecting} progress={progress} detected={detected} result={riskAdjustedResult} onImage={handleImage} onSample={() => { setImage(DEMO_THERMAL); setFileName('示例热成像-01.jpg'); setDetected(false) }} onReset={resetDetection} onDetect={runDetection} />
  }, [activeTab, alerts, cameras, selectedCamera, selectedCameraId, image, fileName, detecting, progress, detected, riskAdjustedResult, phase, alarm, fire, settings, audioReady, route, position, blockedNodes, nowMs])

  return (
    <div className={`mobile-app-shell ${alarm ? 'has-alarm' : ''}`}>
      <header className="mobile-topbar">
        <div className="mobile-brand"><span><Flame size={19} /></span><div><strong>热感哨兵</strong><small>AI火警网警</small></div></div>
        <div className="top-actions"><ConnectionBadge state={connection} /><button type="button" aria-label="设备管理" onClick={() => setShowDevices(true)}><Cable size={18} /></button></div>
      </header>

      {alarm && !overlayOpen && (
        <button className={`alarm-banner ${alarm.acknowledged ? 'is-muted' : ''}`} type="button" onClick={() => setOverlayOpen(true)}>
          <ShieldAlert size={16} />
          <span>{alarm.acknowledged ? '报警已静音，危险未解除' : '火警报警进行中'}</span>
          <strong>返回警报</strong>
        </button>
      )}

      {notice && !alarm && (
        <div className={`warn-banner tone-${notice.tone || 'warn'}`}>
          <TriangleAlert size={15} />
          <span>{notice.text}</span>
          <button type="button" aria-label="关闭提示" onClick={() => setNotice(null)}><X size={14} /></button>
        </div>
      )}

      {settings.sound && !audioReady && !alarm && (
        <button className="warn-banner is-action" type="button" onClick={enableSound}>
          <Volume2 size={15} />
          <span>点击启用报警声音，否则火警时只有画面提示</span>
        </button>
      )}

      <main className="mobile-main">{page}</main>
      <nav className="mobile-tabs">
        {tabs.map(({ id, label, icon: Icon }) => <button type="button" className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}><Icon size={20} /><span>{label}</span></button>)}
      </nav>
      {showDevices && <DeviceSheet devices={devices} activeDevice={activeDevice} connection={connection} error={error} onClose={() => setShowDevices(false)} onConnect={connectDevice} onDisconnect={disconnect} onSave={saveDevice} onDelete={(id) => setDevices((current) => current.filter((device) => device.id !== id))} />}
      {cameraSheet && <CameraSheet editing={cameraSheet.camera} onClose={() => setCameraSheet(null)} onSave={saveCamera} />}
      {toast && <div className="toast-message">{toast}</div>}
      {alarm && overlayOpen && (
        <AlarmOverlay
          alarm={alarm}
          nowMs={nowMs}
          soundOn={settings.sound}
          audioReady={audioReady}
          onEvacuate={() => {
            setOverlayOpen(false)
            setActiveTab('evacuation')
          }}
          onAcknowledge={acknowledgeAlarm}
          onReenforce={reenforceAlarm}
          onResolve={resolveAlarm}
          onStopDrill={stopDrill}
          onEnableSound={enableSound}
        />
      )}
    </div>
  )
}
