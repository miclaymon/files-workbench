import { reactive } from 'vue'
import { validateManifest } from '~/models/plugin/index.js'
import { createPluginApi } from './usePluginApi.js'

// ── Plugin host (loader + lifecycle) ──────────────────────────────────────────
//
// Owns the set of loaded plugins. A *plugin* is a { manifest, module } pair:
//   manifest  the validated metadata block (see models/plugin).
//   module    the plugin's entry exports — `activate(api)` (required) and an
//             optional `deactivate(api)`. activate() registers the plugin's
//             activity/commands/etc. through its permission-scoped `api` and may
//             return a disposer; on unload that disposer + deactivate() run.
//
// The eventual archive loader (extract .zip/.vsix → read manifest.json → import
// src/plugin.js in a sandbox) produces those pairs and feeds them here; this layer
// is agnostic to where they came from. Registration of a plugin's UI surfaces goes
// through the same facade path first-party activities use — plugins are not special.
export function createPluginHost({ host, log = () => {} }) {
  const loaded = reactive(new Map())   // id → { manifest, api, module, dispose }

  function isLoaded(id) { return loaded.has(id) }

  // Load one plugin. Throws on an invalid manifest or unmet dependency; warnings
  // (unknown permissions, …) are logged and non-fatal.
  function load(manifest, module) {
    const { valid, errors, warnings } = validateManifest(manifest)
    if (!valid) throw new Error(`[plugins] invalid manifest for "${manifest?.id ?? '?'}": ${errors.join('; ')}`)
    for (const w of warnings) log('plugins', `${manifest.id}: ${w}`)

    if (loaded.has(manifest.id)) { log('plugins', `"${manifest.id}" already loaded`); return }
    if (typeof module?.activate !== 'function') {
      throw new Error(`[plugins] "${manifest.id}" entry has no activate(api) export`)
    }
    for (const depId of Object.keys(manifest.dependencies ?? {})) {
      if (!loaded.has(depId)) throw new Error(`[plugins] "${manifest.id}" depends on "${depId}", which is not loaded`)
    }

    const api = createPluginApi(manifest, host)
    let dispose
    try {
      dispose = module.activate(api)   // plugin contributes through its scoped api
    } catch (err) {
      throw new Error(`[plugins] "${manifest.id}" activate() threw: ${err?.message ?? err}`)
    }
    loaded.set(manifest.id, { manifest, api, module, dispose })
    log('plugins', `loaded "${manifest.id}" v${manifest.version}`)
  }

  function unload(id) {
    const p = loaded.get(id)
    if (!p) return
    const dependents = [...loaded.values()].filter(o => o.manifest.dependencies?.[id])
    if (dependents.length) {
      throw new Error(`[plugins] cannot unload "${id}" — required by ${dependents.map(d => d.manifest.id).join(', ')}`)
    }
    try { if (typeof p.dispose === 'function') p.dispose() } catch (err) { log('plugins', `"${id}" dispose threw`, err) }
    try { p.module.deactivate?.(p.api) } catch (err) { log('plugins', `"${id}" deactivate threw`, err) }
    loaded.delete(id)
  }

  // Load many at once, ordered so each plugin's dependencies load first. Plugins
  // with missing/cyclic dependencies are skipped (and reported).
  function loadAll(entries) {
    for (const { manifest, module } of order(entries, log)) {
      try { load(manifest, module) } catch (err) { log('plugins', String(err?.message ?? err)) }
    }
  }

  return {
    load,
    unload,
    loadAll,
    isLoaded,
    get: (id) => loaded.get(id)?.manifest ?? null,
    list: () => [...loaded.values()].map(p => p.manifest),
  }
}

// Topologically order { manifest, module } entries by manifest.dependencies. Entries
// whose dependencies are absent from the set, or that participate in a cycle, are
// dropped with a log note (load() would reject them anyway).
function order(entries, log) {
  const byId = new Map(entries.map(e => [e.manifest.id, e]))
  const out = []
  const done = new Set()
  const visiting = new Set()

  function visit(id) {
    if (done.has(id)) return true
    if (visiting.has(id)) { log('plugins', `dependency cycle involving "${id}" — skipped`); return false }
    const entry = byId.get(id)
    if (!entry) return false
    visiting.add(id)
    for (const depId of Object.keys(entry.manifest.dependencies ?? {})) {
      if (!byId.has(depId)) { log('plugins', `"${id}" depends on missing "${depId}" — skipped`); visiting.delete(id); return false }
      if (!visit(depId)) { visiting.delete(id); return false }
    }
    visiting.delete(id)
    done.add(id)
    out.push(entry)
    return true
  }

  for (const e of entries) visit(e.manifest.id)
  return out
}
