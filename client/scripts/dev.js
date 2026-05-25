#!/usr/bin/env node

const { spawn } = require('child_process')

const args = process.argv.slice(2)
const withElectron = !args.includes('--no-electron')

const nuxt = spawn('npx', ['nuxt', 'dev'], { stdio: 'inherit', shell: true })

nuxt.on('error', (err) => {
  console.error('Failed to start Nuxt:', err)
  process.exit(1)
})

if (withElectron) {
  waitForServer('http://localhost:3000').then(() => {
    const electron = spawn('npx', ['electron', '.'], { stdio: 'inherit', shell: true })
    electron.on('close', () => {
      nuxt.kill()
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => {
  nuxt.kill()
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
  console.error(`Nuxt server at ${url} did not become ready within ${timeout / 1000}s`)
  process.exit(1)
}
