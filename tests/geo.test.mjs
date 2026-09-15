// 用户端地理定位单测：经纬度与校园平面坐标互转、距离/方位、最近出口与校园内外判定。
// 这些数值直接决定「GPS 说你在哪、离哪个出口多远」，算错会让 AR 指错方向。

import {
  CAMPUS_CENTER,
  CAMPUS_EXITS,
  CAMPUS_POINTS,
  bearingDeg,
  bearingLocal,
  describeLocation,
  distanceMeters,
  formatMeters,
  insideCampus,
  latLonToLocal,
  localToLatLon,
  nearestPoint,
} from '../src/user/geo.js'

let failures = 0

function check(name, condition, detail = '') {
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

function close(a, b, tolerance) {
  return Math.abs(a - b) <= tolerance
}

console.log('[1] 经纬度与校园平面坐标互转')
{
  const samples = [
    [0, 0],
    [60, -40],      // 南门
    [-230, -215],   // 北门
    [269.1, -48.4], // 轻轨站
    [-400, 300],
  ]
  const roundTrips = samples.map(([x, y]) => {
    const { lat, lon } = localToLatLon(x, y)
    return latLonToLocal(lat, lon)
  })
  check('往返换算误差小于 1 米', roundTrips.every((point, index) => (
    close(point.x, samples[index][0], 1) && close(point.y, samples[index][1], 1)
  )))
  const center = latLonToLocal(CAMPUS_CENTER.lat, CAMPUS_CENTER.lon)
  check('校园中心落在原点', close(center.x, 0, 0.01) && close(center.y, 0, 0.01))
  const gate = CAMPUS_POINTS.find((point) => point.id === 'south-gate')
  check('南门经纬度由模型坐标反算', close(gate.x, 60, 0.5) && close(gate.y, -40, 0.5), `${gate.lat},${gate.lon}`)
}

console.log('[2] 距离与方位')
{
  const northGate = CAMPUS_POINTS.find((point) => point.id === 'north-gate')
  const southGate = CAMPUS_POINTS.find((point) => point.id === 'south-gate')
  const planar = Math.hypot(northGate.x - southGate.x, northGate.y - southGate.y)
  const meters = distanceMeters(southGate, northGate)
  check('球面距离与平面距离一致（误差 2% 内）', close(meters, planar, planar * 0.02), `${meters.toFixed(1)} vs ${planar.toFixed(1)}`)

  const bearing = bearingDeg(southGate, northGate)
  check('南门到北门约在西北方向（295°–310°）', bearing > 295 && bearing < 310, `${bearing.toFixed(1)}°`)

  const localBearing = bearingLocal(southGate, northGate)
  check('两套方位算法结果一致（1° 内）', close(bearing, localBearing, 1), `${bearing.toFixed(1)} vs ${localBearing.toFixed(1)}`)

  const eastBearing = bearingLocal({ x: 0, y: 0 }, { x: 100, y: 0 })
  check('正东为 90°', close(eastBearing, 90, 0.01), `${eastBearing}`)
  const northBearing = bearingLocal({ x: 0, y: 0 }, { x: 0, y: -100 })
  check('正北为 0°', close(northBearing, 0, 0.01), `${northBearing}`)
}

console.log('[3] 最近关键点与校园内外判定')
{
  const nearR = describeLocation(...Object.values(localToLatLon(140, -70)))
  check('R座附近最近点识别为 R座', nearR.nearest.point.id === 'complex', nearR.nearest.point.name)
  check('R座附近判定在校园内', nearR.inside === true)

  const nearExit = nearestPoint(...Object.values(localToLatLon(70, -30)), CAMPUS_EXITS)
  check('离南门最近时返回南门', nearExit.point.id === 'south-gate', nearExit.point.name)
  check('到南门距离在合理范围（30 米内）', nearExit.meters < 30, `${nearExit.meters.toFixed(1)}`)

  const outside = describeLocation(22.1620, 113.5820)
  check('校园外坐标判定为校园外', outside.inside === false, `x=${outside.x.toFixed(0)} y=${outside.y.toFixed(0)}`)
  check('仍然给出最近参考点', Boolean(outside.nearest?.point?.name))

  check('边界判定与范围一致', insideCampus(0, 0) && !insideCampus(600, 0))
}

console.log('[4] 展示格式')
{
  check('短距离用米', formatMeters(82.4) === '82 米')
  check('长距离用公里', formatMeters(1234) === '1.23 公里')
  check('非法值给占位符', formatMeters(Number.NaN) === '—')
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
