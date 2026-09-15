// 三路证据融合判定（合并自队友）：热像 + 视觉火焰 + 烟雾。
// 关键约束：单一证据不足以报警，至少两路独立证据成立，或热像自身满足
// "超阈值 + 持续 + 快速升温" 的完整证据链。

export const DEFAULT_FUSION_WEIGHTS = {
  thermalStrong: 0.45,
  thermalTrend: 0.2,
  flame: 0.3,
  smoke: 0.25,
  alarmThreshold: 0.55,
  watchThreshold: 0.3,
}

const num = (value, fallback = 0) => (Number.isFinite(Number(value)) ? Number(value) : fallback)
const ratio = (value) => Math.max(0, Math.min(1, num(value)))

export function fusePreventionSignals(input = {}, options = {}) {
  const weights = { ...DEFAULT_FUSION_WEIGHTS, ...options }
  const thermal = input.thermal ?? {}
  const visual = input.visual ?? {}
  const smoke = input.smoke ?? {}
  const thresholds = input.thresholds ?? {}
  const high = num(thresholds.high, 65)
  const medium = num(thresholds.medium, 45)

  const maxTemp = num(thermal.maxTemp, 0)
  const ror = num(thermal.ror, 0)
  const sustainedSec = num(thermal.sustainedSec, 0)
  const multiNode = Boolean(thermal.multiNode)
  const flame = ratio(visual.flame)
  const smokeConfidence = ratio(visual.smoke ?? smoke.confidence)
  const smokeDensity = ratio(smoke.density)

  const tempHit = maxTemp >= high
  const tempWarm = maxTemp >= medium
  const fastRise = ror >= 6
  const lasting = sustainedSec >= 8
  const flameSeen = flame >= 0.5
  const smokeSeen = Math.max(smokeConfidence, smokeDensity) >= 0.45

  const thermalStrong = tempHit && (lasting || fastRise)
  const thermalTrend = !thermalStrong && (tempWarm || fastRise)
  const evidenceCount = [thermalStrong, flameSeen, smokeSeen].filter(Boolean).length

  let score = 0
  if (thermalStrong) score += weights.thermalStrong
  if (thermalTrend) score += weights.thermalTrend
  if (flameSeen) score += weights.flame * Math.max(flame, 0.5)
  if (smokeSeen) score += weights.smoke * Math.max(smokeConfidence, smokeDensity, 0.45)
  if (multiNode && thermalStrong) score += 0.08
  if (thermalStrong && fastRise && lasting) score += 0.15
  score = Math.min(1, score)

  const reasons = []
  if (tempHit) reasons.push(`最高温 ${maxTemp.toFixed(1)}°C 超过报警阈值 ${high}°C`)
  else if (tempWarm) reasons.push(`最高温 ${maxTemp.toFixed(1)}°C 达关注阈值 ${medium}°C`)
  if (fastRise) reasons.push(`温升速率 ${ror.toFixed(1)}°C/分钟，属快速升温`)
  if (lasting && tempHit) reasons.push(`高温已持续 ${sustainedSec.toFixed(0)} 秒`)
  if (multiNode) reasons.push('多个节点同时上报，可参与投票')
  if (flameSeen) reasons.push(`视觉识别到火焰（置信度 ${(flame * 100).toFixed(0)}%）`)
  if (smokeSeen) reasons.push(`识别到烟雾（置信度 ${(Math.max(smokeConfidence, smokeDensity) * 100).toFixed(0)}%）`)
  if (!reasons.length) reasons.push('温度、温升与视觉均正常')

  const enoughEvidence = evidenceCount >= 2
  const thermalAlone = thermalStrong && fastRise && lasting
  const alarm = (tempHit || flameSeen) && (enoughEvidence || thermalAlone) && score >= weights.alarmThreshold
  const watch = !alarm && (score >= weights.watchThreshold || tempWarm || smokeSeen || flameSeen)

  return {
    level: alarm ? 'alarm' : watch ? 'watch' : 'normal',
    score,
    evidenceCount,
    reasons,
    flags: { tempHit, tempWarm, fastRise, lasting, flameSeen, smokeSeen, thermalStrong, thermalTrend, multiNode },
    weights,
  }
}
