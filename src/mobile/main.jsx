import React from 'react'
import { createRoot } from 'react-dom/client'
import MobileApp from './MobileApp.jsx'
import './mobile.css'

createRoot(document.getElementById('mobile-root')).render(
  <React.StrictMode>
    <MobileApp />
  </React.StrictMode>
)
