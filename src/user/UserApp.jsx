import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle, Camera, Compass, Flame, LocateFixed, MapPin, Navigation,
  Phone, Play, Siren, ShieldAlert, Volume2, VolumeX, X, BellRing, Building2, ChevronRight, RotateCcw,
} from 'lucide-react'

const EXITS = [
  { id: 'north', name: '北门', bearing: 0, distance: 118 },
  { id: 'south', name: '南门', bearing: 180, distance: 132 },
  { id: 'lrt', name: '轻轨科大站', bearing: 90, distance: 160 },
  { id: 'r', name: 'R座综合教学大楼', bearing: 45, distance: 95 },
  { id: 'j', name: 'J座体育馆', bearing: 135, distance: 140 },
  { id: 'library', name: '图书馆', bearing: 300, distance: 88 },
  { id: 'p', name: 'P座宿舍', bearing: 225, distance: 150 },
]

const FLOORS = ['G', '1F', '2F', '3F', '4F', '5F']

function directionLabel(degree) {
  const labels = ['北', '东北', '东', '东南', '南', '西南', '西', '西北']
  return labels[Math.round(((degree % 360) + 360) % 360 / 45) % 8]
}

function shortestTurn(target, heading) {
  return ((target - heading + 540) % 360) - 180
}

function useSiren() {
  const ref = useRef(null)
  const [on, setOn] = useState(false)
  const toggle = () => {
    if (ref.current) {
      try { ref.current.ctx.close() } catch {}
      ref.current = null
      setOn(false)
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
      osc.frequency.value = 720
      lfo.type = 'sine'
      lfo.frequency.value = 2
      gain.gain.value = 0.0001
      lfoGain.gain.value = 0.05
      lfo.connect(lfoGain)
      lfoGain.connect(gain.gain)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(); lfo.start()
      gain.gain.linearRampToValueAtTime(0.12, ctx.currentTime + 0.08)
      ref.current = { ctx, osc, lfo, gain, lfoGain }
      setOn(true)
      navigator.vibrate?.([260, 100, 260, 100, 260])
    } catch {}
  }
  useEffect(() => () => { try { ref.current?.ctx.close() } catch {} }, [])
  return { on, toggle }
}

function useHeading(enabled) {
  const [heading, setHeading] = useState(24)
  useEffect(() => {
    if (!enabled) return undefined
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
  }, [enabled])
  return heading
}

function ArView({ exit, onClose, siren }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('requesting')
  const heading = useHeading(true)
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '保持当前方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        setStatus('active')
      } catch { if (!cancelled) setStatus('denied') }
    }
    start()
    return () => { cancelled = true; streamRef.current?.getTracks().forEach((t) => t.stop()) }
  }, [])

  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [status])

  return (
    <div className="usr-overlay">
      <section className="usr-sheet usr-ar-sheet">
        <div className="usr-sheet-head"><div><strong>AR 实景逃生</strong><small>前往 {exit.name} · {exit.distance} 米</small></div><button type="button" onClick={onClose}><X size={18} /></button></div>
        {status === 'active' ? (
          <div className="usr-ar-stage">
            <video ref={videoRef} className="usr-ar-video" autoPlay playsInline muted />
            <div className="usr-ar-overlay">
              <div className="usr-ar-top"><span className="usr-ar-exit"><Navigation size={13} />{exit.name}</span><span className="usr-ar-dist">{exit.distance} m</span></div>
              <div className="usr-ar-arrow-wrap" style={{ transform: `rotate(${turn}deg)` }}><Navigation size={60} className="usr-ar-arrow" /></div>
              <div className="usr-ar-center"><strong>{turnText}</strong><p>{Math.round(heading)}° 当前朝向 · 出口方位 {exit.bearing}°</p></div>
            </div>
          </div>
        ) : (
          <div className="usr-ar-pending">
            {status === 'requesting' && '正在打开摄像头…'}
            {status === 'denied' && '摄像头权限被拒绝，请在浏览器设置中允许后重试。'}
            {status === 'unsupported' && '当前浏览器不支持摄像头，请用 Safari 或 Chrome。'}
          </div>
        )}
        <div className="usr-sheet-actions">
          <button type="button" onClick={siren.toggle}><Volume2 size={15} />{siren.on ? '关闭警报' : '打开警报'}</button>
          <a href="tel:119"><Phone size={15} />拨打119</a>
        </div>
      </section>
    </div>
  )
}

function EvacOverlay({ exit, onClose, siren }) {
  const heading = useHeading(true)
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '沿箭头方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`
  return (
    <div className="usr-evac">
      <div className="usr-evac-head"><Siren size={20} />火警 · 立即撤离</div>
      <div className="usr-evac-body">
        <div className="usr-evac-dial" style={{ '--heading': `${-heading}deg`, '--turn': `${turn}deg` }}>
          <span className="usr-cn">N</span><span className="usr-ce">E</span><span className="usr-cs">S</span><span className="usr-cw">W</span>
          <i className="usr-ring" />
          <b className="usr-arrow"><Navigation size={30} /></b>
        </div>
        <div className="usr-evac-copy">
          <h2>{turnText}</h2>
          <p>撤离至 <strong>{exit.name}</strong> · {exit.distance} 米</p>
          <small>{Math.round(heading)}° 当前朝向 · 出口方位 {exit.bearing}°</small>
        </div>
      </div>
      <div className="usr-evac-actions">
        <a href="tel:119"><Phone size={18} />一键报警 119</a>
        <button type="button" onClick={siren.toggle}>{siren.on ? <VolumeX size={18} /> : <Volume2 size={18} />}{siren.on ? '静音' : '报警声'}</button>
        <button type="button" onClick={onClose}><X size={18} />结束</button>
      </div>
      <p className="usr-evac-note">这是逃生引导原型，请结合实际现场标识与工作人员指挥撤离。</p>
    </div>
  )
}

