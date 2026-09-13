// 报警引擎：Web Audio 警笛 + 语音播报 + 震动
//
// 浏览器自动播放策略要求音频必须由用户手势解锁，
// 因此页面首次被点击时会自动调用 unlockAudio()，界面中也会提供显式开关。

let audioContext = null
let sirenNodes = null

function ensureContext() {
  if (typeof window === 'undefined') return null
  const Ctor = window.AudioContext || window.webkitAudioContext
  if (!Ctor) return null
  if (!audioContext) {
    try {
      audioContext = new Ctor()
    } catch {
      return null
    }
  }
  return audioContext
}

function warmUpSpeech() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    const warm = new SpeechSynthesisUtterance(' ')
    warm.volume = 0
    window.speechSynthesis.speak(warm)
  } catch {
    /* 忽略：部分浏览器不支持 */
  }
}

// 必须在用户手势（点击/触摸）中调用
export async function unlockAudio() {
  const context = ensureContext()
  if (!context) return false
  try {
    if (context.state === 'suspended') await context.resume()
    const buffer = context.createBuffer(1, 1, context.sampleRate)
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(context.destination)
    source.start(0)
    warmUpSpeech()
    return context.state === 'running'
  } catch {
    return false
  }
}

export function isAudioUnlocked() {
  return Boolean(audioContext && audioContext.state === 'running')
}

export function isSirenPlaying() {
  return Boolean(sirenNodes)
}

const LEVELS = { drill: 0.15, normal: 0.22, escalated: 0.42 }

// 双音慢速扫频警笛（接近消防警铃听感）
export function startSiren(intensity = 'normal') {
  const context = ensureContext()
  if (!context || context.state !== 'running') return false

  stopSiren()

  const level = LEVELS[intensity] || LEVELS.normal
  const now = context.currentTime

  const master = context.createGain()
  master.gain.setValueAtTime(0, now)
  master.gain.linearRampToValueAtTime(level, now + 0.3)
  master.connect(context.destination)

  const tone = context.createOscillator()
  tone.type = 'triangle'
  tone.frequency.setValueAtTime(680, now)

  const sweep = context.createOscillator()
  sweep.type = 'sine'
  sweep.frequency.setValueAtTime(0.52, now)
  const sweepDepth = context.createGain()
  sweepDepth.gain.value = 185
  sweep.connect(sweepDepth)
  sweepDepth.connect(tone.frequency)

  const sub = context.createOscillator()
  sub.type = 'sine'
  sub.frequency.setValueAtTime(340, now)
  const subGain = context.createGain()
  subGain.gain.value = 0.32

  const pulse = context.createOscillator()
  pulse.type = 'square'
  pulse.frequency.setValueAtTime(2.1, now)
  const pulseDepth = context.createGain()
  pulseDepth.gain.value = level * 0.55
  pulse.connect(pulseDepth)
  pulseDepth.connect(master.gain)

  tone.connect(master)
  sub.connect(subGain)
  subGain.connect(master)

  tone.start(now)
  sub.start(now)
  sweep.start(now)
  pulse.start(now)

  sirenNodes = { context, master, tone, sub, sweep, pulse, sweepDepth, subGain, pulseDepth }
  return true
}

export function setSirenIntensity(intensity) {
  if (!sirenNodes) return false
  const level = LEVELS[intensity] || LEVELS.normal
  const { context, master, pulseDepth } = sirenNodes
  try {
    master.gain.cancelScheduledValues(context.currentTime)
    master.gain.setTargetAtTime(level, context.currentTime, 0.12)
    pulseDepth.gain.setTargetAtTime(level * 0.55, context.currentTime, 0.12)
    return true
  } catch {
    return false
  }
}

export function stopSiren() {
  if (!sirenNodes) return
  const { context, master, tone, sub, sweep, pulse, sweepDepth, subGain, pulseDepth } = sirenNodes
  sirenNodes = null
  try {
    const now = context.currentTime
    master.gain.cancelScheduledValues(now)
    master.gain.setTargetAtTime(0.0001, now, 0.08)
    ;[tone, sub, sweep, pulse].forEach((node) => {
      try {
        node.stop(now + 0.4)
      } catch {
        /* 已停止 */
      }
    })
    window.setTimeout(() => {
      ;[master, sweepDepth, subGain, pulseDepth, tone, sub, sweep, pulse].forEach((node) => {
        try {
          node.disconnect()
        } catch {
          /* 已断开 */
        }
      })
    }, 600)
  } catch {
    /* 忽略清理异常 */
  }
}

export function speak(text) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false
  try {
    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = 'zh-CN'
    utterance.rate = 1
    utterance.pitch = 1
    utterance.volume = 1
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}

export function stopSpeak() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* 忽略 */
  }
}

export function supportsVibration() {
  return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function'
}

const ALARM_PATTERN = [420, 180, 420, 180, 700, 320]

export function vibrateAlarm() {
  if (!supportsVibration()) return false
  try {
    navigator.vibrate(ALARM_PATTERN)
    return true
  } catch {
    return false
  }
}

export function stopVibrate() {
  if (!supportsVibration()) return
  try {
    navigator.vibrate(0)
  } catch {
    /* 忽略 */
  }
}

export const ALARM_VIBRATION_INTERVAL = 2400
