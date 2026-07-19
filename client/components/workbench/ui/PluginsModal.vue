<template>
  <div class="pm-root">
    <!-- Toolbar -->
    <div class="pm-toolbar">
      <div class="pm-tabs">
        <button class="pm-tab" :class="{ 'pm-tab-active': tab === 'installed' }" :disabled="busy" @click="tab = 'installed'">
          Installed <span class="pm-count">{{ plugins.length }}</span>
        </button>
        <button class="pm-tab" :class="{ 'pm-tab-active': tab === 'browse' }" :disabled="busy" @click="showBrowse">
          Browse
        </button>
      </div>
      <div class="pm-actions">
        <button v-if="tab === 'installed'" class="pm-btn" :disabled="busy" @click="pickFile">Install from file…</button>
        <button class="pm-btn pm-ghost" :disabled="busy || loading" @click="tab === 'browse' ? loadRegistry() : refresh()">Refresh</button>
      </div>
    </div>

    <div v-if="error" class="pm-error">{{ error }}</div>

    <!-- Consent gate (after install / before running unfamiliar code) -->
    <div v-if="consent" class="pm-consent">
      <h3 class="pm-consent-title">Enable “{{ consent.name || consent.id }}”?</h3>
      <p class="pm-consent-warn">
        Third-party plugins run <strong>in-process with full access to the app</strong> —
        this is not a sandbox. Only enable plugins you trust.
      </p>
      <div class="pm-consent-perms">
        <div class="pm-consent-label">Requested permissions</div>
        <ul>
          <li v-for="perm in (consent.permissions || [])" :key="perm">{{ perm }}</li>
          <li v-if="!consent.permissions?.length" class="pm-muted">None declared</li>
        </ul>
      </div>
      <div v-if="consentFindings.length" class="pm-consent-findings">
        <div class="pm-consent-label">Code analysis — undeclared capabilities</div>
        <ul>
          <li v-for="f in consentFindings" :key="f.token" :class="{ 'pm-finding-high': f.severity === 'high' }">
            <strong>{{ f.token }}</strong>
            <span v-if="f.severity === 'high'"> — code execution / loading (high risk)</span>
            <span v-else-if="f.permission"> — network/storage/clipboard use without the “{{ f.permission }}” permission</span>
          </li>
        </ul>
      </div>
      <div class="pm-consent-buttons">
        <button class="pm-btn pm-ghost" :disabled="busy" @click="cancelConsent">Keep disabled</button>
        <button class="pm-btn pm-primary" :disabled="busy" @click="confirmConsent">Enable &amp; run</button>
      </div>
    </div>

    <!-- Installed list -->
    <div v-else-if="tab === 'installed'" class="pm-list">
      <div v-if="loading" class="pm-empty">Loading…</div>
      <div v-else-if="!plugins.length" class="pm-empty">
        No plugins installed. Use <em>Install from file…</em> or <em>Browse</em> to add one.
      </div>
      <div v-for="p in plugins" :key="p.id" class="pm-item">
        <svg class="pm-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path :d="puzzle" /></svg>
        <div class="pm-item-main">
          <div class="pm-item-head">
            <span class="pm-item-name">{{ p.name || p.id }}</span>
            <span class="pm-ver">v{{ p.version || '0.0.0' }}</span>
            <span v-if="p.firstParty" class="pm-badge pm-badge-builtin">Built-in</span>
            <span class="pm-state" :data-state="rowState(p)">{{ stateLabel(p) }}</span>
          </div>
          <div v-if="p.permissions?.length" class="pm-perms">{{ p.permissions.join(' · ') }}</div>
          <div v-else class="pm-perms pm-muted">no permissions</div>
        </div>
        <div class="pm-item-actions">
          <label class="pm-toggle" :title="p.enabled ? 'Disable' : 'Enable'">
            <input type="checkbox" :checked="p.enabled" :disabled="busy" @change="toggle(p, $event.target.checked)" />
            <span>Enabled</span>
          </label>
          <button v-if="!p.firstParty" class="pm-btn pm-danger" :disabled="busy" @click="remove(p)">Uninstall</button>
        </div>
      </div>
    </div>

    <!-- Browse (remote registry) -->
    <div v-else class="pm-list">
      <div v-if="registryLoading" class="pm-empty">Loading registry…</div>
      <div v-else-if="registryConfigured === false" class="pm-empty">
        No plugin registry configured. Set <code>FW_PLUGIN_REGISTRY</code> to an index URL.
      </div>
      <div v-else-if="!registry.length" class="pm-empty">The registry is empty.</div>
      <div v-for="e in registry" :key="e.id" class="pm-item">
        <svg class="pm-item-icon" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path :d="puzzle" /></svg>
        <div class="pm-item-main">
          <div class="pm-item-head">
            <span class="pm-item-name">{{ e.name || e.id }}</span>
            <span class="pm-ver">v{{ e.version }}</span>
            <span v-if="installedVersion(e.id) && isNewer(e.version, installedVersion(e.id))" class="pm-badge pm-badge-update">Update</span>
          </div>
          <div v-if="e.description" class="pm-perms">{{ e.description }}</div>
          <div v-if="e.permissions?.length" class="pm-perms pm-muted">{{ e.permissions.join(' · ') }}</div>
        </div>
        <div class="pm-item-actions">
          <button
            class="pm-btn"
            :class="{ 'pm-primary': !installedVersion(e.id) || isNewer(e.version, installedVersion(e.id)) }"
            :disabled="busy || (installedVersion(e.id) && !isNewer(e.version, installedVersion(e.id)))"
            @click="installFromRegistry(e)"
          >
            {{ !installedVersion(e.id) ? 'Install' : (isNewer(e.version, installedVersion(e.id)) ? 'Update' : 'Installed') }}
          </button>
        </div>
      </div>
    </div>

    <input ref="fileRef" type="file" accept=".zip,.vsix" hidden @change="onFile" />
  </div>
