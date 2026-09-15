import { useEffect, useMemo, useRef, useState } from 'react'
import { fusePreventionSignals } from '../mobile/sensorFusion.js'
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

function GpsPanel() {
  const [on, setOn] = useState(false)
  const [gps, setGps] = useState(null)
  useEffect(() => {
    if (!on) return undefined
    if (!navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [on])
  return (
    <section className="usr-card">
      <div className="usr-card-head"><div><strong>GPS 我的位置</strong><small>手机实时定位</small></div><LocateFixed size={18} /></div>
      <button type="button" className="usr-mini-btn" onClick={() => setOn((v) => !v)}>{on ? '关闭 GPS 定位' : '开启 GPS 定位'}</button>
      {on && (gps ? (
        <div className="usr-gps-grid">
          <div><span>纬度</span><strong>{gps.lat.toFixed(6)}</strong></div>
          <div><span>经度</span><strong>{gps.lng.toFixed(6)}</strong></div>
          <div><span>精度</span><strong>±{Math.round(gps.accuracy)} m</strong></div>
        </div>
      ) : <p className="usr-gps-pending">正在获取定位… 请允许位置权限。</p>)}
    </section>
  )
}

function QrScanModal({ onClose, onDetected }) {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [msg, setMsg] = useState('正在打开摄像头…')

  useEffect(() => {
    let cancelled = false
    const stop = () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); rafRef.current = null; streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null }
    const tick = () => {
      if (cancelled) return
      const video = videoRef.current, canvas = canvasRef.current
      if (video && canvas && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
        const scale = Math.min(1, 640 / video.videoWidth)
        canvas.width = Math.round(video.videoWidth * scale)
        canvas.height = Math.round(video.videoHeight * scale)
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        try {
          const code = jsQR(ctx.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts: 'dontInvert' })
          if (code && code.data) { stop(); onDetected(code.data); return }
        } catch {}
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setMsg('当前浏览器不支持摄像头'); return }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play().catch(() => {}) }
        setMsg('请对准消防设施二维码')
        tick()
      } catch { if (!cancelled) setMsg('无法打开摄像头，请允许相机权限后重试') }
    }
    start()
    return () => { cancelled = true; stop() }
  }, [onDetected])

  return (
    <div className="usr-scan-backdrop" onClick={onClose}>
      <section className="usr-scan-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="usr-scan-head"><div><strong>扫码巡检</strong><small>对准二维码自动识别</small></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        <div className="usr-scan-stage">
          <video ref={videoRef} className="usr-scan-video" autoPlay playsInline muted />
          <canvas ref={canvasRef} style={{ display: 'none' }} />
          <div className="usr-scan-frame"><span /></div>
        </div>
        <p className="usr-scan-status">{msg}</p>
        <button type="button" className="usr-scan-cancel" onClick={onClose}>取消</button>
      </section>
    </div>
  )
}

const FACILITIES = [
  { id: 'f1', name: '灭火器', code: 'A-01', location: '图书馆 1F 东侧', expire: '2027-06' },
  { id: 'f2', name: '室内消火栓', code: 'B-03', location: '教学楼 B 3F 走廊', expire: '2027-01' },
  { id: 'f3', name: '应急照明', code: 'C-12', location: '综合大楼 2F 楼梯间', expire: '2026-12' },
  { id: 'f4', name: '疏散指示', code: 'D-07', location: 'P 座宿舍 5F 出口', expire: '2027-09' },
]

