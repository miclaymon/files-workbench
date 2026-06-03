import { shallowRef, computed } from 'vue'
import { API_BASE, API_V } from '~/lib/api-config.js'

const ICONS_BASE = `${API_BASE}/_api/${API_V}/icons`

const _manifest = shallowRef(null) // null = not loaded yet, false = unavailable, object = loaded
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

export function useIconPack() {
  function ensureLoaded() {
    if (_loadPromise === null) _loadPromise = _load()
    return _loadPromise
  }

  const isAvailable = computed(() => !!_manifest.value)

  function resolveIcon(filename, isDir) {
    const m = _manifest.value
    if (!m) return null
    const lower = filename.toLowerCase()
    if (isDir) {
      return m.folderNames?.[lower] ?? m.folder ?? null
    }
    const dotIdx = lower.lastIndexOf('.')
    const ext = dotIdx >= 0 ? lower.slice(dotIdx + 1) : ''
    return m.fileNames?.[lower] ?? (ext ? m.fileExtensions?.[ext] : null) ?? m.file ?? null
  }

  function iconUrl(iconName) {
    return `${ICONS_BASE}/svg?name=${encodeURIComponent(iconName)}`
  }

  return { ensureLoaded, resolveIcon, iconUrl, isAvailable }
}