</template>

<script setup>
import { ref, inject, onMounted } from 'vue'
import { mdiPuzzle } from '@mdi/js'
import { useDebugLog } from '~/composables/useDebugLog.js'
import { API_BASE } from '~/lib/api-config.js'
import { listInstalled, installPluginFile, installPluginUrl, uninstallPlugin, setPluginEnabled, listRegistry } from '~/lib/plugins-api.js'
import { scanCapabilities, uncoveredFindings } from '~/lib/capability-scan.mjs'
import { loadOneRuntimePlugin } from '~/composables/plugins/useRuntimePlugins.js'

// Manage runtime plugins: list installed (first-party + third-party), install a
// packaged plugin from a file, enable/disable, and uninstall third-party ones. The
// host provides the live plugin host so enable/disable hot-loads/unloads without a
// restart. Consent (running unfamiliar code) is gated before a fresh install runs.
defineProps({ host: { type: Object, required: true } })

const pluginHost = inject('pluginHost', null)
const { log } = useDebugLog()
const puzzle = mdiPuzzle

const tab = ref('installed')
const plugins = ref([])
const loading = ref(true)
const busy = ref(false)
const error = ref('')
const consent = ref(null) // a freshly-installed served descriptor awaiting consent
const consentFindings = ref([]) // capability-scan findings for the consent gate
const fileRef = ref(null)

// Browse (remote registry) state.
const registry = ref([])
const registryLoading = ref(false)
const registryConfigured = ref(null)

async function refresh() {
  loading.value = true
  try {
    plugins.value = await listInstalled()
  } catch (e) {
    error.value = String(e?.message ?? e)
  } finally {
    loading.value = false
  }
}
onMounted(refresh)

// Live load-state from the host's reactive states map (reactive Map.get is tracked).
function rowState(p) {
  if (!p.enabled) return 'disabled'
  return pluginHost?.states?.get(p.id) ?? 'idle'
}
function stateLabel(p) {
  return { active: 'Active', loading: 'Loading…', failed: 'Failed', disabled: 'Disabled', idle: '—' }[rowState(p)]
}

function pickFile() { fileRef.value?.click() }

async function onFile(e) {
  const file = e.target.files?.[0]
  e.target.value = '' // allow re-picking the same file
  if (!file) return
  busy.value = true
  error.value = ''
  try {
    const { plugin } = await installPluginFile(file)
    await refresh()
    // Installed + enabled server-side, but not yet run — gate on consent first.
    await beginConsent(plugin)
  } catch (err) {
    error.value = String(err?.message ?? err)
  } finally {
    busy.value = false
  }
}

