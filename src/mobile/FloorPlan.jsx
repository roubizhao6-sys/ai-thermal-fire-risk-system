import { BUILDING, FLOOR_COUNT } from './building.js'

const NORTH_UNITS = [
  [6, 28],
  [30, 45],
  [55, 70],
  [72, 94],
]

// 单层平面示意图。真实部署时可替换为 RoomPlan / BIM 导出的楼层轮廓。
export default function FloorPlan({ floor, pathIds = [], hazard, fire, positionId, blockedIds = [], exitId }) {
  const segments = []
  for (let index = 1; index < pathIds.length; index += 1) {
    const from = BUILDING.nodes[pathIds[index - 1]]
    const to = BUILDING.nodes[pathIds[index]]
    if (from && to && from.floor === floor && to.floor === floor) segments.push([from, to])
  }

  const localWays = pathIds
    .map((id) => BUILDING.nodes[id])
    .filter((node) => node && node.floor === floor && node.kind !== 'exit')

  const isGround = floor === 1
  const isTop = floor === FLOOR_COUNT

  const northRects = isTop
    ? [[6, 28], [30, 70, 'roof'], [72, 94]]
    : NORTH_UNITS

  const southRects = isGround
    ? [[6, 28], [30, 70, 'lobby'], [72, 94]]
    : NORTH_UNITS

  const floorNodes = Object.values(BUILDING.nodes).filter((node) => node.floor === floor)
  const fireNode = fire && BUILDING.nodes[fire.nodeId]?.floor === floor ? BUILDING.nodes[fire.nodeId] : null
  const positionNode = positionId && BUILDING.nodes[positionId]?.floor === floor ? BUILDING.nodes[positionId] : null
  const exitNode = exitId && BUILDING.nodes[exitId]?.floor === floor ? BUILDING.nodes[exitId] : null

  return (
    <svg className="floor-plan" viewBox="0 0 100 100" role="img" aria-label={`${floor} 楼平面示意图`}>
      <defs>
        <linearGradient id={`planFloor-${floor}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0d1a2e" />
          <stop offset="100%" stopColor="#081121" />
        </linearGradient>
      </defs>

      <rect x="3" y="3" width="94" height="94" rx="2.6" fill={`url(#planFloor-${floor})`} stroke="rgba(96,165,250,.28)" strokeWidth="0.5" />

      {northRects.map(([x1, x2, kind]) => (
        <g key={`n-${x1}`}>
          <rect x={x1} y="6" width={x2 - x1} height="32" rx="1.4" className={kind === 'roof' ? 'plan-room plan-room-exit' : 'plan-room'} />
          <text className="plan-room-text" x={(x1 + x2) / 2} y={kind === 'roof' ? 24 : 23}>
            {kind === 'roof' ? '天台避难区' : '住宅单位'}
          </text>
        </g>
      ))}

      {southRects.map(([x1, x2, kind]) => (
        <g key={`s-${x1}`}>
          <rect x={x1} y="62" width={x2 - x1} height="30" rx="1.4" className={kind === 'lobby' ? 'plan-room plan-room-exit' : 'plan-room'} />
          <text className="plan-room-text" x={(x1 + x2) / 2} y={kind === 'lobby' ? 79 : 78}>
            {kind === 'lobby' ? '大堂出口' : '住宅单位'}
          </text>
        </g>
      ))}

      {!isTop && (
        <g>
          <rect x="46" y="12" width="8" height="26" rx="1.2" className="plan-lift" />
          <text className="plan-lift-text" x="50" y="26">电梯</text>
          <text className="plan-lift-text" x="50" y="31">停用</text>
        </g>
      )}

      <rect x="4" y="42" width="92" height="14" rx="1.2" className="plan-corridor" />
      <text className="plan-corridor-text" x="50" y="59.8">公共走廊</text>

      <rect x="6" y="42" width="14" height="14" rx="1.2" className="plan-stair" />
      <text className="plan-stair-text" x="13" y="48.6">A 梯</text>
      <rect x="80" y="42" width="14" height="14" rx="1.2" className="plan-stair" />
      <text className="plan-stair-text" x="87" y="48.6">B 梯</text>

      {localWays.map((node, index) => (
        <circle key={`way-${node.id}-${index}`} cx={node.x} cy={node.y} r="1.5" className="plan-waypoint" />
      ))}

      {segments.map(([from, to], index) => (
        <g key={`seg-${from.id}-${to.id}-${index}`}>
          <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="plan-route" />
          <RouteArrow from={from} to={to} index={index} />
        </g>
      ))}

      {floorNodes.map((node) => {
        const level = hazard?.get(node.id)?.level || 'clear'
        if (level === 'clear') return null
        const radius = level === 'fire' ? 8 : level === 'smoke' ? 6.5 : 4.5
        return <circle key={`hazard-${node.id}`} cx={node.x} cy={node.y} r={radius} className={`plan-hazard plan-hazard-${level}`} />
      })}

      {blockedIds
        .map((id) => BUILDING.nodes[id])
        .filter((node) => node && node.floor === floor)
        .map((node) => (
          <g key={`blocked-${node.id}`} className="plan-blocked">
            <line x1={node.x - 3} y1={node.y - 3} x2={node.x + 3} y2={node.y + 3} />
            <line x1={node.x + 3} y1={node.y - 3} x2={node.x - 3} y2={node.y + 3} />
          </g>
        ))}

      {fireNode && (
        <g className="plan-fire">
          <circle cx={fireNode.x} cy={fireNode.y} r="6.4" className="plan-fire-pulse" />
          <circle cx={fireNode.x} cy={fireNode.y} r="3.2" className="plan-fire-core" />
          <path
            className="plan-fire-icon"
            transform={`translate(${fireNode.x},${fireNode.y}) scale(0.075)`}
            d="M12 2s4.5 4.2 4.5 8.2c0 2.6-2 4.8-4.5 4.8s-4.5-2.2-4.5-4.8C7.5 6.2 12 2 12 2z"
          />
          <text className="plan-fire-text" x={fireNode.x} y={fireNode.y - 8.4}>火源</text>
        </g>
      )}

      {positionNode && (
        <g className="plan-position">
          <circle cx={positionNode.x} cy={positionNode.y} r="4" className="plan-position-ring" />
          <circle cx={positionNode.x} cy={positionNode.y} r="1.8" className="plan-position-dot" />
          <text className="plan-position-text" x={positionNode.x} y={positionNode.y + 8.4}>您在此</text>
        </g>
      )}

      {exitNode && (
        <g className="plan-exit">
          <circle cx={exitNode.x} cy={exitNode.y} r="2.6" />
          <path d={`M${exitNode.x - 1.2},${exitNode.y + 0.1} l0.9,1.1 l1.6,-2.1`} />
        </g>
      )}

      <text className="plan-floor-tag" x="8" y="40.4">{floor} 楼</text>
    </svg>
  )
}

function RouteArrow({ from, to, index }) {
  const dx = to.x - from.x
  const dy = to.y - from.y
  if (Math.hypot(dx, dy) < 1) return null
  const midX = (from.x + to.x) / 2
  const midY = (from.y + to.y) / 2
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI
  return (
    <polygon
      className="plan-arrow"
      points="0,-1.7 2.6,0 0,1.7"
      transform={`translate(${midX},${midY}) rotate(${angle})`}
      style={{ animationDelay: `${index * 0.16}s` }}
    />
  )
}
