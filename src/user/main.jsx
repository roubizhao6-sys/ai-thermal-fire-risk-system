import React from 'react'
import { createRoot } from 'react-dom/client'
import UserApp from './UserApp.jsx'
import './user.css'

createRoot(document.getElementById('user-root')).render(
  <React.StrictMode>
    <UserApp />
  </React.StrictMode>
)

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, { updateViaCache: 'none' }).catch(() => {})
  })
}
