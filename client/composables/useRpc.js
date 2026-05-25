import { API_BASE, API_V } from '~/lib/api-config.js'

const DEFAULT_TIMEOUT_MS = 12_000

const GET_METHODS = new Set([
  'app.init',
  'fs.stat',
  'fs.list_dir',
  'fs.preview',
])

const METHOD_TO_PATH = {
  'app.init':           `/_api/${API_V}/app/init`,
  'fs.stat':            `/_api/${API_V}/fs/stat`,
  'fs.list_dir':        `/_api/${API_V}/fs/list_dir`,
  'fs.preview':         `/_api/${API_V}/fs/preview`,
  'fs.open_with_system':`/_api/${API_V}/fs/open_with_system`,
  'fs.create_file':     `/_api/${API_V}/fs/create_file`,
  'fs.create_dir':      `/_api/${API_V}/fs/create_dir`,
  'fs.write_file':      `/_api/${API_V}/fs/write_file`,
}

export function useRpc(options = {}) {
  const { onStatus } = options

  onStatus?.('Connected')

  // call(method, params, { signal }) — signal is optional; if provided it is
  // composed with the internal timeout so whichever fires first wins.
  async function call(method, params = {}, { signal: callerSignal } = {}) {
    const path = METHOD_TO_PATH[method]
    if (!path) throw new Error(`Unknown RPC method: ${method}`)

    const isGet = GET_METHODS.has(method)
    let url = `${API_BASE}${path}`

    if (isGet) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined && v !== null) qs.set(k, String(v))
      }
      const q = qs.toString()
      if (q) url += `?${q}`
    }

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS)

    // Forward caller cancellation into the internal controller
    callerSignal?.addEventListener('abort', () => controller.abort(), { once: true })

    let res
    try {
      res = await fetch(url, {
        signal: controller.signal,
        ...(isGet ? {} : {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(params),
        })
      })
    } catch (err) {
      if (err.name === 'AbortError') {
        if (callerSignal?.aborted) throw new Error(`Request cancelled: ${method}`)
        throw new Error(`Request timed out: ${method}`)
      }
      throw err
    } finally {
      clearTimeout(timer)
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? `HTTP ${res.status}`)
    }

    return res.json()
  }

  return { call }
}