function InspectionPanel() {
  const [records, setRecords] = useState(FACILITIES)
  const [scanOpen, setScanOpen] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const now = () => new Date().toLocaleString('zh-CN', { hour12: false })
  const mark = (id) => setRecords((r) => r.map((f) => (f.id === id ? { ...f, last: now(), checks: (f.checks || 0) + 1 } : f)))
  const detected = (data) => {
    const code = String(data || '').trim()
    const found = records.find((f) => f.code.toUpperCase() === code.toUpperCase() || code.includes(f.code.toUpperCase()) || code.includes(f.name))
    if (found) { setRecords((r) => r.map((f) => (f.id === found.id ? { ...f, last: now(), checks: (f.checks || 0) + 1 } : f))); setScanMsg(`识别成功：${found.name} ${found.code}`) }
    else setScanMsg(`未匹配到设施：${code || '空二维码'}`)
    setScanOpen(false)
  }
  return (
    <section className="usr-card">
      <div className="usr-card-head"><div><strong>消防设施扫码巡检</strong><small>扫码识别 + 到期提醒</small></div><QrCode size={18} /></div>
      <button type="button" className="usr-scan-btn" onClick={() => { setScanMsg(''); setScanOpen(true) }}><ScanLine size={15} />扫码检查</button>
      {scanMsg && <p className="usr-scan-msg">{scanMsg}</p>}
      <div className="usr-inspection-list">
        {records.map((f) => (
          <div className="usr-inspection-row" key={f.id}>
            <span><QrCode size={14} /></span>
            <div><strong>{f.name} · {f.code}</strong><small>{f.location}{f.last ? ` · 上次 ${f.last}` : ' · 尚未登记'}</small><em>有效期至 {f.expire}{f.checks ? ` · 已检 ${f.checks} 次` : ''}</em></div>
            <button type="button" onClick={() => mark(f.id)}><CheckCircle2 size={13} />登记</button>
          </div>
        ))}
      </div>
      <p className="usr-note"><Info size={12} />二维码内容示例：设施编号 A-01。</p>
      {scanOpen && <QrScanModal onClose={() => setScanOpen(false)} onDetected={detected} />}
    </section>
  )
}

function HazardReport() {
  const [items, setItems] = useState(() => { try { return JSON.parse(localStorage.getItem('thermalGuardHazards') || '[]') } catch { return [] } })
  const [desc, setDesc] = useState('')
  const [loc, setLoc] = useState('')
  const [img, setImg] = useState('')
  const fileRef = useRef(null)
  const pick = (e) => { const f = e.target.files?.[0]; if (!f) return; const r = new FileReader(); r.onload = () => setImg(r.result); r.readAsDataURL(f) }
  const submit = () => {
    if (!desc.trim() && !loc.trim()) return
    const next = [{ id: `hz-${Date.now()}`, desc: desc.trim() || '未描述', loc: loc.trim() || '未填写位置', img, time: new Date().toLocaleString('zh-CN', { hour12: false }) }, ...items].slice(0, 20)
    setItems(next); localStorage.setItem('thermalGuardHazards', JSON.stringify(next)); setDesc(''); setLoc(''); setImg('')
  }
  return (
    <section className="usr-card">
      <div className="usr-card-head"><div><strong>隐患上报</strong><small>拍照记录隐患位置</small></div><AlertTriangle size={18} /></div>
      <div className="usr-hazard-form">
        <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="隐患位置，如：三楼配电箱旁" />
        <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="隐患描述，如：线路发热" rows={2} />
        <div className="usr-hazard-row">
          <button type="button" onClick={() => fileRef.current?.click()}><Camera size={14} />{img ? '更换照片' : '拍照/选图'}</button>
          {img && <img src={img} alt="" />}
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pick} style={{ display: 'none' }} />
        </div>
        <button type="button" className="usr-hazard-submit" onClick={submit}><Send size={14} />提交隐患</button>
      </div>
      {items.length > 0 && <div className="usr-hazard-list">{items.map((h) => <div key={h.id}><span><AlertTriangle size={13} /></span><div><strong>{h.loc}</strong><p>{h.desc}</p><small>{h.time}</small></div>{h.img && <img src={h.img} alt="" />}</div>)}</div>}
    </section>
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
        {tab === 'home' ? <DetectionHome onEvacuate={() => setTab('ar')} /> : tab === 'ar' ? <ArEscape exit={exit} onPickExit={setExitId} siren={siren} /> : <MorePage />}
      </main>

      <nav className="usr-tabs">
        <button type="button" className={tab === 'ar' ? 'active' : ''} onClick={() => setTab('ar')}><Navigation size={19} /><span>AR实景逃生</span></button>
        <button type="button" className={tab === 'home' ? 'active' : ''} onClick={() => setTab('home')}><ScanLine size={19} /><span>首页检测</span></button>
        <button type="button" className={tab === 'more' ? 'active' : ''} onClick={() => setTab('more')}><QrCode size={19} /><span>更多功能</span></button>
      </nav>
    </div>
  )
}
