// 现场本地部署用的静态服务器 + 本地大模型代理
//
// 为什么需要它：
//   GitHub Pages 是 HTTPS，浏览器会拦截页面里对 http://127.0.0.1:11434 的请求（混合内容）。
//   现场想要「断网也能用 AI 指挥」，就用这个脚本在本机把两个东西挂在同一个 http 源上：
//     · 站点本身（dist 目录）        → http://127.0.0.1:4173/user-app.html
//     · 本地大模型的反向代理 /ai/*   → 转发到 Ollama / LM Studio / vLLM 的 OpenAI 兼容端点
//   于是用户端与系统端都可以把「端点地址」填成相对路径 /ai/v1，不存在跨域与混合内容问题。
//
// 用法：
//   node tools/local-ai-server.mjs                 # 默认转发到 http://127.0.0.1:11434/v1（Ollama）
//   node tools/local-ai-server.mjs --upstream http://127.0.0.1:1234/v1 --port 4173
//
// 同时它还是「局域网事件中继」：手机/电脑只要连现场热点并打开这个站点，
// 用户端与系统端就能通过 /sync/* 交换火情与求助事件 —— **不需要互联网**。
//    POST /sync/publish          发布一条事件
//    GET  /sync/events?since=N   取第 N 条之后的事件（长轮询，最多等 wait 毫秒）
//    GET  /sync/health           中继状态（前端用它判断"局域网链路是否可用"）

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { networkInterfaces } from 'node:os'
import { extname, join, normalize, resolve } from 'node:path'

const args = process.argv.slice(2)
const readArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(readArg('--port', '4173'))
const upstream = readArg('--upstream', 'http://127.0.0.1:11434/v1').replace(/\/$/, '')
const dist = resolve(readArg('--dist', 'dist'))
// 默认监听所有网卡：手机连现场热点后要能直接打开这个站点（断网也能用中继）
const host = readArg('--host', '0.0.0.0')

function lanAddresses() {
  const result = []
  const interfaces = networkInterfaces()
  Object.values(interfaces).forEach((list) => {
    (list ?? []).forEach((item) => {
      if (item.family === 'IPv4' && !item.internal) result.push(item.address)
    })
  })
  return result
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.glb': 'model/gltf-binary',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
}

async function serveStatic(request, response, pathname) {
  const relative = pathname === '/' ? '/mobile-app.html' : pathname
  const target = join(dist, normalize(decodeURIComponent(relative)).replace(/^(\.\.[/\\])+/, ''))
  try {
    const info = await stat(target)
    if (info.isDirectory()) throw new Error('is-directory')
    const body = await readFile(target)
    response.writeHead(200, { 'Content-Type': MIME[extname(target)] ?? 'application/octet-stream' })
    response.end(body)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('404 · 没找到这个文件。先跑一次 npm run build / pnpm build 生成 dist 目录。')
  }
}

async function proxyAi(request, response) {
  const suffix = request.url.replace(/^\/ai/, '')
  const target = `${upstream}${suffix}`
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  try {
    const upstreamResponse = await fetch(target, {
      method: request.method,
      headers: {
        'Content-Type': request.headers['content-type'] ?? 'application/json',
        ...(request.headers.authorization ? { Authorization: request.headers.authorization } : {}),
      },
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : Buffer.concat(chunks),
    })
    const body = Buffer.from(await upstreamResponse.arrayBuffer())
    response.writeHead(upstreamResponse.status, {
      'Content-Type': upstreamResponse.headers.get('content-type') ?? 'application/json',
      'Access-Control-Allow-Origin': '*',
    })
    response.end(body)
  } catch (error) {
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({
      error: 'local-model-unreachable',
      upstream,
      detail: String(error?.message ?? error),
      hint: '确认本地模型已经启动：ollama serve（默认 11434）或 LM Studio 的 Local Server（默认 1234）。',
    }))
  }
}

// ---------------------------------------------------------------- 局域网事件中继
// 目的：火场里可能没有互联网；只要手机和指挥端连在同一个现场热点上，就能互通。
const relay = { events: [], waiters: new Set(), clients: 0 }

function pushEvent(event) {
  if (!event || !event.id) return null
  if (relay.events.some((item) => item.event?.id === event.id)) {
    return relay.events.find((item) => item.event?.id === event.id)
  }
  const record = { seq: relay.events.length + 1, at: Date.now(), event }
  relay.events.push(record)
  if (relay.events.length > 200) relay.events.splice(0, relay.events.length - 200)
  let seq = record.seq - 1
  relay.waiters.forEach((waiter) => {
    if (waiter.since >= seq) return
    clearTimeout(waiter.timer)
    relay.waiters.delete(waiter)
    waiter.reply()
  })
  console.log(`[relay] 事件 ${event.kind} id=${event.id} 已广播（客户端 ${relay.clients}）`)
  return record
}

async function handleRelay(request, response, url) {
  const corsHeaders = { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store' }
  if (url.pathname === '/sync/health') {
    response.writeHead(200, corsHeaders)
    response.end(JSON.stringify({ ok: true, clients: relay.clients, events: relay.events.length, seq: relay.events.length, uptimeSec: Math.round(process.uptime()) }))
    return
  }
  if (url.pathname === '/sync/publish' && request.method === 'POST') {
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    let event = null
    try {
      event = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    } catch {
      response.writeHead(400, corsHeaders)
      response.end(JSON.stringify({ ok: false, error: 'bad-json' }))
      return
    }
    const record = pushEvent(event)
    response.writeHead(200, corsHeaders)
    response.end(JSON.stringify({ ok: Boolean(record), seq: record?.seq ?? relay.events.length }))
    return
  }
  if (url.pathname === '/sync/events' && request.method === 'GET') {
    const since = Number(url.searchParams.get('since')) || 0
    const wait = Math.max(0, Math.min(25000, Number(url.searchParams.get('wait')) || 0))
    const reply = () => {
      const events = relay.events.filter((item) => item.seq > since).map((item) => item.event)
      response.writeHead(200, corsHeaders)
      response.end(JSON.stringify({ ok: true, seq: relay.events.length, clients: relay.clients, events }))
    }
    if (relay.events.length > since || wait === 0) {
      reply()
      return
    }
    const waiter = { since, reply, timer: setTimeout(() => { relay.waiters.delete(waiter); reply() }, wait) }
    relay.waiters.add(waiter)
    request.on('close', () => {
      clearTimeout(waiter.timer)
      relay.waiters.delete(waiter)
    })
    return
  }
  response.writeHead(404, corsHeaders)
  response.end(JSON.stringify({ ok: false, error: 'unknown-sync-endpoint' }))
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    response.end()
    return
  }
  if (url.pathname.startsWith('/sync/')) {
    await handleRelay(request, response, url)
    return
  }
  if (url.pathname === '/ai' || url.pathname.startsWith('/ai/')) {
    await proxyAi(request, response)
    return
  }
  await serveStatic(request, response, url.pathname)
}).listen(port, host, () => {
  console.log(`热感哨兵本地站点：http://127.0.0.1:${port}/user-app.html （系统端 .../mobile-app.html）`)
  lanAddresses().forEach((address) => {
    console.log(`  手机端可访问：http://${address}:${port}/user-app.html`)
  })
  console.log(`本地大模型代理：/ai/*  →  ${upstream}`)
  console.log(`局域网事件中继：/sync/*  （手机连现场热点后打开 http://<本机局域网IP>:${port}/ 即可互通，不需要互联网）`)
  console.log('在页面「AI 指挥」里把端点填成 /ai/v1 即可，断网也能用。')
})
