// 逃生路线图：上传 → 识别 → 存在手机本地 → 火警时按图指引。
//
// 存储：IndexedDB（只在本机，不上传）。识别：优先用已配置的本地视觉模型；
// 没有模型时用浏览器内的颜色/线条启发式给出一份"草稿"，由用户点一下确认，
// 这样现场没有网络也能用（AI 辅助 + 人工确认）。

import { aiChatVision, readAiSettings } from '../shared/aiClient.js'

export const PLAN_DB = 'thermalGuardPlans'
export const PLAN_STORE = 'plans'

// ---------------------------------------------------------------- 本地存储

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('indexeddb-unsupported'))
      return
    }
    const request = indexedDB.open(PLAN_DB, 1)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(PLAN_STORE)) {
        db.createObjectStore(PLAN_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('indexeddb-error'))
  })
}

async function withStore(mode, handler) {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(PLAN_STORE, mode)
    const store = tx.objectStore(PLAN_STORE)
    let result
    try {
      result = handler(store)
    } catch (error) {
      reject(error)
      return
    }
    tx.oncomplete = () => {
      db.close()
      resolve(result?.__request ? result.__request.result : result)
    }
    tx.onerror = () => {
      db.close()
      reject(tx.error ?? new Error('indexeddb-tx-error'))
    }
  })
}

export async function savePlan(plan) {
  const record = {
    ...plan,
    id: plan.id ?? `plan-${Date.now()}`,
    updatedAt: Date.now(),
    createdAt: plan.createdAt ?? Date.now(),
  }
  await withStore('readwrite', (store) => store.put(record))
  return record
}

export async function listPlans() {
  const records = await withStore('readonly', (store) => {
    const request = store.getAll()
    return { __request: request }
  })
  return Array.isArray(records) ? records.sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)) : []
}

export async function deletePlan(id) {
  await withStore('readwrite', (store) => store.delete(id))
  return id
}

// ---------------------------------------------------------------- 图像识别（浏览器内启发式）

const MAX_SIDE = 480

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('image-load-failed'))
    image.src = dataUrl
  })
}

// 主色/符号启发式：绿色（疏散指示）→ 候选出口；红色（灭火器/消火栓）→ 消防设施；深色细线 → 走廊
export async function analyzePlanImage(dataUrl) {
  const image = await loadImage(dataUrl)
  const scale = Math.min(1, MAX_SIDE / Math.max(image.width, image.height))
  const width = Math.max(1, Math.round(image.width * scale))
  const height = Math.max(1, Math.round(image.height * scale))
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  ctx.drawImage(image, 0, 0, width, height)
  const { data } = ctx.getImageData(0, 0, width, height)

  const cell = 12
  const cols = Math.ceil(width / cell)
  const rows = Math.ceil(height / cell)
  const green = new Float32Array(cols * rows)
  const red = new Float32Array(cols * rows)
  let darkCount = 0
  let greenCount = 0
  let redCount = 0

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4
      const r = data[index]
      const g = data[index + 1]
      const b = data[index + 2]
      const cellIndex = Math.floor(y / cell) * cols + Math.floor(x / cell)
      if (g > 92 && g > r + 18 && g > b + 16) {
        green[cellIndex] += 1
        greenCount += 1
      } else if (r > 110 && r > g + 30 && r > b + 30) {
        red[cellIndex] += 1
        redCount += 1
      } else if (0.299 * r + 0.587 * g + 0.114 * b < 110) {
        darkCount += 1
      }
    }
  }

  const exits = clusterCells(green, cols, rows, cell, width, height).slice(0, 3)
  const extinguishers = clusterCells(red, cols, rows, cell, width, height).slice(0, 6)
  const total = width * height

  return {
    width,
    height,
    exits,
    extinguishers,
    ratios: {
      green: greenCount / total,
      red: redCount / total,
      dark: darkCount / total,
    },
  }
}

// 把命中像素按网格聚类成候选点（不用外部依赖，够用且可解释）
function clusterCells(mask, cols, rows, cell, width, height) {
  const visited = new Uint8Array(cols * rows)
  const out = []
  const threshold = 6
  for (let index = 0; index < mask.length; index += 1) {
    if (visited[index] || mask[index] < threshold) continue
    const stack = [index]
    visited[index] = 1
    let count = 0
    let sumX = 0
    let sumY = 0
    while (stack.length) {
      const current = stack.pop()
      const cx = current % cols
      const cy = Math.floor(current / cols)
      count += mask[current]
      sumX += (cx + 0.5) * cell * mask[current]
      sumY += (cy + 0.5) * cell * mask[current]
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = cx + dx
        const ny = cy + dy
        if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue
        const next = ny * cols + nx
        if (visited[next] || mask[next] < threshold) continue
        visited[next] = 1
        stack.push(next)
      }
    }
    if (count < threshold * 2) continue
    out.push({
      x: sumX / count / width,
      y: sumY / count / height,
      area: count,
      confidence: Math.min(0.95, 0.45 + count / 400),
    })
  }
  return out.sort((a, b) => b.area - a.area)
}

