// 系统端的三阶段面板：预防判定 / 救援信息 / 灾后生命体征搜索
//
// 对应团队定的 AI 三个工作阶段：
//   阶段一（预防）：视觉 + 烟 + 热三路证据融合，回答"要不要报警"，并生成给周边居民的通知；
//   阶段二（处置）：把用户端二元问答的结果汇总给救援端（配合三维模型定位到楼栋楼层）；
//   阶段三（搜救）：红外扫描残余热场，找人体温度特征，给出优先排查顺序。
//
// 所有判定都有本机规则版本（离线可用），配了本地模型时可以让模型复核一遍。

import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  BellRing,
  Copy,
  Cpu,
  Flame,
  Info,
  Megaphone,
  Radar,
  ShieldAlert,
  Users,
} from 'lucide-react'
import { aiCommand, readAiSettings } from '../shared/aiClient.js'
import { buildNeighborNotice, fusePreventionSignals, summarizeRescueBrief } from '../shared/aiPhases.js'
import { createAfterFireFrame, describeVitalSigns, scanVitalSigns } from '../shared/vitalSigns.js'
import { readUserStatuses } from '../user/binaryDialogue.js'
import { temperatureColor } from './thermal.js'

// ---------------------------------------------------------------- 阶段一：预防判定
export function PreventionPanel({ result, thresholds, history = [], floor = 4, onAlarm, onNotify }) {
  const [visionFlame, setVisionFlame] = useState(0)
  const [visionSmoke, setVisionSmoke] = useState(0)
  const [aiReview, setAiReview] = useState(null)
  const [busy, setBusy] = useState(false)

  // 温升速率用最近一段历史估计（有真实设备时由采样帧提供）
  const ror = useMemo(() => {
    const list = history.filter((frame) => Number.isFinite(frame?.maxTemp)).slice(-6)
    if (list.length < 2) return 0
    const first = list[0]
    const last = list[list.length - 1]
    const seconds = Math.max(1, (last.at ?? 0) - (first.at ?? 0)) / 1000
    return Math.max(0, (last.maxTemp - first.maxTemp) / (seconds / 60))
  }, [history])

  const decision = useMemo(() => fusePreventionSignals({
    thermal: {
      maxTemp: result?.maxTemp,
      ror,
      sustainedSec: history.length ? Math.max(0, ((history.at(-1)?.at ?? 0) - (history[0]?.at ?? 0)) / 1000) : 0,
      multiNode: false,
    },
    visual: { flame: visionFlame, smoke: visionSmoke },
    thresholds,
  }), [result?.maxTemp, ror, history, visionFlame, visionSmoke, thresholds])

  const notice = useMemo(() => buildNeighborNotice(decision, { floor, location: '教学楼' }), [decision, floor])
  const levelText = decision.level === 'alarm' ? '判定火警' : decision.level === 'watch' ? '关注复核' : '监测正常'

  const runAiReview = async () => {
    setBusy(true)
    const outcome = await aiCommand({
      phase: 'prevention',
      prevention: { decision, notice, location: '教学楼' },
      position: { floor },
    }, readAiSettings())
    setAiReview(outcome)
    setBusy(false)
  }

  return (
    <section className={`mobile-card prevention-card level-${decision.level}`}>
      <div className="card-head">
        <div><strong>阶段一 · 火灾前预防判定</strong><small>视觉 + 烟雾 + 热像三路证据融合，决定是否报警</small></div>
        <ShieldAlert size={18} />
      </div>

      <div className="prevention-verdict">
        <span className={`prevention-badge tone-${decision.level}`}>{levelText}</span>
        <strong>{Math.round(decision.score * 100)}</strong>
        <small>/100 判据得分 · 置信度 {Math.round(decision.confidence * 100)}% · 有效证据 {decision.evidence.sources} 路</small>
      </div>

      <ul className="prevention-reasons">
        {decision.reasons.map((reason) => <li key={reason}>{reason}</li>)}
      </ul>
      {decision.missing.length > 0 && (
        <p className="situation-note"><Info size={12} />{decision.missing.join('；')}（单路证据不触发报警，避免误报）</p>
      )}

      <div className="prevention-demo">
        <label>
          <span>视觉火焰（演示输入）</span>
          <input type="range" min="0" max="1" step="0.05" value={visionFlame} onChange={(event) => setVisionFlame(Number(event.target.value))} />
          <b>{Math.round(visionFlame * 100)}%</b>
        </label>
        <label>
          <span>烟雾（演示输入）</span>
          <input type="range" min="0" max="1" step="0.05" value={visionSmoke} onChange={(event) => setVisionSmoke(Number(event.target.value))} />
          <b>{Math.round(visionSmoke * 100)}%</b>
        </label>
        <p className="situation-note">
          <Info size={12} />热像来自当前检测帧；火焰与烟雾置信度在真实部署里由摄像头视觉模型给出，这里用滑杆代替，便于演示"单路不报警、三路才确认"。
        </p>
      </div>

      <div className="prevention-notice">
        <span><Megaphone size={13} />给周边居民的通知</span>
        <p>{notice}</p>
      </div>

      <div className="prevention-actions">
        <button type="button" onClick={() => onNotify?.(notice)}><BellRing size={14} />发送周边通知</button>
        <button type="button" onClick={runAiReview} disabled={busy}><Cpu size={14} />{busy ? 'AI 复核中…' : 'AI 复核判定'}</button>
        {decision.alarm && onAlarm && (
          <button type="button" className="is-danger" onClick={onAlarm}><Flame size={14} />触发报警</button>
        )}
      </div>

      {aiReview && (
        <p className={`prevention-ai ${aiReview.source === 'local-model' ? 'is-model' : ''}`}>
          <Cpu size={13} />
          <b>{aiReview.source === 'local-model' ? '本地模型' : '本机规则'}</b>
          {aiReview.summary}｜{aiReview.action}
        </p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 阶段二：救援信息
export function RescueBriefPanel({ fire, position, crowd, blocked = [], rescueBrief }) {
  const [statuses, setStatuses] = useState(() => readUserStatuses())

  useEffect(() => {
    const refresh = () => setStatuses(readUserStatuses())
    const timer = window.setInterval(refresh, 4000)
    window.addEventListener('storage', refresh)
    return () => {
      window.clearInterval(timer)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const lines = summarizeRescueBrief({ fire, position, crowd, blocked, userStatus: statuses })
  const needingHelp = statuses.filter((item) => item.needsHelp)

  return (
    <section className="mobile-card rescue-card">
      <div className="card-head">
        <div><strong>阶段二 · 救援端楼内现况</strong><small>起火位置、封控通道与用户在楼里上报的情况</small></div>
        <Radar size={18} />
      </div>
      <ul className="rescue-lines">
        {lines.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {rescueBrief && (
        <p className="rescue-ai"><Cpu size={13} /><b>{rescueBrief.source === 'local-model' ? '本地模型' : '本机规则'}</b>{rescueBrief.summary}{rescueBrief.rescue ? `｜${rescueBrief.rescue}` : ''}</p>
      )}
      <div className="rescue-list">
        <strong><Users size={13} />用户端上报（{statuses.length}）</strong>
        {statuses.length === 0 && <p className="situation-note"><Info size={12} />还没有收到用户端上报：在用户端触发火警并回答二元问答后，这里会实时出现楼层、位置与是否有人需要帮助。</p>}
        {statuses.map((item) => (
          <div className={`rescue-row ${item.needsHelp ? 'needs-help' : ''}`} key={item.id}>
            <span>{item.needsHelp ? '需帮助' : '可自主撤离'}</span>
            <div>
              <strong>{item.floor ?? '?'} 楼 {item.spot ?? ''}</strong>
              <small>{item.advice}</small>
              {item.answers?.length > 0 && <em>{item.answers.join(' · ')}</em>}
            </div>
          </div>
        ))}
      </div>
      {needingHelp.length > 0 && (
        <p className="rescue-alert"><ShieldAlert size={13} />优先排查：{needingHelp.map((item) => `${item.floor} 楼 ${item.spot}`).join('、')}</p>
      )}
    </section>
  )
}

// ---------------------------------------------------------------- 阶段三：灾后生命体征搜索
export function VitalSignsPanel({ floor = 4, aiSettings }) {
  const [frame, setFrame] = useState(null)
  const [scan, setScan] = useState(null)
  const [aiReview, setAiReview] = useState(null)
  const [busy, setBusy] = useState(false)

  const runScan = async (rescan = false) => {
    setBusy(true)
    const nextFrame = createAfterFireFrame({ seed: rescan ? Date.now() % 100000 : 20260915 })
    setFrame(nextFrame)
    const result = scanVitalSigns(nextFrame)
    setScan(result)
    const described = describeVitalSigns(result, { floor })
    const outcome = await aiCommand({
      phase: 'aftermath',
      vital: { result, described },
      position: { floor },
    }, aiSettings ?? readAiSettings())
    setAiReview(outcome)
    setBusy(false)
  }

  return (
    <section className="mobile-card vital-card">
      <div className="card-head">
        <div><strong>阶段三 · 灾后生命体征搜索</strong><small>火灭后用红外找人体温度特征，辅助后续救援</small></div>
        <Activity size={18} />
      </div>

      <div className="vital-actions">
        <button type="button" className="vital-scan" onClick={() => runScan(false)} disabled={busy}>
          <Radar size={15} />{busy ? '扫描中…' : '开始红外扫描'}
        </button>
        <button type="button" onClick={() => runScan(true)} disabled={busy}>换一帧重扫</button>
      </div>

      {frame && (
        <div className="vital-stage">
          <svg viewBox="0 0 32 24" preserveAspectRatio="none" className="vital-grid" role="img" aria-label="灾后热像扫描结果">
            {frame.temperatures.map((temp, index) => {
              const x = index % frame.width
              const y = Math.floor(index / frame.width)
              const [r, g, b] = temperatureColor(temp / 90)
              return <rect key={index} x={x} y={y} width="1" height="1" fill={`rgb(${r},${g},${b})`} />
            })}
            {(scan?.candidates ?? []).map((item, index) => (
              <g key={`cand-${index}`}>
                <rect
                  x={item.x * frame.width - 2}
                  y={item.y * frame.height - 2}
                  width="4"
                  height="4"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="0.5"
                />
              </g>
            ))}
          </svg>
          <div className="vital-meta">
            <span>环境基准 {scan?.ambient}°C</span>
            <span>已排除余温格 {scan?.burnedCells}</span>
            <span>人体温度带 {scan?.band?.min}–{scan?.band?.max}°C</span>
          </div>
        </div>
      )}

      {scan && (
        <div className="vital-result">
          {(scan.candidates ?? []).length === 0 ? (
            <p className="situation-note"><Info size={12} />本帧未发现符合人体温度特征的区域（仍然需要人工逐间搜索）。</p>
          ) : (
            scan.candidates.map((item, index) => (
              <div className="vital-row" key={`vital-${index}`}>
                <span className="vital-index">{index + 1}</span>
                <div>
                  <strong>{item.meanTemp}°C · 置信度 {Math.round(item.confidence * 100)}%</strong>
                  <small>图内坐标 ({item.x.toFixed(2)}, {item.y.toFixed(2)}) · {item.cells} 格 · 与环境差 {item.contrast}°C</small>
                </div>
                {item.needsHumanCheck && <em>需人工复核</em>}
              </div>
            ))
          )}
        </div>
      )}

      {aiReview && (
        <p className="rescue-ai">
          <Cpu size={13} />
          <b>{aiReview.source === 'local-model' ? '本地模型' : '本机规则'}</b>
          {aiReview.summary}｜{aiReview.action}
        </p>
      )}
      <p className="situation-note">
        <Info size={12} />红外只能看到表面温度：被遮挡、被掩埋的人员看不到，算法结果只作为搜救辅助，必须人工复核。
      </p>
    </section>
  )
}

export function copyNotice(text) {
  if (typeof navigator === 'undefined' || !navigator.clipboard) return Promise.resolve(false)
  return navigator.clipboard.writeText(text).then(() => true).catch(() => false)
}

export const NOTICE_COPY_ICON = Copy
