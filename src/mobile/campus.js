// 澳门科技大学校园数据（按校方校园图重建）
//
// 来源：用户提供的《澳科大地图.JPG》(1279×1472) + 校方 720° 全景。
// 楼名与**相对位置**来自对该图的 OCR（macOS Vision，带像素坐标），布局与真实校园一致：
//   左列  行政大樓 / 教學大樓
//   中列  活動中心 / 宿舍 / 科技大樓
//   右列  田徑運動場 / 室內體育館 / 澳門國際學校 / 宿舍 / 圖書館
//   最右  教學大樓 / Dormitory / 綜合教學大樓（图中标注 R）
//   顶部  輕軌科大站、北門；中部 南門
//
// 换算：mapPx → 模型单位（0.55 倍，地图中心移到原点）。x 向东、z 向南、y 为高度。
// 楼层数由公开资料与图中标注（如"圖書館六樓"）估计，可按实测绘改。

export const CAMPUS_FLOOR_HEIGHT = 6.4

const MAP_W = 1279
const MAP_H = 1472
const SCALE = 0.55
const toModel = (px, py) => ({
  x: Number(((px - MAP_W / 2) * SCALE).toFixed(1)),
  z: Number(((py - MAP_H / 2) * SCALE).toFixed(1)),
})

const BUILDINGS = [
  { id: 'admin', name: '行政大樓', short: '行政大樓', px: 350, py: 967, w: 58, d: 46, floors: 5, style: 'office' },
  { id: 'academic-left', name: '教學大樓', short: '教學大樓', px: 350, py: 1042, w: 62, d: 52, floors: 6, style: 'glass' },
  { id: 'recreation', name: '活動中心', short: '活動中心', px: 600, py: 990, w: 66, d: 50, floors: 3, style: 'warm' },
  { id: 'science', name: '科技大樓', short: '科技大樓', px: 600, py: 1225, w: 60, d: 52, floors: 6, style: 'lab' },
  { id: 'dorm-mid', name: '宿舍（中）', short: '宿舍', px: 600, py: 1150, w: 52, d: 40, floors: 10, style: 'dorm' },
  { id: 'stadium', name: '田徑運動場', short: '田徑場', px: 900, py: 985, w: 150, d: 96, floors: 1, style: 'sport' },
  { id: 'gym', name: '室內體育館', short: '體育館', px: 900, py: 1062, w: 86, d: 60, floors: 3, style: 'sport' },
  { id: 'tis', name: '澳門國際學校', short: '國際學校', px: 900, py: 1128, w: 70, d: 52, floors: 4, style: 'clean' },
  { id: 'dorm-right', name: '宿舍（右）', short: '宿舍', px: 900, py: 1210, w: 52, d: 40, floors: 10, style: 'dorm' },
  { id: 'library', name: '圖書館', short: '圖書館', px: 900, py: 1258, w: 74, d: 54, floors: 6, style: 'warm', note: '图中标注"圖書館六樓"' },
  { id: 'academic-right', name: '教學大樓（右）', short: '教學大樓', px: 1075, py: 986, w: 58, d: 48, floors: 6, style: 'glass' },
  { id: 'dorm-far', name: 'Dormitory', short: '宿舍', px: 1075, py: 1080, w: 52, d: 40, floors: 10, style: 'dorm' },
  { id: 'complex', name: '綜合教學大樓', short: '綜合教學樓', px: 1075, py: 1259, w: 96, d: 62, floors: 9, style: 'glass', note: '含演藝廳 / 電影院 / 體育設施' },
]

export const CAMPUS_BUILDINGS = BUILDINGS.map((building) => {
  const { x, z } = toModel(building.px, building.py)
  return { ...building, x, z }
})

const LANDMARKS = [
  { id: 'north-gate', name: '北門', px: 213, py: 318, w: 46, d: 12, kind: 'gate' },
  { id: 'south-gate', name: '南門', px: 743, py: 655, w: 46, d: 12, kind: 'gate' },
  { id: 'lrt', name: '輕軌科大站', px: 747, py: 248, w: 84, d: 26, kind: 'station' },
]

export const CAMPUS_LANDMARKS = LANDMARKS.map((item) => {
  const { x, z } = toModel(item.px, item.py)
  return { ...item, x, z }
})

// 道路：按地图上的主动线（北门→南门、轻轨站→生活区、教学区横线）
export const CAMPUS_ROADS = [
  { from: [213, 318], to: [743, 655], w: 20 },
  { from: [747, 248], to: [600, 1150], w: 22 },
  { from: [350, 1042], to: [1075, 1259], w: 20 },
].map((road) => {
  const a = toModel(road.from[0], road.from[1])
  const b = toModel(road.to[0], road.to[1])
  return {
    x: (a.x + b.x) / 2,
    z: (a.z + b.z) / 2,
    w: road.w,
    d: Math.hypot(b.x - a.x, b.z - a.z),
    angle: Math.atan2(b.z - a.z, b.x - a.x),
  }
})

export const CAMPUS_BY_ID = Object.fromEntries(CAMPUS_BUILDINGS.map((item) => [item.id, item]))

// 楼盘节点（如 'C4'）→ 校园建筑 + 楼层
const SPOT_TO_BUILDING = { A: 'library', B: 'science', C: 'complex' }

export function campusLocationForNode(nodeId) {
  if (!nodeId || typeof nodeId !== 'string') return null
  const spot = nodeId[0]
  const floor = Number(nodeId.replace(/\D/g, ''))
  const buildingId = SPOT_TO_BUILDING[spot] ?? 'complex'
  const building = CAMPUS_BY_ID[buildingId]
  if (!building) return null
  const safeFloor = Math.min(Math.max(floor || 1, 1), building.floors)
  return {
    buildingId,
    building,
    floor: safeFloor,
    label: `${building.name} ${safeFloor} 樓`,
    height: (safeFloor - 0.5) * CAMPUS_FLOOR_HEIGHT,
  }
}

export const SPOT_MAPPING_NOTE = '节点映射：C 走廊 → 綜合教學大樓｜A 梯 → 圖書館｜B 梯 → 科技大樓'
