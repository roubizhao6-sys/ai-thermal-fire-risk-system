# AI 火警精灵 · 后端 LLM 代理（Cloudflare Worker）

把大模型 API Key 放在服务端，前端（用户端 / 系统端）只调用本代理，用户无需填写任何 Key。

## 部署（一次性）

```bash
cd gateway/llm-proxy
npx wrangler login
npx wrangler deploy
```

部署后会得到地址，例如 `https://thermal-guard-llm-proxy.你的账号.workers.dev`。

## 配置服务端密钥（Key 只存在服务端，不暴露给前端）

```bash
# 必填：你的大模型 API Key
npx wrangler secret put LLM_API_KEY

# 可选：服务商地址与模型（默认豆包）
npx wrangler secret put LLM_BASE_URL      # 默认 https://ark.cn-beijing.volces.com/api/v3
npx wrangler secret put LLM_MODEL         # 默认 doubao-1-5-pro-32k-250115

# 可选：共享访问令牌，防止陌生人滥用（前端需填相同 token）
npx wrangler secret put PROXY_TOKEN
```

## 调用方式

```bash
curl -X POST https://<你的worker>.workers.dev/chat \
  -H "Content-Type: application/json" \
  -H "x-proxy-token: 你的PROXY_TOKEN(可选)" \
  -d '{"messages":[{"role":"user","content":"灭火器怎么用"}]}'
```

返回：`{"reply":"..."}`

## 支持的服务商（OpenAI 兼容接口均可）

- 豆包：base `https://ark.cn-beijing.volces.com/api/v3`，model `doubao-1-5-pro-32k-250115`
- DeepSeek：base `https://api.deepseek.com/v1`，model `deepseek-chat`
- Kimi：base `https://api.moonshot.cn/v1`，model `moonshot-v1-8k`
- OpenAI：base `https://api.openai.com/v1`，model `gpt-4o-mini`