// ---------------------------------------------------------------- 按图指引

// ---------------------------------------------------------------- 本地模型复核（AI 辅助）
//
// 分工：启发式负责"哪里像出口"（像素级、可解释），本地模型负责"这个出口叫什么、走哪个更合理"。
// 两者都在本机完成，模型端点由用户自己填；模型不可用时只返回启发式结果，流程不中断。

const AI_MAX_SIDE = 768

export function downscaleDataUrl(dataUrl, maxSide = AI_MAX_SIDE, quality = 0.72) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') {
      resolve({ dataUrl, width: 0, height: 0 })
      return
    }
    const image = new Image()
    image.onload = () => {
      const scale = Math.min(1, maxSide / Math.max(image.width, image.height))
      const width = Math.max(1, Math.round(image.width * scale))
      const height = Math.max(1, Math.round(image.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve({ dataUrl, width: image.width, height: image.height })
        return
      }
      ctx.drawImage(image, 0, 0, width, height)
      try {
        resolve({ dataUrl: canvas.toDataURL('image/jpeg', quality), width, height })
      } catch {
        resolve({ dataUrl, width, height })
      }
    }
    image.onerror = () => resolve({ dataUrl, width: 0, height: 0 })
    image.src = dataUrl
  })
}

// 给本地模型的任务描述：只让它做"命名 + 选哪个出口"，位置由启发式给出，避免模型乱报坐标
export function buildPlanRecognitionPrompt(analysis = {}, context = {}) {
  const exits = (analysis.exits ?? []).map((item, index) => (
    `  ${index + 1}. 图内坐标 (${item.x.toFixed(2)}, ${item.y.toFixed(2)})，图上方为北`
  ))
  const extinguishers = (analysis.extinguishers ?? [])
    .map((item, index) => `  ${index + 1}. (${item.x.toFixed(2)}, ${item.y.toFixed(2)})`)
  return [
    '这是一张传统火灾疏散路线图（平面图）。系统已经用颜色检测找出若干候选出口（绿色疏散指示）与消防设施（红色）。',
    `楼层：${context.floor ?? '未知'} 楼。当前火源位置：${context.fireText ?? '未知'}。`,
    '',
    '候选出口：',
    ...(exits.length ? exits : ['  （未检测到绿色标记）']),
    '消防设施（红色）：',
    ...(extinguishers.length ? extinguishers : ['  （未检测到）']),
    '',
    '请只回答一个 JSON，不要任何解释文字，字段如下：',
    '{"exitLabels":["每个候选出口的中文名称，按上面编号顺序"],"recommendedExit":1,"rooms":["图中能读出的房间/区域名称"],"corridor":"一句话描述主疏散通道走向","notes":"结合当前火源，说明为什么推荐这个出口"}',
    '规则：名称要短（如"东侧楼梯间""南门""中庭扶梯口"）；读不出来的字段给空字符串或空数组；不要编造图上没有的房间名。',
  ].join('\n')
}

