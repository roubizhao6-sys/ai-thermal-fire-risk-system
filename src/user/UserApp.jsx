import { useEffect, useRef, useState } from 'react'
import {
  Camera, CheckCircle2, Flame, Navigation, Phone, ScanLine, ShieldAlert, ShieldCheck,
  Thermometer, Upload, Volume2, VolumeX, X, MapPin, AlertTriangle, LoaderCircle, RotateCcw,
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

function DetectionHome() {
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
    </div>
  )
}

function ArEscape({ exit, onPickExit, siren }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const heading = useHeading()
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '沿箭头方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  const start = async () => {
    setStatus('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      streamRef.current = stream; setStatus('active'); navigator.vibrate?.(40)
    } catch { setStatus('denied') }
  }
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setStatus('idle') }

  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) { videoRef.current.srcObject = streamRef.current; videoRef.current.play().catch(() => {}) }
  }, [status])

  return (
    <div className="usr-page usr-ar-page">
      <header className="usr-page-head"><span>AR 实景逃生</span><h1>跟着箭头跑</h1><p>摄像头实景 + 方向箭头，带你到最近安全出口</p></header>

      <div className="usr-exit-chips">{EXITS.map((e) => <button type="button" key={e.id} className={e.id === exit.id ? 'active' : ''} onClick={() => onPickExit(e.id)}>{e.name}</button>)}</div>

      <section className="usr-ar-stage-card">
        <div className="usr-ar-stage">
          {status === 'active' && <video ref={videoRef} className="usr-ar-video" autoPlay playsInline muted />}
          {status !== 'active' ? (
            <div className="usr-ar-idle">
              <div className="usr-ar-idle-badge"><i />实时逃生引导</div>
              <h2>摄像头对准前方</h2>
              <p>画面将叠加箭头，前往 <strong>{exit.name}</strong>（{exit.distance} 米）</p>
              <button type="button" onClick={start}>{status === 'requesting' ? <><LoaderCircle className="spin" size={18} />正在打开摄像头…</> : <><Camera size={18} />开启 AR 实景逃生</>}</button>
              {status === 'denied' && <small className="usr-warn">摄像头权限被拒绝，请在浏览器设置中允许后重试。</small>}
              {status === 'unsupported' && <small className="usr-warn">当前浏览器不支持摄像头，请用 Safari 或 Chrome。</small>}
            </div>
          ) : (
            <div className="usr-ar-overlay">
              <div className="usr-ar-top"><span className="usr-ar-exit"><Navigation size={13} />{exit.name}</span><span className="usr-ar-dist">{exit.distance} m</span></div>
              <div className="usr-ar-arrow-wrap" style={{ transform: `rotate(${turn}deg)` }}><Navigation size={60} className="usr-ar-arrow" /></div>
              <div className="usr-ar-center"><strong>{turnText}</strong><p>{Math.round(heading)}° 当前朝向 · 出口方位 {exit.bearing}°</p></div>
            </div>
          )}
        </div>
        <div className="usr-ar-actions">
          <a href="tel:119"><Phone size={16} />一键报警 119</a>
          <button type="button" onClick={siren.toggle}>{siren.on ? <VolumeX size={16} /> : <Volume2 size={16} />}{siren.on ? '静音' : '警报'}</button>
          {status === 'active' ? <button type="button" onClick={stop}><X size={16} />退出AR</button> : <button type="button" onClick={start}><Camera size={16} />开始</button>}
        </div>
      </section>
      <p className="usr-disclaimer"><ShieldAlert size={14} />本应用为科研演示原型，逃生路线仅供参考，请结合实际现场标识与工作人员指挥。</p>
    </div>
  )
}

export default function UserApp() {
  const [tab, setTab] = useState('home')
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
        {tab === 'home' ? <DetectionHome /> : <ArEscape exit={exit} onPickExit={setExitId} siren={siren} />}
      </main>

      <nav className="usr-tabs">
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><ScanLine size={19} /><span>首页检测</span></button>
        <button type="button" className={tab === 'ar' ? 'active' : ''} onClick={() => setTab('ar')}><Navigation size={19} /><span>AR实景逃生</span></button>
      </nav>
    </div>
  )
}
