// 多因素火灾判定单测：真火要报、短促热点不报、单节点也要能报
import { DEFAULT_DETECTION, evaluateDetection } from '../src/mobile/detection.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`  PASS  ${name}`)
  else {
    failures += 1
    console.log(`  FAIL  ${name}${detail ? ` -> ${detail}` : ''}`)
  }
}

// 造一段历史：sampleSec 秒一个采样点，curve(t 秒) 给该时刻温度
const build = (durationSec, sampleSec, curves) => {
  const history = []
  for (let t = 0; t <= durationSec; t += sampleSec) {
    history.push({ at: t * 1000, readings: curves.map((curve) => curve(t)) })
  }
  return history
}
const ramp = (nodeId, from, to, riseSec, holdTemp) => (t) => ({
  nodeId,
  temp: t <= riseSec ? from + (to - from) * (t / riseSec) : (holdTemp ?? to),
})

console.log('\n[1] 真火（两个节点同时快速升温并持续）→ 报警')
{
  const history = build(120, 5, [ramp('C4', 30, 88, 25), ramp('A4', 30, 80, 25)])
  const result = evaluateDetection(history)
  check('判定为报警', result.decision === 'alarm', `${result.decision} ${JSON.stringify(result.metrics)}`)
  check('理由里有多节点投票', result.reasons.some((text) => text.includes('投票')), result.reasons.join(' | '))
}

console.log('\n[2] 热风枪：短促高温（最高 90°C 但只维持十几秒）→ 不报警')
{
  const spike = (t) => ({ nodeId: 'C4', temp: t <= 15 ? 30 + (90 - 30) * (t / 15) : Math.max(38, 90 - (t - 15) * 5) })
  const history = build(60, 5, [spike])
  const result = evaluateDetection(history)
  check('没有报警', result.decision !== 'alarm', `${result.decision} ${JSON.stringify(result.metrics)}`)
  check('给出了不报警的理由', result.reasons.some((text) => text.includes('持续') || text.includes('短促')), result.reasons.join(' | '))
}

console.log('\n[3] 单节点长时间高温（升温不快但一直热着）→ 仍要报警')
{
  const history = build(200, 5, [ramp('C7', 30, 72, 120)])
  const result = evaluateDetection(history)
  check('判定为报警', result.decision === 'alarm', `${result.decision} ${JSON.stringify(result.metrics)}`)
  check('提示单节点部署的退化策略', result.reasons.some((text) => text.includes('只有 1 个节点')), result.reasons.join(' | '))
}

console.log('\n[4] 人员经过 / 正常波动（中温抖动，从不超过高温阈值）→ 不报警')
{
  const noisy = (t) => ({ nodeId: 'C4', temp: 44 + 6 * Math.sin(t / 4) })
  const history = build(120, 5, [noisy])
  const result = evaluateDetection(history)
  check('没有报警', result.decision !== 'alarm', `${result.decision}`)
  check('最高温低于高温阈值', result.metrics.maxTemp < DEFAULT_DETECTION.high, `${result.metrics.maxTemp}`)
}

console.log('\n[5] 传感器漂移：缓慢升温到阈值以上 → 先观察，长时间后才兜底报警')
{
  // 30→68°C 用 900 秒（约 2.5°C/分钟，属于缓慢漂移而非快速升温）
  const drift = build(1100, 5, [ramp('B5', 30, 68, 900)])
  const early = evaluateDetection(drift.slice(0, 161)) // t=800s，刚过阈值不久
  check('刚过阈值时只是观察', early.decision === 'watch', `${early.decision} ${JSON.stringify(early.metrics)}`)
  const late = evaluateDetection(drift)
  check('长时间保持高温后兜底报警', late.decision === 'alarm', `${late.decision} ${JSON.stringify(late.metrics)}`)
}

console.log('\n[6] 多节点但都没到高温阈值 → 不报警')
{
  const history = build(120, 5, [ramp('C4', 30, 60, 40), ramp('A4', 30, 58, 40)])
  const result = evaluateDetection(history)
  check('没有报警', result.decision !== 'alarm', `${result.decision} ${JSON.stringify(result.metrics)}`)
  check('但进入观察', result.decision === 'watch', result.decision)
}

console.log('\n[7] 时间窗起作用：两个节点先后升温、相隔超过窗口 → 不能凑成投票')
{
  const first = (t) => ({ nodeId: 'C4', temp: t < 20 ? 30 + 30 * (t / 20) : 40 })
  const second = (t) => ({ nodeId: 'A4', temp: t < 40 ? 30 : 30 + 35 * Math.min(1, (t - 40) / 10) })
  const history = build(60, 5, [first, second])
  const result = evaluateDetection(history)
  check('没有凑成报警', result.decision !== 'alarm', `${result.decision} ${JSON.stringify(result.metrics)}`)
  check('窗口内投票数不足 2', result.metrics.votes < DEFAULT_DETECTION.voteCount, `${result.metrics.votes}`)
}

console.log('\n[8] 温升速率指标本身')
{
  // 注意：温升速率看的是"最近一个时间窗"，所以要在升温过程中评估
  const rising = evaluateDetection(build(60, 5, [ramp('C4', 30, 70, 20)]).slice(0, 6))
  check('升温过程中速率被算出', rising.metrics.ror > 0, `${rising.metrics.ror}`)
  const flat = evaluateDetection(build(60, 5, [ramp('C4', 30, 31, 50)]).slice(0, 6))
  check('缓慢升温的速率更低', flat.metrics.ror < rising.metrics.ror, `${flat.metrics.ror} < ${rising.metrics.ror}`)
  const steady = evaluateDetection(build(60, 5, [ramp('C4', 30, 70, 20)]))
  check('升到高温后趋于平稳，速率回落为 0', steady.metrics.ror === 0, `${steady.metrics.ror}`)
}

console.log('\n[9] 空数据与非法数据')
{
  check('空历史返回 idle', evaluateDetection([]).decision === 'idle')
  const dirty = evaluateDetection([{ at: 0, readings: [{ nodeId: '', temp: 99 }, { nodeId: 'C4', temp: 'hot' }] }])
  check('非法读数不会误报', dirty.decision === 'idle', `${dirty.decision}`)
}

console.log(`\n结果：${failures === 0 ? '全部通过' : `${failures} 项失败`}`)
process.exit(failures === 0 ? 0 : 1)
