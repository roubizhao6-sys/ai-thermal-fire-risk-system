// AI 指挥接口层（本地优先）
//
// 目标：把"AI 指挥决策"做成可插拔的一层——团队把本地大模型（Ollama / LM Studio / vLLM 等
// OpenAI 兼容端点）部署到现场机器或边缘盒子后，只要在设置里填地址与模型名即可接管；
// 没有网络、没有模型时，自动回落到本机规则引擎，保证紧急情况下一定有可用指令。
//
// 约定：
//   · 只走 OpenAI 兼容的 /chat/completions 与 /models，方便替换任意本地推理服务；
//   · 请求带超时，任何失败都不抛异常，调用方永远拿到结构化结果（带 source 字段）；
//   · 密钥只存在本机 localStorage，不随任何埋点上报。

export const AI_SETTINGS_KEY = 'thermalGuardAiSettings'

export const AI_PROVIDERS = {
  offline: {
    id: 'offline',
    label: '本机规则引擎（无网络可用）',
    hint: '不调用任何模型，按现场数据直接给出指令',
    baseUrl: '',
    model: '',
  },
  ollama: {
    id: 'ollama',
    label: '本地 Ollama',
    hint: '现场机器上运行 ollama serve，默认端口 11434',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'qwen2.5:7b',
  },
  lmstudio: {
    id: 'lmstudio',
    label: '本地 LM Studio',
    hint: 'LM Studio 打开 Local Server，默认端口 1234',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: 'qwen2.5-7b-instruct',
  },
  vllm: {
    id: 'vllm',
    label: '本地 vLLM / 自建端点',
    hint: '任何 OpenAI 兼容端点，例如 http://192.168.1.20:8000/v1',
    baseUrl: 'http://127.0.0.1:8000/v1',
    model: '',
  },
}

export const DEFAULT_AI_SETTINGS = {
  provider: 'offline',
  baseUrl: '',
  model: '',
  apiKey: '',
  timeoutMs: 6000,
}

function safeParse(raw) {
  if (!raw) return null
  try {
    const value = JSON.parse(raw)
    return value && typeof value === 'object' ? value : null
  } catch {
    return null
  }
}

export function readAiSettings() {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_AI_SETTINGS }
  const stored = safeParse(localStorage.getItem(AI_SETTINGS_KEY)) ?? {}
  const preset = AI_PROVIDERS[stored.provider] ?? AI_PROVIDERS.offline
  return {
    ...DEFAULT_AI_SETTINGS,
    ...stored,
    baseUrl: stored.baseUrl ?? preset.baseUrl,
    model: stored.model ?? preset.model,
  }
}

export function saveAiSettings(patch) {
  if (typeof localStorage === 'undefined') return { ...DEFAULT_AI_SETTINGS, ...patch }
  const next = { ...readAiSettings(), ...patch }
  localStorage.setItem(AI_SETTINGS_KEY, JSON.stringify(next))
  return next
}

