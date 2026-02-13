import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrate } from './db/migrations'

async function start() {
  try {
    // initDB is handled lazily by getDB in services
    await migrate();
  } catch (e) {
    console.error('Failed to initialize database:', e);
  }

  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

start();
