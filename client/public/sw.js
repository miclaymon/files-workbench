'use strict'

// Defaults overridden by INIT message from each client.
let controlBase = 'http://localhost:8002'
let apiV = 'v2'

// Endpoint definitions keyed by operation kind.
const ENDPOINTS = {
  rename:           { path: 'fs/rename',          method: 'POST' },
  move:             { path: 'fs/move',             method: 'POST' },
  copy:             { path: 'fs/copy',             method: 'POST' },
  delete:           { path: 'fs/delete',           method: 'POST' },
  delete_elevated:  { path: 'fs/delete/elevated',  method: 'POST' },
  trash:            { path: 'fs/trash',            method: 'POST' },
  trash_elevated:   { path: 'fs/trash/elevated',   method: 'POST' },
  compress:         { path: 'fs/compress',         method: 'POST' },
  decompress:       { path: 'fs/decompress',       method: 'POST' },
  create_file:      { path: 'fs/create_file',      method: 'POST' },
  create_dir:       { path: 'fs/create_dir',       method: 'POST' },
  write_file:       { path: 'fs/write_file',       method: 'POST' },
  open_with_system: { path: 'fs/open_with_system', method: 'POST' },
  customization:    { path: 'fs/customization',    method: 'PUT'  },
  preferences:      { path: 'preferences',         method: 'PUT'  },
}

// Per-client operation queues.  clientId → Op[]
// Each Op: { id: string, kind: string, params: object }
const queues = new Map()

// ── Lifecycle ─────────────────────────────────────────────────────────────────

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

// ── Message dispatch ──────────────────────────────────────────────────────────

self.addEventListener('message', event => {
  const msg = event.data
  const client = event.source
  if (!client || !msg?.type) return

  switch (msg.type) {
    case 'INIT':
      if (msg.controlBase) controlBase = msg.controlBase
      if (msg.apiV) apiV = msg.apiV
      queues.set(client.id, [])
      client.postMessage({ type: 'READY' })
      break

    case 'ENQUEUE': {
      const q = queues.get(client.id) ?? []
      q.push(msg.op)
      queues.set(client.id, q)
      break
    }

    // Drain the client's queue and fire all ops concurrently.
    // Each op resolves independently — OP_COMPLETE or OP_ERROR is sent per op.
    case 'EXECUTE': {
      const q = queues.get(client.id) ?? []
      queues.set(client.id, [])
      for (const op of q) {
        executeOp(op).then(
          result => client.postMessage({ type: 'OP_COMPLETE', id: op.id, result }),
          err    => client.postMessage({ type: 'OP_ERROR',    id: op.id, error: String(err?.message ?? err) }),
        )
      }
      break
    }

    case 'CLEAR':
      queues.set(client.id, [])
      break
  }
})

// ── Fetch execution ───────────────────────────────────────────────────────────

async function executeOp(op) {
  const def = ENDPOINTS[op.kind]
  if (!def) throw new Error(`Unknown operation: ${op.kind}`)

  const url = `${controlBase}/_api/${apiV}/${def.path}`
  const res = await fetch(url, {
    method: def.method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(op.params ?? {}),
  })

  const data = await res.json().catch(() => ({}))

  // Structured non-throw responses — caller checks for these fields.
  if (res.status === 403 && data.error === 'requires_elevation') {
    return {
      requiresElevation: true,
      elevationMethod: data.elevation_method,
      elevationPaths: data.paths,
    }
  }
  if (res.status === 422 && data.error === 'missing_tool') {
    return {
      missingTool: true,
      tool: data.tool,
      installApt: data.install_apt,
      installDnf: data.install_dnf,
      installPac: data.install_pac,
      installBrew: data.install_brew,
    }
  }

  if (!res.ok) throw new Error(data.detail ?? `HTTP ${res.status}`)
  return data
}
