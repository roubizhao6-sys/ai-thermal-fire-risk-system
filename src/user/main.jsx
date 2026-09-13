import React from 'react'
import { createRoot } from 'react-dom/client'
import UserApp from './UserApp.jsx'
import './user.css'

createRoot(document.getElementById('user-root')).render(
  <React.StrictMode>
    <UserApp />
  </React.StrictMode>
)
