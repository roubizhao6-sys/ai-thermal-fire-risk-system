// 火势/烟气扩散模型 + A* 动态避障寻路 + 逃生指令生成
//
// 设计原则：
// 1. 烟气向上蔓延快于向下，因此楼梯向上跳数权重低于向下。
// 2. 火源节点不可通行（不可进入），浓烟节点重罚、烟气边缘轻罚，
//    让路径在「绕远」与「穿过危险区」之间自动取舍。
// 3. 用户当前所在节点即使已受火势影响也必须允许离开，只做提示。
// 4. 危险半径随起火时间增长，路线因此会随时间自动重算。

import { BUILDING, EXIT_LIST, STAIRS, nodeLabel } from './building.js'

const HOP_CORRIDOR = 1
const HOP_STAIR_UP = 0.7
const HOP_STAIR_DOWN = 1.1

// 危险半径（按图跳数）：
//   <= 0.5  核心火源区，禁止进入（仅允许从当前位置迈出第一步脱离）
//   <= 2.4  浓烟区，可通行但代价极高
//   <= 4.0  烟气边缘，代价较低
const FIRE_DEPTH = 0.5
const SMOKE_DEPTH = 2.4
const WARN_DEPTH = 4.0

const FIRE_PENALTY = 100
const SMOKE_PENALTY = 45
const WARN_PENALTY = 14
const WALKING_SPEED = 1.15 // 米/秒，含楼梯减速后的保守估算

export const HAZARD_META = {
  fire: { label: '火源核心', description: '高温明火，禁止进入' },
  smoke: { label: '浓烟', description: '能见度低且含毒气，尽量绕行' },
  warn: { label: '烟气边缘', description: '可能扩散，低姿快速通过' },
  clear: { label: '正常', description: '无明显烟气' },
}

// 以火源节点为起点做加权跳数扩散，再按扩散系数换算危险等级
export function computeHazard(fire, elapsedSec = 0) {
  const hazard = new Map()
  Object.keys(BUILDING.nodes).forEach((id) => hazard.set(id, { level: 'clear', depth: Infinity }))

  const originId = fire?.nodeId
  if (!originId || !BUILDING.nodes[originId]) return hazard

  const spread = 1 + Math.min(Math.max(elapsedSec, 0) / 55, 1.5)
  const depths = new Map([[originId, 0]])
  const settled = new Set()
  const total = Object.keys(BUILDING.nodes).length

  while (settled.size < total) {
    let current = null
    let best = Infinity
    depths.forEach((depth, id) => {
      if (!settled.has(id) && depth < best) {
        best = depth
        current = id
      }
    })
    if (current === null) break
    settled.add(current)

    BUILDING.adjacency[current].forEach((edge) => {
      let hop = HOP_CORRIDOR
      if (edge.kind === 'stair') {
        hop = BUILDING.nodes[edge.to].floor > BUILDING.nodes[current].floor ? HOP_STAIR_UP : HOP_STAIR_DOWN
      }
      const next = best + hop
      if (next < (depths.get(edge.to) ?? Infinity)) depths.set(edge.to, next)
    })
  }

  depths.forEach((depth, id) => {
    const effective = depth / spread
    let level = 'clear'
    if (effective <= FIRE_DEPTH) level = 'fire'
    else if (effective <= SMOKE_DEPTH) level = 'smoke'
    else if (effective <= WARN_DEPTH) level = 'warn'
    hazard.set(id, { level, depth: effective })
  })

  return hazard
}

function heuristic(fromId, toId) {
  const from = BUILDING.nodes[fromId]
  const to = BUILDING.nodes[toId]
  // 可采纳下界：垂直 12 米/层，水平 0.2 米/坐标单位
  return 12 * Math.abs(from.floor - to.floor) + 0.2 * (Math.abs(from.x - to.x) + Math.abs(from.y - to.y))
}

