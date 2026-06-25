import { shallowRef } from 'vue'
import { API_BASE, API_V } from '~/lib/api-config.js'

// Material Icon Theme — a first-party icon-pack plugin. It owns layer 2 of the
// icon pipeline (after custom .directory/desktop.ini icons, before the default MDI
// glyphs): it registers a getIcon handler through the `icons` permission and
// resolves file/folder names to SVGs served by the Go backend's icon endpoints.
//
// The active pack is loaded server-side from config/plugins/material-icon-theme;
// this plugin fetches its mapping tables once from /icons/manifest and resolves
// names locally, then points at /icons/svg for each glyph (browser-cached). No
// filesystem access — purely the public icon endpoints.

const ICONS_BASE = `${API_BASE}/_api/${API_V}/icons`

// null = not loaded yet, false = unavailable, object = the resolution tables.
const _manifest = shallowRef(null)
let _loadPromise = null

async function _load() {
  try {
    const res = await fetch(`${ICONS_BASE}/manifest`)
    if (!res.ok) { _manifest.value = false; return }
    const data = await res.json()
    _manifest.value = data.available ? data : false
  } catch {
    _manifest.value = false
  }
}

function ensureLoaded() {
  if (_loadPromise === null) _loadPromise = _load()
  return _loadPromise
}

function iconUrl(name) {
  return `${ICONS_BASE}/svg?name=${encodeURIComponent(name)}`
}

// Map a filename/foldername to an icon-definition name using the theme tables.
// Folder lookups honour the expanded (open) variant, falling back through the
// named-closed icon then the defaults — matching the server's resolveOpen order.
function resolveName(m, name, isDir, expanded) {
  const lower = String(name ?? '').toLowerCase()
  if (isDir) {
    if (expanded) {
      return m.folderNamesExpanded?.[lower] ?? m.folderNames?.[lower] ?? m.folderExpanded ?? m.folder ?? null
    }
    return m.folderNames?.[lower] ?? m.folder ?? null
  }
  const dot = lower.lastIndexOf('.')
  const ext = dot >= 0 ? lower.slice(dot + 1) : ''
  return m.fileNames?.[lower] ?? (ext ? m.fileExtensions?.[ext] : null) ?? m.file ?? null
}

// The handler the registry calls per item. Reads the reactive manifest so a
// renderer's computed re-resolves once the tables finish loading. Returns a URL
// descriptor, or null (→ the renderer falls through to its MDI default).
function getIcon(ctx) {
  const m = _manifest.value
  if (!m) return null
  const name = resolveName(m, ctx.name, ctx.isDir, ctx.expanded)
  return name ? { type: 'url', icon: iconUrl(name) } : null
}

export function activate(api) {
  ensureLoaded()
  return api.icons.register({ id: api.manifest.id, label: api.manifest.name, getIcon })
}

export function deactivate() {}
