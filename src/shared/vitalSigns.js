// 阶段三：火灾后的生命体征搜索（红外热像）
//
// 火灾扑灭后，楼内仍有余温（墙体、设备、阴燃点），所以不能只看"哪块热"。
// 这里做三件事，全部是纯函数，便于单测与解释：
//   1. 用分位数估计环境基准温度（对大片余温不敏感）；
//   2. 把明显高于人体上限的格子当作"火场余温"剔除，避免把阴燃点当成伤员；
//   3. 在 33–42°C 的窄带里找"与环境有 3°C 以上反差、且成片"的区域，
//      越接近 37°C、格子越多，置信度越高。

export const VITAL_BAND = { min: 33, max: 42, target: 37 }
export const DEFAULT_VITAL_OPTIONS = {
  minTemp: VITAL_BAND.min,
  maxTemp: VITAL_BAND.max,
  targetTemp: VITAL_BAND.target,
  contrast: 3, // 与环境基准的最小温差
  hotCut: 70, // 超过这个温度视为火场余温，不参与生命体征判定
  minCells: 1,
  minStrongCells: 2,
  maxCellRatio: 0.06, // 连通区占画幅比例：占得太大的更像余温/热区，而不是一个人
}

function percentile(values, p) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const index = Math.max(0, Math.min(sorted.length - 1, Math.round((sorted.length - 1) * p)))
  return sorted[index]
}

export function ambientBaseline(temperatures) {
  const list = (temperatures ?? []).map(Number).filter(Number.isFinite)
  if (!list.length) return 0
  return Number(percentile(list, 0.35).toFixed(2))
}

// 主入口：输入一帧热像（与 thermal.js 的 frame 同结构），输出候选生命体征区域
export function scanVitalSigns(frame, options = {}) {
  const config = { ...DEFAULT_VITAL_OPTIONS, ...options }
  const width = Number(frame?.width) || 32
  const height = Number(frame?.height) || 24
  const temps = Array.isArray(frame?.temperatures) ? frame.temperatures.map(Number) : []
  if (temps.length !== width * height) {
    return { ok: false, reason: '温度矩阵尺寸不匹配', ambient: null, candidates: [], scannedCells: 0 }
  }

  const ambient = ambientBaseline(temps)
  const mask = new Uint8Array(width * height)
  let scannedCells = 0
  let burnedCells = 0

  for (let index = 0; index < temps.length; index += 1) {
    const temp = temps[index]
    if (temp >= config.hotCut) {
      burnedCells += 1
      continue
    }
    scannedCells += 1
    const contrast = temp - ambient
    if (temp >= config.minTemp && temp <= config.maxTemp && contrast >= config.contrast) mask[index] = 1
  }

  // 4 邻域聚类：单格噪点不算目标，但"非常接近 37°C 且反差大"的单格仍然报出，交人工复核
  const visited = new Uint8Array(width * height)
  const candidates = []
  let warmAreaCells = 0
  for (let index = 0; index < mask.length; index += 1) {
    if (!mask[index] || visited[index]) continue
    const stack = [index]
    visited[index] = 1
    const cells = []
    while (stack.length) {
      const current = stack.pop()
      cells.push(current)
      const cx = current % width
      const cy = Math.floor(current / width)
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue
        const next = ny * width + nx
        if (visited[next] || !mask[next]) continue
        visited[next] = 1
        stack.push(next)
      }
    }

    const temps4 = cells.map((cell) => temps[cell])
    const meanTemp = temps4.reduce((sum, value) => sum + value, 0) / cells.length
    const maxTemp = Math.max(...temps4)
    const contrast = meanTemp - ambient
    const spread = maxTemp - Math.min(...temps4)
    // 面积过大的连通区按"余温/热区"处理：人体在 32×24 上通常只有几个格子
    const cellCap = Math.max(6, Math.round(width * height * config.maxCellRatio))
    if (cells.length > cellCap) {
      warmAreaCells += cells.length
      continue
    }
    const nearTarget = 1 - Math.min(1, Math.abs(meanTemp - config.targetTemp) / 5)
    const strongest = cells.some((cell) => Math.abs(temps[cell] - config.targetTemp) <= 1.5)
    const strongEnough = cells.length >= config.minStrongCells || (strongest && contrast >= config.contrast + 2)
    if (cells.length < config.minCells || !strongEnough) continue

    const sumX = cells.reduce((sum, cell) => sum + (cell % width), 0)
    const sumY = cells.reduce((sum, cell) => sum + Math.floor(cell / width), 0)
    const confidence = Math.max(0.2, Math.min(0.97,
      0.35
      + Math.min(0.25, cells.length * 0.05)
      + nearTarget * 0.25
      + Math.min(0.15, Math.max(0, contrast - config.contrast) * 0.05)
      - Math.min(0.12, spread * 0.02),
    ))

    candidates.push({
      x: sumX / cells.length / width,
      y: sumY / cells.length / height,
      cells: cells.length,
      meanTemp: Number(meanTemp.toFixed(1)),
      maxTemp: Number(maxTemp.toFixed(1)),
      contrast: Number(contrast.toFixed(1)),
      confidence: Number(confidence.toFixed(2)),
      needsHumanCheck: !strongest || cells.length < 2,
    })
  }

  candidates.sort((a, b) => b.confidence - a.confidence)
  return {
    ok: true,
    width,
    height,
    ambient,
    scannedCells,
    burnedCells,
    warmAreaCells,
    candidates,
    band: { ...VITAL_BAND },
  }
}

