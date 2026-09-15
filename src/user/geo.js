// 用户端地理定位模块：把手机 GPS 的经纬度换算成校园平面坐标，并给出最近的安全点与方位。
//
// 坐标约定与校园模型一致：以校园中心为原点，x 向东（米），y 向南（米）。
// 中心点与投影常数取自 campus.js（OSM 建筑轮廓用的同一套投影），因此 GPS 结果
// 可以直接和教学楼、出口、集合点对齐。

export const CAMPUS_CENTER = { lat: 22.1526454, lon: 113.5680410 }
export const M_PER_DEG_LAT = 110574
export const M_PER_DEG_LON = 111320 * Math.cos((CAMPUS_CENTER.lat * Math.PI) / 180)

// 校园可识别范围（与航拍底图覆盖范围一致，单位：米）
export const CAMPUS_BOUNDS = { minX: -540, maxX: 480, minY: -340, maxY: 390 }

function toRad(value) {
  return (value * Math.PI) / 180
}

function toDeg(value) {
  return (value * 180) / Math.PI
}

export function normalizeDeg(value) {
  return ((value % 360) + 360) % 360
}

// 经纬度 → 校园平面坐标
export function latLonToLocal(lat, lon) {
  return {
    x: (lon - CAMPUS_CENTER.lon) * M_PER_DEG_LON,
    y: -(lat - CAMPUS_CENTER.lat) * M_PER_DEG_LAT,
  }
}

// 校园平面坐标 → 经纬度
export function localToLatLon(x, y) {
  return {
    lat: CAMPUS_CENTER.lat - y / M_PER_DEG_LAT,
    lon: CAMPUS_CENTER.lon + x / M_PER_DEG_LON,
  }
}

export function insideCampus(x, y) {
  return x >= CAMPUS_BOUNDS.minX && x <= CAMPUS_BOUNDS.maxX && y >= CAMPUS_BOUNDS.minY && y <= CAMPUS_BOUNDS.maxY
}

// 球面距离（米）：GPS 与集合点之间用
export function distanceMeters(a, b) {
  const earth = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)))
}

// 方位角：正北 0°，顺时针增加（与表盘、设备朝向同一套约定）
export function bearingDeg(from, to) {
  const dLon = toRad(to.lon - from.lon)
  const lat1 = toRad(from.lat)
  const lat2 = toRad(to.lat)
  const y = Math.sin(dLon) * Math.cos(lat2)
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon)
  return normalizeDeg(toDeg(Math.atan2(y, x)))
}

// 校园平面方位角（x 向东，y 向南）：与表盘 bearingBetween 完全一致的算法
export function bearingLocal(from, to) {
  return normalizeDeg(toDeg(Math.atan2(to.x - from.x, -(to.y - from.y))))
}

// 校园内的关键点：出口、集合点与标志性楼栋。
// 平面坐标取自校园模型（OSM 轮廓投影），经纬度由同一套投影反算。
const RAW_POINTS = [
  { id: 'north-gate', name: '北门', kind: 'exit', x: -230, y: -215 },
  { id: 'south-gate', name: '南门', kind: 'exit', x: 60, y: -40 },
  { id: 'lrt', name: '轻轨科大站', kind: 'exit', x: 269.1, y: -48.4 },
  { id: 'complex', name: 'R座综合教学大楼', kind: 'building', x: 133, y: -75.3 },
  { id: 'gym', name: 'J座体育馆', kind: 'building', x: 186.4, y: -4.8 },
  { id: 'library', name: '图书馆', kind: 'building', x: -107, y: 85.3 },
  { id: 'dorm-p', name: 'P座宿舍', kind: 'building', x: 215.9, y: 59.1 },
  { id: 'dorm-g', name: 'G座宿舍', kind: 'building', x: -71, y: -111 },
  { id: 'dorm-m', name: 'M座宿舍', kind: 'building', x: -70.6, y: 160.4 },
  { id: 'dorm-f', name: 'F座宿舍', kind: 'building', x: -202.9, y: -2.6 },
  { id: 'science', name: 'H座科技大楼', kind: 'building', x: 33.5, y: -207.6 },
]

export const CAMPUS_POINTS = RAW_POINTS.map((point) => ({ ...point, ...localToLatLon(point.x, point.y) }))

export const CAMPUS_EXITS = CAMPUS_POINTS.filter((point) => point.kind === 'exit')

// 最近的关键点（不含自身），返回距离与方位，供 AR 视图与状态行使用
export function nearestPoint(lat, lon, points = CAMPUS_POINTS) {
  const origin = { lat, lon }
  let best = null
  for (const point of points) {
    const meters = distanceMeters(origin, point)
    if (!best || meters < best.meters) {
      best = { point, meters, bearing: bearingDeg(origin, point) }
    }
  }
  return best
}

// 当前位置描述：校园内/外、最近出口、最近楼栋
export function describeLocation(lat, lon) {
  const { x, y } = latLonToLocal(lat, lon)
  const nearest = nearestPoint(lat, lon)
  const nearestExit = nearestPoint(lat, lon, CAMPUS_EXITS)
  return {
    x,
    y,
    inside: insideCampus(x, y),
    nearest,
    nearestExit,
  }
}

export function formatMeters(meters) {
  if (!Number.isFinite(meters)) return '—'
  return meters >= 1000 ? `${(meters / 1000).toFixed(2)} 公里` : `${Math.round(meters)} 米`
}
