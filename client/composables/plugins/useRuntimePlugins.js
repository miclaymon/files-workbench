import { API_BASE, API_V } from '@files-workbench/core'
import lock from '#plugins-lock'

// ── Runtime plugin loader ─────────────────────────────────────────────────────
//
// Loads client plugins at RUNTIME from the Go server (not bundled): fetch the plugin
// manifest, verify each artifact's content hash, then dynamic-import its client.js and
// hand it to the (unchanged) plugin host. This is the client counterpart of the
// server-side WASM loading — first-party plugins go through the exact same path a
// third-party plugin would.
//
// Integrity: the committed `plugins.lock.json` (imported via #plugins-lock) is the
// client's root of trust. For a first-party plugin the fetched artifact must match its
// pinned hash; prod refuses a mismatch, dev warns and loads (hashes churn as you edit).

async function sha256Hex(text) {
  if (!globalThis.crypto?.subtle) return null // unavailable (some file:// contexts) → can't verify
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
  } catch {
    return null
  }
}

/**
 * Fetch the served plugin manifest (first-party + third-party), each entry stamped
 * with { firstParty, enabled }. Returns [] if the server/manifest is unavailable.
 */
export async function fetchRuntimeManifest({ log = () => {} } = {}) {
  try {
    const res = await fetch(`${API_BASE}/_api/${API_V}/plugins/manifest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()
    return data.plugins ?? []
  } catch (e) {
    log('runtime-plugins', 'manifest unavailable; skipping runtime plugins', String(e?.message ?? e))
    return []
  }
}

/**
 * Load one served plugin descriptor: fetch its artifact, hash-verify, blob-import, and
 * hand it to the (unchanged) plugin host. Isolated — throws are the caller's to log.
 * Reused by the startup loop and by the Plugins manager's hot-load after install.
 * @returns {boolean} true if loaded (false if skipped as already-loaded).
 */
export async function loadOneRuntimePlugin(p, { pluginHost, log = () => {}, strict = false }) {
  if (!p?.id || !p.client?.url) return false
  if (pluginHost.isLoaded?.(p.id)) return false // already loaded (e.g. still bundled)

  const jsRes = await fetch(`${API_BASE}${p.client.url}`)
  if (!jsRes.ok) throw new Error(`artifact HTTP ${jsRes.status}`)
  const code = await jsRes.text()

  // Verify integrity against the pinned hash (committed lock for first-party; the
  // server-recomputed served hash otherwise).
  const pinned = p.firstParty ? lock?.[p.id]?.client : p.client.hash
  const actual = await sha256Hex(code)
  if (pinned && actual && actual !== pinned) {
    const msg = `hash mismatch for ${p.id} (want ${pinned.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
    if (strict) throw new Error(`refused: ${msg}`)
    log('runtime-plugins', `warning (dev): ${msg} — loading anyway`)
  } else if (pinned && !actual) {
    log('runtime-plugins', `note: cannot verify ${p.id} (no SubtleCrypto); loading unverified`)
  }

  // Import exactly the bytes we verified (blob), not the URL (avoids a TOCTOU gap).
  const blobUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }))
  let mod
  try {
    mod = await import(/* @vite-ignore */ blobUrl)
  } finally {
    URL.revokeObjectURL(blobUrl)
  }

  const manifest = {
    manifest_version: 1,
    id: p.id,
    name: p.name || p.id,
    version: p.version || '0.0.0',
    client: { entry: 'client.js' },
    permissions: p.permissions || [],
    // Contract declarations the host enforces at load (engines.sdk compatibility,
    // dependency ranges) — carry them through or the checks silently never fire.
    ...(p.engines ? { engines: p.engines } : {}),
    ...(p.dependencies ? { dependencies: p.dependencies } : {}),
  }
  await pluginHost.load(manifest, mod)
  log('runtime-plugins', `loaded ${p.id} (runtime${p.firstParty ? ', first-party' : ''})`)
  return true
}

/**
 * Discover + load all runtime client plugins. Disabled plugins are skipped.
 * @param {{ pluginHost, log?, strict?: boolean }} opts
 *        strict → refuse an artifact whose hash doesn't match its pin (production).
 */
export async function loadRuntimePlugins({ pluginHost, log = () => {}, strict = false }) {
  const plugins = await fetchRuntimeManifest({ log })
  for (const p of plugins) {
    if (p.enabled === false) continue // installed but disabled — list, don't load
    try {
      await loadOneRuntimePlugin(p, { pluginHost, log, strict })
    } catch (e) {
      // Isolated per plugin — a bad artifact never blocks peers or the host.
      log('runtime-plugins', `failed to load ${p.id}: ${String(e?.message ?? e)}`)
    }
  }
}