// Fetch the (not-yet-run) artifact and scan it, so consent shows what the plugin's
// code actually reaches beyond its declared permissions before we execute it.
async function beginConsent(plugin) {
  consentFindings.value = []
  try {
    const res = await fetch(`${API_BASE}${plugin.client.url}`)
    if (res.ok) consentFindings.value = uncoveredFindings(scanCapabilities(await res.text()), plugin.permissions || [])
  } catch { /* scan is advisory — a fetch failure shouldn't block consent */ }
  consent.value = plugin
}

async function confirmConsent() {
  const p = consent.value
  busy.value = true
  error.value = ''
  try {
    await loadOneRuntimePlugin(p, { pluginHost, log })
  } catch (err) {
    error.value = `Failed to load ${p.id}: ${String(err?.message ?? err)}`
  } finally {
    consent.value = null
    busy.value = false
    await refresh()
  }
}

async function cancelConsent() {
  const p = consent.value
  busy.value = true
  try {
    await setPluginEnabled(p.id, false) // installed but left disabled (not run)
  } catch (err) {
    error.value = String(err?.message ?? err)
  } finally {
    consent.value = null
    busy.value = false
    await refresh()
  }
}

async function toggle(p, on) {
  busy.value = true
  error.value = ''
  try {
    await setPluginEnabled(p.id, on)
    if (on) await loadOneRuntimePlugin(p, { pluginHost, log })
    else pluginHost?.unload?.(p.id)
  } catch (err) {
    error.value = String(err?.message ?? err)
  } finally {
    busy.value = false
    await refresh()
  }
}

async function remove(p) {
  if (!window.confirm(`Uninstall “${p.name || p.id}”? This deletes it from disk.`)) return
  busy.value = true
  error.value = ''
  try {
    try { pluginHost?.unload?.(p.id) } catch { /* not loaded / has dependents — surfaced below if the delete fails */ }
    await uninstallPlugin(p.id)
  } catch (err) {
    error.value = String(err?.message ?? err)
  } finally {
    busy.value = false
    await refresh()
  }
}

// ── Browse (remote registry) ──────────────────────────────────────────────────

function showBrowse() {
  tab.value = 'browse'
  if (registryConfigured.value === null) loadRegistry()
}

async function loadRegistry() {
  registryLoading.value = true
  error.value = ''
  try {
    const data = await listRegistry()
    registry.value = data.plugins ?? []
    registryConfigured.value = data.configured !== false
  } catch (err) {
    error.value = String(err?.message ?? err)
    registryConfigured.value = true // a fetch error isn't "unconfigured"
  } finally {
    registryLoading.value = false
  }
}

function installedVersion(id) {
  return plugins.value.find((p) => p.id === id)?.version ?? null
}

// Numeric semver-ish compare: is `a` newer than `b`? (Non-numeric/pre-release parts
// are compared lexically as a fallback.)
function isNewer(a, b) {
  const pa = String(a).split('.')
  const pb = String(b).split('.')
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const na = parseInt(pa[i] ?? '0', 10)
    const nb = parseInt(pb[i] ?? '0', 10)
    if (Number.isNaN(na) || Number.isNaN(nb)) {
      if ((pa[i] ?? '') !== (pb[i] ?? '')) return (pa[i] ?? '') > (pb[i] ?? '')
      continue
    }
    if (na !== nb) return na > nb
  }
  return false
}

async function installFromRegistry(e) {
  busy.value = true
  error.value = ''
  try {
    const { plugin } = await installPluginUrl(e.download, e.hash, { force: true })
    await refresh()
    tab.value = 'installed'
    await beginConsent(plugin) // gate running the code on consent, same as a file install
  } catch (err) {
    error.value = String(err?.message ?? err)
  } finally {
    busy.value = false
  }
}
</script>

