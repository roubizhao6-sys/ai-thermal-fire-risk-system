import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Cable,
  Check,
  ChevronRight,
  CircleDot,
  Cpu,
  Crosshair,
  Database,
  Edit3,
  Flame,
  Gauge,
  Waves,
  Info,
  Link2,
  LoaderCircle,
  MapPin,
  Plus,
  Radio,
  RotateCcw,
  Save,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Thermometer,
  Trash2,
  Wifi,
  WifiOff,
  X,
  Zap,
} from 'lucide-react'

const tabs = [
  { id: 'dashboard', label: '总览', icon: Gauge },
  { id: 'thermal', label: '热成像', icon: Waves },
  { id: 'devices', label: '设备', icon: Cable },
  { id: 'equipment', label: '实验', icon: Cpu },
  { id: 'alerts', label: '记录', icon: AlertTriangle },
]

const equipment = [
  ['ESP32-S3-DevKitC-1', '主控开发板', '¥45–80'],
  ['MLX90640 32×24', '红外热成像阵列', '¥180–320'],
  ['SHT31 / DHT22', '温湿度传感器', '¥15–45'],
  ['MQ-2 / SGP30', '烟雾或气体辅助检测', '¥15–60'],
  ['蜂鸣器 + RGB LED', '本地声光报警', '¥10–25'],
  ['面包板 + 杜邦线', '实验连接耗材', '¥20–40'],
]

function temperatureColor(value) {
  const stops = [
    [0, [7, 13, 30]],
    [0.24, [32, 28, 93]],
    [0.44, [125, 23, 84]],
    [0.62, [220, 38, 50]],
    [0.78, [249, 115, 22]],
    [0.9, [250, 204, 21]],
    [1, [255, 251, 220]],
  ]
  const t = Math.max(0, Math.min(1, value))
  let left = stops[0]
  let right = stops[stops.length - 1]
  for (let i = 1; i < stops.length; i += 1) {
    if (t <= stops[i][0]) {
      left = stops[i - 1]
      right = stops[i]
      break
    }
  }
  const span = Math.max(right[0] - left[0], 0.001)
  const p = (t - left[0]) / span
  return left[1].map((channel, i) => Math.round(channel + (right[1][i] - channel) * p))
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
    timestamp: new Date(),
  }
}

function normalizePacket(packet) {
  const width = Number(packet.width || 32)
  const height = Number(packet.height || 24)
  let temperatures = Array.isArray(packet.temperatures) ? packet.temperatures.map(Number) : []
  if (temperatures.length !== width * height) temperatures = createFrame().temperatures
  const maxTemp = Number(packet.max_temp ?? packet.maxTemp ?? Math.max(...temperatures))
  const minTemp = Number(packet.min_temp ?? packet.minTemp ?? Math.min(...temperatures))
  const averageTemp = temperatures.reduce((sum, value) => sum + value, 0) / temperatures.length
  const hotspots = (packet.hotspots || []).map((spot) => ({
    x: Number(spot.x || 0) * 100,
    y: Number(spot.y || 0) * 100,
    w: Number(spot.width || 0.15) * 100,
    h: Number(spot.height || 0.18) * 100,
    temp: Number(spot.temp ?? maxTemp),
  }))
  return {
    width,
    height,
    temperatures,
    maxTemp,
    minTemp,
    averageTemp,
    hotspots,
    risk: maxTemp >= 65 ? 'high' : maxTemp >= 45 ? 'medium' : 'low',
    source: packet.source || 'ESP32 设备',
    timestamp: new Date(),
  }
}

function riskText(risk) {
  return risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险'
}

