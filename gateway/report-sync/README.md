# 用户端 → 系统端 跨设备同步（Cloudflare Worker + KV）

用户端（手机）上报隐患/求助 → 存到它 → 系统端（电脑）拉取展示。跨设备实时联动。

## 部署（一次性）

```bash
cd gateway/report-sync
npx wrangler login

# 1) 创建 KV 命名空间，复制返回的 id 填进 wrangler.toml
npx wrangler kv namespace create REPORTS

# 2) 部署
npx wrangler deploy
```

部署后得到地址，例如 `https://thermal-guard-report-sync.你的账号.workers.dev`。

## 可选：访问令牌（防止被乱写）

```bash
npx wrangler secret put SYNC_TOKEN
```

## 接口

- `POST /report`  body: `{ "type": "hazard|help", "payload": {...} }`
- `GET  /reports` 返回 `{ "reports": [{ id, type, at, payload }] }`
- `GET  /health`

## 怎么用

1. 部署得到 Worker 地址；
2. 在**用户端**「更多功能 → 云端同步」把地址填进去（手机端）；
3. 在**系统端**数据看板「用户端联动」也会读取同一个地址（电脑端填一次，或让地址预置）；
4. 之后用户手机上报隐患（含照片）→ 系统端「用户端联动」面板就能看到。