<style scoped>
.pm-root { display: flex; flex-direction: column; height: 100%; color: var(--text, #ccc); font-size: 13px; }
.pm-toolbar { display: flex; align-items: center; justify-content: space-between; padding: 8px 14px; border-bottom: 1px solid var(--border, #454545); }
.pm-tabs { display: flex; gap: 4px; }
.pm-tab { padding: 5px 12px; border: none; border-radius: 4px; background: transparent; color: var(--text-muted, #888); cursor: pointer; }
.pm-tab:hover:not(:disabled) { color: var(--text, #ccc); background: var(--hover, rgba(255,255,255,0.05)); }
.pm-tab-active { color: var(--text, #eee); background: var(--hover, rgba(255,255,255,0.08)); }
.pm-count { display: inline-block; margin-left: 4px; padding: 0 6px; border-radius: 8px; background: var(--input-background, #3c3c3c); color: var(--text-muted, #aaa); font-size: 11px; }
.pm-actions { display: flex; gap: 8px; }

.pm-btn { padding: 5px 12px; border: 1px solid var(--border, #454545); border-radius: 4px; background: var(--input-background, #3c3c3c); color: var(--text, #ccc); cursor: pointer; }
.pm-btn:hover:not(:disabled) { border-color: var(--border-hover, #666); }
.pm-btn:disabled { opacity: 0.5; cursor: default; }
.pm-primary { background: var(--accent, #0078d4); border-color: var(--accent, #0078d4); color: #fff; }
.pm-ghost { background: transparent; }
.pm-danger { color: var(--danger, #f14c4c); }
.pm-danger:hover:not(:disabled) { border-color: var(--danger, #f14c4c); }

.pm-error { margin: 10px 14px 0; padding: 8px 10px; border: 1px solid var(--danger, #f14c4c); border-radius: 4px; color: var(--danger, #f14c4c); background: rgba(241, 76, 76, 0.08); }

.pm-list { flex: 1; overflow-y: auto; padding: 8px 0; }
.pm-empty { padding: 32px 14px; text-align: center; color: var(--text-muted, #888); }

.pm-item { display: flex; align-items: flex-start; gap: 12px; padding: 12px 14px; border-bottom: 1px solid var(--border, #333); }
.pm-item-icon { flex: none; margin-top: 2px; color: var(--text-muted, #888); }
.pm-item-main { flex: 1; min-width: 0; }
.pm-item-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.pm-item-name { font-weight: 600; }
.pm-ver { color: var(--text-muted, #888); font-size: 12px; }
.pm-badge { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; padding: 1px 6px; border-radius: 3px; border: 1px solid var(--border, #555); color: var(--text-muted, #aaa); }
.pm-badge-builtin { border-color: var(--accent, #0078d4); color: var(--accent, #4aa3e8); }
.pm-badge-update { border-color: #d1a12a; color: #e0b552; }
.pm-state { margin-left: auto; font-size: 11px; color: var(--text-muted, #888); }
.pm-state[data-state="active"] { color: #4ec98f; }
.pm-state[data-state="failed"] { color: var(--danger, #f14c4c); }
.pm-state[data-state="disabled"] { color: var(--text-muted, #777); }
.pm-perms { margin-top: 4px; font-size: 12px; color: var(--text-muted, #999); word-break: break-word; }
.pm-muted { color: var(--text-muted, #777); }

.pm-item-actions { display: flex; align-items: center; gap: 12px; flex: none; }
.pm-toggle { display: flex; align-items: center; gap: 5px; cursor: pointer; user-select: none; }

.pm-consent { padding: 20px 18px; }
.pm-consent-title { margin: 0 0 10px; font-size: 15px; }
.pm-consent-warn { margin: 0 0 14px; padding: 10px 12px; border: 1px solid var(--danger, #f14c4c); border-radius: 4px; background: rgba(241, 76, 76, 0.08); color: var(--text, #ddd); }
.pm-consent-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted, #888); margin-bottom: 6px; }
.pm-consent-perms ul { margin: 0 0 16px; padding-left: 18px; }
.pm-consent-perms li { margin: 2px 0; }
.pm-consent-findings { margin-bottom: 16px; }
.pm-consent-findings ul { margin: 0; padding-left: 18px; }
.pm-consent-findings li { margin: 2px 0; color: var(--text-muted, #aaa); }
.pm-finding-high { color: var(--danger, #f14c4c) !important; }
.pm-consent-buttons { display: flex; justify-content: flex-end; gap: 10px; }
</style>