export default function UserApp() {
  const [exitId, setExitId] = useState('library')
  const [arOpen, setArOpen] = useState(false)
  const [evacOpen, setEvacOpen] = useState(false)
  const [gpsOn, setGpsOn] = useState(false)
  const [gps, setGps] = useState(null)
  const [floor, setFloor] = useState('3F')
  const siren = useSiren()
  const heading = useHeading(true)
  const exit = EXITS.find((e) => e.id === exitId) || EXITS[0]
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '保持当前方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => {
    if (!gpsOn) return undefined
    if (!navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {},
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [gpsOn])

  return (
    <div className="usr-app">
      <header className="usr-topbar">
        <div className="usr-brand"><span><Flame size={20} /></span><div><strong>热感哨兵</strong><small>逃生指引 · 用户端</small></div></div>
        <button type="button" className={`usr-alarm ${siren.on ? 'on' : ''}`} onClick={siren.toggle}>{siren.on ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
      </header>

      <main className="usr-main">
        <section className="usr-hero">
          <div className="usr-hero-text"><span className="usr-live"><i />实时逃生引导</span><h1>危险时，跟着箭头跑</h1><p>最近安全出口：{exit.name} · {exit.distance} 米</p></div>
          <button type="button" className="usr-evac-btn" onClick={() => setEvacOpen(true)}><Siren size={22} />紧急撤离模式</button>
        </section>

        <section className="usr-quick">
          <a className="usr-quick-119" href="tel:119"><Phone size={22} /><span>一键报警</span><strong>119</strong></a>
          <button type="button" onClick={() => setArOpen(true)}><Camera size={22} /><span>AR实景逃生</span></button>
          <button type="button" onClick={() => setGpsOn((v) => !v)}><LocateFixed size={22} /><span>我的位置</span></button>
        </section>

        <section className="usr-card usr-compass-card">
          <div className="usr-card-head"><div><strong>指南针导航</strong><small>朝向最近安全出口</small></div><Compass size={18} /></div>
          <div className="usr-compass-dial" style={{ '--heading': `${-heading}deg`, '--turn': `${turn}deg` }}>
            <span className="usr-cn">N</span><span className="usr-ce">E</span><span className="usr-cs">S</span><span className="usr-cw">W</span>
            <i className="usr-ring" />
            <b className="usr-arrow"><Navigation size={30} /></b>
          </div>
          <h2 className="usr-turn-text">{turnText}</h2>
          <p className="usr-turn-sub">前往 {exit.name} · 出口方位 {exit.bearing}° · 距离 {exit.distance} 米</p>
        </section>

        <section className="usr-card">
          <div className="usr-card-head"><div><strong>最近安全出口</strong><small>点选目标，导航自动切换</small></div><Building2 size={18} /></div>
          <div className="usr-exit-list">
            {EXITS.sort((a, b) => a.distance - b.distance).map((e) => (
              <button type="button" key={e.id} className={e.id === exitId ? 'active' : ''} onClick={() => setExitId(e.id)}>
                <span>{e.id === exitId ? <Navigation size={16} /> : <ChevronRight size={16} />}</span>
                <div><strong>{e.name}</strong><small>{e.distance} 米 · {directionLabel(e.bearing)}</small></div>
                <b>{e.id === exitId ? '当前' : '选择'}</b>
              </button>
            ))}
          </div>
        </section>

        {gpsOn && (
          <section className="usr-card usr-gps-card">
            <div className="usr-card-head"><div><strong>我的位置</strong><small>手机 GPS 定位</small></div><LocateFixed size={18} /></div>
            {gps ? (
              <div className="usr-gps-grid">
                <div><span>纬度</span><strong>{gps.lat.toFixed(6)}</strong></div>
                <div><span>经度</span><strong>{gps.lng.toFixed(6)}</strong></div>
                <div><span>精度</span><strong>±{Math.round(gps.accuracy)} m</strong></div>
                <div><span>最近出口</span><strong>{exit.name}</strong></div>
              </div>
            ) : <p className="usr-gps-pending">正在获取定位… 请允许位置权限。</p>}
            <button type="button" className="usr-gps-close" onClick={() => setGpsOn(false)}>关闭 GPS 定位</button>
          </section>
        )}

        <section className="usr-card">
          <div className="usr-card-head"><div><strong>所在楼层</strong><small>用于楼梯疏散指引</small></div><Building2 size={18} /></div>
          <div className="usr-floor-row">{FLOORS.map((f) => <button type="button" key={f} className={floor === f ? 'active' : ''} onClick={() => setFloor(f)}>{f}</button>)}</div>
          <div className="usr-stair-row">
            <button type="button"><BellRing size={15} />进楼梯</button>
            <button type="button"><Play size={15} />开始演练</button>
          </div>
        </section>

        <a className="usr-switch" href="./mobile-app.html">我是物业/管理员，进入系统端 →</a>
        <p className="usr-disclaimer"><ShieldAlert size={14} />本应用为科研演示原型，逃生路线仅供参考，不替代专业消防设施与现场指挥。</p>
      </main>

      {arOpen && <ArView exit={exit} onClose={() => setArOpen(false)} siren={siren} />}
      {evacOpen && <EvacOverlay exit={exit} onClose={() => setEvacOpen(false)} siren={siren} />}
    </div>
  )
}
