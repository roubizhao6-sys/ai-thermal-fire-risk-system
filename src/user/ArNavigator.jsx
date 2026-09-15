// 用户端 AR 实景导航：调用手机后置摄像头，把逃生方向、距离与接近度叠加在实景画面上。
//
// 设计要点（针对常见 AR 导航的缺陷）：
//   · 摄像头与方向权限分开处理，逐种失败给出可操作提示（不支持 / 未授权 / 非安全上下文）；
//   · 视频流在 <video> 挂载后再绑定，切换前后摄像头时重新绑定；
//   · 叠加层显示：方向箭头（随真实朝向旋转）、目标出口、距离、接近度、剩余楼层与定位来源；
//   · 摄像头不可用时自动退回表盘模式，不阻断撤离；
//   · 使用期间申请屏幕常亮，退出时释放摄像头与监听。

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Compass, Camera, CameraOff, Flashlight, RefreshCw, X } from 'lucide-react'

const TURN_TEXT = (turn) => {
  const abs = Math.abs(turn)
  if (abs < 12) return '保持当前方向直行'
  return turn > 0 ? `向右转 ${Math.round(abs)}°` : `向左转 ${Math.round(abs)}°`
}

function shortestTurn(target, current) {
  return ((target - current + 540) % 360) - 180
}

