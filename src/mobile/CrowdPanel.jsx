// 人流监看面板：实时显示每层剩余人数、撤离进度曲线、楼梯负载与拥堵提示。
import { Activity, AlertTriangle, Users } from 'lucide-react'
import { crowdSummary } from './crowd.js'

const STATE_TONE = {
  已清空: 'done',
  撤离中: 'moving',
  等待撤离: 'queued',
  待命: 'idle',
}

// 迷你趋势图：把一串数值画成折线 + 面积，用来表现人流每秒都在变化
function Sparkline({ values, height = 42, tone = 'evac', max }) {
  if (!values || values.length < 2) {
    return <div className={`crowd-spark tone-${tone} is-empty`} style={{ height }} aria-hidden="true" />
  }
  const top = Math.max(max ?? Math.max(...values), 1)
  const step = 100 / (values.length - 1)
  const points = values
    .map((value, index) => `${(index * step).toFixed(2)},${(100 - (value / top) * 100).toFixed(2)}`)
    .join(' ')
  const last = values[values.length - 1]
  return (
    <div className={`crowd-spark tone-${tone}`} style={{ height }} aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none">
        <polygon className="spark-area" points={`0,100 ${points} 100,100`} />
        <polyline className="spark-line" points={points} vectorEffect="non-scaling-stroke" />
      </svg>
      <i className="spark-end" style={{ left: '100%', bottom: `${100 - (last / top) * 100}%` }} />
    </div>
  )
}

export default function CrowdPanel({ crowd, alarmActive, history = [], demo = false }) {
  const summary = crowdSummary(crowd)
  const total = Math.max(crowd.totals.total, 1)
  const clearedPercent = Math.round((crowd.totals.evacuated / total) * 100)

  const samples = history.slice(-60)
  const evacSeries = samples.map((item) => item.evacuated)
  const first = samples[0]
  const last = samples[samples.length - 1]
  const spanSec = first && last ? Math.max((last.at - first.at) / 1000, 0.6) : 0
  const rate = first && last ? (last.evacuated - first.evacuated) / spanSec : 0
  const perTick = samples.length > 1 ? last.evacuated - samples[samples.length - 2].evacuated : 0
  const etas = crowd.floors
    .filter((floor) => floor.remaining > 0 && floor.etaSec != null)
    .map((floor) => floor.etaSec)
  const etaMax = etas.length ? Math.max(...etas) : null

  return (
    <section className={`mobile-card crowd-card ${alarmActive ? 'is-live' : ''} ${demo ? 'is-demo' : ''}`}>
      <div className="card-title">
        <div>
          <strong>人流监看</strong>
          <small>{alarmActive ? '火警撤离中 · 持续刷新' : '待命（触发报警后开始撤离）'}</small>
        </div>
        {alarmActive ? <span className="crowd-live"><i />实时</span> : <Users size={18} />}
      </div>

      <div className="crowd-totals">
        <div>
          <span>已撤离</span>
          <strong className="is-ticking" key={`e${crowd.totals.evacuated}`}>{crowd.totals.evacuated}</strong>
        </div>
        <div>
          <span>楼内剩余</span>
          <strong className="is-ticking" key={`r${crowd.totals.remaining}`}>{crowd.totals.remaining}</strong>
        </div>
        <div><span>总人数</span><strong>{crowd.totals.total}</strong></div>
      </div>

      <div className="crowd-spark-block">
        <div className="crowd-spark-head">
          <span><Activity size={13} />撤离人数曲线</span>
          <em>
            {rate > 0 ? `${rate.toFixed(1)} 人/秒` : '等待启动'}
            {perTick > 0 ? ` · 本拍 +${perTick}` : ''}
          </em>
        </div>
        <Sparkline values={evacSeries} tone="evac" />
        <div className="crowd-spark-foot">
          <span>最近 {samples.length} 次采样</span>
          <span>{etaMax != null ? `预计 ${Math.round(etaMax)} 秒后全部撤离` : '全部楼層已清空'}</span>
        </div>
      </div>

      <div className="crowd-progress" aria-hidden="true">
        <i style={{ width: `${clearedPercent}%` }} />
      </div>
      <p className="crowd-progress-text">
        已撤离 {clearedPercent}%
        {crowd.clearedAtSec != null ? ` · 全部清空用时 ${crowd.clearedAtSec} 秒` : ''}
      </p>

      <div className="crowd-floors">
        {[...crowd.floors].sort((a, b) => b.floor - a.floor).map((item) => {
          const ratio = Math.round((item.remaining / Math.max(item.total, 1)) * 100)
          const series = samples.map((sample) => sample.floors?.[item.floor - 1] ?? item.total)
          return (
            <div className={`crowd-row ${item.floor === crowd.fireFloor ? 'is-fire' : ''}`} key={item.floor}>
              <span className="crowd-floor">{item.floor} 楼</span>
              <span className="crowd-bar" aria-hidden="true"><i style={{ width: `${ratio}%` }} /></span>
              <span className="crowd-trend" aria-hidden="true">
                <Sparkline values={series} height={16} tone="floor" max={item.total} />
              </span>
              <span className="crowd-count is-ticking" key={`f${item.floor}-${item.remaining}`}>
                {item.remaining}<small>/{item.total}</small>
              </span>
              <span className={`crowd-state tone-${STATE_TONE[item.state] ?? 'idle'}`}>{item.state}</span>
            </div>
          )
        })}
      </div>

      <div className="crowd-stairs">
        {Object.values(crowd.stairs).map((stair) => (
          <div className={`crowd-stair ${stair.congested ? 'is-congested' : ''}`} key={stair.id}>
            <strong>{stair.id} 梯</strong>
            <small>{stair.flow.toFixed(1)} 人/秒</small>
            <span>{stair.queue > 0 ? `排队 ${stair.queue} 人` : '通行顺畅'}</span>
          </div>
        ))}
      </div>

      {(summary.congestedStairs.length > 0 || crowd.blockedStairs.length > 0) && (
        <div className="crowd-alert">
          <AlertTriangle size={14} />
          <span>
            {crowd.blockedStairs.length > 0 ? `${crowd.blockedStairs.join(' / ')} 梯已封锁；` : ''}
            {summary.congestedStairs.length > 0 ? `${summary.congestedStairs.join(' / ')} 梯出现拥堵，建议分流` : ''}
          </span>
        </div>
      )}
    </section>
  )
}
