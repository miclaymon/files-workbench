#!/usr/bin/env node

const { spawn } = require('child_process')

const args = process.argv.slice(2)
const withElectron = !args.includes('--no-electron')

const vite = spawn('npx', ['vite'], { stdio: 'inherit', shell: true })

vite.on('error', (err) => {
  console.error('Failed to start Vite:', err)
  process.exit(1)
})

if (withElectron) {
  waitForServer('http://localhost:3000').then(() => {
    // Strip ELECTRON_RUN_AS_NODE (leaked by Electron-based parent processes like
    // VS Code extension hosts) — with it set, `electron .` runs as plain Node and
    // crashes on the first `electron` API access.
    const env = { ...process.env }
    delete env.ELECTRON_RUN_AS_NODE
    const electron = spawn('npx', ['electron', '.'], { stdio: 'inherit', shell: true, env })
    electron.on('close', () => {
      vite.kill()
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => {
  vite.kill()
  process.exit(0)
})

async function waitForServer(url, timeout = 60000) {
  const start = Date.now()
  while (Date.now() - start < timeout) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(1000) })
      return
    } catch {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }
  console.error(`Vite dev server at ${url} did not become ready within ${timeout / 1000}s`)
  process.exit(1)
}