export default function ArNavigator({
  route,
  fire,
  proximity = 0,
  atExit = false,
  proximityText = '',
  bearing = 0,
  targetLabel = '最近安全出口',
  remainingFloors = '—',
  positionSource = '',
  gps,
  onClose,
}) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const wakeRef = useRef(null)
  const headingRef = useRef(null)
  const [camera, setCamera] = useState('idle') // idle | requesting | active | denied | unsupported | insecure
  const [facing, setFacing] = useState('environment')
  const [headingState, setHeadingState] = useState('idle') // idle | active | unsupported | denied | simulated
  const [heading, setHeading] = useState(0)
  const [hasTorch, setHasTorch] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [notice, setNotice] = useState('')

  const secure = typeof window === 'undefined' ? true : window.isSecureContext !== false
  const supported = typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia)

  // 方向监听：iOS 需要用户手势内申请权限
  const attachHeading = useCallback(async () => {
    if (typeof window === 'undefined') return
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      try {
        const permission = await DeviceOrientationEvent.requestPermission()
        if (permission !== 'granted') {
          setHeadingState('denied')
          setNotice('未获得方向权限，箭头将按固定基准指向；可在系统设置中允许「运动与方向」访问')
          return
        }
      } catch {
        setHeadingState('denied')
        return
      }
    }
    if (typeof window.DeviceOrientationEvent === 'undefined') {
      setHeadingState('unsupported')
      return
    }
    const handler = (event) => {
      const raw = Number.isFinite(event.webkitCompassHeading)
        ? Number(event.webkitCompassHeading)
        : Number.isFinite(event.alpha)
          ? 360 - Number(event.alpha)
          : null
      if (raw == null) return
      setHeading((raw + 360) % 360)
      setHeadingState('active')
    }
    headingRef.current = handler
    window.addEventListener('deviceorientationabsolute', handler, true)
    window.addEventListener('deviceorientation', handler, true)
  }, [])

  const detachHeading = useCallback(() => {
    if (!headingRef.current || typeof window === 'undefined') return
    window.removeEventListener('deviceorientationabsolute', headingRef.current, true)
    window.removeEventListener('deviceorientation', headingRef.current, true)
    headingRef.current = null
  }, [])

  // 把流绑定到 <video>：等元素就绪后再绑定，避免出现黑屏
  const attachStream = useCallback(async (stream) => {
    const video = videoRef.current
    if (!video) return
    if (video.srcObject !== stream) video.srcObject = stream
    try {
      await video.play()
    } catch {
      // iOS 需要用户手势，此时已经在手势链路里，忽略即可
    }
  }, [])

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setHasTorch(false)
    setTorchOn(false)
  }, [])

  const startCamera = useCallback(async (mode = facing) => {
    if (!secure) {
      setCamera('insecure')
      setNotice('浏览器要求 HTTPS 才能使用摄像头，请通过 https 打开本页')
      return
    }
    if (!supported) {
      setCamera('unsupported')
      setNotice('当前浏览器不支持摄像头调用，请用 Safari 或 Chrome 打开')
      return
    }
    setCamera('requesting')
    setNotice('')
    try {
      stopCamera()
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: mode }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      await attachStream(stream)
      setCamera('active')
      const track = stream.getVideoTracks()[0]
      const caps = track?.getCapabilities?.() ?? {}
      setHasTorch(Boolean(caps.torch))
    } catch (error) {
      const denied = error?.name === 'NotAllowedError' || error?.name === 'SecurityError'
      setCamera(denied ? 'denied' : 'unsupported')
      setNotice(denied
        ? '摄像头权限被拒绝：可在浏览器地址栏的权限设置里允许，或继续使用表盘导航'
        : '无法打开摄像头，可能是设备被占用，已保留表盘导航')
    }
  }, [attachStream, facing, secure, stopCamera, supported])

  // 屏幕常亮（支持时）
  useEffect(() => {
    let released = false
    const request = async () => {
      try {
        if (!navigator.wakeLock?.request) return
        wakeRef.current = await navigator.wakeLock.request('screen')
      } catch {
        wakeRef.current = null
      }
    }
    request()
    return () => {
      released = true
      const lock = wakeRef.current
      wakeRef.current = null
      if (!released) return
      try {
        lock?.release?.()
      } catch {
        // 忽略释放失败
      }
    }
  }, [])

  // 进入即请求摄像头与方向；退出时全部释放
  useEffect(() => {
    let cancelled = false
    const boot = async () => {
      await attachHeading()
      if (cancelled) return
      await startCamera('environment')
    }
    boot()
    return () => {
      cancelled = true
      detachHeading()
      stopCamera()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const switchCamera = async () => {
    const next = facing === 'environment' ? 'user' : 'environment'
    setFacing(next)
    await startCamera(next)
  }

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks?.()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: !torchOn }] })
      setTorchOn((current) => !current)
    } catch {
      setNotice('该设备不支持手电筒')
    }
  }

  const turn = useMemo(() => shortestTurn(bearing, heading), [bearing, heading])
  const arrowRotation = useMemo(() => normalizeArrow(bearing - heading), [bearing, heading])
  const cameraActive = camera === 'active'

  return (
    <section className="ar-nav" role="dialog" aria-modal="true" aria-label="AR 实景导航">
      <div className={`ar-nav-stage ${cameraActive ? 'is-live' : ''}`}>
        <video ref={videoRef} className="ar-nav-video" autoPlay playsInline muted />
        <div className="ar-nav-scrim" aria-hidden="true" />

        <header className="ar-nav-head">
          <span className="ar-nav-title">{cameraActive ? 'AR 实景导航' : 'AR 导航（表盘模式）'}</span>
          <button type="button" className="ar-nav-close" onClick={onClose} aria-label="退出 AR 导航">
            <X size={18} />
          </button>
        </header>

        {!cameraActive && (
          <div className="ar-nav-empty">
            <Compass size={26} />
            <p>
              摄像头未开启，当前用表盘导航。开启后会在实景画面上叠加方向箭头与距离；
              {secure ? '需要你允许摄像头权限。' : '请通过 https 打开本页后重试。'}
            </p>
            <button type="button" className="ar-nav-primary" onClick={() => startCamera(facing)}>
              <Camera size={16} />
              {camera === 'requesting' ? '正在请求摄像头…' : '开启摄像头实景导航'}
            </button>
          </div>
        )}

        {cameraActive && (
          <div className="ar-nav-aim" aria-hidden="true">
            <svg viewBox="0 0 240 240" className="ar-nav-arrow" style={{ transform: `rotate(${arrowRotation}deg)` }}>
              <polygon points="120,18 142,86 120,70 98,86" className={atExit ? 'is-here' : ''} />
            </svg>
            <div className={`ar-nav-ring ${atExit ? 'is-here' : ''}`} style={{ opacity: 0.2 + proximity * 0.6 }} />
          </div>
        )}

        <div className="ar-nav-hud">
          <div className="ar-nav-turn">{route?.ok ? TURN_TEXT(turn) : route?.reason || '等待定位'}</div>
          <div className="ar-nav-target">
            <span>前往</span>
            <strong>{route?.ok ? targetLabel : '通道受阻'}</strong>
          </div>
          {route?.ok && (
            <div className="ar-nav-metrics">
              <div><span>距离</span><strong>{Math.round(route.meters)}<small>米</small></strong></div>
              <div><span>剩余楼层</span><strong>{remainingFloors}</strong></div>
              <div><span>状态</span><strong>{proximityText || '按箭头前进'}</strong></div>
            </div>
          )}
        </div>

        <footer className="ar-nav-foot">
          <span className="ar-nav-source">
            {positionSource}
            {gps?.status === 'active' ? ` · GPS ±${Math.round(gps.accuracy ?? 0)} 米` : ''}
            {headingState === 'active' ? ' · 朝向实时' : headingState === 'denied' ? ' · 朝向未授权' : ''}
          </span>
          <div className="ar-nav-actions">
            <button type="button" onClick={switchCamera} aria-label="切换前后摄像头">
              {cameraActive ? <RefreshCw size={16} /> : <CameraOff size={16} />}
              <span>切换</span>
            </button>
            <button type="button" onClick={toggleTorch} disabled={!hasTorch} aria-label="手电筒">
              <Flashlight size={16} />
              <span>{torchOn ? '关灯' : '照明'}</span>
            </button>
          </div>
        </footer>

        {notice && <div className="ar-nav-notice">{notice}</div>}
        {fire && <div className="ar-nav-alert">撤离中 · 路线每秒重算</div>}
      </div>
    </section>
  )
}

function normalizeArrow(value) {
  return ((value % 360) + 360) % 360
}
