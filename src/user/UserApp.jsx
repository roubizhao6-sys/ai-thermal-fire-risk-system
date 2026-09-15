import { useEffect, useMemo, useRef, useState } from 'react'
import { fusePreventionSignals } from '../mobile/sensorFusion.js'
import ArNavigator from './ArNavigator.jsx'
import jsQR from 'jsqr'
import {
  Camera, CheckCircle2, Flame, Navigation, Phone, ScanLine, ShieldAlert, ShieldCheck,
  Thermometer, Upload, Volume2, VolumeX, X, MapPin, AlertTriangle, LoaderCircle, RotateCcw,
  QrCode, LocateFixed, Info, Send, Waves, Eye, BellRing,
} from 'lucide-react'

const DEMO = `${import.meta.env.BASE_URL}demo-thermal.jpg`

const EXITS = [
  { id: 'library', name: '图书馆', bearing: 300, distance: 88 },
  { id: 'r', name: 'R座教学大楼', bearing: 45, distance: 95 },
  { id: 'north', name: '北门', bearing: 0, distance: 118 },
  { id: 'south', name: '南门', bearing: 180, distance: 132 },
  { id: 'lrt', name: '轻轨科大站', bearing: 90, distance: 160 },
  { id: 'j', name: 'J座体育馆', bearing: 135, distance: 140 },
]

function directionLabel(degree) {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return labels[Math.round(((degree % 360) + 360) % 360 / 45) % 8]
}

function shortestTurn(target, heading) {
  return ((target - heading + 540) % 360) - 180
}

function riskTitle(risk) {
  return risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险'
}

function makeDetection() {
  const maxTemp = 45 + Math.random() * 50
  const risk = maxTemp >= 65 ? 'high' : maxTemp >= 45 ? 'medium' : 'low'
  const count = Math.max(1, Math.round(maxTemp / 26))
  const hotspots = Array.from({ length: count }, (_, i) => ({
    temp: Math.round(maxTemp - i * 14),
    x: 15 + Math.random() * 60,
    y: 15 + Math.random() * 55,
  }))
  return { maxTemp, risk, hotspots, width: 32, height: 24 }
}

function useSiren() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  const toggle = () => {
    if (ref.current) { try { ref.current.ctx.close() } catch {}; ref.current = null; setOn(false); return }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      const lfo = ctx.createOscillator(); const lfoGain = ctx.createGain()
      osc.type = 'sawtooth'; osc.frequency.value = 720
      lfo.type = 'sine'; lfo.frequency.value = 2
      gain.gain.value = 0.0001; lfoGain.gain.value = 0.05
      lfo.connect(lfoGain); lfoGain.connect(gain.gain)
      osc.connect(gain); gain.connect(ctx.destination)
      osc.start(); lfo.start()
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08)
      ref.current = { ctx, osc, lfo, gain, lfoGain }
      setOn(true); navigator.vibrate?.([260, 100, 260, 100, 260])
    } catch {}
  }
  useEffect(() => () => { try { ref.current?.ctx.close() } catch {} }, [])
  return { on, toggle }
}

function useHeading() {
  const [heading, setHeading] = useState(24)
  useEffect(() => {
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
  }, [])
  return heading
}

