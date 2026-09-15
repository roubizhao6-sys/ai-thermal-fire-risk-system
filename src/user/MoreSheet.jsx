// 「更多」面板：逃生路线图（上传 / 识别 / 本地保存）、AI 指挥设置、端切换入口。

import { useEffect, useMemo, useRef, useState } from 'react'
import { Cpu, DoorOpen, Image as ImageIcon, Link2, Save, Sparkles, Trash2, Upload } from 'lucide-react'
import { AI_PROVIDERS, aiReachable } from '../shared/aiClient.js'
import {
  aiReviewPlan,
  analyzePlanImage,
  applyPlanRecognition,
  buildPlanRoute,
  deletePlan,
  fileToDataUrl,
  listPlans,
  savePlan,
} from './floorplan.js'

export default function MoreSheet({
  onClose,
  floor,
  aiSettings,
  onAiSettingsChange,
  plans,
  onPlansChange,
  activePlanId,
  onActivePlanChange,
}) {
  const [tab, setTab] = useState('plan')
  const [draft, setDraft] = useState(null)
  const [busy, setBusy] = useState('')
  const [notice, setNotice] = useState('')
  const [probe, setProbe] = useState(null)
  const fileRef = useRef(null)
  const imageRef = useRef(null)

  const savedActive = useMemo(
    () => plans.find((plan) => plan.id === activePlanId) ?? plans.find((plan) => plan.floor === floor) ?? null,
    [plans, activePlanId, floor],
  )

  useEffect(() => {
    if (!notice) return undefined
    const timer = window.setTimeout(() => setNotice(''), 3600)
    return () => window.clearTimeout(timer)
  }, [notice])

  const aiConfigured = aiSettings.provider !== 'offline' && Boolean(aiSettings.baseUrl)

  // 浏览器内识别：先把"哪里像出口"找出来（离线也能跑）
  const analyze = async (dataUrl, name) => {
    setBusy('analyze')
    try {
      const result = await analyzePlanImage(dataUrl)
      const base = {
        id: `plan-${Date.now()}`,
        name,
        floor,
        dataUrl,
        widthMeters: 50,
        upBearing: 0,
        start: { x: 0.5, y: 0.5 },
        exit: result.exits[0] ?? { x: 0.5, y: 0.08 },
        exits: (result.exits ?? []).map((item, index) => ({ ...item, label: `候选出口 ${index + 1}` })),
        extinguishers: result.extinguishers,
        ratios: result.ratios,
        source: result.exits?.length ? 'local-vision' : 'manual',
        exitLabel: '路线图出口',
        ai: null,
      }
      setDraft(base)
      setNotice(result.exits?.length
        ? `识别到 ${result.exits.length} 处候选出口（绿色疏散指示），已生成草稿路线，可点图调整起点、点绿点改出口`
        : '没有识别到绿色出口标记，请手动点选出口位置后再保存')
      // 配了本地模型就顺手复核一次：让它给出口起名、结合火源推荐走哪个
      if (aiConfigured) await runAiReview(base)
    } catch (error) {
      setNotice(`识别失败：${error.message}`)
    } finally {
      setBusy('')
    }
  }

  // 本地模型复核：位置仍用启发式结果，模型只负责命名与推荐，失败就退回原草稿
  const runAiReview = async (target) => {
    if (!target) return
    if (!aiConfigured) {
      setNotice('还没有配置本地模型：可在「AI 指挥」里填端点，或直接用当前识别结果')
      return
    }
    setBusy('ai')
    setNotice('正在让本地模型复核这张路线图…')
    const recognition = await aiReviewPlan({
      dataUrl: target.dataUrl,
      analysis: { exits: target.exits, extinguishers: target.extinguishers },
      floor,
      settings: aiSettings,
    })
    setBusy('')
    if (!recognition.ok) {
      setNotice(`本地模型复核未成功（${recognition.reason ?? '未知原因'}），继续使用浏览器内的识别结果`)
      return
    }
    const merged = applyPlanRecognition({ exits: target.exits }, recognition)
    setDraft({
      ...target,
      exits: merged.exits,
      exit: merged.chosen ? { x: merged.chosen.x, y: merged.chosen.y } : target.exit,
      exitLabel: merged.chosen?.label || target.exitLabel,
      ai: {
        source: 'local-model',
        vision: recognition.vision,
        model: recognition.model,
        notes: recognition.notes,
        corridor: recognition.corridor,
        rooms: recognition.rooms,
      },
    })
    setNotice(`本地模型已复核：推荐「${merged.chosen?.label || '出口'}」${recognition.vision ? '（读图）' : '（按识别摘要）'}`)
  }

  const onPickFile = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    const dataUrl = await fileToDataUrl(file)
    await analyze(dataUrl, file.name.replace(/\.[^.]+$/, ''))
  }

  const useSample = async () => {
    const dataUrl = await (await fetch('./floorplan-sample.png')).blob().then(fileToDataUrl)
    await analyze(dataUrl, '示例：教学楼标准层')
  }

  // 点图设置起点；若点到的位置靠近某个候选出口，则把该出口设为终点
  const onImageTap = (event) => {
    if (!draft || !imageRef.current) return
    const rect = imageRef.current.getBoundingClientRect()
    const point = {
      x: Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    }
    const nearExit = draft.exits?.find((item) => Math.hypot(item.x - point.x, item.y - point.y) < 0.05)
    if (nearExit) {
      setDraft({ ...draft, exit: { x: nearExit.x, y: nearExit.y } })
      setNotice('已把该绿色标记设为出口')
      return
    }
    setDraft({ ...draft, start: point })
    setNotice('已把这里设为我的起点')
  }

  const persistDraft = async () => {
    if (!draft) return
    const record = await savePlan({ ...draft, active: true })
    const next = await listPlans()
    onPlansChange(next)
    onActivePlanChange(record.id)
    setDraft(null)
    setNotice('已保存到本机（IndexedDB），火警时会按这张图指引')
  }

  const removePlan = async (id) => {
    await deletePlan(id)
    const next = await listPlans()
    onPlansChange(next)
    if (activePlanId === id) onActivePlanChange(next[0]?.id ?? null)
    setNotice('已删除该路线图')
  }

  const testAi = async () => {
    setProbe('testing')
    const ok = await aiReachable(aiSettings)
    setProbe(ok ? 'ok' : 'fail')
    setNotice(ok ? '已连上本地模型端点' : '连不上该端点，将使用本机规则引擎')
  }

  const draftRoute = draft ? buildPlanRoute(draft) : null

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section
        className="position-sheet more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="更多设置"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="sheet-handle" />
        <div className="more-tabs" role="tablist">
          <button type="button" role="tab" aria-selected={tab === 'plan'} className={tab === 'plan' ? 'active' : ''} onClick={() => setTab('plan')}>
            <DoorOpen size={15} /> 逃生路线图
          </button>
          <button type="button" role="tab" aria-selected={tab === 'ai'} className={tab === 'ai' ? 'active' : ''} onClick={() => setTab('ai')}>
            <Cpu size={15} /> AI 指挥
          </button>
          <button type="button" role="tab" aria-selected={tab === 'swap'} className={tab === 'swap' ? 'active' : ''} onClick={() => setTab('swap')}>
            <Link2 size={15} /> 端切换
          </button>
        </div>

        {notice && <div className="more-notice">{notice}</div>}

        {tab === 'plan' && (
          <div className="more-body">
            <p className="more-hint">
              上传本层的传统疏散路线图，识别后存在手机里；火警时按图给出方向与步序，没网络也能用。
              出口位置由浏览器内识别给出；若在「AI 指挥」里配了本地模型，会再把图交给本地模型复核一遍（出口命名、推荐走哪个）。
              两种方式都在本机完成，图片不会上传到任何服务器。
            </p>
            <div className="more-actions">
              <button type="button" className="more-primary" onClick={() => fileRef.current?.click()} disabled={busy === 'analyze'}>
                <Upload size={15} /> {busy === 'analyze' ? '正在识别…' : '上传路线图'}
              </button>
              <button type="button" onClick={useSample} disabled={busy === 'analyze'}>
                <ImageIcon size={15} /> 使用示例图
              </button>
            </div>
            <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={onPickFile} />

            {draft && (
              <div className="plan-editor">
                <div className="plan-canvas" onClick={onImageTap}>
                  <img ref={imageRef} src={draft.dataUrl} alt="逃生路线图" />
                  {(draft.exits ?? []).map((item, index) => (
                    <button
                      key={`exit-${index}`}
                      type="button"
                      className={`plan-exit ${Math.hypot(item.x - draft.exit.x, item.y - draft.exit.y) < 0.01 ? 'is-active' : ''}`}
                      style={{ left: `${item.x * 100}%`, top: `${item.y * 100}%` }}
                      onClick={(event) => {
                        event.stopPropagation()
                        setDraft({ ...draft, exit: { x: item.x, y: item.y } })
                      }}
                      aria-label={`候选出口 ${index + 1}`}
                    />
                  ))}
                  <span className="plan-start" style={{ left: `${draft.start.x * 100}%`, top: `${draft.start.y * 100}%` }} />
                  {draftRoute && (
                    <svg className="plan-route" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                      <polyline
                        points={draftRoute.points.map((point) => `${point.x * 100},${point.y * 100}`).join(' ')}
                      />
                    </svg>
                  )}
                </div>
                <p className="plan-tip">
                  点图上任意位置设置<b>我的起点</b>；点绿色标记选择<b>出口</b>。当前草稿：
                  {draftRoute && draftRoute.instructions.length ? draftRoute.instructions[0].text : '等待起点与出口'}，
                  全程约 {Math.round(draftRoute?.totalMeters ?? 0)} 米。
                </p>
                {(draft.exits ?? []).length > 0 && (
                  <div className="plan-exit-list">
                    <span className="plan-exit-label">候选出口</span>
                    {(draft.exits ?? []).map((item, index) => (
                      <button
                        key={`exit-pick-${index}`}
                        type="button"
                        className={Math.hypot(item.x - draft.exit.x, item.y - draft.exit.y) < 0.01 ? 'is-active' : ''}
                        onClick={() => setDraft({ ...draft, exit: { x: item.x, y: item.y }, exitLabel: item.label || `候选出口 ${index + 1}` })}
                      >
                        {index + 1}. {item.label || `候选出口 ${index + 1}`}
                      </button>
                    ))}
                  </div>
                )}
                {draft.ai && (
                  <p className="plan-ai-note">
                    <Sparkles size={13} />
                    <b>本地模型复核</b>
                    {draft.ai.vision ? '（读图）' : '（按识别摘要）'}
                    {draft.ai.corridor ? ` · 主通道：${draft.ai.corridor}` : ''}
                    {draft.ai.notes ? ` · ${draft.ai.notes}` : ''}
                  </p>
                )}
                <div className="plan-fields">
                  <label>
                    整图宽度代表
                    <input
                      type="number"
                      min="5"
                      max="400"
                      value={draft.widthMeters}
                      onChange={(event) => setDraft({ ...draft, widthMeters: Number(event.target.value) })}
                    />
                    米
                  </label>
                  <label>
                    图上方朝向
                    <select value={draft.upBearing} onChange={(event) => setDraft({ ...draft, upBearing: Number(event.target.value) })}>
                      <option value={0}>北</option>
                      <option value={90}>东</option>
                      <option value={180}>南</option>
                      <option value={270}>西</option>
                    </select>
                  </label>
                </div>
                <div className="more-actions">
                  <button type="button" className="more-primary" onClick={persistDraft}><Save size={15} /> 保存到本机</button>
                  <button type="button" onClick={() => runAiReview(draft)} disabled={busy === 'ai' || busy === 'analyze'}>
                    <Sparkles size={15} /> {busy === 'ai' ? '复核中…' : 'AI 复核'}
                  </button>
                  <button type="button" onClick={() => setDraft(null)}>放弃</button>
                </div>
              </div>
            )}

            <div className="plan-list">
              <strong>已保存的路线图（{plans.length}）</strong>
              {plans.length === 0 && <p className="more-hint">还没有保存的路线图。</p>}
              {plans.map((plan) => (
                <div className={`plan-row ${plan.id === savedActive?.id ? 'is-active' : ''}`} key={plan.id}>
                  <div>
                    <strong>{plan.name}</strong>
                    <small>
                      {plan.floor ?? floor} 楼 · {plan.source === 'local-vision' ? '浏览器内识别' : '手动选点'}
                      {plan.ai ? ' · 本地模型已复核' : ''}
                      {plan.exitLabel ? ` · 出口：${plan.exitLabel}` : ''}
                      {' · '}{new Date(plan.updatedAt ?? plan.createdAt).toLocaleDateString()}
                    </small>
                  </div>
                  <button type="button" onClick={() => onActivePlanChange(plan.id)} aria-pressed={plan.id === savedActive?.id}>
                    {plan.id === savedActive?.id ? '使用中' : '设为当前'}
                  </button>
                  <button type="button" aria-label="删除" onClick={() => removePlan(plan.id)}><Trash2 size={15} /></button>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'ai' && (
          <div className="more-body">
            <p className="more-hint">
              团队可在现场机器或边缘盒子部署本地大模型（Ollama / LM Studio / vLLM 等 OpenAI 兼容端点），
              填入地址后由本地模型接管指挥决策；<b>断网或没配模型时，系统自动使用本机规则引擎</b>，不会没有指令。
              密钥只保存在本机。
            </p>
            <label className="ai-field">
              推理来源
              <select
                value={aiSettings.provider}
                onChange={(event) => {
                  const preset = AI_PROVIDERS[event.target.value]
                  onAiSettingsChange({ provider: preset.id, baseUrl: preset.baseUrl, model: preset.model })
                }}
              >
                {Object.values(AI_PROVIDERS).map((preset) => (
                  <option key={preset.id} value={preset.id}>{preset.label}</option>
                ))}
              </select>
            </label>
            <p className="ai-preset-hint">{AI_PROVIDERS[aiSettings.provider]?.hint}</p>
            <p className="ai-preset-hint">
              现场用法：在本机跑 <b>node tools/local-ai-server.mjs</b>，用 http://127.0.0.1:4173 打开本页，
              端点就能填相对路径 <b>/ai/v1</b>（同源转发到本地模型）。公网 HTTPS 页面会拦截 http 端点，所以别在演示站上填 127.0.0.1。
            </p>
            <label className="ai-field">
              端点地址
              <input
                type="url"
                inputMode="url"
                placeholder="http://127.0.0.1:11434/v1"
                value={aiSettings.baseUrl}
                onChange={(event) => onAiSettingsChange({ baseUrl: event.target.value })}
                disabled={aiSettings.provider === 'offline'}
              />
            </label>
            <label className="ai-field">
              模型名
              <input
                type="text"
                placeholder="qwen2.5:7b"
                value={aiSettings.model}
                onChange={(event) => onAiSettingsChange({ model: event.target.value })}
                disabled={aiSettings.provider === 'offline'}
              />
            </label>
            <label className="ai-field">
              访问密钥（可选）
              <input
                type="password"
                placeholder="留空表示本地端点不需要密钥"
                value={aiSettings.apiKey}
                onChange={(event) => onAiSettingsChange({ apiKey: event.target.value })}
                disabled={aiSettings.provider === 'offline'}
              />
            </label>
            <label className="ai-check">
              <input
                type="checkbox"
                checked={Boolean(aiSettings.vision)}
                onChange={(event) => onAiSettingsChange({ vision: event.target.checked })}
                disabled={aiSettings.provider === 'offline'}
              />
              该模型支持读图（视觉模型，如 qwen2.5-vl / llava / minicpm-v）
            </label>
            <p className="ai-preset-hint">
              勾上后，上传路线图时会把缩小后的图片一并发给这个本地端点做识别；不勾只发文字摘要。
              两者都只在你填的地址内网流转，图片不会上传到任何服务器。
            </p>
            <div className="more-actions">
              <button type="button" className="more-primary" onClick={testAi} disabled={probe === 'testing' || aiSettings.provider === 'offline'}>
                <Cpu size={15} /> {probe === 'testing' ? '正在测试…' : '测试连接'}
              </button>
              <span className={`ai-probe ${probe === 'ok' ? 'is-ok' : probe === 'fail' ? 'is-fail' : ''}`}>
                {probe === 'ok' ? '端点可用' : probe === 'fail' ? '端点不可用（仍可用规则引擎）' : '未测试'}
              </span>
            </div>
          </div>
        )}

        {tab === 'swap' && (
          <div className="more-body">
            <p className="more-hint">
              用户端给被疏散的人看（方向、距离、AR 与路线图）；系统端给值守与指挥人员看（检测、监控、报警、人流与三维校园）。
              两边数据同源，切换不会丢状态。
            </p>
            <a className="more-link" href="./mobile-app.html">
              <Link2 size={16} /> 切换到系统端
            </a>
            <p className="more-hint">也可以把两个地址分别加入主屏图标，现场一人一机同时使用。</p>
          </div>
        )}

        <button className="done-button" type="button" onClick={onClose}>完成</button>
      </section>
    </div>
  )
}
