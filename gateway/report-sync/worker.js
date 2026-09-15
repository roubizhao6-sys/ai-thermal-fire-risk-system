// 用户端 → 系统端 跨设备同步（Cloudflare Worker + KV）
// 用户端上报隐患/求助 → POST /report；系统端 GET /reports 拉取。
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, x-sync-token',
}
const json = (obj, status = 200) => new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    const url = new URL(request.url)

    if (env.SYNC_TOKEN && request.headers.get('x-sync-token') !== env.SYNC_TOKEN) {
      return json({ error: 'unauthorized' }, 401)
    }

    if (url.pathname === '/report' && request.method === 'POST') {
      let body = {}
      try { body = await request.json() } catch {}
      const type = String(body.type || 'hazard')
      const payload = body.payload || {}
      const at = Date.now()
      const id = (crypto.randomUUID && crypto.randomUUID()) || `${at}-${Math.random().toString(36).slice(2)}`
      const record = { id, type, at, payload }
      await env.REPORTS.put(`report:${at}:${id}`, JSON.stringify(record))
      return json({ ok: true, id })
    }

    if (url.pathname === '/reports' && request.method === 'GET') {
      const list = await env.REPORTS.list({ prefix: 'report:', limit: 200 })
      const items = []
      for (const key of list.keys) {
        const value = await env.REPORTS.get(key.name)
        if (value) { try { items.push(JSON.parse(value)) } catch {} }
      }
      items.sort((a, b) => b.at - a.at)
      return json({ reports: items.slice(0, 50) })
    }

    if (url.pathname === '/health') return json({ ok: true })

    return new Response('Not Found', { status: 404, headers: CORS })
  },
}