function HeatCanvas({ frame, compact = false }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const context = canvas.getContext('2d')
    const image = context.createImageData(frame.width, frame.height)
    const range = Math.max(frame.maxTemp - frame.minTemp, 0.1)
    frame.temperatures.forEach((temperature, index) => {
      const normalized = Math.max(0, Math.min(1, (temperature - frame.minTemp) / range))
      const [r, g, b] = temperatureColor(normalized)
      const offset = index * 4
      image.data[offset] = r
      image.data[offset + 1] = g
      image.data[offset + 2] = b
      image.data[offset + 3] = 255
    })
    context.putImageData(image, 0, 0)
  }, [frame])

  return (
    <div className={`heat-canvas ${compact ? 'compact' : ''}`}>
      <canvas ref={canvasRef} width={frame.width} height={frame.height} />
      <div className="heat-grid" />
      <div className="heat-scan" />
      {frame.hotspots.slice(0, 3).map((spot, index) => (
        <div
          className="heat-box"
          key={`${spot.x}-${spot.y}-${index}`}
          style={{ left: `${spot.x}%`, top: `${spot.y}%`, width: `${spot.w}%`, height: `${spot.h}%` }}
        >
          <span>热区 {String(index + 1).padStart(2, '0')}</span>
          <b>{spot.temp.toFixed(1)}°C</b>
        </div>
      ))}
      <div className="heat-source"><i />{frame.source}</div>
      <div className="heat-legend"><span>{frame.minTemp.toFixed(1)}°C</span><i /><span>{frame.maxTemp.toFixed(1)}°C</span></div>
    </div>
  )
}

function ConnectionBadge({ state }) {
  const text = state === 'connected' ? '硬件在线' : state === 'connecting' ? '连接中' : state === 'failed' ? '连接失败' : '模拟运行'
  return <span className={`connection-badge state-${state}`}><i />{text}</span>
}

function DeviceSheet({ editing, onClose, onSave }) {
  const [name, setName] = useState(editing?.name || '')
  const [url, setUrl] = useState(editing?.url || '')
  const [location, setLocation] = useState(editing?.location || '')
  const valid = name.trim() && /^wss?:\/\//i.test(url.trim())

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div><span>设备设置</span><strong>{editing ? '编辑设备' : '添加设备'}</strong></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>
        <label>设备名称<input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如：实验室 ESP32" /></label>
        <label>设备位置<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="例如：P11 宿舍" /></label>
        <label>WebSocket 地址<input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="wss://设备地址:81/" inputMode="url" autoCapitalize="none" /></label>
        <div className="sheet-tip"><Info size={14} />手机网页必须使用安全连接 wss://。普通 ws:// 可在 Mac App 中使用。</div>
        <button
          className="sheet-save"
          type="button"
          disabled={!valid}
          onClick={() => onSave({ name: name.trim(), url: url.trim(), location: location.trim() })}
        >
          <Save size={16} />保存设备
        </button>
      </section>
    </div>
  )
}

function DashboardPage({ frame, history, connection, deviceName }) {
  return (
    <div className="mobile-page">
      <header className="page-intro">
        <div><span>运行总览</span><h1>热感火警风险检测</h1><p>32×24 热成像矩阵实时分析</p></div>
        <ConnectionBadge state={connection} />
      </header>
      <div className="metric-grid">
        <Metric icon={Thermometer} label="最高温度" value={`${frame.maxTemp.toFixed(1)}°C`} tone="orange" />
        <Metric icon={MapPin} label="高温区域" value={`${frame.hotspots.length} 处`} tone="red" />
        <Metric icon={Activity} label="平均温度" value={`${frame.averageTemp.toFixed(1)}°C`} tone="blue" />
        <Metric icon={Radio} label="数据刷新" value="3.1 帧/秒" tone="cyan" />
      </div>
      <section className="mobile-card heat-card">
        <div className="card-title"><div><strong>实时热成像</strong><small>温度越高颜色越亮</small></div><Crosshair size={18} /></div>
        <HeatCanvas frame={frame} />
      </section>
      <section className={`risk-card risk-${frame.risk}`}>
        <ShieldAlert size={26} />
        <div><span>综合风险等级</span><strong>{riskText(frame.risk)}</strong><small>{frame.risk === 'high' ? '疑似火情热源，立即复核' : frame.risk === 'medium' ? '存在异常温升，安排核查' : '温度稳定，继续监测'}</small></div>
        <b>{frame.maxTemp.toFixed(1)}°C</b>
      </section>
      <section className="mobile-card device-summary">
        <div className="card-title"><div><strong>当前数据源</strong><small>{deviceName || '内置模拟热像仪'}</small></div><CircleDot size={18} /></div>
        <div className="summary-row"><span>连接状态</span><b>{connection === 'connected' ? '硬件在线' : '模拟运行'}</b></div>
        <div className="summary-row"><span>热像分辨率</span><b>{frame.width} × {frame.height}</b></div>
        <div className="summary-row"><span>最近采样</span><b>{frame.timestamp.toLocaleTimeString('zh-CN', { hour12: false })}</b></div>
      </section>
      <section className="mobile-card trend-card">
        <div className="card-title"><div><strong>最高温度趋势</strong><small>最近采样</small></div><Activity size={18} /></div>
        <div className="mini-trend">
          {history.slice(-34).map((value, index) => {
            const height = Math.max(8, Math.min(88, ((value - 20) / 80) * 100))
            return <i key={index} style={{ height: `${height}%` }} />
          })}
        </div>
      </section>
    </div>
  )
}

