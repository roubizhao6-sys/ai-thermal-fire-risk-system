import { useState } from 'react'
import {
  AlertTriangle,
  BellRing,
  Check,
  Flame,
  Play,
  RotateCcw,
  Settings2,
  ShieldAlert,
  ShieldCheck,
  Square,
  Volume2,
} from 'lucide-react'

const SPOTS = [
  { id: 'A', label: 'A 楼梯口' },
  { id: 'C', label: '走廊中段' },
  { id: 'B', label: 'B 楼梯口' },
]

function riskText(risk) {
  return risk === 'high' ? '高风险' : risk === 'medium' ? '中风险' : '低风险'
}

export default function AlarmCenterView({
  alarm,
  fire,
  alerts,
  settings,
  audioReady,
  onSettingsChange,
  onManualAlarm,
  onStartDrill,
  onStopDrill,
  onClearFire,
  onEnableSound,
  onMarkHandled,
  onClearAlerts,
}) {
  const [drillFloor, setDrillFloor] = useState(4)
  const [drillSpot, setDrillSpot] = useState('A')

  const armed = !alarm
  const statusLabel = alarm ? (fire?.mode === 'drill' ? '演练中' : '火警报警中') : '布防中'

  return (
    <div className="mobile-page">
      <header className="page-intro">
        <div><span>报警中心</span><h1>火警报警与记录</h1><p>报警触发、声音设置与事件留痕</p></div>
        <span className={`evac-badge ${alarm ? 'badge-danger' : 'badge-safe'}`}>{statusLabel}</span>
      </header>

      <section className={`arm-card ${armed ? 'is-armed' : 'is-alarming'}`}>
        {armed ? <ShieldCheck size={26} /> : <BellRing size={26} />}
        <div>
          <span>系统状态</span>
          <strong>{armed ? '监测已布防' : '报警进行中'}</strong>
          <small>
            {armed
              ? `温度达到 ${settings.highThreshold}°C 自动触发全屏报警`
              : '报警将持续鸣响，直到确认或解除'}
          </small>
        </div>
      </section>

      {settings.sound && !audioReady && (
        <button className="sound-unlock" type="button" onClick={onEnableSound}>
          <Volume2 size={17} />点击解锁报警声音（浏览器限制自动播放）
        </button>
      )}

      <section className="mobile-card">
        <div className="card-title"><div><strong>立即触发</strong><small>用于演示与自检</small></div><BellRing size={18} /></div>
        <button className="trigger-button" type="button" onClick={onManualAlarm}>
          <AlertTriangle size={18} />手动触发火警报警
        </button>
        <div className="card-hint">手动报警不带火源信息，仅演示全屏警报与声音。</div>
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>火警演练</strong><small>指定起火层与起火点</small></div><Flame size={18} /></div>
        <div className="spot-picker">
          <span>起火楼层</span>
          <div className="chip-row">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((floor) => (
              <button key={floor} type="button" className={drillFloor === floor ? 'active' : ''} onClick={() => setDrillFloor(floor)}>{floor}</button>
            ))}
          </div>
        </div>
        <div className="spot-picker">
          <span>起火点</span>
          <div className="chip-row wide">
            {SPOTS.map((spot) => (
              <button key={spot.id} type="button" className={drillSpot === spot.id ? 'active' : ''} onClick={() => setDrillSpot(spot.id)}>{spot.label}</button>
            ))}
          </div>
        </div>
        <div className="drill-row">
          <button type="button" className="drill-start" onClick={() => onStartDrill(drillFloor, drillSpot)}>
            <Play size={15} />开始演练
          </button>
          <button type="button" className="drill-stop" onClick={() => { onStopDrill(); onClearFire() }} disabled={!fire && !alarm}>
            <Square size={15} />结束
          </button>
        </div>
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>报警设置</strong><small>保存在本机浏览器</small></div><Settings2 size={18} /></div>

        <Toggle label="警笛声音" hint="全屏报警时循环鸣响" value={settings.sound} onChange={(value) => onSettingsChange({ sound: value })} />
        <Toggle label="语音播报" hint="循环播报撤离指令" value={settings.voice} onChange={(value) => onSettingsChange({ voice: value })} />
        <Toggle label="震动提醒" hint="iOS Safari 不支持震动 API" value={settings.vibrate} onChange={(value) => onSettingsChange({ vibrate: value })} />
        <Toggle label="传感器自动触发" hint="热像仪判定高风险时自动报警" value={settings.autoTrigger} onChange={(value) => onSettingsChange({ autoTrigger: value })} />

        <Slider
          label="高温报警阈值"
          unit="°C"
          min={50}
          max={90}
          step={1}
          value={settings.highThreshold}
          onChange={(value) => onSettingsChange({ highThreshold: value })}
        />
        <Slider
          label="中风险提示阈值"
          unit="°C"
          min={35}
          max={70}
          step={1}
          value={settings.mediumThreshold}
          onChange={(value) => onSettingsChange({ mediumThreshold: value })}
        />

        <div className="setting-row">
          <div><strong>未确认升级时间</strong><small>超时后提高音量并加快播报</small></div>
          <div className="chip-row compact">
            {[20, 30, 60].map((second) => (
              <button key={second} type="button" className={settings.escalateSec === second ? 'active' : ''} onClick={() => onSettingsChange({ escalateSec: second })}>{second}s</button>
            ))}
            <button type="button" className={settings.escalateSec === 0 ? 'active' : ''} onClick={() => onSettingsChange({ escalateSec: 0 })}>关闭</button>
          </div>
        </div>
      </section>

      <section className="mobile-card">
        <div className="card-title">
          <div><strong>报警记录</strong><small>最近 {alerts.length} 条事件</small></div>
          {alerts.length > 0 && <button className="link-button" type="button" onClick={onClearAlerts}>清空</button>}
        </div>
        {alerts.length === 0 && (
          <div className="empty-card"><ShieldCheck size={34} /><strong>暂无报警记录</strong><p>触发中高风险或手动报警后会记录在此。</p></div>
        )}
        {alerts.map((alert) => (
          <div className={`alarm-log alarm-${alert.risk} ${alert.handled ? 'is-handled' : ''}`} key={alert.id}>
            <span className="log-icon">{alert.kind === 'alarm' ? <BellRing size={17} /> : <AlertTriangle size={17} />}</span>
            <div>
              <strong>{alert.kind === 'alarm' ? (alert.mode === 'drill' ? '火警演练' : '火警报警') : `${riskText(alert.risk)}温升`}</strong>
              <small>{alert.time} · {alert.location || '热像仪监测点'}</small>
              <small className="log-state">
                {alert.handled ? <><Check size={12} />已处理</> : <><ShieldAlert size={12} />未处理</>}
              </small>
            </div>
            <div className="log-right">
              <b>{alert.temp != null ? `${Number(alert.temp).toFixed(1)}°C` : '—'}</b>
              {!alert.handled && <button type="button" onClick={() => onMarkHandled(alert.id)}>处理</button>}
            </div>
          </div>
        ))}
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>报警链路</strong><small>传感器到手机的完整闭环</small></div><BellRing size={18} /></div>
        {[
          ['01', '传感器判定', '热像仪最高温超过阈值即判定高风险'],
          ['02', '报警决策', '本地判定，断网仍可触发报警'],
          ['03', '全屏警报', '警笛 + 语音 + 震动 + 高对比界面'],
          ['04', '逃生指引', '路线实时重算并进入跟随模式'],
          ['05', '事件留痕', '记录触发时间、温度与处理状态'],
        ].map(([index, title, text]) => (
          <div className="hotspot-row" key={index}>
            <span>{index}</span>
            <div><strong>{title}</strong><small>{text}</small></div>
            <RotateCcw size={15} />
          </div>
        ))}
      </section>

      <div className="safety-note"><ShieldAlert size={17} /><p>本系统为科研演示原型，不替代专业消防报警系统。请勿在真实火警中依赖本页面作为唯一逃生依据。</p></div>
    </div>
  )
}

function Toggle({ label, hint, value, onChange }) {
  return (
    <div className="setting-row">
      <div><strong>{label}</strong><small>{hint}</small></div>
      <button
        type="button"
        className={`switch ${value ? 'on' : ''}`}
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
      >
        <i />
      </button>
    </div>
  )
}

function Slider({ label, unit, min, max, step, value, onChange }) {
  return (
    <div className="setting-row column">
      <div className="slider-head"><strong>{label}</strong><b>{value}{unit}</b></div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} />
    </div>
  )
}
