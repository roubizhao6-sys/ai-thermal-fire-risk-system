import { useEffect, useState } from 'react'
import { ArrowUp, ChevronLeft, ChevronRight, TriangleAlert, X } from 'lucide-react'

const HEADING_ANGLE = { 向北: 0, 向东: 90, 向南: 180, 向西: 270, 向上: 0, 向下: 180 }

function headingAngle(title = '') {
  const key = Object.keys(HEADING_ANGLE).find((item) => title.includes(item))
  return HEADING_ANGLE[key] ?? 0
}

// 大字指引模式：现场演示时把手机举在身前即可。
// 真实 AR 叠加层需要 iOS 端 ARKit / RoomPlan，Web 端先用方向箭头替代。
export default function FollowMode({ route, fire, onClose }) {
  const steps = route?.ok ? route.steps : []
  const [index, setIndex] = useState(0)

  useEffect(() => {
    setIndex(0)
  }, [route?.exitId, fire?.nodeId])

  const safeIndex = Math.min(index, Math.max(steps.length - 1, 0))
  const step = steps[safeIndex]

  return (
    <div className="follow-overlay">
      <header className="follow-head">
        <span>{fire ? '火警逃生中' : '常规路线预览'}</span>
        <button type="button" onClick={onClose} aria-label="退出跟随模式"><X size={20} /></button>
      </header>

      {!step && (
        <div className="follow-empty">
          <TriangleAlert size={34} />
          <strong>暂无可用路线</strong>
          <p>{route?.reason || '请检查当前位置设置'}</p>
        </div>
      )}

      {step && (
        <>
          <div className="follow-arrow-wrap">
            <div className="follow-arrow" style={{ transform: `rotate(${headingAngle(step.title)}deg)` }}>
              <ArrowUp size={132} strokeWidth={2.4} />
            </div>
            <div className="follow-pulse" />
          </div>

          <div className="follow-step">
            <span className="follow-counter">第 {safeIndex + 1} / {steps.length} 步</span>
            <h2>{step.title}</h2>
            <p>{step.detail}</p>
          </div>

          {route.warnings?.length > 0 && (
            <div className="follow-warning"><TriangleAlert size={15} />{route.warnings[0]}</div>
          )}

          <div className="follow-progress">
            {steps.map((item, itemIndex) => (
              <i key={item.key} className={itemIndex <= safeIndex ? 'done' : ''} />
            ))}
          </div>

          <div className="follow-actions">
            <button type="button" onClick={() => setIndex((current) => Math.max(0, current - 1))} disabled={safeIndex === 0}>
              <ChevronLeft size={19} />上一步
            </button>
            <button
              type="button"
              className="primary"
              onClick={() => setIndex((current) => Math.min(steps.length - 1, current + 1))}
              disabled={safeIndex >= steps.length - 1}
            >
              下一步<ChevronRight size={19} />
            </button>
          </div>

          <p className="follow-note">AR 实景指引需要 iPhone 的 ARKit / RoomPlan，将在 iOS 版本中实现，Web 端以方向箭头替代。</p>
        </>
      )}
    </div>
  )
}
