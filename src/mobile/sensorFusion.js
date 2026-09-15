// 多节点温度联合定位（创新点 1）
//
// 现状问题：多节点系统里最常见的做法是"谁超过阈值，谁就算一处火源"。
// 于是一个真实火场周围的 3 个传感器会被算成 3 处火源，路线被过度保守化；
// 与此同时用户端也不知道"这个位置判断有多可信"。
//
// 这个模块做三件事：
//   1. 按楼宇拓扑把"高温读数"聚成若干火源团（相隔较远的两个火场不会被并成一个）；
//   2. 在每个团内用图上加权质心估计火源节点（温度越高、离得越近，权重越大）；
//   3. 给出置信度与不确定度（±N 层/跳），低置信度时退化为"把团内节点都当可能火源"的稳健解。
//
// 全部是纯函数，方便单测与在系统端/用户端复用。

import { BUILDING, nodeLabel } from './building.js'

const HOP_CORRIDOR = 1
const HOP_STAIR_UP = 0.7
const HOP_STAIR_DOWN = 1.1

// 参与聚合的最低温度与"算作高温"的温度，默认与系统端阈值一致
export const DEFAULT_FUSION = {
  high: 65,
  medium: 45,
  // 两个高温节点在图上距离小于这个值时视为同一处火场
  clusterHops: 2.2,
  // 置信度低于该值时改用稳健解（团内节点全部作为可能火源）
  confidenceFloor: 0.35,
}

const nodeFloor = (id) => BUILDING.nodes[id]?.floor ?? null

// 单源加权跳数距离：与 evacuation.js 的扩散权重保持一致（烟气上行快于下行）
export function graphDistances(fromId) {
  const distances = new Map(Object.keys(BUILDING.nodes).map((id) => [id, Infinity]))
  if (!BUILDING.nodes[fromId]) return distances
  distances.set(fromId, 0)
  const settled = new Set()
  const total = Object.keys(BUILDING.nodes).length

  while (settled.size < total) {
    let current = null
    let best = Infinity
    distances.forEach((distance, id) => {
      if (!settled.has(id) && distance < best) {
        best = distance
        current = id
      }
    })
    if (current === null) break
    settled.add(current)
    BUILDING.adjacency[current].forEach((edge) => {
      let hop = HOP_CORRIDOR
      if (edge.kind === 'stair') {
        hop = nodeFloor(edge.to) > nodeFloor(current) ? HOP_STAIR_UP : HOP_STAIR_DOWN
      }
      const next = best + hop
      if (next < (distances.get(edge.to) ?? Infinity)) distances.set(edge.to, next)
    })
  }
  return distances
}

// 读数归一化：支持 { nodeId, temp } 或 { floor, temp }（只给楼层时落到该层走廊）
export function normalizeReadings(readings) {
  if (!Array.isArray(readings)) return []
  return readings
    .map((item) => {
      const temp = Number(item?.temp)
      if (!Number.isFinite(temp)) return null
      const nodeId = item.nodeId && BUILDING.nodes[item.nodeId]
        ? item.nodeId
        : item.floor && BUILDING.nodes[`C${item.floor}`]
          ? `C${item.floor}`
          : null
      if (!nodeId) return null
      return { nodeId, temp, label: item.label ?? null }
    })
    .filter(Boolean)
}

// 把高温读数按图距离聚团：距离 > clusterHops 的两处高温属于不同火场
export function clusterReadings(readings, options = {}) {
  const config = { ...DEFAULT_FUSION, ...options }
  const all = normalizeReadings(readings)
  const hot = all.filter((item) => item.temp >= config.high)
  const clusters = []
  const distanceCache = new Map()
  const distancesFrom = (id) => {
    if (!distanceCache.has(id)) distanceCache.set(id, graphDistances(id))
    return distanceCache.get(id)
  }

  hot.forEach((reading) => {
    const target = clusters.find((cluster) =>
      cluster.some((member) => distancesFrom(member.nodeId).get(reading.nodeId) <= config.clusterHops))
    if (target) target.push(reading)
    else clusters.push([reading])
  })

  return { clusters, readings: all, config }
}

