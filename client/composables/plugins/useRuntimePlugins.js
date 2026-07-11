import { API_BASE, API_V } from '~/lib/api-config.js'
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
 * Discover + load all runtime client plugins.
 * @param {{ pluginHost, log?, strict?: boolean }} opts
 *        strict → refuse an artifact whose hash doesn't match its pin (production).
 */
export async function loadRuntimePlugins({ pluginHost, log = () => {}, strict = false }) {
  let data
  try {
    const res = await fetch(`${API_BASE}/_api/${API_V}/plugins/manifest`)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    data = await res.json()
  } catch (e) {
    // No server / no runtime plugins — non-fatal; bundled plugins are unaffected.
    log('runtime-plugins', 'manifest unavailable; skipping runtime plugins', String(e?.message ?? e))
    return
  }

  for (const p of data.plugins ?? []) {
    if (!p?.id || !p.client?.url) continue
    if (pluginHost.isLoaded?.(p.id)) continue // already loaded (e.g. still bundled)

    try {
      const jsRes = await fetch(`${API_BASE}${p.client.url}`)
      if (!jsRes.ok) throw new Error(`artifact HTTP ${jsRes.status}`)
      const code = await jsRes.text()

      // Verify integrity against the pinned hash (committed lock for first-party;
      // the served hash otherwise).
      const pinned = p.firstParty ? lock?.[p.id]?.client : p.client.hash
      const actual = await sha256Hex(code)
      if (pinned && actual && actual !== pinned) {
        const msg = `hash mismatch for ${p.id} (want ${pinned.slice(0, 12)}…, got ${actual.slice(0, 12)}…)`
        if (strict) { log('runtime-plugins', `refused ${p.id}: ${msg}`); continue }
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
      }
      await pluginHost.load(manifest, mod)
      log('runtime-plugins', `loaded ${p.id} (runtime${p.firstParty ? ', first-party' : ''})`)
    } catch (e) {
      // Isolated per plugin — a bad artifact never blocks peers or the host.
      log('runtime-plugins', `failed to load ${p.id}: ${String(e?.message ?? e)}`)
    }
  }
}
