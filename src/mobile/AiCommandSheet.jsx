// 系统端「AI 指挥」设置：把本地大模型的接口放在指挥端配置一次。
//
// 为什么放在系统端：现场部署时，是值守/指挥这台机器上跑 Ollama / LM Studio / vLLM，
// 消防管理员来这里填一次地址，用户端（同一台手机或浏览器）会共用同一份设置，
// 于是断网时两边都走这台本地模型，模型不可用时自动回落本机规则引擎。
//
// 设置存在 localStorage（键在 src/shared/aiClient.js 里统一定义），密钥不出本机。

import { useState } from 'react'
import { Cpu, RefreshCw, Save, Server, TriangleAlert, X } from 'lucide-react'
import { AI_PROVIDERS, aiReachable, readAiSettings, saveAiSettings } from '../shared/aiClient.js'

export default function AiCommandSheet({ onClose, onSaved }) {
  const [form, setForm] = useState(() => readAiSettings())
  const [probe, setProbe] = useState('')
  const [saved, setSaved] = useState('')

  const patch = (next) => setForm((current) => ({ ...current, ...next }))
  const offline = form.provider === 'offline'

  const test = async () => {
    setProbe('testing')
    const ok = await aiReachable(form)
    setProbe(ok ? 'ok' : 'fail')
  }

  const persist = () => {
    const next = saveAiSettings(form)
    setSaved('已保存到本机，用户端会自动使用同一份设置')
    onSaved?.(next)
    window.setTimeout(() => setSaved(''), 3200)
  }

  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <section className="device-sheet ai-sheet" onClick={(event) => event.stopPropagation()}>
        <div className="sheet-handle" />
        <div className="sheet-head">
          <div><span>应急指挥</span><strong>AI 指挥 · 本地模型接口</strong></div>
          <button type="button" onClick={onClose}><X size={18} /></button>
        </div>

        <div className="sheet-tip">
          <Server size={14} />
          把本地大模型部署在现场机器或边缘盒子（Ollama / LM Studio / vLLM 等 OpenAI 兼容端点），
          在这里填一次地址与模型名即可接管指挥决策；<b>断网或端点不可用时自动回落本机规则引擎</b>，不会没有指令。
        </div>

        <label className="ai-sheet-field">
          推理来源
          <select
            value={form.provider}
            onChange={(event) => {
              const preset = AI_PROVIDERS[event.target.value]
              patch({ provider: preset.id, baseUrl: preset.baseUrl, model: preset.model })
            }}
          >
            {Object.values(AI_PROVIDERS).map((preset) => (
              <option key={preset.id} value={preset.id}>{preset.label}</option>
            ))}
          </select>
        </label>
        <p className="ai-sheet-hint">{AI_PROVIDERS[form.provider]?.hint}</p>

        <label className="ai-sheet-field">
          端点地址
          <input
            type="url"
            inputMode="url"
            placeholder="http://127.0.0.1:11434/v1"
            value={form.baseUrl}
            disabled={offline}
            onChange={(event) => patch({ baseUrl: event.target.value })}
          />
        </label>
        <label className="ai-sheet-field">
          模型名
          <input
            type="text"
            placeholder="qwen2.5:7b"
            value={form.model}
            disabled={offline}
            onChange={(event) => patch({ model: event.target.value })}
          />
        </label>
        <label className="ai-sheet-field">
          访问密钥（可选）
          <input
            type="password"
            placeholder="本地端点一般不需要"
            value={form.apiKey}
            disabled={offline}
            onChange={(event) => patch({ apiKey: event.target.value })}
          />
        </label>
        <label className="ai-sheet-check">
          <input
            type="checkbox"
            checked={Boolean(form.vision)}
            disabled={offline}
            onChange={(event) => patch({ vision: event.target.checked })}
          />
          该模型支持读图（视觉模型，用于复核用户上传的疏散路线图）
        </label>

        <div className="ai-sheet-actions">
          <button type="button" className="sheet-save" onClick={persist}><Save size={16} />保存设置</button>
          <button type="button" onClick={test} disabled={offline || probe === 'testing'}>
            <RefreshCw size={15} /> {probe === 'testing' ? '正在测试…' : '测试连接'}
          </button>
          <span className={`ai-probe ${probe === 'ok' ? 'is-ok' : probe === 'fail' ? 'is-fail' : ''}`}>
            {probe === 'ok' ? '端点可用，将由本地模型接管' : probe === 'fail' ? '端点不可用（仍可使用规则引擎）' : '未测试'}
          </span>
        </div>

        {saved && <div className="ai-sheet-saved">{saved}</div>}

        <div className="sheet-tip protocol-tip">
          <Cpu size={14} />
          推荐：8B 级量化模型 + 视觉模型各一（例如 qwen2.5:7b 负责决策、qwen2.5-vl 负责读路线图），现场机器 16GB 内存可跑。
        </div>
        {offline && (
          <div className="sheet-tip">
            <TriangleAlert size={14} />
            当前是本机规则引擎：不调用任何模型，按危险场、路线与现场数据直接给出指令，断网也可用。
          </div>
        )}
      </section>
    </div>
  )
}
