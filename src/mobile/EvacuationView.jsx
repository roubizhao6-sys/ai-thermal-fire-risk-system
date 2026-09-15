import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  ArrowDownUp,
  Ban,
  ChevronDown,
  ChevronUp,
  Compass,
  Camera,
  DoorOpen,
  Flame,
  Footprints,
  MapPin,
  Navigation,
  Play,
  RotateCcw,
  ShieldAlert,
  TriangleAlert,
} from 'lucide-react'
import { BUILDING, FLOOR_COUNT, positionNodeId } from './building.js'
import CrowdPanel from './CrowdPanel.jsx'
import { HAZARD_META } from './evacuation.js'
import FloorPlan from './FloorPlan.jsx'
import FollowMode from './FollowMode.jsx'

const STEP_ICONS = { pin: MapPin, walk: Footprints, stair: ArrowDownUp, exit: DoorOpen }

const SPOTS = [
  { id: 'A', label: 'A 楼梯口' },
  { id: 'C', label: '走廊中段' },
  { id: 'B', label: 'B 楼梯口' },
]

const BLOCK_OPTIONS = [
  { id: 'A1', label: 'A 楼梯（1 楼口）' },
  { id: 'B1', label: 'B 楼梯（1 楼口）' },
  { id: 'L1', label: '1 楼大堂正门' },
  { id: 'ROOF', label: '8 楼天台出口' },
]

function formatDistance(meters) {
  return meters >= 100 ? `${Math.round(meters)} 米` : `${Math.round(meters)} 米`
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`
  const minutes = Math.floor(seconds / 60)
  return `约 ${minutes} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
}

