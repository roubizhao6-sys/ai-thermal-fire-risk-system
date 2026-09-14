// 热感哨兵 · 用户端
// 设计参考 iOS 自带「指南针」：单屏、一个大表盘、读数在表盘正中、几乎没有卡片与按钮。
// 全部信息压缩成三件事：往哪个方向走、还有多远、走哪条楼梯。

import { useEffect, useMemo, useRef, useState } from 'react'
import { BUILDING, positionNodeId } from '../mobile/building.js'
import { planRoute } from '../mobile/evacuation.js'

const FIRE_KEY = 'thermalGuardFire'

const CARDINALS = [
  { short: 'N', label: '北' },
  { short: 'NE', label: '东北' },
  { short: 'E', label: '东' },
  { short: 'SE', label: '东南' },
  { short: 'S', label: '南' },
  { short: 'SW', label: '西南' },
  { short: 'W', label: '西' },
  { short: 'NW', label: '西北' },
]

const SPOTS = [
  { id: 'A', label: 'A 梯' },
  { id: 'C', label: '走廊' },
  { id: 'B', label: 'B 梯' },
]

// 平面图里 x 向东、y 向南，正北为 -y
function bearingBetween(from, to) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  return (Math.atan2(dx, -dy) * 180) / Math.PI
}

function normalize(deg) {
  return (deg + 360) % 360
}

function cardinalOf(deg) {
  return CARDINALS[Math.round(normalize(deg) / 45) % 8]
}

function formatDuration(seconds) {
  if (seconds < 60) return `${seconds} 秒`
  return `${Math.floor(seconds / 60)} 分 ${String(seconds % 60).padStart(2, '0')} 秒`
}

function readStored(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch {
    return fallback
  }
}

function readFire() {
  const stored = readStored(FIRE_KEY, null)
  if (!stored?.nodeId || !BUILDING.nodes[stored.nodeId]) return null
  return { ...stored, startedAt: stored.startedAt || Date.now() }
}

