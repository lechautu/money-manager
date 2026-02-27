import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { migrate } from './db/migrations'
import { performMigration } from './migrate_to_gateway'

async function start() {
  try {
    // initDB is handled lazily by getDB in services
    await migrate();
    // One-time migration to Gateway for local dev
    await performMigration();
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