// 解析模型回复（纯函数，便于单测）：容错地取出第一段 JSON
export function parsePlanRecognition(text) {
  if (!text) return null
  const start = String(text).indexOf('{')
  const end = String(text).lastIndexOf('}')
  if (start < 0 || end <= start) return null
  let parsed = null
  try {
    parsed = JSON.parse(String(text).slice(start, end + 1))
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object') return null
  const labels = Array.isArray(parsed.exitLabels)
    ? parsed.exitLabels.map((item) => String(item ?? '').trim().slice(0, 16))
    : []
  const rooms = Array.isArray(parsed.rooms)
    ? parsed.rooms.map((item) => String(item ?? '').trim().slice(0, 16)).filter(Boolean).slice(0, 8)
    : []
  const recommended = Number.isFinite(Number(parsed.recommendedExit)) ? Number(parsed.recommendedExit) : NaN
  return {
    exitLabels: labels,
    recommendedExit: Number.isInteger(recommended) ? recommended : NaN,
    rooms,
    corridor: String(parsed.corridor ?? '').slice(0, 60),
    notes: String(parsed.notes ?? '').slice(0, 120),
  }
}

// 统一入口：有本地模型就让模型复核，没有就返回 null 让调用方继续用启发式结果。永不抛异常。
export async function aiReviewPlan({ dataUrl, analysis, floor, fireText, settings = readAiSettings() } = {}) {
  if (!settings || settings.provider === 'offline' || !settings.baseUrl) {
    return { ok: false, source: 'offline', reason: 'ai-disabled' }
  }
  const prompt = buildPlanRecognitionPrompt(analysis, { floor, fireText })
  const image = settings.vision ? await downscaleDataUrl(dataUrl) : { dataUrl: '' }
  try {
    const text = await aiChatVision(prompt, settings.vision ? image.dataUrl : '', settings, settings.timeoutMs ?? 15000)
    const parsed = parsePlanRecognition(text)
    if (!parsed) return { ok: false, source: 'local-model', reason: 'reply-not-json', reply: String(text).slice(0, 120) }
    return { ok: true, source: 'local-model', vision: Boolean(settings.vision), model: settings.model, ...parsed }
  } catch (error) {
    return { ok: false, source: 'local-model', reason: String(error?.message ?? error) }
  }
}

// 把模型给的名称贴回候选出口（位置仍用启发式结果），并挑出推荐的出口
export function applyPlanRecognition(analysis, recognition) {
  const exits = (analysis.exits ?? []).map((item, index) => ({
    ...item,
    label: recognition?.exitLabels?.[index] || item.label || `候选出口 ${index + 1}`,
  }))
  const recommended = Number.isInteger(recognition?.recommendedExit) ? recognition.recommendedExit : -1
  const chosen = exits[recommended] ?? exits[0] ?? null
  return { exits, chosen, recommended }
}

export function normalizeDeg(value) {
  return ((value % 360) + 360) % 360
}

// 图内方位角：x 向右、y 向下，图上方默认视为北（plan.upBearing 可校正朝向）
export function imageBearing(from, to) {
  const dx = (to.x - from.x)
  const dy = (to.y - from.y)
  return normalizeDeg((Math.atan2(dx, -dy) * 180) / Math.PI)
}

function turnText(turn) {
  const abs = Math.abs(turn)
  if (abs < 12) return '直行'
  return turn > 0 ? `向右转 ${Math.round(abs)}°` : `向左转 ${Math.round(abs)}°`
}

// 把「起点 → 途经点 → 出口」编成分步指令；scaleMeters 由用户在图上一格/整图宽度推算
export function buildPlanRoute(plan) {
  const start = plan.start ?? { x: 0.5, y: 0.5 }
  const exit = plan.exit ?? plan.exits?.[0] ?? { x: 0.5, y: 0.1 }
  const middle = Array.isArray(plan.waypoints) ? plan.waypoints : []
  const points = [start, ...middle, exit]
  const widthMeters = Number(plan.widthMeters) > 0 ? Number(plan.widthMeters) : 50
  const metersPerUnit = widthMeters

  const instructions = []
  let totalMeters = 0
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1]
    const to = points[index]
    const bearing = imageBearing(from, to)
    const meters = Math.hypot(to.x - from.x, to.y - from.y) * metersPerUnit
    const previous = instructions.at(-1)
    const turn = previous ? ((bearing - previous.bearing + 540) % 360) - 180 : 0
    totalMeters += meters
    instructions.push({
      index: index - 1,
      bearing,
      compassBearing: normalizeDeg(bearing + (Number(plan.upBearing) || 0)),
      meters,
      turn,
      text: `${turnText(turn)}，前进约 ${Math.max(1, Math.round(meters))} 米`,
      from,
      to,
      isLast: index === points.length - 1,
    })
  }

  return {
    points,
    instructions,
    totalMeters,
    exitLabel: plan.exitLabel || '路线图出口',
    exit,
  }
}

// 按当前位置（图内归一化坐标）找当前应该走的那一段
export function currentStep(route, point) {
  if (!route?.instructions?.length) return null
  if (!point) return route.instructions[0]
  let best = route.instructions[0]
  let bestDistance = Infinity
  route.instructions.forEach((step) => {
    const distance = Math.hypot(point.x - step.to.x, point.y - step.to.y)
    if (distance < bestDistance) {
      bestDistance = distance
      best = step
    }
  })
  return best
}

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('file-read-failed'))
    reader.readAsDataURL(file)
  })
}
