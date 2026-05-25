import { API_BASE, API_TIMEOUT_MS, API_V } from './api-config.js'

async function _get(path, params = {}, signal = null) {
  const base = API_BASE
  const qs = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null) qs.set(k, String(v))
  }
  const q = qs.toString()
  const url = `${base}${path}${q ? `?${q}` : ''}`

  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS)
  if (signal) signal.addEventListener('abort', () => timeoutController.abort(), { once: true })

  try {
    const res = await fetch(url, { signal: timeoutController.signal })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? `HTTP ${res.status}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      if (signal?.aborted) throw new Error('Request cancelled')
      throw new Error(`Request timed out: ${path}`)
    }
    throw err
  }
}

async function _post(path, body = {}, signal = null) {
  const url = `${API_BASE}${path}`
  const timeoutController = new AbortController()
  const timer = setTimeout(() => timeoutController.abort(), API_TIMEOUT_MS)
  const fetchSignal = signal
    ? AbortSignal.any([timeoutController.signal, signal])
    : timeoutController.signal

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: fetchSignal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }))
      throw new Error(err.detail ?? `HTTP ${res.status}`)
    }
    return res.json()
  } catch (err) {
    clearTimeout(timer)
    if (err.name === 'AbortError') {
      if (signal?.aborted) throw new Error('Request cancelled')
      throw new Error(`Request timed out: ${path}`)
    }
    throw err
  }
}

// ── reads ─────────────────────────────────────────────────────────────────────

export function fsStat(path) {
  return _get(`/_api/${API_V}/fs/stat`, { path })
}

// opts: { includeMetadata, showHidden, excludeCategories, signal }
const LIST_DIR_PAGE_SIZE = 16

export async function fsListDir(path, opts = {}) {
  const { includeMetadata = true, showHidden = false, excludeCategories = 'System', signal } = opts
  const params = { path, includeMetadata, showHidden, excludeCategories, limit: LIST_DIR_PAGE_SIZE, offset: 0 }

  const first = await _get(`/_api/${API_V}/fs/list_dir`, params, signal)
  if (first.offset + first.items.length >= first.total) return first

  // Total is known after first page — fire all remaining pages in parallel
  const offsets = []
  for (let offset = first.items.length; offset < first.total; offset += LIST_DIR_PAGE_SIZE) {
    offsets.push(offset)
  }
  const pages = await Promise.all(
    offsets.map(offset => _get(`/_api/${API_V}/fs/list_dir`, { ...params, offset }, signal))
  )
  return { items: [...first.items, ...pages.flatMap(p => p.items)], total: first.total, offset: 0 }
}

// ── writes ────────────────────────────────────────────────────────────────────

export function fsOpenWithSystem(path, opts = {}) {
  return _post(`/_api/${API_V}/fs/open_with_system`, { path }, opts.signal)
}

export function fsCreateFile(path, opts = {}) {
  return _post(`/_api/${API_V}/fs/create_file`, { path }, opts.signal)
}

export function fsCreateDir(path, opts = {}) {
  return _post(`/_api/${API_V}/fs/create_dir`, { path }, opts.signal)
}

export function fsWriteFile(path, content, opts = {}) {
  return _post(`/_api/${API_V}/fs/write_file`, { path, content }, opts.signal)
}
