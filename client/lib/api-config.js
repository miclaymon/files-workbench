// Empty string = same-origin (routed through Nuxt devProxy in dev).
// Set VITE_API_BASE=http://127.0.0.1:8001 in production builds (Electron).
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''

// Control server handles all mutating operations (POST/PUT).
// Direct connection — bypasses the Nuxt dev proxy (CORS is permissive on the Go side).
// Set VITE_CONTROL_BASE=http://127.0.0.1:8002 in production builds (Electron).
export const CONTROL_BASE = import.meta.env.VITE_CONTROL_BASE ?? 'http://localhost:8002'

export const API_TIMEOUT_MS = 30_000
export const API_V = 'v1'
export const MEDIA_BASE = `${API_BASE}/_api/${API_V}/media`
