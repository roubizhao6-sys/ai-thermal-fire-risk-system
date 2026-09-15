// 人流模型（用于实时监看火灾撤离时每层人流变化）
//
// 设计：
//   · 每层有初始人数；未报警时保持"待命"，不流动；
//   · 报警后按**优先级**疏散：起火层最先，其次按与起火层的距离（同距离时楼上先走，因为烟气上行）；
//   · 楼梯有通行能力上限（每人每秒），能力不足的部分形成**排队**，用于提示拥堵；
//   · 封锁某条楼梯即刻降低总通行能力，剩余楼层清空时间随之变长 —— 与寻路模型里的封路一致。
//
// 输出每层 remaining / evacuated / state / eta，以及每条楼梯的 flow / queue、全局 totals。
// 纯函数 + 不可变更新，便于单测与在 1 秒心跳里调用。

export const DEFAULT_PER_FLOOR = [10, 12, 14, 16, 16, 14, 12, 10]

export const CROWD_DEFAULTS = {
  flowPerStair: 1.4, // 每条楼梯每秒通过人数
  congestionQueue: 12, // 排队超过该人数即视为拥堵
  stairIds: ['A', 'B'],
}

export function createCrowdState({ perFloor = DEFAULT_PER_FLOOR, stairIds = CROWD_DEFAULTS.stairIds } = {}) {
  const floors = perFloor.map((total, index) => ({
    floor: index + 1,
    total,
    remaining: total,
    evacuated: 0,
    state: '待命',
    etaSec: null,
  }))
  const stairs = {}
  stairIds.forEach((id) => { stairs[id] = { id, flow: 0, queue: 0, congested: false, moved: 0 } })
  const total = floors.reduce((sum, item) => sum + item.total, 0)
  return {
    t: 0,
    alarm: false,
    fireFloor: null,
    blockedStairs: [],
    floors,
    stairs,
    totals: { total, evacuated: 0, remaining: total },
    clearedAtSec: null,
  }
}

// 疏散优先级：起火层 → 距离近的 → 同距离时上层优先
function priorityOrder(floors, fireFloor) {
  return [...floors]
    .sort((a, b) => {
      const da = Math.abs(a.floor - fireFloor)
      const db = Math.abs(b.floor - fireFloor)
      if (da !== db) return da - db
      return b.floor - a.floor
    })
    .map((item) => item.floor)
}

export function advanceCrowd(state, dtSec, options = {}) {
  const config = { ...CROWD_DEFAULTS, ...options }
  const fireFloor = config.fireFloor ?? state.fireFloor
  const blocked = config.blockedStairs ?? state.blockedStairs ?? []
  const alarm = config.alarm ?? state.alarm ?? (fireFloor != null)
  const dt = Math.max(0, dtSec)

  const stairs = {}
  Object.values(state.stairs).forEach((stair) => {
    const open = !blocked.includes(stair.id)
    stairs[stair.id] = { ...stair, flow: open ? 0 : 0, queue: 0, congested: false }
  })

  const floors = state.floors.map((item) => ({ ...item }))
  if (!alarm || dt === 0) {
    return { ...state, alarm, fireFloor, blockedStairs: blocked, stairs, floors }
  }

  const openStairs = Object.values(stairs).filter((stair) => !blocked.includes(stair.id))
  const capacity = openStairs.length * config.flowPerStair * dt

  // 需求：按优先级把各楼层待疏散人数排成队列
  let demand = 0
  const plan = priorityOrder(floors, fireFloor).map((floorNo) => {
    const item = floors.find((entry) => entry.floor === floorNo)
    demand += item.remaining
    return item
  })

  let budget = capacity
  plan.forEach((item) => {
    if (budget <= 0 || item.remaining <= 0) {
      item.state = item.remaining > 0 ? '等待撤离' : '已清空'
      return
    }
    const moved = Math.min(item.remaining, budget)
    budget -= moved
    item.remaining -= moved
    item.evacuated += moved
    item.state = item.remaining > 0 ? '撤离中' : '已清空'
  })

  const movedTotal = capacity - budget
  const perStair = openStairs.length ? movedTotal / openStairs.length : 0
  openStairs.forEach((stair) => {
    const queue = Math.max(0, demand - capacity) / openStairs.length
    stairs[stair.id] = {
      ...stair,
      flow: Number(perStair.toFixed(2)),
      queue: Number(queue.toFixed(1)),
      congested: queue > config.congestionQueue,
      moved: stair.moved + perStair,
    }
  })
  blocked.forEach((id) => {
    if (stairs[id]) stairs[id] = { ...stairs[id], flow: 0, queue: 0, congested: false }
  })

  const totalServedPerSec = openStairs.length * config.flowPerStair
  floors.forEach((item) => {
    item.etaSec = item.remaining > 0 && totalServedPerSec > 0
      ? Math.round(demand > 0 ? (demand / totalServedPerSec) : (item.remaining / totalServedPerSec))
      : item.remaining > 0 ? null : 0
  })

  const evacuated = floors.reduce((sum, item) => sum + item.evacuated, 0)
  const remaining = floors.reduce((sum, item) => sum + item.remaining, 0)
  const nextT = state.t + dt
  const allCleared = remaining === 0

  return {
    ...state,
    t: Number(nextT.toFixed(2)),
    alarm,
    fireFloor,
    blockedStairs: blocked,
    floors,
    stairs,
    totals: { total: state.totals.total, evacuated: Math.round(evacuated), remaining: Math.round(remaining) },
    clearedAtSec: allCleared ? (state.clearedAtSec ?? Number(nextT.toFixed(1))) : state.clearedAtSec,
  }
}

// 给界面用的一句话结论
export function crowdSummary(state) {
  const congestion = Object.values(state.stairs).filter((stair) => stair.congested).map((stair) => stair.id)
  return {
    evacuated: state.totals.evacuated,
    remaining: state.totals.remaining,
    congestedStairs: congestion,
    clearedInSec: state.clearedAtSec,
    busiestFloor: [...state.floors].sort((a, b) => b.remaining - a.remaining)[0]?.floor ?? null,
  }
}