export default function UserApp() {
  const [position, setPosition] = useState(() => readStored('thermalGuardUserPosition', { floor: 4, spot: 'C' }))
  const [fire, setFire] = useState(() => readFire())
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [dialMode, setDialMode] = useState('north') // north = 固定指北；device = 跟随手机朝向
  const [deviceHeading, setDeviceHeading] = useState(null)
  const [hint, setHint] = useState('')
  const sheetTitleRef = useRef(null)

  useEffect(() => {
    localStorage.setItem('thermalGuardUserPosition', JSON.stringify(position))
  }, [position])

  // 与系统端联动：系统端触发报警时会把火情写进 localStorage
  useEffect(() => {
    const onStorage = (event) => {
      if (event.key !== FIRE_KEY) return
      setFire(readFire())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // 火警期间每秒重算（烟气扩散会改变路线）
  useEffect(() => {
    if (!fire) return undefined
    setNowMs(Date.now())
    const timer = setInterval(() => setNowMs(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [fire])

  // 手机朝向（可选，需要用户授权）
  useEffect(() => {
    if (dialMode !== 'device') return undefined
    const onOrientation = (event) => {
      const heading = typeof event.webkitCompassHeading === 'number'
        ? event.webkitCompassHeading
        : event.alpha != null
          ? 360 - event.alpha
          : null
      if (heading != null) setDeviceHeading(heading)
    }
    window.addEventListener('deviceorientation', onOrientation, true)
    return () => window.removeEventListener('deviceorientation', onOrientation, true)
  }, [dialMode])

  // 位置弹层：打开时把焦点交给标题，Esc 可关闭
  useEffect(() => {
    if (sheetOpen) sheetTitleRef.current?.focus()
  }, [sheetOpen])

  useEffect(() => {
    if (!sheetOpen) return undefined
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setSheetOpen(false)
      if (event.key !== 'Tab') return
      // 弹层是模态的：Tab 只在弹层内部循环，不会跑到背后的按钮上
      const sheet = sheetTitleRef.current?.closest('.position-sheet')
      if (!sheet) return
      const focusables = [...sheet.querySelectorAll('button, [href], input, [tabindex]:not([tabindex="-1"])')]
        .filter((element) => !element.hasAttribute('disabled'))
      if (!focusables.length) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const active = document.activeElement
      if (event.shiftKey && (active === first || active === sheetTitleRef.current)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (active === last || !sheet.contains(active))) {
        event.preventDefault()
        first.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [sheetOpen])

  const elapsedSec = fire ? Math.max(0, (nowMs - fire.startedAt) / 1000) : 0
  const route = useMemo(
    () => planRoute({ startId: positionNodeId(position.floor, position.spot), fire, elapsedSec }),
    [position.floor, position.spot, fire, elapsedSec],
  )

  const startNode = BUILDING.nodes[route?.startId] || BUILDING.nodes[positionNodeId(position.floor, position.spot)]
  const nextNodeId = route?.ok ? route.path[1] : null
  const nextNode = nextNodeId ? BUILDING.nodes[nextNodeId] : null
  const targetNode = nextNode || (route?.ok ? BUILDING.nodes[route.exitId] : null)

  const bearing = startNode && targetNode ? normalize(bearingBetween(startNode, targetNode)) : 0
  const cardinal = cardinalOf(bearing)
  const dialRotation = dialMode === 'device' && deviceHeading != null ? -deviceHeading : 0
  const needleRotation = bearing - dialRotation

  const nextStep = route?.ok ? route.steps.find((step) => step.icon !== 'pin') : null
  const distanceToNext = route?.ok && nextNode
    ? route.path.length > 1
      ? (BUILDING.adjacency[route.path[0]].find((edge) => edge.to === route.path[1])?.meters || 0)
      : 0
    : 0

  // 剩余楼层：以当前所在层与出口所在层的差值为准（下行取负）
  const startFloor = BUILDING.nodes[route?.startId]?.floor ?? position.floor
  const exitFloor = route?.ok ? (BUILDING.nodes[route.exitId]?.floor ?? startFloor) : startFloor
  const floorDelta = exitFloor - startFloor
  const remainingFloors = route?.ok
    ? floorDelta === 0
      ? '已在本层'
      : `${Math.abs(floorDelta)} 层 · ${floorDelta < 0 ? '下行' : '上行'}`
    : '—'

  // 给读屏软件的一句话状态：只随路线变化，不随秒数跳动，避免每秒重复播报
  const statusText = route?.ok
    ? `${fire ? '火警，请立即撤离。' : '当前无火警。'}撤离至 ${route.exitLabel}，${Math.round(route.meters)} 米，约 ${formatDuration(route.seconds)}，${floorDelta === 0 ? '已在本层' : `剩余 ${Math.abs(floorDelta)} 层，${floorDelta < 0 ? '下行' : '上行'}`}。`
    : `${fire ? '火警。' : ''}${route?.reason || '正在定位当前位置'}`
  const dialLabel = route?.ok
    ? `撤离方向表盘：目标${cardinal.label}方向，距离 ${Math.round(route.meters)} 米`
    : '撤离方向表盘：通道受阻'

  const requestCompass = async () => {
    if (dialMode === 'device') {
      setDialMode('north')
      return
    }
    try {
      if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
        const result = await DeviceOrientationEvent.requestPermission()
        if (result !== 'granted') {
          setHint('未获得方向权限，已保持固定指北')
          window.setTimeout(() => setHint(''), 2600)
          return
        }
      }
      setDialMode('device')
    } catch {
      setHint('该设备不支持方向感应，已保持固定指北')
      window.setTimeout(() => setHint(''), 2600)
    }
  }

  const toggleDrill = () => {
    if (fire) {
      localStorage.removeItem(FIRE_KEY)
      setFire(null)
      return
    }
    const startedAt = Date.now()
    localStorage.setItem(FIRE_KEY, JSON.stringify({ nodeId: `C${position.floor}`, floor: position.floor, startedAt, mode: 'drill' }))
    setFire({ nodeId: `C${position.floor}`, floor: position.floor, startedAt, mode: 'drill' })
  }

  return (
    <div className={`compass-app ${fire ? 'is-alert' : ''}`}>
      {fire && (
        <div className="alert-strip">
          <span>火警 · 立即撤离</span>
          <em>{BUILDING.nodes[fire.nodeId]?.floor ?? position.floor} 楼起火</em>
        </div>
      )}

      <p className="sr-only" role="status" aria-live={fire ? 'assertive' : 'polite'} aria-atomic="true">
        {statusText}
      </p>

      <main className="compass-stage">
        <div className="dial-wrap">
          <CompassDial rotation={dialRotation} needle={needleRotation} alert={Boolean(fire)} label={dialLabel} />

          <div className="dial-center">
            <div className="dial-caption">
              {route?.ok ? `${cardinal.label} · ${Math.round(bearing)}°` : '通道受阻'}
            </div>

            {route?.ok ? (
              <>
                <div className={`dial-distance ${fire ? 'is-alert' : ''}`}>
                  <span className="distance-value">{Math.round(route.meters)}</span>
                  <span className="distance-unit">米</span>
                </div>
                <div className="dial-time">约 {formatDuration(route.seconds)}</div>
              </>
            ) : (
              <div className="dial-distance is-blocked">
                <span className="distance-value">受阻</span>
              </div>
            )}
          </div>
        </div>

        <div className="stage-readouts" role="list">
          {route?.ok ? (
            <>
              <div className="readout" role="listitem">
                <span>{fire ? '撤离至' : '最近出口'}</span>
                <strong>{route.exitLabel}</strong>
              </div>
              <div className="readout-sep" aria-hidden="true" />
              <div className="readout" role="listitem">
                <span>剩余楼层</span>
                <strong>{remainingFloors}</strong>
              </div>
            </>
          ) : (
            <div className="readout readout-wide" role="listitem">
              <span>提示</span>
              <strong>{route?.reason || '等待定位'}</strong>
            </div>
          )}
        </div>

        <div className="stage-note">
          {fire
            ? `距起火点 ${Math.round(elapsedSec)} 秒，路线每秒重算`
            : `${position.floor} 楼${SPOTS.find((item) => item.id === position.spot)?.label} · ${route?.ok ? `${Math.round(distanceToNext)} 米后${nextStep?.icon === 'stair' ? '进楼梯' : '到下一个路口'}` : '等待定位'}`}
        </div>
      </main>

      <footer className="compass-tools">
        <button type="button" onClick={toggleDrill} aria-pressed={Boolean(fire)}>{fire ? '结束演练' : '演练'}</button>
        <button type="button" onClick={() => setSheetOpen(true)}>我的位置</button>
        <button
          type="button"
          onClick={requestCompass}
          aria-label={dialMode === 'device' ? '固定指北' : '跟随手机朝向'}
        >
          {dialMode === 'device' ? '指北' : '罗盘'}
        </button>
      </footer>

      {hint && <div className="compass-toast">{hint}</div>}

      {sheetOpen && (
        <div className="sheet-backdrop" onClick={() => setSheetOpen(false)}>
          <section
            className="position-sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="position-sheet-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="sheet-handle" />
            <h2 id="position-sheet-title" tabIndex={-1} ref={sheetTitleRef}>我的位置</h2>
            <p>实际部署时由蓝牙信标自动定位，这里用于演示手动选点。</p>
            <div className="floor-row-picker" role="group" aria-label="选择楼层">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((floor) => (
                <button
                  key={floor}
                  type="button"
                  className={position.floor === floor ? 'active' : ''}
                  aria-pressed={position.floor === floor}
                  onClick={() => setPosition((current) => ({ ...current, floor }))}
                >
                  {floor}
                </button>
              ))}
            </div>
            <div className="spot-row-picker" role="group" aria-label="选择位置">
              {SPOTS.map((spot) => (
                <button
                  key={spot.id}
                  type="button"
                  className={position.spot === spot.id ? 'active' : ''}
                  aria-pressed={position.spot === spot.id}
                  onClick={() => setPosition((current) => ({ ...current, spot: spot.id }))}
                >
                  {spot.label}
                </button>
              ))}
            </div>
            <button className="done-button" type="button" onClick={() => setSheetOpen(false)}>完成</button>
          </section>
        </div>
      )}
    </div>
  )
}

// 表盘：外圈刻度 + 四向字母，中间留给读数，指针指向应走的方向
function CompassDial({ rotation, needle, alert, label }) {
  const ticks = []
  for (let degree = 0; degree < 360; degree += 5) {
    const major = degree % 45 === 0
    const medium = degree % 15 === 0
    const inner = major ? 86 : medium ? 93 : 97
    const angle = (degree * Math.PI) / 180
    const x1 = 120 + Math.sin(angle) * inner
    const y1 = 120 - Math.cos(angle) * inner
    const x2 = 120 + Math.sin(angle) * 104
    const y2 = 120 - Math.cos(angle) * 104
    ticks.push(
      <line
        key={degree}
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        className={major ? 'tick tick-major' : medium ? 'tick tick-medium' : 'tick'}
      />,
    )
  }

  return (
    <svg className="compass-dial" viewBox="0 0 240 240" role="img" aria-label={label}>
      <g style={{ transform: `rotate(${rotation}deg)`, transformOrigin: '120px 120px', transition: 'transform .25s ease-out' }}>
        <circle cx="120" cy="120" r="104" className="dial-ring" />
        {ticks}
        {CARDINALS.filter((item) => item.short.length <= 2 && item.short !== 'NE' && item.short !== 'SE' && item.short !== 'SW' && item.short !== 'NW').map((item) => {
          const index = CARDINALS.indexOf(item)
          const angle = (index * 45 * Math.PI) / 180
          const x = 120 + Math.sin(angle) * 72
          const y = 120 - Math.cos(angle) * 72
          return (
            <text key={item.short} x={x} y={y + 5} className={`dial-letter ${item.short === 'N' ? 'is-north' : ''}`}>
              {item.short}
            </text>
          )
        })}
      </g>
      <g style={{ transform: `rotate(${needle}deg)`, transformOrigin: '120px 120px', transition: 'transform .45s cubic-bezier(.32,.72,0,1)' }}>
        <polygon
          points="120,22 130,56 110,56"
          className={alert ? 'needle needle-alert' : 'needle'}
        />
        <line x1="120" y1="56" x2="120" y2="104" className={alert ? 'needle-line needle-alert' : 'needle-line'} />
      </g>
      <circle cx="120" cy="120" r="3" className="dial-pin" />
    </svg>
  )
}