function Metric({ icon: Icon, label, value, tone }) {
  return <article className={`metric tone-${tone}`}><Icon size={17} /><span>{label}</span><strong>{value}</strong></article>
}

function ThermalPage({ frame, connection, history }) {
  return (
    <div className="mobile-page">
      <header className="page-intro"><div><span>实时热成像</span><h1>温度矩阵</h1><p>{frame.width} × {frame.height} 热成像采样矩阵</p></div><ConnectionBadge state={connection} /></header>
      <section className="mobile-card heat-card large"><HeatCanvas frame={frame} /></section>
      <div className="reading-grid">
        <div><span>最高</span><strong>{frame.maxTemp.toFixed(1)}°C</strong></div>
        <div><span>最低</span><strong>{frame.minTemp.toFixed(1)}°C</strong></div>
        <div><span>平均</span><strong>{frame.averageTemp.toFixed(1)}°C</strong></div>
        <div><span>热区</span><strong>{frame.hotspots.length} 处</strong></div>
      </div>
      <section className="mobile-card">
        <div className="card-title"><div><strong>高温热区</strong><small>目标检测结果</small></div><Crosshair size={18} /></div>
        {frame.hotspots.slice(0, 3).map((spot, index) => <div className="hotspot-row" key={index}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>疑似高温区域 {index + 1}</strong><small>置信度 {96.8 - index * 5.1}%</small></div><b>{spot.temp.toFixed(1)}°C</b></div>)}
      </section>
      <section className="mobile-card trend-card">
        <div className="card-title"><div><strong>最高温度趋势</strong><small>最近采样</small></div><Activity size={18} /></div>
        <div className="mini-trend">{history.slice(-34).map((value, index) => <i key={index} style={{ height: `${Math.max(8, Math.min(88, ((value - 20) / 80) * 100))}%` }} />)}</div>
      </section>
    </div>
  )
}

