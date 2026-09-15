import React from 'react'
import { createRoot } from 'react-dom/client'
import MobileApp from './MobileApp.jsx'
import { bootstrapAiConfig } from '../shared/aiClient.js'
import './mobile.css'

// 与用户端一致：先读 AI 接入配置，再渲染，队友改 ai-config.json 即可生效
bootstrapAiConfig().finally(() => {
  createRoot(document.getElementById('mobile-root')).render(
    <React.StrictMode>
      <MobileApp />
    </React.StrictMode>
  )
})

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
