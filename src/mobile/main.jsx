import React from 'react'
import { createRoot } from 'react-dom/client'
import MobileApp from './MobileApp.jsx'
import './mobile.css'

createRoot(document.getElementById('mobile-root')).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {})
  })
}
