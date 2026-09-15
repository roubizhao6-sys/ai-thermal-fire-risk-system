import React from 'react'
import { createRoot } from 'react-dom/client'
import UserApp from './UserApp.jsx'
import { bootstrapAiConfig } from '../shared/aiClient.js'
import './user.css'

// 先把 AI 接入配置读进来（window.THERMAL_GUARD_AI / ai-config.json），再渲染界面，
// 这样队友改配置文件就能直接生效，不需要在界面上点。
bootstrapAiConfig().finally(() => {
  createRoot(document.getElementById('user-root')).render(
    <React.StrictMode>
      <UserApp />
    </React.StrictMode>
  )
})

// 逃生指引是断网时最需要打开的那个页面，所以自己也注册 Service Worker
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