function DevicesPage({ devices, activeDevice, connection, error, onConnect, onDisconnect, onAdd, onEdit, onDelete }) {
  return (
    <div className="mobile-page">
      <header className="page-intro"><div><span>硬件连接</span><h1>设备管理</h1><p>添加并保存 ESP32 WebSocket 设备</p></div><ConnectionBadge state={connection} /></header>
      <section className="mobile-card simulator-card">
        <div className="device-icon"><Cpu size={22} /></div>
        <div><strong>内置模拟热像仪</strong><small>无需硬件即可演示</small></div>
        <button type="button" onClick={onDisconnect}>运行</button>
      </section>
      <div className="section-title"><strong>已添加设备</strong><button type="button" onClick={onAdd}><Plus size={15} />添加设备</button></div>
      {devices.length === 0 && <section className="empty-card"><Cable size={32} /><strong>还没有保存设备</strong><p>点击“添加设备”，填写 ESP32 名称和 wss:// 地址。</p></section>}
      {devices.map((device) => {
        const active = activeDevice?.id === device.id
        return (
          <section className={`device-card ${active ? 'active' : ''}`} key={device.id}>
            <div className="device-card-top"><span className="device-icon"><Wifi size={20} /></span><div><strong>{device.name}</strong><small>{device.location || '未设置位置'}</small></div>{active && connection === 'connected' ? <span className="online"><i />在线</span> : <span className="offline">离线</span>}</div>
            <code>{device.url}</code>
            <div className="device-actions">
              <button type="button" className="connect" onClick={() => active && connection === 'connected' ? onDisconnect() : onConnect(device)}>{active && connection === 'connected' ? <WifiOff size={15} /> : <Link2 size={15} />}{active && connection === 'connected' ? '断开' : '连接'}</button>
              <button type="button" onClick={() => onEdit(device)}><Edit3 size={15} />编辑</button>
              <button type="button" className="danger" onClick={() => onDelete(device.id)}><Trash2 size={15} />删除</button>
            </div>
          </section>
        )
      })}
      {error && <div className="device-error"><AlertTriangle size={15} />{error}</div>}
      <section className="mobile-card protocol-card">
        <div className="card-title"><div><strong>数据协议</strong><small>ESP32 → 手机</small></div><Database size={18} /></div>
        <pre>{`{
  "width": 32,
  "height": 24,
  "max_temp": 86.4,
  "risk": "high",
  "temperatures": [...],
  "hotspots": [...]
}`}</pre>
        <p>坐标和宽高使用 0–1 归一化值。手机网页连接必须使用 <b>wss://</b>。</p>
      </section>
    </div>
  )
}

function EquipmentPage() {
  return (
    <div className="mobile-page">
      <header className="page-intro"><div><span>实验设备</span><h1>采购与接线</h1><p>从 MLX90640 + ESP32-S3 开始</p></div><span className="budget">¥300–600</span></header>
      <section className="recommend-card"><Zap size={22} /><div><strong>最佳性价比方案</strong><p>ESP32-S3-DevKitC-1 + MLX90640 32×24，支持 USB 串口与 Wi-Fi WebSocket。</p></div></section>
      {equipment.map(([model, purpose, price], index) => <section className="equipment-row" key={model}><span>{String(index + 1).padStart(2, '0')}</span><div><strong>{purpose}</strong><small>{model}</small></div><b>{price}</b></section>)}
      <section className="mobile-card wiring-card">
        <div className="card-title"><div><strong>MLX90640 接线</strong><small>ESP32-S3 I²C</small></div><Settings2 size={18} /></div>
        {[['VIN', '3V3'], ['GND', 'GND'], ['SDA', 'GPIO 8'], ['SCL', 'GPIO 9']].map(([from, to]) => <div className="wire-row" key={from}><code>{from}</code><ChevronRight size={14} /><code>{to}</code></div>)}
      </section>
      <div className="safety-note"><ShieldAlert size={17} /><p>请勿使用明火或危险高温源实验。本系统为科研演示原型，不替代专业消防检测设备。</p></div>
    </div>
  )
}

function AlertsPage({ alerts }) {
  return (
    <div className="mobile-page">
      <header className="page-intro"><div><span>预警记录</span><h1>高温事件</h1><p>中高风险事件自动记录</p></div><span className="alert-count">{alerts.length} 条</span></header>
      {alerts.length === 0 ? <section className="empty-card"><ShieldCheck size={38} /><strong>暂无预警记录</strong><p>当前运行正常，触发中高风险后会显示在这里。</p></section> : alerts.map((alert) => <section className={`alert-row alert-${alert.risk}`} key={alert.id}><AlertTriangle size={18} /><div><strong>{riskText(alert.risk)}</strong><small>{alert.time}</small></div><b>{alert.temp.toFixed(1)}°C</b></section>)}
    </div>
  )
}

export default function MobileApp() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [frame, setFrame] = useState(() => createFrame())
  const [phase, setPhase] = useState(0)
  const [history, setHistory] = useState([])
  const [alerts, setAlerts] = useState([])
  const [devices, setDevices] = useState(() => {
    try { return JSON.parse(localStorage.getItem('thermalGuardDevices') || '[]') } catch { return [] }
  })
  const [activeDevice, setActiveDevice] = useState(null)
  const [connection, setConnection] = useState('simulator')
  const [error, setError] = useState('')
  const [sheet, setSheet] = useState(null)
  const socketRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('thermalGuardDevices', JSON.stringify(devices))
  }, [devices])

  useEffect(() => {
    if (connection === 'connected') return undefined
    const timer = setInterval(() => setPhase((current) => current + 1), 320)
    return () => clearInterval(timer)
  }, [connection])

  useEffect(() => {
    if (connection === 'connected') return
    setFrame(createFrame(phase))
  }, [phase, connection])

  useEffect(() => {
    setHistory((current) => [...current.slice(-79), frame.maxTemp])
    if (frame.risk !== 'low') {
      setAlerts((current) => {
        const latest = current[0]
        if (latest && Date.now() - latest.timestamp < 4000) return current
        return [{ id: `${Date.now()}`, risk: frame.risk, temp: frame.maxTemp, time: new Date().toLocaleString('zh-CN', { hour12: false }), timestamp: Date.now() }, ...current].slice(0, 30)
      })
    }
  }, [frame])

  const disconnect = () => {
    socketRef.current?.close()
    socketRef.current = null
    setActiveDevice(null)
    setConnection('simulator')
    setError('')
  }

  const connectDevice = (device) => {
    disconnect()
    setError('')
    let parsed
    try {
      parsed = new URL(device.url)
    } catch {
      setConnection('failed')
      setError('设备地址格式不正确')
      return
    }
    if (location.protocol === 'https:' && parsed.protocol === 'ws:') {
      setConnection('failed')
      setError('GitHub Pages 使用 HTTPS，手机浏览器会阻止 ws://。请使用 wss:// 地址，或在 Mac App 中使用串口/局域网模式。')
      return
    }
    setConnection('connecting')
    setActiveDevice(device)
    const socket = new WebSocket(device.url)
    socketRef.current = socket
    socket.onopen = () => setConnection('connected')
    socket.onmessage = (event) => {
      try {
        const packet = JSON.parse(event.data)
        setFrame(normalizePacket(packet))
      } catch {
        setError('收到数据，但 JSON 格式不正确')
      }
    }
    socket.onerror = () => {
      setConnection('failed')
      setError('无法连接设备，请检查地址、网络和 wss:// 证书。')
    }
    socket.onclose = () => {
      if (socketRef.current === socket) setConnection('simulator')
    }
  }

  const saveDevice = (values) => {
    if (sheet?.device) {
      setDevices((current) => current.map((device) => device.id === sheet.device.id ? { ...device, ...values } : device))
    } else {
      setDevices((current) => [...current, { id: globalThis.crypto?.randomUUID?.() || `${Date.now()}`, ...values }])
    }
    setSheet(null)
  }

  const page = useMemo(() => {
    if (activeTab === 'thermal') return <ThermalPage frame={frame} connection={connection} history={history} />
    if (activeTab === 'devices') return <DevicesPage devices={devices} activeDevice={activeDevice} connection={connection} error={error} onConnect={connectDevice} onDisconnect={disconnect} onAdd={() => setSheet({})} onEdit={(device) => setSheet({ device })} onDelete={(id) => setDevices((current) => current.filter((device) => device.id !== id))} />
    if (activeTab === 'equipment') return <EquipmentPage />
    if (activeTab === 'alerts') return <AlertsPage alerts={alerts} />
    return <DashboardPage frame={frame} history={history} connection={connection} deviceName={activeDevice?.name} />
  }, [activeTab, frame, history, alerts, devices, activeDevice, connection, error])

  return (
    <div className="mobile-app-shell">
      <header className="mobile-topbar">
        <div className="mobile-brand"><span><Flame size={19} /></span><div><strong>热感哨兵</strong><small>手机控制台</small></div></div>
        <ConnectionBadge state={connection} />
      </header>
      <main className="mobile-main">{page}</main>
      <nav className="mobile-tabs">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button type="button" className={activeTab === id ? 'active' : ''} key={id} onClick={() => setActiveTab(id)}>
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>
      {sheet && <DeviceSheet editing={sheet.device} onClose={() => setSheet(null)} onSave={saveDevice} />}
    </div>
  )
}
