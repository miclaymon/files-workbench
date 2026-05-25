// Empty string = same-origin requests, routed through Nuxt devProxy in development.
// Set VITE_API_BASE=http://127.0.0.1:8000 in production builds (Electron).
export const API_BASE = import.meta.env.VITE_API_BASE ?? ''
export const API_TIMEOUT_MS = 30_000
// API_V controls which server version is used. Set VITE_API_V=v1 to use the Python server.
export const API_V = import.meta.env.VITE_API_V ?? 'v2'
export const MEDIA_BASE = `${API_BASE}/_api/${API_V}/media`
