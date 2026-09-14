// 楼宇拓扑模型（8 层高密度旧式住宅示意结构）
// 每层：A 楼梯口（西）— 走廊中段 — B 楼梯口（东）
// 垂直：A / B 两条楼梯贯通 1–8 楼
// 出口：1 楼大堂正门、8 楼天台避难区
//
// 坐标使用 0–100 的归一化平面坐标，x 向右为东，y 向下为南。
// 距离单位统一为米，便于直接换算步行时间。

export const FLOOR_COUNT = 8

export const STAIRS = {
  A: { id: 'A', short: 'A 楼梯', label: 'A 楼梯（西侧）' },
  B: { id: 'B', short: 'B 楼梯', label: 'B 楼梯（东侧）' },
}

export const EXIT_LIST = [
  { id: 'L1', label: '1 楼大堂正门', short: '正门', penalty: 0 },
  // 消防原则是优先向下撤离至地面，天台只作为向下通道不可通行（或代价极高）时的备选，
  // 因此给天台附加一个很高的代价（约等于连穿 7 段浓烟的惩罚）。
  { id: 'ROOF', label: '8 楼天台避难区', short: '天台', penalty: 400 },
]

export const LAYOUT = { west: 10, mid: 50, east: 90, corridor: 48, lobby: 74, roof: 22 }

function buildGraph() {
  const nodes = {}
  const edges = []

  const link = (a, b, meters, kind, extra = {}) => {
    edges.push({ a, b, meters, kind, ...extra })
  }

  for (let floor = 1; floor <= FLOOR_COUNT; floor += 1) {
    nodes[`A${floor}`] = { id: `A${floor}`, floor, x: LAYOUT.west, y: LAYOUT.corridor, kind: 'stair', stair: 'A' }
    nodes[`C${floor}`] = { id: `C${floor}`, floor, x: LAYOUT.mid, y: LAYOUT.corridor, kind: 'corridor' }
    nodes[`B${floor}`] = { id: `B${floor}`, floor, x: LAYOUT.east, y: LAYOUT.corridor, kind: 'stair', stair: 'B' }

    link(`A${floor}`, `C${floor}`, 16, 'corridor')
    link(`C${floor}`, `B${floor}`, 16, 'corridor')

    if (floor < FLOOR_COUNT) {
      link(`A${floor}`, `A${floor + 1}`, 12, 'stair', { stair: 'A' })
      link(`B${floor}`, `B${floor + 1}`, 12, 'stair', { stair: 'B' })
    }
  }

  nodes.L1 = { id: 'L1', floor: 1, x: LAYOUT.mid, y: LAYOUT.lobby, kind: 'exit', exitId: 'L1' }
  link('C1', 'L1', 8, 'corridor', { exitId: 'L1' })

  nodes.ROOF = { id: 'ROOF', floor: FLOOR_COUNT, x: LAYOUT.mid, y: LAYOUT.roof, kind: 'exit', exitId: 'ROOF' }
  link(`C${FLOOR_COUNT}`, 'ROOF', 10, 'corridor', { exitId: 'ROOF' })

  const adjacency = {}
  Object.keys(nodes).forEach((id) => { adjacency[id] = [] })
  edges.forEach((edge) => {
    adjacency[edge.a].push({ ...edge, to: edge.b })
    adjacency[edge.b].push({ ...edge, to: edge.a })
  })

  return { nodes, edges, adjacency }
}

export const BUILDING = buildGraph()

export function nodeById(id) {
  return BUILDING.nodes[id]
}

export function floorNodeIds(floor) {
  return [`A${floor}`, `C${floor}`, `B${floor}`]
}

export function nodeLabel(id) {
  const node = BUILDING.nodes[id]
  if (!node) return id
  if (id === 'L1') return '1 楼大堂正门'
  if (id === 'ROOF') return '8 楼天台避难区'
  const spot = node.kind === 'stair' ? `${node.stair} 楼梯口` : '走廊中段'
  return `${node.floor} 楼${spot}`
}

export function nodeShortLabel(id) {
  const node = BUILDING.nodes[id]
  if (!node) return id
  if (id === 'L1') return '正门'
  if (id === 'ROOF') return '天台'
  return node.kind === 'stair' ? `${node.stair} 梯` : '走廊'
}

export function positionNodeId(floor, spot) {
  return `${spot}${floor}`
}