function aStar(startId, goalId, entry) {
  const open = new Map([[startId, heuristic(startId, goalId)]])
  const gScore = new Map([[startId, 0]])
  const cameFrom = new Map()
  const closed = new Set()

  while (open.size > 0) {
    let current = null
    let bestF = Infinity
    open.forEach((score, id) => {
      if (score < bestF) {
        bestF = score
        current = id
      }
    })
    if (current === null) break
    open.delete(current)

    if (current === goalId) {
      const path = [current]
      let cursor = current
      while (cameFrom.has(cursor)) {
        cursor = cameFrom.get(cursor)
        path.unshift(cursor)
      }
      return { path, cost: gScore.get(current) }
    }

    closed.add(current)
    BUILDING.adjacency[current].forEach((edge) => {
      const next = edge.to
      if (closed.has(next) || !entry.allowed(next)) return
      const tentative = gScore.get(current) + edge.meters + entry.penalty(next)
      if (tentative < (gScore.get(next) ?? Infinity)) {
        cameFrom.set(next, current)
        gScore.set(next, tentative)
        open.set(next, tentative + heuristic(next, goalId))
      }
    })
  }

  return null
}

// 构建「能否进入某节点」与「进入代价」两个判定函数。
// 关键规则：
//   1. 起火点本身永远不可通行，路线不会穿过明火。
//   2. 核心火源区的其他节点默认禁止进入，但若紧邻使用者当前位置则允许迈出这一步，
//      否则站在起火层的人将永远无法离开。
function buildEntryRules(startId, originId, hazard, blockedSet) {
  const startNeighbors = new Set(BUILDING.adjacency[startId].map((edge) => edge.to))
  const depthOf = (id) => hazard.get(id)?.depth ?? Infinity

  return {
    allowed(id) {
      if (blockedSet.has(id)) return false
      if (id === startId) return true
      if (id === originId) return false
      if (depthOf(id) <= FIRE_DEPTH) return startNeighbors.has(id)
      return true
    },
    penalty(id) {
      if (id === startId) return 0
      const depth = depthOf(id)
      if (depth <= FIRE_DEPTH) return FIRE_PENALTY
      if (depth <= SMOKE_DEPTH) return SMOKE_PENALTY
      if (depth <= WARN_DEPTH) return WARN_PENALTY
      return 0
    },
  }
}

const HEADING_TEXT = { east: '向东', west: '向西', north: '向北', south: '向南' }

export function buildSteps(path, hazard) {
  const steps = []
  const warnings = []
  const floors = new Set()
  const stairsUsed = new Set()

  if (!path || path.length === 0) return { steps, warnings, floors: [], stairsUsed: [] }

  path.forEach((id) => floors.add(BUILDING.nodes[id].floor))
  steps.push({
    key: 'start',
    icon: 'pin',
    title: `从${nodeLabel(path[0])}出发`,
    detail: path.length > 1 ? '先确认身后无可燃物，全程保持低姿' : '您已在安全出口位置',
  })

  let walk = null
  let stair = null

  const flushWalk = () => {
    if (!walk) return
    steps.push({
      key: `walk-${walk.startId}-${walk.endId}`,
      icon: 'walk',
      title: `沿 ${walk.floor} 楼走廊${HEADING_TEXT[walk.heading]}前行 ${Math.round(walk.meters)} 米`,
      detail: `到达${nodeLabel(walk.endId)}`,
    })
    walk = null
  }

  const flushStair = () => {
    if (!stair) return
    steps.push({
      key: `stair-${stair.stair}-${stair.startId}`,
      icon: 'stair',
      title: `经 ${STAIRS[stair.stair].short}${stair.dir === 'down' ? '向下' : '向上'} ${stair.levels} 层`,
      detail: `到达 ${stair.endFloor} 楼，切勿使用电梯`,
    })
    stair = null
  }

  for (let index = 1; index < path.length; index += 1) {
    const fromId = path[index - 1]
    const toId = path[index]
    const from = BUILDING.nodes[fromId]
    const to = BUILDING.nodes[toId]
    const edge = BUILDING.adjacency[fromId].find((item) => item.to === toId)
    const level = hazard.get(toId)?.level

    if (level === 'smoke') warnings.push(`${nodeLabel(toId)}有浓烟，请低姿并用湿毛巾捂住口鼻通过`)
    else if (level === 'warn') warnings.push(`${nodeLabel(toId)}附近有烟气扩散，注意观察前方`)

    if (to.kind === 'exit') {
      flushWalk()
      flushStair()
      steps.push({
        key: `exit-${toId}`,
        icon: 'exit',
        title: toId === 'ROOF' ? '抵达 8 楼天台避难区' : '抵达 1 楼大堂，从正门撤离',
        detail: toId === 'ROOF' ? '关闭防火门阻隔烟气，在明显位置等待消防救援' : '离开建筑后前往空旷集合点，不要返回取物',
      })
      continue
    }

    if (edge.kind === 'stair') {
      flushWalk()
      stairsUsed.add(edge.stair)
      const dir = to.floor > from.floor ? 'up' : 'down'
      if (stair && stair.stair === edge.stair && stair.dir === dir) {
        stair.levels += 1
        stair.endId = toId
        stair.endFloor = to.floor
      } else {
        flushStair()
        stair = { stair: edge.stair, dir, levels: 1, startId: fromId, endId: toId, endFloor: to.floor }
      }
      continue
    }

    flushStair()
    const dx = to.x - from.x
    const dy = to.y - from.y
    const heading = Math.abs(dx) >= Math.abs(dy) ? (dx > 0 ? 'east' : 'west') : (dy > 0 ? 'south' : 'north')
    if (walk && walk.heading === heading && walk.floor === to.floor) {
      walk.endId = toId
      walk.meters += edge.meters
    } else {
      flushWalk()
      walk = { heading, floor: to.floor, startId: fromId, endId: toId, meters: edge.meters }
    }
  }

  flushWalk()
  flushStair()

  return {
    steps,
    warnings: [...new Set(warnings)],
    floors: [...floors].sort((a, b) => a - b),
    stairsUsed: [...stairsUsed],
  }
}