function FusionPanel({ maxTemp, hotspots, onEvacuate }) {
  const [flame, setFlame] = useState(0)
  const [smoke, setSmoke] = useState(0)
  const [history, setHistory] = useState([])

  useEffect(() => {
    const id = setInterval(() => setHistory((cur) => [...cur.slice(-29), { t: Date.now(), temp: maxTemp }]), 1000)
    return () => clearInterval(id)
  }, [maxTemp])

  const derived = useMemo(() => {
    if (history.length < 2) return { ror: 0, sustainedSec: 0 }
    const first = history[0]
    const last = history[history.length - 1]
    const minutes = Math.max((last.t - first.t) / 60000, 0.02)
    const ror = Math.max(0, (last.temp - first.temp) / minutes)
    let sustained = 0
    for (let i = history.length - 1; i >= 0; i -= 1) { if (history[i].temp >= 65) sustained += 1; else break }
    return { ror, sustainedSec: sustained }
  }, [history])

  const result = useMemo(() => fusePreventionSignals({
    thermal: { maxTemp, ror: derived.ror, sustainedSec: derived.sustainedSec, multiNode: hotspots >= 2 },
    visual: { flame, smoke },
    thresholds: { high: 65, medium: 45 },
  }), [maxTemp, derived, flame, smoke, hotspots])

  const meta = result.level === 'alarm' ? { label: '判定火警', cls: 'alarm' } : result.level === 'watch' ? { label: '关注复核', cls: 'watch' } : { label: '监测正常', cls: 'normal' }

  return (
    <section className="usr-card usr-fusion">
      <div className="usr-card-head"><div><strong>三路证据融合判定</strong><small>视觉 + 烟雾 + 热像，单路不报警</small></div><Waves size={18} /></div>
      <div className={`usr-fusion-level ${meta.cls}`}><ShieldAlert size={17} /><strong>{meta.label}</strong><span>判据得分 {(result.score * 100).toFixed(0)}% · 证据 {result.evidenceCount} 路</span></div>
      <div className="usr-fusion-bar"><i style={{ width: `${Math.round(result.score * 100)}%` }} /></div>
      <div className="usr-fusion-rows">
        <div className={`usr-fusion-row ${result.flags.thermalStrong || result.flags.tempHit ? 'on' : ''}`}><span><Thermometer size={15} /></span><div><strong>热像证据</strong><small>{maxTemp.toFixed(1)}°C · 升温 {derived.ror.toFixed(1)}°C/分</small></div><em>{result.flags.thermalStrong ? '强' : result.flags.tempHit ? '超阈' : '正常'}</em></div>
        <div className={`usr-fusion-row ${result.flags.flameSeen ? 'on' : ''}`}><span><Flame size={15} /></span><div><strong>视觉火焰</strong><small>演示滑杆</small></div><input type="range" min="0" max="100" value={Math.round(flame * 100)} onChange={(e) => setFlame(Number(e.target.value) / 100)} /></div>
        <div className={`usr-fusion-row ${result.flags.smokeSeen ? 'on' : ''}`}><span><Eye size={15} /></span><div><strong>烟雾证据</strong><small>演示滑杆</small></div><input type="range" min="0" max="100" value={Math.round(smoke * 100)} onChange={(e) => setSmoke(Number(e.target.value) / 100)} /></div>
      </div>
      <div className="usr-fusion-reasons">{result.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
      {result.level === 'alarm' && <button type="button" className="usr-fusion-alarm" onClick={onEvacuate}><BellRing size={15} />立即疏散逃生</button>}
      <p className="usr-fusion-note"><ShieldAlert size={12} />单路证据不报警，两路或完整热像证据链才确认，降低误报。</p>
    </section>
  )
}

function DetectionHome({ onEvacuate }) {
  const inputRef = useRef(null)
  const [image, setImage] = useState('')
  const [fileName, setFileName] = useState('')
  const [detecting, setDetecting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState(null)

  const onImage = (file) => {
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => { setImage(reader.result); setFileName(file.name); setResult(null) }
    reader.readAsDataURL(file)
  }
  const onSample = () => { setImage(DEMO); setFileName('示例热成像-01.jpg'); setResult(null) }
  const reset = () => { setImage(''); setFileName(''); setResult(null); setDetecting(false); setProgress(0) }
  const detect = () => {
    if (!image || detecting) return
    setDetecting(true); setProgress(3)
    let value = 3
    const id = setInterval(() => {
      value += Math.round(Math.random() * 9 + 8)
      if (value >= 100) {
        value = 100; clearInterval(id)
        setTimeout(() => { setResult(makeDetection()); setDetecting(false) }, 240)
      }
      setProgress(Math.min(value, 99))
    }, 110)
  }

  const active = result?.risk

  return (
    <div className="usr-page">
      <header className="usr-page-head"><span>首页检测</span><h1>AI 热感火警检测</h1><p>上传热成像图，火焰出现前识别异常温升</p></header>

      <section className="usr-card">
        <div className="usr-card-head"><div><strong>热成像图片检测</strong><small>拍摄 / 上传 / 载入示例</small></div><button type="button" className="usr-mini-btn" onClick={onSample}>载入示例</button></div>

        <div className="usr-preview">
          {image
            ? <><img src={image} alt="热成像预览" />{result && result.hotspots.map((h, i) => <span key={i} className="usr-hot-box" style={{ left: `${h.x}%`, top: `${h.y}%` }}><b>{h.temp}°</b></span>)}</>
            : <div className="usr-preview-empty"><ScanLine size={30} /><p>尚未选择图片</p></div>}
          {detecting && <div className="usr-preview-scan" />}
        </div>

        <div className="usr-capture">
          <button type="button" onClick={() => inputRef.current?.click()}><Camera size={15} />拍摄热成像图</button>
          <button type="button" onClick={() => inputRef.current?.click()}><Upload size={15} />上传图片</button>
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={(e) => onImage(e.target.files?.[0])} style={{ display: 'none' }} />
        </div>

        <div className="usr-meta"><span>{fileName || '尚未选择图片'}</span>{image && <button type="button" onClick={reset}><RotateCcw size={12} />重置</button>}</div>
        <button className="usr-detect-btn" type="button" disabled={!image || detecting} onClick={detect}>{detecting ? <><LoaderCircle className="spin" size={17} />AI 正在检测</> : <><ScanLine size={17} />开始 AI 检测</>}</button>
        {detecting && <div className="usr-progress"><div><i style={{ width: `${progress}%` }} /></div><small>{progress}% · 温度轮廓分析中</small></div>}
      </section>

      {result && (
        <section className="usr-card usr-result">
          <div className="usr-result-title"><div><span>AI检测结果</span><strong>{riskTitle(result.risk)}</strong></div></div>
          <div className="usr-level-grid">
            {['low', 'medium', 'high'].map((r) => <div key={r} className={`usr-level level-${r} ${active === r ? 'active' : ''}`}><span>{r === 'low' ? <ShieldCheck size={16} /> : r === 'medium' ? <AlertTriangle size={16} /> : <ShieldAlert size={16} />}</span><strong>{riskTitle(r)}</strong><small>{r === 'low' ? '持续观察' : r === 'medium' ? '现场核查' : '立即疏散'}</small>{active === r && <CheckCircle2 size={15} />}</div>)}
          </div>
          <div className="usr-detail-grid">
            <div><MapPin size={16} /><span>高温区域</span><strong>{result.hotspots.length} 处</strong></div>
            <div><Thermometer size={16} /><span>最高温度</span><strong>{result.maxTemp.toFixed(1)}°C</strong></div>
          </div>
          <div className="usr-explain"><span><ShieldAlert size={16} /></span><p>基于温度轮廓与扩散梯度分析，区分正常热源与火灾隐患，有效降低误报率。</p></div>
        </section>
      )}

      {result && <FusionPanel maxTemp={result.maxTemp} hotspots={result.hotspots.length} onEvacuate={onEvacuate} />}
    </div>
  )
}

function ArEscape({ exit, onPickExit, siren, onOpenAr }) {
  const heading = useHeading()
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '保持当前方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`
  return (
    <div className="usr-page usr-ar-page">
      <header className="usr-page-head"><span>AR 实景逃生</span><h1>跟着箭头跑</h1><p>摄像头实景 + 方向箭头 + 表盘兜底</p></header>

      <div className="usr-exit-chips">{EXITS.map((e) => <button type="button" key={e.id} className={e.id === exit.id ? 'active' : ''} onClick={() => onPickExit(e.id)}>{e.name}</button>)}</div>

      <section className="usr-card usr-ar-launch-card">
        <div className="usr-ar-launch">
          <div className="usr-ar-launch-badge"><i />实时逃生引导</div>
          <h2>{turnText}</h2>
          <p>前往 <strong>{exit.name}</strong> · {exit.distance} 米 · 方位 {exit.bearing}°</p>
          <button type="button" className="usr-ar-launch-btn" onClick={onOpenAr}><Camera size={18} />开启 AR 实景导航</button>
          <small>进入后可切换前后摄像头、开启手电筒；摄像头不可用时自动退回表盘模式。</small>
        </div>
        <div className="usr-ar-actions">
          <a href="tel:119"><Phone size={16} />一键报警 119</a>
          <button type="button" onClick={siren.toggle}>{siren.on ? <VolumeX size={16} /> : <Volume2 size={16} />}{siren.on ? '静音' : '警报'}</button>
        </div>
      </section>
      <p className="usr-disclaimer"><ShieldAlert size={14} />本应用为科研演示原型，逃生路线仅供参考，请结合实际现场标识与工作人员指挥。</p>
    </div>
  )
}

function MorePage() {
  return (
    <div className="usr-page">
      <header className="usr-page-head"><span>更多功能</span><h1>定位 · 巡检 · 上报</h1><p>辅助消防安全的实用工具</p></header>
      <GpsPanel />
      <InspectionPanel />
      <HazardReport />
    </div>
  )
}

export default function UserApp() {
  const [tab, setTab] = useState('ar')
  const [arOpen, setArOpen] = useState(false)
  const [exitId, setExitId] = useState('library')
  const siren = useSiren()
  const exit = EXITS.find((e) => e.id === exitId) || EXITS[0]

  return (
    <div className="usr-app">
      <header className="usr-topbar">
        <div className="usr-brand"><span><Flame size={20} /></span><div><strong>热感哨兵</strong><small>AI 热感火警 · 用户端</small></div></div>
        <button type="button" className={`usr-alarm ${siren.on ? 'on' : ''}`} onClick={siren.toggle}>{siren.on ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </header>

      <main className="usr-main">
        {tab === 'home' ? <DetectionHome onEvacuate={() => setTab('ar')} /> : tab === 'ar' ? <ArEscape exit={exit} onPickExit={setExitId} siren={siren} onOpenAr={() => setArOpen(true)} /> : <MorePage />}
      </main>

      <nav className="usr-tabs">
        <button type="button" className={tab === 'ar' ? 'active' : ''} onClick={() => setTab('ar')}><Navigation size={19} /><span>AR实景逃生</span></button>
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><ScanLine size={19} /><span>首页检测</span></button>
        <button type="button" className={tab === 'more' ? 'active' : ''} onClick={() => setTab('more')}><QrCode size={19} /><span>更多功能</span></button>
      </nav>

      {arOpen && (
        <ArNavigator
          route={{ ok: true, meters: exit.distance }}
          bearing={exit.bearing}
          targetLabel={exit.name}
          proximity={Math.max(0, Math.min(1, 1 - exit.distance / 300))}
          atExit={exit.distance <= 20}
          proximityText={exit.distance <= 30 ? '就在附近' : exit.distance <= 80 ? '接近中' : '按箭头前进'}
          remainingFloors="—"
          positionSource="演示定位 · 校园出口"
          onClose={() => setArOpen(false)}
        />
      )}
    </div>
  )
}
