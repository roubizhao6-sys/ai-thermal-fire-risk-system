// AI 火警精灵后端代理（Cloudflare Worker）
// 把大模型 API Key 保存在服务端，前端只调用本代理，不暴露 Key。
export default {
  async fetch(request, env) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, x-proxy-token',
    }

    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: cors })

    const url = new URL(request.url)
    if (url.pathname !== '/chat') return new Response('Not Found', { status: 404, headers: cors })

    // 可选：用一个共享令牌防止陌生人滥用（对应前端 x-proxy-token）
    if (env.PROXY_TOKEN && request.headers.get('x-proxy-token') !== env.PROXY_TOKEN) {
      return new Response(JSON.stringify({ error: 'unauthorized' }), { status: 401, headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    let body = {}
    try { body = await request.json() } catch {}
    const messages = Array.isArray(body.messages) && body.messages.length
      ? body.messages
      : [{ role: 'user', content: String(body.message || '你好') }]

    const base = (env.LLM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3').replace(/\/+$/, '')
    const model = env.LLM_MODEL || 'doubao-1-5-pro-32k-250115'
    const apiKey = env.LLM_API_KEY || ''
    if (!apiKey) return new Response(JSON.stringify({ error: 'LLM_API_KEY not configured on server' }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } })

    try {
      const upstream = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({ model, messages, temperature: 0.4 }),
      })
      const data = await upstream.json().catch(() => ({}))
      if (!upstream.ok) {
        return new Response(JSON.stringify({ error: data?.error?.message || `upstream ${upstream.status}` }), { status: upstream.status, headers: { ...cors, 'Content-Type': 'application/json' } })
      }
      const text = data.choices?.[0]?.message?.content || data.choices?.[0]?.text || ''
      return new Response(JSON.stringify({ reply: text }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message || 'upstream error' }), { status: 502, headers: { ...cors, 'Content-Type': 'application/json' } })
    }
  },
}
