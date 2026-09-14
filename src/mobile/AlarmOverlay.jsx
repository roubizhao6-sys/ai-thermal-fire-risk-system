import { AlertTriangle, BellRing, Flame, Route, ShieldCheck, Volume2, VolumeX, X } from 'lucide-react'

function formatElapsed(startedAt, nowMs) {
  const seconds = Math.max(0, Math.round((nowMs - startedAt) / 1000))
  const minutes = Math.floor(seconds / 60)
  return minutes > 0 ? `${minutes} 分 ${String(seconds % 60).padStart(2, '0')} 秒` : `${seconds} 秒`
}

export default function AlarmOverlay({
  alarm,
  nowMs,
  soundOn,
  audioReady,
  onEvacuate,
  onAcknowledge,
  onReenforce,
  onResolve,
  onStopDrill,
  onSpreadFire,
  onEnableSound,
  locationDetail,
}) {
  if (!alarm) return null

  const isDrill = alarm.mode === 'drill'
  const acknowledged = alarm.acknowledged
  const elapsed = formatElapsed(alarm.startedAt, nowMs)

  return (
    <div className={`alarm-overlay ${acknowledged ? 'is-acked' : 'is-active'} ${isDrill ? 'is-drill' : ''}`} role="alertdialog" aria-live="assertive">
      <div className="alarm-flash" />
      <div className="alarm-body">
        <header className="alarm-head">
          <span className={`alarm-chip ${isDrill ? 'chip-drill' : 'chip-live'}`}>
            {isDrill ? '火警演练' : '真实警情'}
          </span>
          <span className="alarm-elapsed">已持续 {elapsed}</span>
        </header>

        <div className="alarm-hero">
          <div className="alarm-icon"><Flame size={46} strokeWidth={2.2} /></div>
          <h2>火警警报</h2>
          <p className="alarm-location">{alarm.location}</p>
          {locationDetail && (
            <p className="alarm-location-detail">
              <Flame size={14} />火情位置 · {locationDetail}
            </p>
          )}
          <p className="alarm-lead">
            {acknowledged ? '已静音，但危险仍未解除' : isDrill ? '这是一次演练，请按指引撤离' : '立即沿逃生路线撤离，切勿搭乘电梯'}
          </p>
        </div>

        <div className="alarm-stats">
          <div><span>触发温度</span><strong>{alarm.temp != null ? `${Number(alarm.temp).toFixed(1)}°C` : '—'}</strong></div>
          <div><span>风险等级</span><strong>{alarm.risk === 'medium' ? '中风险' : '高风险'}</strong></div>
          <div><span>报警来源</span><strong>{alarm.sourceLabel || '传感器'}</strong></div>
        </div>

        {alarm.escalated && !acknowledged && (
          <div className="alarm-escalated"><AlertTriangle size={15} />报警长时间未被确认，已升级音量与播报频率</div>
        )}

        {!acknowledged && soundOn && !audioReady && (
          <button className="alarm-unlock" type="button" onClick={onEnableSound}>
            <Volume2 size={17} />点击开启警笛声音（浏览器要求先交互）
          </button>
        )}

        <div className="alarm-actions">
          <button className="alarm-primary" type="button" onClick={onEvacuate}>
            <Route size={22} />查看逃生路线
          </button>

          {acknowledged ? (
            <div className="alarm-row">
              <button type="button" onClick={onReenforce}><BellRing size={16} />重新鸣响</button>
              <button type="button" onClick={onResolve}><ShieldCheck size={16} />解除警报</button>
            </div>
          ) : (
            <button className="alarm-secondary" type="button" onClick={onAcknowledge}>
              <VolumeX size={18} />我已知晓，静音报警
            </button>
          )}

          {isDrill && (
            <div className="alarm-row">
              {onSpreadFire && (
                <button type="button" onClick={onSpreadFire}>
                  <Flame size={16} />蔓延到上一层
                </button>
              )}
              <button className="alarm-ghost" type="button" onClick={onStopDrill}>
                <X size={16} />结束演练
              </button>
            </div>
          )}
        </div>

        <p className="alarm-foot">
          报警期间请保持本页面处于前台。震动提醒在 iOS Safari 上不可用，正式版 App 将通过 Critical Alerts 强制提醒。
        </p>
      </div>
    </div>
  )
}
