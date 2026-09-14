// 人流监看面板：实时显示每层剩余人数、撤离进度、楼梯负载与拥堵提示。
import { AlertTriangle, Users } from 'lucide-react'
import { crowdSummary } from './crowd.js'

const STATE_TONE = {
  已清空: 'done',
  撤离中: 'moving',
  等待撤离: 'queued',
  待命: 'idle',
}

export default function CrowdPanel({ crowd, alarmActive }) {
  const summary = crowdSummary(crowd)
  const total = Math.max(crowd.totals.total, 1)
  const clearedPercent = Math.round((crowd.totals.evacuated / total) * 100)

  return (
    <section className="mobile-card crowd-card">
      <div className="card-title">
        <div>
          <strong>人流监看</strong>
          <small>{alarmActive ? '火警撤离中 · 每秒刷新' : '待命（触发报警后开始撤离）'}</small>
        </div>
        <Users size={18} />
      </div>

      <div className="crowd-totals">
        <div><span>已撤离</span><strong>{crowd.totals.evacuated}</strong></div>
        <div><span>楼内剩余</span><strong>{crowd.totals.remaining}</strong></div>
        <div><span>总人数</span><strong>{crowd.totals.total}</strong></div>
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
          return (
            <div className={`crowd-row ${item.floor === crowd.fireFloor ? 'is-fire' : ''}`} key={item.floor}>
              <span className="crowd-floor">{item.floor} 楼</span>
              <span className="crowd-bar" aria-hidden="true"><i style={{ width: `${ratio}%` }} /></span>
              <span className="crowd-count">{item.remaining}<small>/{item.total}</small></span>
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