function pathMeters(path) {
  let total = 0
  for (let index = 1; index < path.length; index += 1) {
    const edge = BUILDING.adjacency[path[index - 1]].find((item) => item.to === path[index])
    if (edge) total += edge.meters
  }
  return total
}

export function planRoute({ startId, fire = null, elapsedSec = 0, blocked = [] }) {
  const hazard = computeHazard(fire, elapsedSec)
  const blockedSet = new Set(blocked)
  const start = BUILDING.nodes[startId] ? startId : 'C3'
  const entry = buildEntryRules(start, fire?.nodeId, hazard, blockedSet)
  const candidates = []

  EXIT_LIST.forEach((exit) => {
    if (!entry.allowed(exit.id)) return
    const found = aStar(start, exit.id, entry)
    if (found) {
      candidates.push({
        path: found.path,
        cost: found.cost + exit.penalty,
        meters: pathMeters(found.path),
        exitId: exit.id,
        exitMeta: exit,
      })
    }
  })

  candidates.sort((a, b) => a.cost - b.cost)
  const best = candidates[0]

  if (!best) {
    return {
      ok: false,
      hazard,
      startId: start,
      blocked: [...blockedSet],
      reason: '所有常规逃生通道均已受阻，请退回房间关闭房门、封堵门缝并等待救援',
    }
  }

  const { steps, warnings, floors, stairsUsed } = buildSteps(best.path, hazard)
  const startHazard = hazard.get(start)?.level
  const notices = [...warnings]
  const fireCrossings = best.path.filter((id) => hazard.get(id)?.level === 'fire').length
  if (fireCrossings > 0) {
    notices.unshift(`路线需紧邻火源通过 ${fireCrossings} 处核心高温区：请低姿快速通过；若浓烟已无法看清路面，请退回房间关门封缝等待救援`)
  }
  if (startHazard === 'fire') notices.unshift('您所在位置正处于火源核心区，请立刻沿指引撤离，不要收整物品')
  else if (startHazard === 'smoke') notices.unshift('您所在区域已有浓烟，请保持低姿并尽快离开')

  // 只有备选出口代价接近时才作为「备用路线」提示，否则天台等避难层只是最后手段
  const runnerUp = candidates[1]
  const alternative = runnerUp && runnerUp.cost <= best.cost * 1.5
    ? { exitId: runnerUp.exitId, exitLabel: runnerUp.exitMeta.label, meters: runnerUp.meters }
    : null

  return {
    ok: true,
    hazard,
    startId: start,
    path: best.path,
    exitId: best.exitId,
    exitLabel: best.exitMeta.label,
    exitShort: best.exitMeta.short,
    meters: best.meters,
    seconds: Math.max(1, Math.round(best.meters / WALKING_SPEED)),
    steps,
    warnings: notices,
    floors,
    stairsUsed,
    fireCrossings,
    hasAlternative: Boolean(alternative),
    alternative,
    fallbackExit: best.exitId === 'L1' && candidates.some((item) => item.exitId === 'ROOF')
      ? candidates.find((item) => item.exitId === 'ROOF').exitMeta.label
      : null,
  }
}
