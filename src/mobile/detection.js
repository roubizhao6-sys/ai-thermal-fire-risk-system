// 多因素火灾判定（创新点 2：误报抑制）
//
// 只盯绝对阈值会带来大量误报：热风枪、焊接火花、阳光反射、暖气出风口、人群聚集
// 都能把一个传感器顶到 65°C 以上。这里用三件事联合判定，并且每一步都能解释：
//
//   1. 绝对阈值（兜底）：高温本身就是危险信号；
//   2. 温升速率 Rate-of-Rise：真实燃烧通常伴随快速升温，热风枪虽然升得快但**退得也快**；
//   3. 多节点投票 + 时间窗：同一时间窗内多个节点同时升温，才算"区域火情"；
//   4. 长时间高温兜底：同一节点持续高温超过 3 倍确认时间，即使升温慢也报警
//      （避免"只有一个传感器就永远不报警"的坑）。
//
// 纯函数，输入一段历史采样，输出结论 + 理由 + 指标，便于单测与出代价曲线。

export const DEFAULT_DETECTION = {
  high: 65,
  medium: 45,
  rorPerMin: 6, // 每分钟升温多少度算"快速升温"
  windowSec: 30, // 投票/温升统计时间窗
  sustainedSec: 20, // 超阈值需要持续多久才算确认（短促热点会被挡掉）
  voteCount: 2, // 多节点投票门槛
  voteTemp: 50, // 参与投票的最低温度
}

const tempOf = (reading) => Number(reading?.temp)

function normalizeHistory(history) {
  if (!Array.isArray(history)) return []
  return history
    .map((sample, index) => ({
      at: Number(sample?.at) || index,
      readings: (Array.isArray(sample?.readings) ? sample.readings : [])
        .map((reading) => ({
          nodeId: reading?.nodeId || (reading?.floor ? `C${reading.floor}` : null),
          temp: tempOf(reading),
        }))
        .filter((reading) => reading.nodeId && Number.isFinite(reading.temp)),
    }))
    .filter((sample) => sample.readings.length)
    .sort((a, b) => a.at - b.at)
}

// 某节点"持续超过阈值"的时长（秒）：从最后一次采样往回数连续超阈值的采样
function sustainedSeconds(samples, nodeId, high) {
  let start = null
  for (let index = samples.length - 1; index >= 0; index -= 1) {
    const reading = samples[index].readings.find((item) => item.nodeId === nodeId)
    if (!reading || reading.temp < high) break
    start = samples[index].at
  }
  if (start === null) return 0
  return Math.max(0, (samples[samples.length - 1].at - start) / 1000)
}

export function evaluateDetection(history, options = {}) {
  const config = { ...DEFAULT_DETECTION, ...options }
  const samples = normalizeHistory(history)
  if (!samples.length) {
    return { decision: 'idle', reasons: ['无采样数据'], metrics: { maxTemp: null, ror: 0, votes: 0, sustainedSec: 0, multiNode: false } }
  }

  const now = samples[samples.length - 1].at
  const windowStart = now - config.windowSec * 1000
  const window = samples.filter((sample) => sample.at >= windowStart)
  const latest = samples[samples.length - 1]

  const allNodes = new Set()
  samples.forEach((sample) => sample.readings.forEach((reading) => allNodes.add(reading.nodeId)))
  const multiNode = allNodes.size > 1

  const maxReading = latest.readings.reduce((best, reading) => (reading.temp > (best?.temp ?? -Infinity) ? reading : best), null)
  const maxTemp = maxReading?.temp ?? null
  const maxNodeId = maxReading?.nodeId ?? null

  // 温升速率：时间窗内最高温与最低温之差 / 分钟
  const perNode = new Map()
  window.forEach((sample) => sample.readings.forEach((reading) => {
    const entry = perNode.get(reading.nodeId) || { min: reading.temp, max: reading.temp }
    entry.min = Math.min(entry.min, reading.temp)
    entry.max = Math.max(entry.max, reading.temp)
    perNode.set(reading.nodeId, entry)
  }))
  const windowMinutes = Math.max(config.windowSec / 60, (now - window[0].at) / 60000 || config.windowSec / 60)
  let ror = 0
  perNode.forEach((entry) => {
    ror = Math.max(ror, (entry.max - entry.min) / windowMinutes)
  })

  const voters = new Set()
  window.forEach((sample) => sample.readings.forEach((reading) => {
    if (reading.temp >= config.voteTemp) voters.add(reading.nodeId)
  }))
  const votes = voters.size

  const sustained = maxNodeId ? sustainedSeconds(samples, maxNodeId, config.high) : 0
  const reasons = []

  const thresholdHit = maxTemp !== null && maxTemp >= config.high
  const fastRise = ror >= config.rorPerMin
  const voted = votes >= config.voteCount
  const longHot = sustained >= config.sustainedSec * 3 && thresholdHit

  let decision = 'idle'
  if (thresholdHit && sustained >= config.sustainedSec && (fastRise || voted || longHot)) {
    decision = 'alarm'
    if (voted) reasons.push(`${votes} 个节点在 ${config.windowSec} 秒窗口内同时升温（投票确认）`)
    if (fastRise) reasons.push(`温升速率 ${ror.toFixed(1)}°C/分钟 ≥ ${config.rorPerMin}（真实燃烧特征）`)
    if (longHot && !fastRise && !voted) reasons.push(`单节点持续高温 ${sustained.toFixed(0)} 秒（长期高温兜底）`)
    reasons.unshift(`最高温 ${maxTemp.toFixed(1)}°C ≥ 阈值 ${config.high}°C 且已持续 ${sustained.toFixed(0)} 秒`)
  } else if (thresholdHit) {
    decision = 'watch'
    if (sustained < config.sustainedSec) reasons.push(`超阈值但只持续 ${sustained.toFixed(0)} 秒，未达确认时长 ${config.sustainedSec} 秒`)
    if (!fastRise && !voted && !longHot) reasons.push('无快速升温、无多节点投票，判定为短促热点')
  } else if ((maxTemp !== null && maxTemp >= config.medium) || ror >= config.rorPerMin * 0.6) {
    decision = 'watch'
    reasons.push(maxTemp !== null && maxTemp >= config.medium
      ? `最高温 ${maxTemp.toFixed(1)}°C 达中风险阈值 ${config.medium}°C，持续观察`
      : `温升速率 ${ror.toFixed(1)}°C/分钟 偏高，持续观察`)
  } else {
    reasons.push('温度与温升均在正常范围')
  }

  if (!multiNode) reasons.push('当前只有 1 个节点上报数据，投票不可用，已用温升速率与持续时间代替')

  return {
    decision,
    reasons,
    metrics: {
      maxTemp,
      maxNodeId,
      ror: Number(ror.toFixed(2)),
      votes,
      sustainedSec: Number(sustained.toFixed(1)),
      multiNode,
      nodes: allNodes.size,
    },
  }
}