// 给救援端的一句话结论 + 排查顺序
export function describeVitalSigns(result, context = {}) {
  if (!result?.ok) return { summary: '扫描未完成，请重新扫描', priority: [], action: '检查热像数据源后重新扫描', caution: null }
  const floorText = context.floor ? `${context.floor} 楼` : '当前楼层'
  const list = result.candidates ?? []
  if (!list.length) {
    return {
      summary: `${floorText}未发现符合人体温度特征的区域（环境基准 ${result.ambient}°C，已排除 ${result.burnedCells} 个余温格）`,
      priority: [],
      action: '按房间逐间复扫，重点排查遮挡与积水区域',
      caution: '红外只能看到表面温度，被掩埋或遮挡的人员无法发现，必须人工搜索',
    }
  }
  const priority = list.slice(0, 3).map((item, index) => (
    `${index + 1}. 图内坐标 (${item.x.toFixed(2)}, ${item.y.toFixed(2)})：${item.meanTemp}°C，置信度 ${Math.round(item.confidence * 100)}%`
  ))
  return {
    summary: `${floorText}发现 ${list.length} 处疑似生命体征，最高一处 ${list[0].meanTemp}°C、置信度 ${Math.round(list[0].confidence * 100)}%`,
    priority,
    action: '按优先顺序派人带热像仪靠近复核，确认后立即标记并呼叫医疗组',
    caution: '结果为算法辅助判定，必须人工复核；阴燃点与热管道可能造成误判',
  }
}

// 演示用的灾后热像：环境 30°C 上下 + 两处余温 + 三个"人形"团块（确定性伪随机，便于复现）
function mulberry32(seed) {
  let value = seed >>> 0
  return () => {
    value += 0x6d2b79f5
    let t = value
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createAfterFireFrame({ width = 32, height = 24, seed = 20260915, ambient = 30 } = {}) {
  const random = mulberry32(seed)
  const temperatures = []
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = x / (width - 1)
      const ny = y / (height - 1)
      // 残余热场：靠近起火点（左上）仍有阴燃余温
      const emberA = 44 * Math.exp(-(((nx - 0.3) ** 2 + (ny - 0.32) ** 2) / 0.02))
      const emberB = 28 * Math.exp(-(((nx - 0.72) ** 2 + (ny - 0.7) ** 2) / 0.03))
      const noise = (random() - 0.5) * 1.2
      temperatures.push(ambient + 0.8 * (1 - ny) + emberA + emberB + noise)
    }
  }
  // 三处人体温度团块（约 36.6–37.6°C）
  const people = [
    { x: 0.62, y: 0.3, size: 2, temp: 37.2 },
    { x: 0.2, y: 0.7, size: 1, temp: 36.8 },
    { x: 0.85, y: 0.5, size: 1, temp: 37.5 },
  ]
  people.forEach((person) => {
    const cx = Math.round(person.x * (width - 1))
    const cy = Math.round(person.y * (height - 1))
    const radius = person.size
    for (let dy = -radius; dy <= radius; dy += 1) {
      for (let dx = -radius; dx <= radius; dx += 1) {
        const x = cx + dx
        const y = cy + dy
        if (x < 0 || y < 0 || x >= width || y >= height) continue
        const distance = Math.hypot(dx, dy)
        if (distance > radius) continue
        const falloff = 1 - distance / (radius + 0.6)
        const index = y * width + x
        temperatures[index] = Math.max(temperatures[index], person.temp * falloff + ambient * (1 - falloff))
      }
    }
  })

  const maxTemp = Math.max(...temperatures)
  const minTemp = Math.min(...temperatures)
  return {
    width,
    height,
    temperatures: temperatures.map((value) => Number(value.toFixed(2))),
    minTemp: Number(minTemp.toFixed(2)),
    maxTemp: Number(maxTemp.toFixed(2)),
    ambient,
    source: '灾后复扫 · 模拟热像',
    timestamp: new Date(),
  }
}