// 团内估计火源节点：score(node) = Σ w_i / (1 + d(node, node_i))，w_i 为超出中风险阈值的温度
function scoreCandidates(cluster, config) {
  const scored = []
  Object.keys(BUILDING.nodes).forEach((candidate) => {
    const distances = graphDistances(candidate)
    let score = 0
    cluster.forEach((reading) => {
      const weight = Math.max(1, reading.temp - config.medium)
      const distance = distances.get(reading.nodeId) ?? Infinity
      if (Number.isFinite(distance)) score += weight / (1 + distance)
    })
    scored.push({ nodeId: candidate, score })
  })
  scored.sort((a, b) => b.score - a.score)
  return scored
}

// 置信度定义：所有观测热量相对估计位置的"加权平均图距离"（spread）。
//   spread ≈ 0  → 热量集中在估计点（置信度高、不确定度 0）
//   spread 越大 → 热量分散（置信度低、不确定度大，必要时退化为稳健解）
export function estimateCluster(cluster, options = {}) {
  const config = { ...DEFAULT_FUSION, ...options }
  if (!cluster.length) return null
  const ranked = scoreCandidates(cluster, config)
  const best = ranked[0]
  const contributors = [...cluster].sort((a, b) => b.temp - a.temp)
  const distances = graphDistances(best.nodeId)
  let weightSum = 0
  let weightedDistance = 0
  contributors.forEach((item) => {
    const weight = Math.max(1, item.temp - config.medium)
    const distance = distances.get(item.nodeId) ?? 3
    weightSum += weight
    weightedDistance += weight * distance
  })
  const spread = weightSum > 0 ? weightedDistance / weightSum : 0
  const confidence = Math.max(0, Math.min(1, 1 - spread / 3))
  const uncertaintyHops = Math.round(spread)

  return {
    nodeId: best.nodeId,
    label: nodeLabel(best.nodeId),
    floor: nodeFloor(best.nodeId),
    confidence: Number(confidence.toFixed(2)),
    uncertaintyHops,
    spread: Number(spread.toFixed(2)),
    maxTemp: Math.max(...cluster.map((item) => item.temp)),
    contributors,
  }
}

// 对外主入口：读数 → 火源来源列表
// 高置信度：一处火场给一个估计来源；
// 低置信度：退化为稳健解——该团内所有高温节点都作为可能火源（宁可多避一点）。
export function fuseReadings(readings, options = {}) {
  const config = { ...DEFAULT_FUSION, ...options }
  const { clusters, readings: normalized } = clusterReadings(readings, config)
  const estimates = clusters
    .map((cluster) => estimateCluster(cluster, config))
    .filter(Boolean)
    .sort((a, b) => b.maxTemp - a.maxTemp)

  const sources = []
  estimates.forEach((estimate) => {
    if (estimate.confidence >= config.confidenceFloor || estimate.contributors.length === 1) {
      sources.push({
        nodeId: estimate.nodeId,
        from: 'sensor',
        confidence: estimate.confidence,
        uncertaintyHops: estimate.uncertaintyHops,
        maxTemp: estimate.maxTemp,
        label: estimate.label,
        contributors: estimate.contributors.map((item) => item.nodeId),
        robust: false,
      })
      return
    }
    estimate.contributors.forEach((item) => {
      sources.push({
        nodeId: item.nodeId,
        from: 'sensor',
        confidence: estimate.confidence,
        uncertaintyHops: estimate.uncertaintyHops,
        maxTemp: item.temp,
        label: nodeLabel(item.nodeId),
        contributors: estimate.contributors.map((entry) => entry.nodeId),
        robust: true,
      })
    })
  })

  // 参与聚合但没到高温的读数也回传，便于界面展示"观察到升温"
  const watch = normalized.filter((item) => item.temp < config.high && item.temp >= config.medium)
  return { sources, estimates, watch, readings: normalized }
}

// ===== 三路证据融合（合并自 aiPhases） =====
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
