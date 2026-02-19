import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

// L'enregistrement du Service Worker est géré automatiquement
// par vite-plugin-pwa (injectRegister: 'auto' dans vite.config.js)