// 端点可用性探测：不抛异常，只返回布尔值（默认 1.2 秒，避免拖慢现场操作）
export async function aiReachable(settings = readAiSettings(), timeoutMs = 1200) {
  const { baseUrl } = settings
  if (!baseUrl || settings.provider === 'offline') return false
  if (typeof fetch === 'undefined') return false
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}/models`, {
      headers: settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : undefined,
      signal: controller?.signal,
    })
    return response.ok
  } catch {
    return false
  } finally {
    clearTimeout(timer)
  }
}

export async function aiChat(messages, settings = readAiSettings(), timeoutMs = settings.timeoutMs ?? 6000) {
  if (!settings.baseUrl || settings.provider === 'offline') {
    throw new Error('ai-disabled')
  }
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null
  const timer = setTimeout(() => controller?.abort(), timeoutMs)
  try {
    const response = await fetch(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}),
      },
      body: JSON.stringify({
        model: settings.model || 'local-model',
        messages,
        temperature: 0.2,
        stream: false,
      }),
      signal: controller?.signal,
    })
    if (!response.ok) throw new Error(`ai-http-${response.status}`)
    const data = await response.json()
    const text = data?.choices?.[0]?.message?.content
    if (!text) throw new Error('ai-empty')
    return String(text)
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------- 规则引擎（无网络兜底）
//
// 输入现场结构化数据，输出与模型同构的结果，保证下游 UI 不需要区分来源。
export function localDecision(context = {}) {
  const {
    fire = null,
    route = null,
    hazard = null,
    crowd = null,
    position = null,
    gps = null,
    plan = null,
  } = context

  if (!fire) {
    return {
      source: 'offline-rules',
      urgency: 'info',
      summary: '未检测到火警，系统处于值守状态',
      action: '保持通道畅通，确认最近出口位置',
      instruction: '可在「我的位置」中开启 GPS，或上传本层逃生路线图备用',
    }
  }

  const floors = (fire.nodes ?? [fire.nodeId]).map((id) => Number(String(id).replace(/\D/g, '')) || position?.floor || 1)
  const sources = Math.max(1, fire.nodes?.length ?? 1)
  const fireFloor = Math.min(...floors)
  const blocked = route?.blockedNodes?.length ?? 0
  const stairs = crowd?.stairs ? Object.values(crowd.stairs) : []
  const congested = stairs.filter((stair) => stair.congested).map((stair) => stair.id)
  const queue = stairs.reduce((sum, stair) => sum + (stair.queue ?? 0), 0)

  const summary = [
    `${fireFloor} 楼起火`,
    sources > 1 ? `${sources} 处火源` : null,
    congested.length ? `${congested.join('/')} 梯拥堵` : null,
    queue > 12 ? `排队 ${queue} 人` : null,
  ].filter(Boolean).join(' · ')

  let action
  let instruction

  if (!route?.ok) {
    action = blocked ? '当前通道受阻，改走备用楼梯或就近房间避难并等待指引' : '正在重新计算路线，先在原地等待 5 秒'
    instruction = '不要搭乘电梯，关闭身后的防火门'
  } else if (plan?.route?.instructions?.length) {
    const step = plan.route.instructions[0]
    action = `按${plan.name || '本层路线图'}撤离，前往${plan.route.exitLabel || '最近出口'}`
    instruction = step.text
  } else {
    const exit = route.exitLabel || '最近安全出口'
    action = `撤离至${exit}，约 ${Math.round(route.meters ?? 0)} 米`
    instruction = congested.length
      ? `避开拥堵的 ${congested.join('/')} 梯，改走另一条楼梯`
      : '保持当前方向前进，注意地面指示'
  }

  if (gps?.status === 'active' && gps.location && !gps.location.inside) {
    instruction += `；你已在校园外，可前往集合点方向`
  }

  return {
    source: 'offline-rules',
    urgency: route?.ok ? 'immediate' : 'prepare',
    summary,
    action,
    instruction,
  }
}

export function buildCommanderMessages(context) {
  return [
    {
      role: 'system',
      content: [
        '你是校园火灾疏散指挥助手，只能依据给出的结构化现场数据回答。',
        '输出严格的 JSON：{"summary":"一句话现场态势","action":"一句话撤离决策","instruction":"给现场人员的一步动作"}',
        '不要编造未提供的信息；数据不足时在 instruction 里明确让人员等待下一次更新。',
      ].join('\n'),
    },
    { role: 'user', content: JSON.stringify(context) },
  ]
}

function parseModelReply(text) {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  const parsed = safeParse(text.slice(start, end + 1))
  if (!parsed?.action) return null
  return {
    source: 'local-model',
    urgency: parsed.urgency ?? 'immediate',
    summary: String(parsed.summary ?? '').slice(0, 120),
    action: String(parsed.action).slice(0, 120),
    instruction: String(parsed.instruction ?? '').slice(0, 160),
  }
}

// 统一入口：优先本地模型，失败或未配置时用规则引擎
export async function aiCommand(context, settings = readAiSettings()) {
  const fallback = localDecision(context)
  if (settings.provider === 'offline' || !settings.baseUrl) {
    return { ...fallback, attempted: false }
  }
  try {
    const text = await aiChat(buildCommanderMessages(context), settings)
    const parsed = parseModelReply(text)
    return parsed ? { ...parsed, attempted: true } : { ...fallback, attempted: true, modelReplyInvalid: true }
  } catch (error) {
    return { ...fallback, attempted: true, error: String(error?.message ?? error) }
  }
}
