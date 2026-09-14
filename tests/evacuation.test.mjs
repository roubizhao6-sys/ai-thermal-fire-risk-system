import { planRoute, computeHazard } from '../src/mobile/evacuation.js'
import { BUILDING, nodeLabel } from '../src/mobile/building.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) {
    console.log(`  PASS  ${name}`)
  } else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

const routeText = (route) => (route.path || []).map((id) => nodeLabel(id)).join(' → ')

console.log('\n[1] 无火情：从 4 楼走廊到正门')
{
  const route = planRoute({ startId: 'C4' })
  check('规划成功', route.ok)
  check('目标为 1 楼正门', route.exitId === 'L1', route.exitId)
  check('距离合理 (30-90m)', route.meters > 30 && route.meters < 90, `${route.meters}m`)
  check('步骤数 >= 4', route.steps.length >= 4, `${route.steps.length}`)
  console.log(`        ${routeText(route)}  |  ${Math.round(route.meters)}m / ${route.seconds}s`)
}

console.log('\n[2] 4 楼 A 楼梯口起火，用户在 4 楼走廊')
{
  const fire = { nodeId: 'A4', floor: 4, startedAt: Date.now(), mode: 'drill' }
  const route = planRoute({ startId: 'C4', fire, elapsedSec: 0 })
  check('规划成功', route.ok)
  check('火源节点被判定为 fire', computeHazard(fire, 0).get('A4').level === 'fire')
  check('路线避开 A 楼梯', !route.path.includes('A4'), routeText(route))
  check('改用 B 楼梯', route.path.includes('B4'), routeText(route))
  console.log(`        ${routeText(route)}  |  ${Math.round(route.meters)}m`)
}

console.log('\n[3] 3 楼走廊起火，用户在 8 楼（向上扩散快于向下）')
{
  const fire = { nodeId: 'C3', floor: 3, startedAt: Date.now(), mode: 'drill' }
  const hazard = computeHazard(fire, 0)
  check('3 楼走廊为火源', hazard.get('C3').level === 'fire')
  check('4 楼走廊比 2 楼更早受烟气影响', hazard.get('C4').depth < hazard.get('C2').depth, `${hazard.get('C4').depth} vs ${hazard.get('C2').depth}`)
  const route = planRoute({ startId: 'C8', fire, elapsedSec: 0 })
  check('8 楼仍可向下撤离', route.ok && route.exitId === 'L1', JSON.stringify({ ok: route.ok, exit: route.exitId }))
  console.log(`        ${routeText(route)}`)
}

console.log('\n[4] 危险半径随时间增长')
{
  const fire = { nodeId: 'C4', floor: 4, startedAt: Date.now(), mode: 'drill' }
  const early = computeHazard(fire, 0)
  const late = computeHazard(fire, 120)
  const count = (hazard, level) => [...hazard.values()].filter((item) => item.level === level).length
  check('烟气随时间扩散到更多节点', count(late, 'smoke') > count(early, 'smoke'), `${count(early, 'smoke')} → ${count(late, 'smoke')}`)
}

console.log('\n[5] 动态避障：封锁受损楼梯后改走另一侧')
{
  const fire = { nodeId: 'A4', floor: 4, startedAt: Date.now(), mode: 'drill' }
  const route = planRoute({ startId: 'C4', fire, elapsedSec: 0, blocked: ['A1', 'A2', 'A3'] })
  check('避开起火且被封的 A 楼梯', !route.path.some((id) => id.startsWith('A')), routeText(route))
  check('改走 B 楼梯', route.path.includes('B4'), routeText(route))
  console.log(`        A 梯封锁 -> ${routeText(route)}`)

  const deadEnd = planRoute({ startId: 'C4', fire, elapsedSec: 0, blocked: ['B1', 'B2', 'B3', 'B4'] })
  check('两条楼梯都无法通行时明确报告无路', deadEnd.ok === false, routeText(deadEnd))
  check('失败结果不返回穿越火源的路线', !deadEnd.path, 'path=' + JSON.stringify(deadEnd.path))
  console.log(`        A/B 梯全封 -> ${deadEnd.reason}`)
}

console.log('\n[6] 向下通道全断：改走天台避难区')
{
  const fire = { nodeId: 'C2', floor: 2, startedAt: Date.now(), mode: 'drill' }
  const blocked = ['A1', 'A2', 'A3', 'A4', 'A5', 'B1', 'B2', 'B3', 'B4', 'B5']
  const route = planRoute({ startId: 'C6', fire, elapsedSec: 0, blocked })
  check('规划成功', route.ok, JSON.stringify(route.reason || ''))
  check('改走天台避难区', route.exitId === 'ROOF', route.exitId)
  console.log(`        ${routeText(route)}`)
}

console.log('\n[7] 用户就在火源点：仍必须给出撤离路线')
{
  const fire = { nodeId: 'C4', floor: 4, startedAt: Date.now(), mode: 'drill' }
  const route = planRoute({ startId: 'C4', fire, elapsedSec: 0 })
  check('规划成功', route.ok, JSON.stringify(route.reason || ''))
  check('给出火势警告', route.warnings.some((text) => text.includes('火势') || text.includes('浓烟')), JSON.stringify(route.warnings))
  console.log(`        ${routeText(route)}`)
}

console.log('\n[8] 所有出口都受阻：返回避险提示')
{
  const fire = { nodeId: 'C2', floor: 2, startedAt: Date.now(), mode: 'drill' }
  const route = planRoute({ startId: 'C1', fire, elapsedSec: 300, blocked: ['L1', 'ROOF'] })
  check('明确返回失败而不是空路线', route.ok === false && Boolean(route.reason), JSON.stringify(route))
  console.log(`        ${route.reason}`)
}

