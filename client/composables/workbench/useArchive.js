import { ref, onMounted } from 'vue'
import { fsArchiveCapabilities } from '~/lib/fs-api.js'
import { API_BASE, API_V } from '~/lib/api-config.js'

// ── Archive slice ─────────────────────────────────────────────────────────────
// Archive-file detection + the host's archive capabilities (loaded once). A leaf:
// `isArchiveItem` is consumed by selection, file operations, and context menus, so
// it lives here rather than inside any one of them.
const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.tgz', '.tbz2', '.txz'])

function getArchiveExt(name) {
  const lower = name.toLowerCase()
  for (const ext of ['.tar.gz', '.tar.bz2', '.tar.xz']) {
    if (lower.endsWith(ext)) return ext
  }
  for (const ext of ARCHIVE_EXTS) {
    if (lower.endsWith(ext)) return ext
  }
  return null
}

export function useArchive() {
  const archiveCaps = ref(null)  // host capabilities (seven_zip, etc.), loaded at startup
  const platform = ref('linux')

  function isArchiveItem(item) { return !!getArchiveExt(item.name) }

  onMounted(async () => {
    try {
      const init = await fetch(`${API_BASE}/_api/${API_V}/app/init`).then(r => r.json())
      platform.value = init.platform ?? 'linux'
    } catch { /* non-fatal */ }
    try { archiveCaps.value = await fsArchiveCapabilities() } catch { /* non-fatal */ }
  })

  return { archiveCaps, platform, isArchiveItem, getArchiveExt }
}