export default function EvacuationView({ route, fire, position, blocked, nowMs, crowd, crowdHistory, crowdDemo, onPositionChange, onToggleBlock, onStartDrillAt, onSpreadFire, onClearFire, onOpenAr }) {
  const [viewFloor, setViewFloor] = useState(position.floor)
  const [follow, setFollow] = useState(false)

  useEffect(() => {
    setViewFloor(position.floor)
  }, [position.floor, position.spot])

  useEffect(() => {
    if (fire?.nodeId) setViewFloor(BUILDING.nodes[fire.nodeId]?.floor || position.floor)
  }, [fire?.nodeId, fire?.startedAt, position.floor])

  const hazard = route?.hazard
  const elapsed = fire ? Math.max(0, Math.round((nowMs - fire.startedAt) / 1000)) : 0
  const floorsOnRoute = route?.floors || []
  const fireFloor = fire ? BUILDING.nodes[fire.nodeId]?.floor : null

  const shiftFloor = (delta) => setViewFloor((current) => Math.min(FLOOR_COUNT, Math.max(1, current + delta)))

  return (
    <div className="mobile-page">
      <header className="page-intro">
        <div>
          <span>逃生指引</span>
          <h1>动态疏散路线</h1>
          <p>{fire ? `起火 ${elapsed} 秒，路线每秒重算一次` : '当前无火情，显示最近出口的常规路线'}</p>
        </div>
        <span className={`evac-badge ${fire ? 'badge-danger' : 'badge-safe'}`}>{fire ? '火警中' : '待命'}</span>
      </header>

      {onOpenAr && (
        <button className="ar-entry-button" type="button" onClick={onOpenAr}>
          <Camera size={17} />
          <span>AR 实景导航</span>
          <small>举起手机，把撤离方向叠在实景画面上（与用户端同一个界面）</small>
        </button>
      )}

      <section className="mobile-card position-card">
        <div className="card-title"><div><strong>我的位置</strong><small>实际部署由蓝牙信标自动定位</small></div><Navigation size={18} /></div>
        <div className="floor-stepper">
          <button type="button" onClick={() => shiftFloor(-1)} disabled={viewFloor <= 1}><ChevronDown size={16} /></button>
          <div><strong>{position.floor} 楼</strong><small>{SPOTS.find((spot) => spot.id === position.spot)?.label}</small></div>
          <button type="button" onClick={() => shiftFloor(1)} disabled={viewFloor >= FLOOR_COUNT}><ChevronUp size={16} /></button>
        </div>
        <div className="spot-picker">
          <span>所在楼层</span>
          <div className="chip-row">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((floor) => (
              <button key={floor} type="button" className={position.floor === floor ? 'active' : ''} onClick={() => onPositionChange({ floor, spot: position.spot })}>{floor}</button>
            ))}
          </div>
        </div>
        <div className="spot-picker">
          <span>所在位置</span>
          <div className="chip-row wide">
            {SPOTS.map((spot) => (
              <button key={spot.id} type="button" className={position.spot === spot.id ? 'active' : ''} onClick={() => onPositionChange({ floor: position.floor, spot: spot.id })}>{spot.label}</button>
            ))}
          </div>
        </div>
      </section>

      {route?.ok ? (
        <section className={`evac-summary ${fire ? 'tone-alert' : 'tone-calm'}`}>
          <div>
            <span>建议撤离至</span>
            <strong>{route.exitLabel}</strong>
            <small>
              {route.hasAlternative && route.alternative
                ? `备用路线：${route.alternative.exitLabel}（${Math.round(route.alternative.meters)} 米）`
                : route.fallbackExit
                  ? `${route.fallbackExit}仅作向下通道中断时的备选`
                  : '当前为唯一可行出口'}
            </small>
          </div>
          <div className="evac-figures">
            <b>{formatDistance(route.meters)}</b>
            <span>{formatDuration(route.seconds)}</span>
          </div>
        </section>
      ) : (
        <section className="evac-summary tone-blocked">
          <div><span>无法规划路线</span><strong>请原地避险</strong><small>{route?.reason}</small></div>
        </section>
      )}

      <section className="mobile-card">
        <div className="card-title">
          <div><strong>{viewFloor} 楼平面图</strong><small>绿色为推荐路线，红色为火源与烟气</small></div>
          <div className="plan-nav">
            <button type="button" onClick={() => shiftFloor(-1)} disabled={viewFloor <= 1}><ChevronDown size={15} /></button>
            <button type="button" onClick={() => shiftFloor(1)} disabled={viewFloor >= FLOOR_COUNT}><ChevronUp size={15} /></button>
          </div>
        </div>
        <FloorPlan
          floor={viewFloor}
          pathIds={route?.path || []}
          hazard={hazard}
          fire={fire}
          positionId={positionNodeId(position.floor, position.spot)}
          blockedIds={blocked}
          exitId={route?.ok ? route.exitId : null}
        />
        <div className="plan-legend">
          <span><i className="dot-route" />逃生路线</span>
          <span><i className="dot-fire" />火源</span>
          <span><i className="dot-smoke" />浓烟</span>
          <span><i className="dot-warn" />烟气边缘</span>
          <span><i className="dot-you" />当前位置</span>
        </div>
        {route?.ok && (
          <div className="route-floors">
            <span>路线经过楼层</span>
            <div className="chip-row compact">
              {floorsOnRoute.map((floor) => (
                <button
                  key={floor}
                  type="button"
                  className={viewFloor === floor ? 'active' : ''}
                  onClick={() => setViewFloor(floor)}
                >
                  {floor}F
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>楼层剖面</strong><small>途经楼层与火源层</small></div><Compass size={18} /></div>
        <div className="floor-stack">
          {Array.from({ length: FLOOR_COUNT }, (_, index) => FLOOR_COUNT - index).map((floor) => {
            const level = hazard?.get(`C${floor}`)?.level || 'clear'
            const classes = ['floor-row']
            if (floor === fireFloor) classes.push('is-fire')
            else if (level === 'smoke') classes.push('is-smoke')
            else if (floorsOnRoute.includes(floor)) classes.push('is-route')
            if (floor === viewFloor) classes.push('is-view')
            return (
              <button key={floor} type="button" className={classes.join(' ')} onClick={() => setViewFloor(floor)}>
                <span>{floor}F</span>
                <i />
                <small>{floor === fireFloor ? '火源层' : floor === 1 ? '大堂出口' : floor === FLOOR_COUNT ? '天台' : ''}</small>
              </button>
            )
          })}
        </div>
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>分步指引</strong><small>{route?.ok ? `共 ${route.steps.length} 步` : '暂无可用路线'}</small></div><Footprints size={18} /></div>
        {route?.ok ? (
          <ol className="step-list">
            {route.steps.map((step, index) => {
              const Icon = STEP_ICONS[step.icon] || MapPin
              return (
                <li key={step.key}>
                  <span className="step-index">{String(index + 1).padStart(2, '0')}</span>
                  <div><strong>{step.title}</strong><small>{step.detail}</small></div>
                  <Icon size={17} />
                </li>
              )
            })}
          </ol>
        ) : (
          <div className="empty-card"><ShieldAlert size={30} /><strong>所有常规通道受阻</strong><p>{route?.reason}</p></div>
        )}
        {route?.warnings?.length > 0 && (
          <div className="evac-warnings">
            {route.warnings.map((warning) => (
              <div key={warning}><TriangleAlert size={14} />{warning}</div>
            ))}
          </div>
        )}
      </section>

      <button className="follow-button" type="button" onClick={() => setFollow(true)}>
        <Navigation size={19} />进入跟随模式（大字指引）
      </button>

      <section className="mobile-card">
        <div className="card-title"><div><strong>通道受阻模拟</strong><small>用于演示路线自动重算</small></div><Ban size={18} /></div>
        <div className="block-grid">
          {BLOCK_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              className={blocked.includes(option.id) ? 'active' : ''}
              onClick={() => onToggleBlock(option.id)}
            >
              <Ban size={13} />{option.label}
            </button>
          ))}
        </div>
        <p className="card-hint">被封锁的节点会在平面图上标记为 ✕，路线将自动改走其他楼梯。</p>
      </section>

      {crowd && <CrowdPanel crowd={crowd} alarmActive={Boolean(fire)} history={crowdHistory} demo={crowdDemo} />}

      <section className="mobile-card">
        <div className="card-title"><div><strong>火情演练</strong><small>以当前楼层作为起火点，可蔓延出多火源</small></div><Flame size={18} /></div>
        <div className="drill-row">
          <button type="button" className="drill-start" onClick={() => onStartDrillAt(positionNodeId(position.floor, position.spot), position.floor)}>
            <Play size={15} />在 {position.floor} 楼{SPOTS.find((spot) => spot.id === position.spot)?.label}点燃起火点
          </button>
          <button type="button" className="drill-start" onClick={onSpreadFire} disabled={!fire}>
            <Flame size={15} />蔓延到上一层
          </button>
          <button type="button" className="drill-stop" onClick={onClearFire} disabled={!fire}>
            <RotateCcw size={15} />清除火源
          </button>
        </div>
        <p className="card-hint">演练会触发完整报警流程（警笛、语音、全屏警报）；点「蔓延到上一层」可造出多火源场景，用户端会同时避开两处火源。</p>
      </section>

      <section className="mobile-card">
        <div className="card-title"><div><strong>危险等级说明</strong><small>基于图扩散的烟气模型</small></div><ShieldAlert size={18} /></div>
        {Object.entries(HAZARD_META).map(([key, meta]) => (
          <div className="summary-row" key={key}><span>{meta.description}</span><b className={`hazard-tag hazard-${key}`}>{meta.label}</b></div>
        ))}
      </section>

      <a className="app-link-row" href="./user-app.html">
        <Navigation size={16} />
        <div><strong>打开用户端（极简逃生版）</strong><small>一个表盘告诉你往哪走、还有多远、走哪条楼梯</small></div>
      </a>

      {/* 页面容器带 transform 动画，会让 position: fixed 失效，因此挂到 body 上 */}
      {follow && createPortal(<FollowMode route={route} fire={fire} onClose={() => setFollow(false)} />, document.body)}
    </div>
  )
}