console.log('\n[9] 步骤文本与图形一致性')
{
  const route = planRoute({ startId: 'C6', fire: null })
  const flat = route.steps.map((step) => step.title).join(' | ')
  check('包含起始步骤', route.steps[0].title.includes('出发'), route.steps[0].title)
  check('包含楼梯下行描述', /向下 \d+ 层/.test(flat), flat)
  check('包含抵达出口描述', flat.includes('正门撤离'), flat)
  check('节点数量一致', route.path.length === new Set(route.path).size)
  check('所有路径节点存在', route.path.every((id) => BUILDING.nodes[id]))
  console.log(`        ${flat}`)
}

console.log('\n[10] 回归：随烟气扩散，站在起火层的人必须始终有路可走')
{
  const fire = { nodeId: 'C4', floor: 4, startedAt: Date.now(), mode: 'live' }
  const times = [0, 10, 30, 60, 120, 300, 900]
  const stranded = times.filter((elapsedSec) => !planRoute({ startId: 'C4', fire, elapsedSec }).ok)
  check('任何时刻都能从起火层撤离', stranded.length === 0, stranded.length ? `${stranded.join('/')} 秒时无路可走` : '')
  const routes = times.map((elapsedSec) => planRoute({ startId: 'C4', fire, elapsedSec }))
  check('始终优先向下撤离', routes.every((route) => route.exitId === 'L1'), routes.map((route) => route.exitId).join(','))
  console.log(`        ${times.map((t, i) => `${t}s:${routes[i].exitId}`).join(' ')}`)
}

console.log('\n[11] 烟气扩散后，起火层上方住户应改走天台')
{
  const fire = { nodeId: 'C4', floor: 4, startedAt: Date.now(), mode: 'live' }
  const early = planRoute({ startId: 'C6', fire, elapsedSec: 0 })
  const late = planRoute({ startId: 'C6', fire, elapsedSec: 300 })
  check('初期仍可向下撤离', early.ok && early.exitId === 'L1', `${early.exitId}`)
  check('后期起火层不可穿越，改走天台', late.ok && late.exitId === 'ROOF', `${late.exitId}`)
  console.log(`        0s -> ${early.exitId} ｜ 300s -> ${late.exitId}`)
}

console.log('\n[12] 多火源：危险场取最危险者，路线同时避开两处')
{
  const single = computeHazard({ nodeId: 'C4' })
  const multi = computeHazard([{ nodeId: 'C4' }, { nodeId: 'B6' }])
  const severity = { clear: 0, warn: 1, smoke: 2, fire: 3 }
  check('4 楼起火时 6 楼不是核心区', single.get('C6').level !== 'fire', single.get('C6').level)
  check('第二处火源自身在核心区', multi.get('B6').level === 'fire', multi.get('B6').level)
  check('6 楼走廊危险度随之升高', severity[multi.get('C6').level] > severity[single.get('C6').level], `${single.get('C6').level} -> ${multi.get('C6').level}`)
  check('原火源仍在核心区', multi.get('C4').level === 'fire', multi.get('C4').level)
  check('危险深度取两者更危险的一个', multi.get('C5').depth <= single.get('C5').depth, `${multi.get('C5').depth} <= ${single.get('C5').depth}`)

  const route = planRoute({ startId: 'C5', fire: [{ nodeId: 'C4' }, { nodeId: 'C6' }] })
  check('五楼用户仍能撤离', route.ok, route.reason || '')
  check('识别到 2 处火源', route.originCount === 2, `${route.originCount}`)
  check('路径不含 4 楼火源节点', !route.path.includes('C4'), route.path.join('→'))
  check('路径不含 6 楼火源节点', !route.path.includes('C6'), route.path.join('→'))
  check('提示里说明了多火源', route.warnings.some((text) => text.includes('2 处火源')), route.warnings.join(' | '))
  console.log(`        用户 5 楼走廊 → ${route.exitLabel}｜${route.path.map((id) => nodeLabel(id)).join(' → ')}`)
}

console.log('\n[13] 兼容性：单个火源与「单元素数组」结果一致，且支持各自的起火时间')
{
  const before = computeHazard({ nodeId: 'A4' }, 120)
  const wrapped = computeHazard([{ nodeId: 'A4' }], 120)
  const sameDepths = [...before.keys()].every((id) => before.get(id).depth === wrapped.get(id).depth)
  check('危险场完全一致', sameDepths)

  const routeBefore = planRoute({ startId: 'C7', fire: { nodeId: 'A4' }, elapsedSec: 120 })
  const routeWrapped = planRoute({ startId: 'C7', fire: [{ nodeId: 'A4' }], elapsedSec: 120 })
  check('路线完全一致', routeBefore.path.join('→') === routeWrapped.path.join('→'), `${routeBefore.path.join('→')} vs ${routeWrapped.path.join('→')}`)

  const staggered = computeHazard([{ nodeId: 'A4', elapsedSec: 0 }, { nodeId: 'B6', elapsedSec: 900 }])
  const fresh = computeHazard([{ nodeId: 'A4', elapsedSec: 0 }, { nodeId: 'B6', elapsedSec: 0 }])
  check('后起火的火源按自己的时间扩散', staggered.get('C6').depth <= fresh.get('C6').depth, `${staggered.get('C6').depth} <= ${fresh.get('C6').depth}`)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
