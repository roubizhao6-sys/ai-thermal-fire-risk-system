import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle, Camera, CheckCircle2, Compass, Flame, Info, Link2, LocateFixed, MapPin,
  Navigation, Phone, QrCode, RotateCcw, Send, ShieldAlert, Sparkles, Volume2, VolumeX, X,
  Building2, ChevronRight, BellRing, Play, Cpu, LoaderCircle,
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

const DEFAULT_LLM = { endpoint: 'https://ark.cn-beijing.volces.com/api/v3', apiKey: '', model: 'doubao-1-5-pro-32k-250115' }
const LLM_PRESETS = [
  { id: 'deepseek', name: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { id: 'moonshot', name: 'Kimi', endpoint: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k' },
  { id: 'openai', name: 'OpenAI', endpoint: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  { id: 'doubao', name: '豆包', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', model: 'doubao-1-5-pro-32k-250115' },
]

const FIRE_KB = [
  { kw: ['灭火器', '怎么用', '使用'], answer: '干粉灭火器口诀「提拔握压」：提起灭火器 → 拔掉保险销 → 握住喷管对准火源根部 → 压下压把扫射。' },
  { kw: ['温度', '多少度', '正常'], answer: '设备表面 40-60°C 需关注，超过 65°C 建议现场核查，超过 80°C 应视为高风险并立即处置。' },
  { kw: ['报警', '119', '电话'], answer: '先保证自身安全，迅速拨打 119，说清地址、起火物、火势大小、是否有人被困。' },
  { kw: ['疏散', '逃生', '撤离'], answer: '湿毛巾捂口鼻、低姿前行，沿疏散指示和绿色路线撤离，不乘电梯，到安全集合点报告。' },
  { kw: ['电气', '火灾', '线路'], answer: '电气火灾先断电，勿用水扑救带电设备，用干粉或二氧化碳灭火器，并通知电工检查线路。' },
  { kw: ['烟雾', '烟'], answer: '烟雾有毒且向上聚集，逃生时贴近地面，用湿布捂住口鼻，避免吸入浓烟。' },
]

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
    if (ref.current) { try { ref.current.ctx.close() } catch {}; ref.current = null; setOn(false); return }
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext
      const ctx = new Ctx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      const lfo = ctx.createOscillator()
      const lfoGain = ctx.createGain()
      osc.type = 'sawtooth'; osc.frequency.value = 720
      lfo.type = 'sine'; lfo.frequency.value = 2
      gain.gain.value = 0.0001; lfoGain.gain.value = 0.05
      lfo.connect(lfoGain); lfoGain.connect(gain.gain)
      osc.connect(gain); gain.connect(ctx.destination)
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

function FullArEscape({ exit, siren, onMore }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [status, setStatus] = useState('idle')
  const heading = useHeading(true)
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '沿箭头方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => () => { streamRef.current?.getTracks().forEach((t) => t.stop()) }, [])

  const start = async () => {
    setStatus('requesting')
    try {
      if (!navigator.mediaDevices?.getUserMedia) { setStatus('unsupported'); return }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false })
      streamRef.current = stream
      setStatus('active')
      navigator.vibrate?.(40)
    } catch { setStatus('denied') }
  }
  const stop = () => { streamRef.current?.getTracks().forEach((t) => t.stop()); streamRef.current = null; setStatus('idle') }

  useEffect(() => {
    if (status === 'active' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [status])

  return (
    <div className="usr-escape">
      <header className="usr-escape-top">
        <div className="usr-brand"><span><Flame size={20} /></span><div><strong>热感哨兵</strong><small>AR 实景逃生</small></div></div>
        <div className="usr-escape-top-actions">
          <button type="button" className={siren.on ? 'on' : ''} onClick={siren.toggle}>{siren.on ? <Volume2 size={18} /> : <VolumeX size={18} />}</button>
          <button type="button" onClick={onMore}><BellRing size={18} /></button>
        </div>
      </header>

      <div className="usr-escape-stage">
        {status === 'active' && <video ref={videoRef} className="usr-escape-video" autoPlay playsInline muted />}

        {status !== 'active' ? (
          <div className="usr-escape-hero">
            <div className="usr-escape-hero-badge"><i />实时逃生引导</div>
            <h1>摄像头对准前方</h1>
            <p>画面将叠加逃生方向箭头，带你前往 <strong>{exit.name}</strong></p>
            <button type="button" className="usr-escape-start" onClick={start}>
              {status === 'requesting' ? <><LoaderCircle className="spin" size={20} />正在打开摄像头…</> : <><Camera size={20} />开启 AR 实景逃生</>}
            </button>
            {status === 'denied' && <p className="usr-escape-warn">摄像头权限被拒绝，请在浏览器设置中允许后重试。</p>}
            {status === 'unsupported' && <p className="usr-escape-warn">当前浏览器不支持摄像头，请用 Safari 或 Chrome。</p>}
          </div>
        ) : (
          <div className="usr-escape-overlay">
            <div className="usr-escape-top-line"><span className="usr-ar-exit"><Navigation size={13} />{exit.name}</span><span className="usr-ar-dist">{exit.distance} m</span></div>
            <div className="usr-ar-arrow-wrap" style={{ transform: `rotate(${turn}deg)` }}><Navigation size={64} className="usr-ar-arrow" /></div>
            <div className="usr-ar-center"><strong>{turnText}</strong><p>{Math.round(heading)}° 当前朝向 · 出口方位 {exit.bearing}°</p></div>
          </div>
        )}
      </div>

      <footer className="usr-escape-bottom">
        <a href="tel:119"><Phone size={20} />一键报警 119</a>
        {status === 'active' ? <button type="button" onClick={stop}><X size={18} />退出 AR</button> : <button type="button" onClick={start}><Camera size={18} />开始 AR</button>}
      </footer>
    </div>
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

function loadLlm() {
  try { return { ...DEFAULT_LLM, ...(JSON.parse(localStorage.getItem('thermalGuardLlm') || 'null') || {}) } } catch { return { ...DEFAULT_LLM } }
}

function useDraggable(storageKey) {
  const [pos, setPos] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(storageKey)); if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return saved } catch {}
    return { x: Math.max(10, window.innerWidth - 68), y: Math.max(10, window.innerHeight - 180) }
  })
  const posRef = useRef(pos)
  const dragRef = useRef(null)
  const didDrag = useRef(false)

  const onPointerDown = (event) => {
    event.preventDefault()
    didDrag.current = false
    dragRef.current = { sx: event.clientX, sy: event.clientY, ox: posRef.current.x, oy: posRef.current.y }
    const move = (ev) => {
      const dx = ev.clientX - dragRef.current.sx
      const dy = ev.clientY - dragRef.current.sy
      if (Math.abs(dx) + Math.abs(dy) > 4) didDrag.current = true
      posRef.current = { x: Math.max(8, Math.min(window.innerWidth - 60, dragRef.current.ox + dx)), y: Math.max(8, Math.min(window.innerHeight - 60, dragRef.current.oy + dy)) }
      setPos(posRef.current)
    }
    const up = () => {
      try { localStorage.setItem(storageKey, JSON.stringify(posRef.current)) } catch {}
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  return { pos, onPointerDown, didDrag, style: { left: pos.x, top: pos.y, right: 'auto', bottom: 'auto' } }
}


function UserSprite({ onClose }) {
  const [msgs, setMsgs] = useState([{ role: 'assistant', text: '你好，我是 AI 火警精灵。问我消防问题，或点右上角设置接入大模型。' }])
  const [input, setInput] = useState('')
  const [thinking, setThinking] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [config, setConfig] = useState(() => loadLlm())
  const listRef = useRef(null)

  useEffect(() => { try { localStorage.setItem('thermalGuardLlm', JSON.stringify(config)) } catch {} }, [config])
  useEffect(() => { if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight }, [msgs, thinking])

  const llmReady = Boolean(config.endpoint && config.apiKey)

  const callLLM = async (q) => {
    const base = config.endpoint.trim().replace(/\/+$/, '')
    const url = base.endsWith('/chat/completions') ? base : `${base}/chat/completions`
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${config.apiKey.trim()}` },
      body: JSON.stringify({ model: config.model.trim() || 'deepseek-chat', messages: [{ role: 'system', content: '你是消防助手，请用简体中文简洁回答。' }, ...msgs.slice(-6).map((m) => ({ role: m.role, content: m.text })), { role: 'user', content: q }] }),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.choices?.[0]?.message?.content || null
  }

  const send = async () => {
    const q = input.trim(); if (!q || thinking) return
    setMsgs((m) => [...m, { role: 'user', text: q }]); setInput(''); setThinking(true)
    let answer = null
    if (llmReady) { try { answer = await callLLM(q) } catch { answer = null } }
    if (!answer) { const hit = FIRE_KB.find((i) => i.kw.some((k) => q.includes(k))); answer = hit ? hit.answer : '这个问题建议联网回答：点右上角设置接入大模型。' }
    setMsgs((m) => [...m, { role: 'assistant', text: answer }]); setThinking(false)
  }

  return (
    <div className="usr-sprite-backdrop" onClick={onClose}>
      <section className="usr-sprite-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="usr-sprite-head">
          <div className="usr-sprite-avatar"><Sparkles size={18} /></div>
          <div><strong>AI 火警精灵</strong><small>{llmReady ? '已接入联网大模型' : '本地知识库 · 可联网'}</small></div>
          <div className="usr-sprite-head-actions">
            <button type="button" onClick={() => setShowSettings((v) => !v)}><Cpu size={17} /></button>
            <button type="button" onClick={onClose}><X size={18} /></button>
          </div>
        </div>
        {showSettings ? (
          <div className="usr-sprite-settings">
            <div className="usr-sprite-presets">{LLM_PRESETS.map((p) => <button type="button" key={p.id} className={config.endpoint === p.endpoint ? 'active' : ''} onClick={() => setConfig((c) => ({ ...c, endpoint: p.endpoint, model: p.model }))}>{p.name}</button>)}</div>
            <label>API 地址<input value={config.endpoint} onChange={(e) => setConfig((c) => ({ ...c, endpoint: e.target.value }))} /></label>
            <label>API 密钥<input type="password" value={config.apiKey} onChange={(e) => setConfig((c) => ({ ...c, apiKey: e.target.value }))} /></label>
            <label>模型<input value={config.model} onChange={(e) => setConfig((c) => ({ ...c, model: e.target.value }))} /></label>
            <p className="usr-sprite-note"><Info size={12} />密钥仅存本机，接口需允许跨域。</p>
          </div>
        ) : (
          <>
            <div className="usr-sprite-log" ref={listRef}>
              {msgs.map((m, i) => <div className={`usr-sprite-msg ${m.role}`} key={i}>{m.text}</div>)}
              {thinking && <div className="usr-sprite-msg assistant"><LoaderCircle className="spin" size={14} />正在思考…</div>}
            </div>
            <div className="usr-sprite-input"><input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') send() }} placeholder={llmReady ? '问我任何问题…' : '输入消防问题'} /><button type="button" onClick={send}><Send size={16} /></button></div>
          </>
        )}
      </section>
    </div>
  )
}

export default function UserApp() {
  const [view, setView] = useState('escape')
  const [exitId, setExitId] = useState('library')
  const [gpsOn, setGpsOn] = useState(false)
  const [gps, setGps] = useState(null)
  const [floor, setFloor] = useState('3F')
  const [spriteOpen, setSpriteOpen] = useState(false)
  const siren = useSiren()
  const drag = useDraggable('thermalGuardSpritePos')
  const heading = useHeading(true)
  const exit = EXITS.find((e) => e.id === exitId) || EXITS[0]
  const turn = shortestTurn(exit.bearing, heading)
  const turnText = Math.abs(turn) < 15 ? '保持当前方向直行' : turn > 0 ? `向右转 ${Math.round(Math.abs(turn))}°` : `向左转 ${Math.round(Math.abs(turn))}°`

  useEffect(() => {
    if (!gpsOn) return undefined
    if (!navigator.geolocation) return undefined
    const id = navigator.geolocation.watchPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy }),
      () => {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
    )
    return () => navigator.geolocation.clearWatch(id)
  }, [gpsOn])

  return (
    <div className="usr-app">
      {view === 'escape'
        ? <FullArEscape exit={exit} siren={siren} onMore={() => setView('more')} />
        : (
          <main className="usr-main">
            <header className="usr-more-head">
              <button type="button" onClick={() => setView('escape')}><ChevronRight size={16} />返回逃生</button>
              <div><strong>更多功能</strong><small>热感哨兵 · 用户端</small></div>
              <span />
            </header>

            <section className="usr-card usr-compass-card">
              <div className="usr-card-head"><div><strong>指南针导航</strong><small>朝向最近安全出口</small></div><Compass size={18} /></div>
              <div className="usr-compass-dial" style={{ '--heading': `${-heading}deg`, '--turn': `${turn}deg` }}>
                <span className="usr-cn">N</span><span className="usr-ce">E</span><span className="usr-cs">S</span><span className="usr-cw">W</span>
                <i className="usr-ring" /><b className="usr-arrow"><Navigation size={30} /></b>
              </div>
              <h2 className="usr-turn-text">{turnText}</h2>
              <p className="usr-turn-sub">前往 {exit.name} · 出口方位 {exit.bearing}° · 距离 {exit.distance} 米</p>
            </section>

            <section className="usr-card">
              <div className="usr-card-head"><div><strong>最近安全出口</strong><small>点选目标，导航自动切换</small></div><Building2 size={18} /></div>
              <div className="usr-exit-list">
                {[...EXITS].sort((a, b) => a.distance - b.distance).map((e) => (
                  <button type="button" key={e.id} className={e.id === exitId ? 'active' : ''} onClick={() => setExitId(e.id)}>
                    <span>{e.id === exitId ? <Navigation size={16} /> : <ChevronRight size={16} />}</span>
                    <div><strong>{e.name}</strong><small>{e.distance} 米 · {directionLabel(e.bearing)}</small></div>
                    <b>{e.id === exitId ? '当前' : '选择'}</b>
                  </button>
                ))}
              </div>
            </section>

            <section className="usr-card">
              <div className="usr-card-head"><div><strong>我的位置</strong><small>手机 GPS 定位</small></div><LocateFixed size={18} /></div>
              <button type="button" className="usr-gps-close" onClick={() => setGpsOn((v) => !v)}>{gpsOn ? '关闭 GPS 定位' : '开启 GPS 定位'}</button>
              {gpsOn && (gps ? (
                <div className="usr-gps-grid" style={{ marginTop: 8 }}>
                  <div><span>纬度</span><strong>{gps.lat.toFixed(6)}</strong></div>
                  <div><span>经度</span><strong>{gps.lng.toFixed(6)}</strong></div>
                  <div><span>精度</span><strong>±{Math.round(gps.accuracy)} m</strong></div>
                  <div><span>最近出口</span><strong>{exit.name}</strong></div>
                </div>
              ) : <p className="usr-gps-pending" style={{ marginTop: 8 }}>正在获取定位… 请允许位置权限。</p>)}
            </section>

            <section className="usr-card">
              <div className="usr-card-head"><div><strong>所在楼层</strong><small>用于楼梯疏散指引</small></div><Building2 size={18} /></div>
              <div className="usr-floor-row">{FLOORS.map((f) => <button type="button" key={f} className={floor === f ? 'active' : ''} onClick={() => setFloor(f)}>{f}</button>)}</div>
              <div className="usr-stair-row">
                <button type="button"><BellRing size={15} />进楼梯</button>
                <button type="button"><Play size={15} />开始演练</button>
              </div>
            </section>

            <HazardReport />

            <a className="usr-switch" href="./mobile-app.html">我是物业/管理员，进入系统端 →</a>
            <p className="usr-disclaimer"><ShieldAlert size={14} />本应用为科研演示原型，逃生路线仅供参考，不替代专业消防设施与现场指挥。</p>
          </main>
        )}

      <button type="button" className="usr-sprite-fab" style={drag.style} onPointerDown={drag.onPointerDown} onClick={() => { if (drag.didDrag.current) { drag.didDrag.current = false; return } setSpriteOpen(true) }} aria-label="打开AI精灵"><Sparkles size={20} /><i /></button>
      {spriteOpen && <UserSprite onClose={() => setSpriteOpen(false)} />}
    </div>
  )
}
