// 起火阶段：跟楼内人员做「是 / 否」二元问答
//
// 为什么用二元问答，而不是让用户在火场里打字：
//   · 火场里没人有耐心描述情况，一个问题是/否只需要一次点击；
//   · 答案能直接改变指引（走不了 → 原地避险；门烫 → 不要开门）；
//   · 同一份答案同时上传给救援端，救援队据此知道哪一层、哪个位置有人需要帮助。
//
// 纯函数 + 一个本机存储读写，便于单测与两端共用。

export const USER_STATUS_KEY = 'thermalGuardUserStatus'

export const QUESTIONS = [
  {
    id: 'seeFlame',
    text: '你现在能看到明火或火光吗？',
    hint: '看到火光说明离火源很近，需要立刻换方向',
    yes: '看到明火，正在远离',
    no: '看不到明火',
  },
  {
    id: 'heavySmoke',
    text: '你所在走廊有明显烟雾吗？',
    hint: '烟雾比火更致命，有烟时要贴地走',
    yes: '烟雾明显',
    no: '烟雾不明显',
  },
  {
    id: 'canWalk',
    text: '你现在能自己走到楼梯口吗？',
    hint: '走不动时不要硬闯，原地避险等救援更安全',
    yes: '能走',
    no: '走不动',
  },
  {
    id: 'doorHot',
    text: '通道门或房门摸上去烫手吗？',
    hint: '门烫说明门外已是火场，开门会引火进来',
    yes: '门是烫的',
    no: '门不烫',
  },
  {
    id: 'someoneStuck',
    text: '你身边有人受伤或走不动吗？',
    hint: '确认人数与位置，救援端会优先处理',
    yes: '有人需要帮助',
    no: '身边没有',
  },
]

export function createDialogueState() {
  return { answers: {}, order: [], done: false, startedAt: Date.now() }
}

// 下一个该问的问题；走不动的人不必再问"门烫不烫"以外的通行问题
export function nextQuestion(state) {
  if (!state || state.done) return null
  const questions = QUESTIONS.filter((question) => {
    if (state.answers[question.id] !== undefined) return false
    if (question.id === 'doorHot' && state.answers.canWalk === 'yes') return false
    return true
  })
  if (!questions.length) return null
  // 先问"看不看得到火"，再问"走不走得动"，其余按顺序
  const priority = ['seeFlame', 'canWalk', 'heavySmoke', 'doorHot', 'someoneStuck']
  questions.sort((a, b) => priority.indexOf(a.id) - priority.indexOf(b.id))
  return questions[0]
}

export function answerQuestion(state, questionId, choice) {
  const answers = { ...(state?.answers ?? {}), [questionId]: choice }
  const order = [...(state?.order ?? []), questionId]
  const remaining = QUESTIONS.filter((question) => {
    if (answers[question.id] !== undefined) return false
    if (question.id === 'doorHot' && answers.canWalk === 'yes') return false
    return true
  })
  return { ...(state ?? createDialogueState()), answers, order, done: remaining.length === 0 }
}

export function progressOf(state) {
  const answered = Object.keys(state?.answers ?? {}).length
  const skipped = state?.answers?.canWalk === 'yes' ? 1 : 0
  const total = QUESTIONS.length - skipped
  return { answered, total, ratio: total ? Math.min(1, answered / total) : 0 }
}

export function needsHelp(state) {
  return state?.answers?.canWalk === 'no' || state?.answers?.someoneStuck === 'yes'
}

// 把答案翻译成一句能照着做的指引
export function buildAdvice(state, context = {}) {
  const answers = state?.answers ?? {}
  const routeOk = context.routeOk !== false
  const exitLabel = context.exitLabel || '最近安全出口'
  const meters = Number.isFinite(context.meters) ? Math.round(context.meters) : null

  if (answers.doorHot === 'yes') {
    return {
      tone: 'danger',
      text: '不要开门：门外温度很高，开门会引火进屋。用湿布堵住门缝，退到窗边或阳台，把位置告诉救援人员。',
      needsHelp: true,
    }
  }
  if (answers.canWalk === 'no') {
    return {
      tone: 'danger',
      text: '不要勉强移动：退回相对封闭的房间，关门堵缝并拨打 119，救援端已收到你的位置，会优先来这一层。',
      needsHelp: true,
    }
  }
  if (answers.seeFlame === 'yes') {
    return {
      tone: 'danger',
      text: `你离火源较近：立刻转身背离火光，贴地沿墙走向 ${exitLabel}${meters ? `（约 ${meters} 米）` : ''}，不要穿过火线。`,
      needsHelp: needsHelp(state),
    }
  }
  if (answers.heavySmoke === 'yes') {
    return {
      tone: 'caution',
      text: `烟雾明显：用湿毛巾捂住口鼻，保持贴地，沿地面指示向 ${exitLabel} 移动，不要直立在烟层里。`,
      needsHelp: needsHelp(state),
    }
  }
  if (answers.someoneStuck === 'yes') {
    return {
      tone: 'caution',
      text: `先保证自己能走通：把伤者位置（楼层 + 明显标志物）告诉救援端，随指引先行撤离，救援队会跟进该位置。`,
      needsHelp: true,
    }
  }
  if (!routeOk) {
    return {
      tone: 'danger',
      text: '当前通道受阻：在房间内等待指引，关门堵缝，注意听广播，不要反复试探通道。',
      needsHelp: true,
    }
  }
  return {
    tone: 'safe',
    text: `按箭头前进：沿当前方向前往 ${exitLabel}${meters ? `，约 ${meters} 米` : ''}，中途不要返回取物。`,
    needsHelp: false,
  }
}

// 给救援端的一份快照
export function summarizeForRescue(state, context = {}) {
  const answers = state?.answers ?? {}
  const advice = buildAdvice(state, context)
  const labels = QUESTIONS
    .filter((question) => answers[question.id])
    .map((question) => `${question.text.replace(/[？?]$/, '')}：${answers[question.id] === 'yes' ? '是' : '否'}`)
  return {
    id: context.id || `user-${context.floor ?? '?'}-${context.spot ?? '?'}`,
    floor: context.floor ?? null,
    spot: context.spot ?? null,
    needsHelp: advice.needsHelp,
    tone: advice.tone,
    advice: advice.text,
    answers: labels,
    updatedAt: Date.now(),
  }
}

// ---------------------------------------------------------------- 本机存取（用户端写、系统端读）
export function readUserStatuses() {
  if (typeof localStorage === 'undefined') return []
  try {
    const raw = JSON.parse(localStorage.getItem(USER_STATUS_KEY) || '[]')
    if (!Array.isArray(raw)) return []
    const cutoff = Date.now() - 30 * 60 * 1000
    return raw.filter((item) => item && item.updatedAt >= cutoff)
  } catch {
    return []
  }
}

export function saveUserStatus(status) {
  if (typeof localStorage === 'undefined') return [status]
  const next = [status, ...readUserStatuses().filter((item) => item.id !== status.id)].slice(0, 8)
  try {
    localStorage.setItem(USER_STATUS_KEY, JSON.stringify(next))
  } catch {}
  return next
}

export function clearUserStatuses() {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.removeItem(USER_STATUS_KEY)
  } catch {}
}
