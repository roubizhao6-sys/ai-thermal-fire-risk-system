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

import { createServer } from 'node:http'
import { readFile, stat } from 'node:fs/promises'
import { extname, join, normalize, resolve } from 'node:path'

const args = process.argv.slice(2)
const readArg = (name, fallback) => {
  const index = args.indexOf(name)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const port = Number(readArg('--port', '4173'))
const upstream = readArg('--upstream', 'http://127.0.0.1:11434/v1').replace(/\/$/, '')
const dist = resolve(readArg('--dist', 'dist'))

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

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`)
  if (request.method === 'OPTIONS') {
    response.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' })
    response.end()
    return
  }
  if (url.pathname === '/ai' || url.pathname.startsWith('/ai/')) {
    await proxyAi(request, response)
    return
  }
  await serveStatic(request, response, url.pathname)
}).listen(port, '127.0.0.1', () => {
  console.log(`热感哨兵本地站点：http://127.0.0.1:${port}/user-app.html （系统端 .../mobile-app.html）`)
  console.log(`本地大模型代理：/ai/*  →  ${upstream}`)
  console.log('在页面「AI 指挥」里把端点填成 /ai/v1 即可，断网也能用。')
})
