// 人流模型单测：优先级、通行能力、封路影响、总量守恒
import { CROWD_DEFAULTS, advanceCrowd, createCrowdState, crowdSummary } from '../src/mobile/crowd.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

const run = (state, seconds, step, options) => {
  let current = state
  for (let t = 0; t < seconds; t += step) current = advanceCrowd(current, step, options)
  return current
}
const byFloor = (state, floor) => state.floors.find((item) => item.floor === floor)

console.log('\n[1] 初始状态：各层待命、总量守恒')
{
  const state = createCrowdState()
  check('共 8 层', state.floors.length === 8)
  check('总人数 = 各层之和', state.totals.total === state.floors.reduce((sum, item) => sum + item.total, 0), `${state.totals.total}`)
  check('全部待命', state.floors.every((item) => item.state === '待命'))
  check('两条楼梯都在', Object.keys(state.stairs).join(',') === 'A,B')
}

console.log('\n[2] 未报警时不流动')
{
  const state = run(createCrowdState(), 20, 1, { alarm: false })
  check('已撤离仍为 0', state.totals.evacuated === 0, `${state.totals.evacuated}`)
  check('剩余等于总数', state.totals.remaining === state.totals.total)
}

console.log('\n[3] 报警后：起火层优先清空')
{
  const state = run(createCrowdState(), 12, 1, { fireFloor: 4, alarm: true })
  const fire = byFloor(state, 4)
  const far = byFloor(state, 8)
  check('起火层撤走的人最多', fire.evacuated > far.evacuated, `4层=${fire.evacuated} 8层=${far.evacuated}`)
  check('起火层已出现撤离状态', ['撤离中', '已清空'].includes(fire.state), fire.state)
  check('总量守恒', state.totals.evacuated + state.totals.remaining === state.totals.total, `${state.totals.evacuated}+${state.totals.remaining}`)
}

console.log('\n[4] 通行能力：人数随时间是线性下降的')
{
  const state = run(createCrowdState(), 10, 1, { fireFloor: 4, alarm: true })
  const perSec = state.totals.evacuated / 10
  check('每秒通行量≈楼梯数×单梯能力', Math.abs(perSec - CROWD_DEFAULTS.flowPerStair * 2) < 0.25, `${perSec.toFixed(2)}`)
}

console.log('\n[5] 封锁一条楼梯 → 通行能力减半、清空变慢')
{
  const open = run(createCrowdState(), 30, 1, { fireFloor: 4, alarm: true })
  const blocked = run(createCrowdState(), 30, 1, { fireFloor: 4, alarm: true, blockedStairs: ['A'] })
  check('封路后撤离人数更少', blocked.totals.evacuated < open.totals.evacuated, `${blocked.totals.evacuated} < ${open.totals.evacuated}`)
  check('被封楼梯流量为 0', blocked.stairs.A.flow === 0, `${blocked.stairs.A.flow}`)
  check('另一条楼梯仍在走', blocked.stairs.B.flow > 0, `${blocked.stairs.B.flow}`)
}

console.log('\n[6] 拥堵判定：人数多时会标记拥堵')
{
  const heavy = createCrowdState({ perFloor: [60, 60, 60, 60, 60, 60, 60, 60] })
  const state = run(heavy, 5, 1, { fireFloor: 4, alarm: true })
  const summary = crowdSummary(state)
  check('检出拥堵楼梯', summary.congestedStairs.length > 0, JSON.stringify(summary))
}

console.log('\n[7] 足够时间后全部清空，并记录清空时刻')
{
  const state = run(createCrowdState({ perFloor: [4, 4, 4, 4, 4, 4, 4, 4] }), 60, 1, { fireFloor: 2, alarm: true })
  check('剩余为 0', state.totals.remaining === 0, `${state.totals.remaining}`)
  check('记录了清空时刻', state.clearedAtSec !== null, `${state.clearedAtSec}`)
  check('全部楼层已清空', state.floors.every((item) => item.state === '已清空'))
}

console.log('\n[8] 两条楼梯同时封锁 → 无法疏散（剩余不变）')
{
  const state = run(createCrowdState(), 20, 1, { fireFloor: 4, alarm: true, blockedStairs: ['A', 'B'] })
  check('没有人被撤离', state.totals.evacuated === 0, `${state.totals.evacuated}`)
  check('剩余等于总数', state.totals.remaining === state.totals.total)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
