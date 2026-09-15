import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, BellRing, Eye, Flame, ShieldAlert, ShieldCheck, Thermometer, Waves } from 'lucide-react'
import { fusePreventionSignals } from './sensorFusion.js'

const HIGH = 65
const MEDIUM = 45

export default function PreventionPanel({ frame, onAlarm }) {
  const [flame, setFlame] = useState(0)
  const [smoke, setSmoke] = useState(0)
  const [history, setHistory] = useState([])
  const timerRef = useRef(null)

  const maxTemp = Number(frame?.maxTemp || 0)
  const hotspots = frame?.hotspots?.length || 0

  useEffect(() => {
    const id = setInterval(() => {
      setHistory((cur) => [...cur.slice(-29), { t: Date.now(), temp: maxTemp }])
    }, 1000)
    timerRef.current = id
    return () => clearInterval(id)
  }, [maxTemp])

  const derived = useMemo(() => {
    if (history.length < 2) return { ror: 0, sustainedSec: 0 }
    const first = history[0]
    const last = history[history.length - 1]
    const minutes = Math.max((last.t - first.t) / 60000, 0.02)
    const ror = Math.max(0, (last.temp - first.temp) / minutes)
    let sustained = 0
    for (let i = history.length - 1; i >= 0; i -= 1) {
      if (history[i].temp >= HIGH) sustained += 1
      else break
    }
    return { ror, sustainedSec: sustained }
  }, [history])

  const result = useMemo(() => fusePreventionSignals({
    thermal: { maxTemp, ror: derived.ror, sustainedSec: derived.sustainedSec, multiNode: hotspots >= 2 },
    visual: { flame, smoke },
    thresholds: { high: HIGH, medium: MEDIUM },
  }), [maxTemp, derived, flame, smoke, hotspots])

  const levelMeta = result.level === 'alarm'
    ? { label: '判定火警', tone: 'danger', icon: BellRing }
    : result.level === 'watch'
      ? { label: '关注复核', tone: 'warn', icon: AlertTriangle }
      : { label: '监测正常', tone: 'safe', icon: ShieldCheck }

  return (
    <section className="mobile-card prevention-card">
      <div className="card-head"><div><strong>火灾前 · 三路证据融合判定</strong><small>视觉 + 烟雾 + 热像联合，单路不报警</small></div><Waves size={18} /></div>

      <div className="fusion-status">
        <div className={`fusion-level level-${result.level}`}><levelMeta.icon size={20} /><strong>{levelMeta.label}</strong><span>判据得分 {(result.score * 100).toFixed(0)}% · 有效证据 {result.evidenceCount} 路</span></div>
        <div className="fusion-bar"><i style={{ width: `${Math.round(result.score * 100)}%` }} /></div>
      </div>

      <div className="fusion-grid">
        <div className={`fusion-row ${result.flags.thermalStrong || result.flags.tempHit ? 'on' : ''}`}>
          <span className="fusion-icon"><Thermometer size={16} /></span>
          <div><strong>热像证据</strong><small>{maxTemp.toFixed(1)}°C · 升温 {derived.ror.toFixed(1)}°C/分 · 持续 {derived.sustainedSec}s</small></div>
          <em>{result.flags.thermalStrong ? '强' : result.flags.tempHit ? '超阈' : result.flags.tempWarm ? '关注' : '正常'}</em>
        </div>
        <div className={`fusion-row ${result.flags.flameSeen ? 'on' : ''}`}>
          <span className="fusion-icon"><Flame size={16} /></span>
          <div><strong>视觉火焰</strong><small>演示滑杆，真实可由 YOLO 接入</small></div>
          <input type="range" min="0" max="100" value={Math.round(flame * 100)} onChange={(e) => setFlame(Number(e.target.value) / 100)} />
        </div>
        <div className={`fusion-row ${result.flags.smokeSeen ? 'on' : ''}`}>
          <span className="fusion-icon"><Eye size={16} /></span>
          <div><strong>烟雾证据</strong><small>演示滑杆，真实可由烟雾识别接入</small></div>
          <input type="range" min="0" max="100" value={Math.round(smoke * 100)} onChange={(e) => setSmoke(Number(e.target.value) / 100)} />
        </div>
      </div>

      <div className="fusion-reasons">
        {result.reasons.map((reason) => <span key={reason}>{reason}</span>)}
      </div>

      {result.level === 'alarm' && (
        <button type="button" className="fusion-alarm-btn" onClick={() => onAlarm(maxTemp)}><BellRing size={16} />立即触发全屏报警</button>
      )}
      <p className="fusion-note"><ShieldAlert size={12} />单路证据不报警、两路或完整热像证据链才确认，用于降低误报。</p>
    </section>
  )
}
