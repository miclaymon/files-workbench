<template>
  <div class="directory-tab-root">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner" />
      <span class="loading-label">Loading…</span>
    </div>
    <DirectoryPanel
      ref="directoryPanelRef"
      :items="itemsWithThumbnails"
      :dir-sizes="dirSizes"
      :selectedItems="props.selectedItems"
      :focusedItem="props.focusedItem"
      :layout="prefs.layout ?? 'grid'"
      :alwaysShowCheckboxes="prefs.alwaysShowCheckboxes"
      :hoverPreviewEnabled="prefs.hoverPreviewEnabled ?? true"
      :hoverPreviewDelayMs="prefs.hoverPreviewDelayMs ?? 2000"
      :currentPath="props.path"
      :navigationHistory="navigationHistory"
      :changeTabPath="changeTabPath"
      @select="handleSelect"
      @contextmenu="showContextMenu"
      @background-contextmenu="$emit('background-contextmenu', $event)"
      @right-drag-drop="$emit('right-drag-drop', $event)"
      @navigate="handleNavigate"
      @navigate-up="handleNavigateUp"
      @navigate-previous="handleNavigatePrevious"
      @navigate-next="handleNavigateNext"
      @update:layout="$emit('update:layout', $event)"
      @rename="$emit('rename', $event)"
      @rename-batch="$emit('rename-batch', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, reactive, shallowReactive, onMounted, onUnmounted, onActivated } from 'vue'
import { MEDIA_BASE } from '~/lib/api-config.js'
import { fsStat, fsListDir, fsDirSize, fsArchiveList, fsExeInfo } from '~/lib/fs-api.js'
import { perfStart, perfMark, perfFlush } from '~/lib/perf-log.js'

const ARCHIVE_EXTS = ['.zip', '.tar', '.tar.gz', '.tar.bz2', '.tgz', '.tbz2', '.7z', '.rar', '.gz', '.bz2', '.xz', '.tar.xz']
function isArchivePath(p) {
  const lower = p.toLowerCase()
  return ARCHIVE_EXTS.some(ext => lower.endsWith(ext))
}

// Archive listings are sorted client-side (dirs first, then case-insensitive name).
// Regular directory listings arrive already sorted from the server, so they are not
// re-sorted here. Shared by the initial fetch and the background soft-refresh.
function sortArchiveItems(list) {
  return list.sort((a, b) => {
    if ((a.kind === 'dir') !== (b.kind === 'dir')) return a.kind === 'dir' ? -1 : 1
    return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
  })
}

const props = defineProps({
  path: { type: String, required: true },
  excludedCategories: { type: Array, default: () => ['System'] },
  selectedPath: { type: String, required: true },
  prefs: { type: Object, required: true },
  selectedItems: { type: Array, default: () => [] },
  focusedItem: { type: Object, default: null },
})

const emit = defineEmits(['select', 'open', 'navigate', 'contextmenu', 'background-contextmenu', 'right-drag-drop', 'update:layout', 'rename', 'rename-batch', 'stats'])

const directoryPanelRef = ref(null)
const navigationHistory = ref({ previous: [], next: [] })

// Parsed archive info when the current path is a virtual archive path (contains '::')
const archiveInfo = computed(() => {
  const idx = props.path.indexOf('::')
  if (idx === -1) return null
  return { archiveFile: props.path.slice(0, idx), innerPath: props.path.slice(idx + 2) }
})

// Internal fetch state
const items = ref([])
const loading = ref(false)
// Async directory sizes kept OFF the items array, keyed by path:
//   path → { size, files, loading }
// Storing them on the items would make the `itemsWithThumbnails` spread recompute
// every item (new identities → grid flicker, thumbnail churn). A separate reactive
// map lets each <DirSizeCell> track only its own key and re-render in isolation.
const dirSizes = reactive({})
let _gen = 0
// Stable per-item identity, assigned at fetch time and preserved across renames so
// the directory grid's v-for key never changes for an existing item. Without this,
// an optimistic rename (path change) would change the key and force Vue to remount
// the item — reloading its thumbnail and causing flicker / 404s mid-rename.
let _uid = 0
let _ctrl = null

async function fetchItems(path) {
  const gen = ++_gen
  _ctrl?.abort()
  const ctrl = new AbortController()
  _ctrl = ctrl
  loading.value = true
  items.value = []
  for (const k of Object.keys(dirSizes)) delete dirSizes[k]
  emit('stats', { count: 0, totalSize: 0 })

  try {
    const info = archiveInfo.value
    if (info) {
      // Virtual archive path: list archive contents
      const result = await fsArchiveList(info.archiveFile, info.innerPath, { signal: ctrl.signal })
      if (gen !== _gen) return
      items.value = sortArchiveItems((result.items ?? []).map(item => ({
        ...item,
        _id: ++_uid,
        path: info.archiveFile + '::' + info.innerPath + item.name + (item.kind === 'dir' ? '/' : ''),
      })))
    } else {
      // Phase 1: fetch listing without dir sizes — renders immediately
      const excl = (props.excludedCategories ?? ['System']).join(',')
      const showHidden = props.prefs?.showHiddenFiles ?? false
      perfStart(`list_dir:${path}`)
      perfMark('mount')
      const result = await fsListDir(path, { includeMetadata: true, showHidden, excludeCategories: excl, signal: ctrl.signal })
      if (gen !== _gen) return
      items.value = (result.items ?? []).map(item => ({ ...item, _id: ++_uid }))
      seedDirSizePlaceholders()
    }
    emitStats()
  } catch {
    if (!ctrl.signal.aborted) items.value = []
  } finally {
    if (_ctrl === ctrl) {
      // Keep _ctrl live through phase 2 so the next navigation can abort it.
      loading.value = false
    }
  }

  if (!archiveInfo.value) {
    perfMark('items-ready')
    perfFlush()
    // Phase 2: backfill directory sizes concurrently (shimmer shows while pending)
    await fetchDirSizes(gen, ctrl)
  }

  if (_ctrl === ctrl) _ctrl = null
}

// Emit directory stats: file sizes are known up front, directory sizes are folded
// in from `dirSizes` as they resolve.
function emitStats() {
  let total = 0
  for (const it of items.value) {
    total += it.kind === 'dir' ? (dirSizes[it.path]?.size ?? 0) : (it.size ?? 0)
  }
  emit('stats', { count: items.value.length, totalSize: total })
}

// Mark the current directories as pending (the previous directory's entries were
// already cleared on reset) so their cells show the shimmer immediately, before
// phase 2 begins fetching.
function seedDirSizePlaceholders() {
  for (const it of items.value) {
    if (it.kind === 'dir') dirSizes[it.path] = { size: null, files: null, loading: true }
  }
}

// Resolve directory sizes in the background, capped at DIRS_CONCURRENCY in-flight
// requests. Each result updates only its own `dirSizes` entry, so only that one
// <DirSizeCell> re-renders — the item objects (and thus the grid rows) are untouched.
const DIRS_CONCURRENCY = 4

function fetchDirSizes(gen, ctrl) {
  const dirPaths = items.value.filter(i => i.kind === 'dir').map(i => i.path)
  return fetchDirSizesFor(dirPaths, gen, ctrl)
}

async function fetchDirSizesFor(dirPaths, gen, ctrl) {
  if (!dirPaths.length) return
  let idx = 0
  async function worker() {
    while (idx < dirPaths.length) {
      if (gen !== _gen) return
      const path = dirPaths[idx++]
      try {
        const { size, files } = await fsDirSize(path, ctrl.signal)
        if (gen !== _gen) return
        dirSizes[path] = { size, files, loading: false }
        emitStats()
      } catch {
        // Aborted or network error — clear the pending flag so the cell stops
        // shimmering (falls back to '—') instead of spinning forever.
        if (gen === _gen && dirSizes[path]) dirSizes[path] = { ...dirSizes[path], loading: false }
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(DIRS_CONCURRENCY, dirPaths.length) }, worker))
}

// Non-destructive background refresh, used when a kept-alive tab is re-revealed (see
// onActivated). Re-lists the current directory and reconciles it against the existing
// items by path: unchanged entries keep their object identity (and _id), so their grid
// cells and thumbnails are NOT remounted; only added / removed / changed entries move.
// Bails early when nothing changed, so an unchanged folder costs one listing call and
// no DOM work. Mirrors the directory tree's diff-merge (useDirectoryFileTree).
async function softRefresh() {
  const path = props.path
  const info = archiveInfo.value
  const gen = ++_gen
  _ctrl?.abort()
  const ctrl = new AbortController()
  _ctrl = ctrl
  try {
    let fresh
    if (info) {
      const result = await fsArchiveList(info.archiveFile, info.innerPath, { signal: ctrl.signal })
      if (gen !== _gen) return
      fresh = (result.items ?? []).map(item => ({
        ...item,
        path: info.archiveFile + '::' + info.innerPath + item.name + (item.kind === 'dir' ? '/' : ''),
      }))
    } else {
      const excl = (props.excludedCategories ?? ['System']).join(',')
      const showHidden = props.prefs?.showHiddenFiles ?? false
      const result = await fsListDir(path, { includeMetadata: true, showHidden, excludeCategories: excl, signal: ctrl.signal })
      if (gen !== _gen) return
      fresh = result.items ?? []
    }

    // Reconcile by path, reusing existing objects where the entry is unchanged.
    const prevByPath = new Map(items.value.map(it => [it.path, it]))
    let changed = fresh.length !== items.value.length
    let merged = fresh.map((f) => {
      const prev = prevByPath.get(f.path)
      if (!prev) { changed = true; return { ...f, _id: ++_uid } }
      if (prev.size !== f.size || prev.date_modified !== f.date_modified) {
        changed = true
        return { ...prev, ...f, _id: prev._id }   // patch metadata, keep identity
      }
      return prev   // unchanged — same reference, Vue skips its DOM
    })
    if (!changed) return   // folder is identical; don't touch items / dirSizes

    if (info) merged = sortArchiveItems(merged)   // regular listings keep server order
    items.value = merged

    // Reconcile the directory-size cache: drop vanished paths, seed + fetch the new
    // dirs only (existing dirs keep their resolved sizes).
    const livePaths = new Set(merged.map(i => i.path))
    for (const k of Object.keys(dirSizes)) if (!livePaths.has(k)) delete dirSizes[k]
    if (!info) {
      const newDirPaths = merged.filter(i => i.kind === 'dir' && !(i.path in dirSizes)).map(i => i.path)
      for (const p of newDirPaths) dirSizes[p] = { size: null, files: null, loading: true }
      emitStats()
      if (newDirPaths.length) await fetchDirSizesFor(newDirPaths, gen, ctrl)
    } else {
      emitStats()
    }
  } catch {
    // aborted or network error — keep the current items as-is
  } finally {
    if (_ctrl === ctrl) _ctrl = null
  }
}

watch(() => props.path, (newPath) => { fetchItems(newPath) })
watch(() => props.prefs?.showHiddenFiles, () => { fetchItems(props.path) })

const IMAGE_EXTS = new Set(['png','jpg','jpeg','webp','gif','bmp','ico','avif'])
const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts'])
const AUDIO_EXTS = new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma'])
const THUMB_SIZE = 256
const thumbnailsEnabled = ref(false)

async function checkThumbnailSupport() {
  try {
    const res = await fetch(`${MEDIA_BASE}/capabilities`)
    if (res.ok) {
      const data = await res.json()
      thumbnailsEnabled.value = data.thumbnails === true
    }
  } catch {
    // server unreachable — leave thumbnails disabled
  }
}

// Lazily-populated cache of exe version info: path → { name, publisher, version, description }
const exeInfoCache = shallowReactive({})

watch(() => items.value, (newItems) => {
  const exes = newItems.filter(item =>
    item.kind === 'file' &&
    !item.path.includes('::') &&
    item.name.toLowerCase().endsWith('.exe') &&
    !(item.path in exeInfoCache)
  )
  for (const item of exes) {
    exeInfoCache[item.path] = null // mark pending to avoid duplicate fetches
    fsExeInfo(item.path)
      .then(info => { exeInfoCache[item.path] = info ?? null })
      .catch(() => {})
  }
})

const itemsWithThumbnails = computed(() => items.value.map(item => {
  const ext = item.name.split('.').pop()?.toLowerCase()
  const inArchive = item.path.includes('::')
  let thumbnail = null
  if (!inArchive) {
    // During optimistic rename, thumbnailPath holds the old (still-existing) path so the
    // thumbnail URL remains valid until the server-side rename completes.
    const srcPath = item.thumbnailPath ?? item.path
    if (ext === 'exe') {
      thumbnail = `${MEDIA_BASE}/exe_icon?path=${encodeURIComponent(srcPath)}`
    } else if (thumbnailsEnabled.value) {
      thumbnail = IMAGE_EXTS.has(ext)
        ? `${MEDIA_BASE}/image?path=${encodeURIComponent(srcPath)}&size=${THUMB_SIZE}`
        : (VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext))
          ? `${MEDIA_BASE}/thumbnail?path=${encodeURIComponent(srcPath)}&size=${THUMB_SIZE}`
          : null
    }
  }
  const exeInfo = ext === 'exe' ? (exeInfoCache[item.path] ?? null) : null
  return {
    ...item,
    thumbnail,
    icon: item.icon ?? null,
    displayName: exeInfo?.name ?? null,
    exeInfo,
  }
}))

function handleKeyDown(event) {
  if (!event.altKey) return
  switch (event.key) {
    case 'ArrowLeft':
      event.preventDefault()
      if (navigationHistory.value.previous.length > 0) handleNavigatePrevious()
      break
    case 'ArrowRight':
      event.preventDefault()
      if (navigationHistory.value.next.length > 0) handleNavigateNext()
      break
    case 'ArrowUp':
      event.preventDefault()
      handleNavigateUp()
      break
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  checkThumbnailSupport()
  fetchItems(props.path)
})

// The tab is kept alive, so re-revealing it from the cache fires onActivated. Skip the
// first one (it coincides with the initial mount, which already fetched) and on every
// later reveal run a background diff-refresh to pick up filesystem changes without a
// full reload.
let _activatedOnce = false
onActivated(() => {
  if (!_activatedOnce) { _activatedOnce = true; return }
  softRefresh()
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  _ctrl?.abort()
})

async function changeTabPath(newPath, options = {}) {
  const { isHistoryNavigation = false, clearNextHistory = true, addToPrevious = true } = options

  if (newPath === props.path) return

  if (isHistoryNavigation) {
    if (addToPrevious) navigationHistory.value.previous.push(props.path)
    else navigationHistory.value.next.push(props.path)
  } else if (addToPrevious) {
    navigationHistory.value.previous.push(props.path)
  }

  if (clearNextHistory && !isHistoryNavigation) {
    navigationHistory.value.next = []
  }

  emit('navigate', newPath)
}

// Patch a single item optimistically without re-fetching. Returns true if found.
function renameItem(oldPath, newName, newPath) {
  const idx = items.value.findIndex(item => item.path === oldPath)
  if (idx === -1) return false

  const updated = { ...items.value[idx], name: newName, path: newPath }

  // Preserve sort order: dirs first, then case-insensitive by name
  items.value = items.value
    .map((item, i) => (i === idx ? updated : item))
    .sort((a, b) => {
      const ad = a.kind === 'dir' || a.kind === 'app'
      const bd = b.kind === 'dir' || b.kind === 'app'
      if (ad !== bd) return ad ? -1 : 1
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })

  // Keep exe_info cache consistent
  if (oldPath in exeInfoCache) {
    exeInfoCache[newPath] = exeInfoCache[oldPath]
    delete exeInfoCache[oldPath]
  }

  return true
}

function batchRenameItems(ops) {
  // Map of oldPath → op for quick lookup
  const opMap = new Map(ops.map(o => [o.oldPath, o]))
  const anyMatch = items.value.some(item => opMap.has(item.path))
  if (!anyMatch) return

  items.value = items.value
    .map(item => {
      const o = opMap.get(item.path)
      if (!o) return item  // same object reference — Vue skips DOM diff
      const updated = { ...item, name: o.newName, path: o.newPath, thumbnailPath: item.path }
      if (item.path in exeInfoCache) {
        exeInfoCache[o.newPath] = exeInfoCache[item.path]
        delete exeInfoCache[item.path]
      }
      return updated
    })
    .sort((a, b) => {
      const ad = a.kind === 'dir' || a.kind === 'app'
      const bd = b.kind === 'dir' || b.kind === 'app'
      if (ad !== bd) return ad ? -1 : 1
      return a.name.toLowerCase().localeCompare(b.name.toLowerCase())
    })
}

function clearOptimisticThumbnails(paths) {
  const pathSet = new Set(paths)
  if (!items.value.some(item => pathSet.has(item.path) && item.thumbnailPath)) return
  items.value = items.value.map(item =>
    pathSet.has(item.path) && item.thumbnailPath
      ? { ...item, thumbnailPath: undefined }
      : item
  )
}

defineExpose({ changeTabPath, navigationHistory, refresh: () => fetchItems(props.path), renameItem, batchRenameItems, clearOptimisticThumbnails })

function showContextMenu({ event, item }) { emit('contextmenu', { event, item }) }

function handleNavigate(item) {
  const path = typeof item === 'string' ? item : item.path
  const kind = typeof item === 'object' ? item.kind : null

  // Inside an archive: files can't be opened (read-only view)
  if (archiveInfo.value && kind === 'file') return

  // Archive file on disk: open as virtual directory instead of navigating into a real dir
  if (!archiveInfo.value && kind === 'file' && isArchivePath(path)) {
    changeTabPath(path + '::')
    return
  }

  changeTabPath(path)
}

function handleSelect(payload) { emit('select', payload) }

function handleNavigateUp() {
  const info = archiveInfo.value
  if (info) {
    const inner = info.innerPath.replace(/\/$/, '') // strip trailing slash
    if (!inner) {
      // At archive root → go to real parent directory
      const parts = info.archiveFile.split('/')
      parts.pop()
      changeTabPath(parts.join('/') || '/')
    } else {
      const parentParts = inner.split('/')
      parentParts.pop()
      const parentInner = parentParts.length > 0 ? parentParts.join('/') + '/' : ''
      changeTabPath(info.archiveFile + '::' + parentInner)
    }
    return
  }
  const parts = props.path.split(/[/\\]/).filter(Boolean)
  if (parts.length > 1) {
    const sep = props.path.includes('\\') ? '\\' : '/'
    const parentPath = (props.path.startsWith('/') ? '/' : '') + parts.slice(0, -1).join(sep)
    changeTabPath(parentPath)
  }
}

async function handleNavigatePrevious() {
  if (navigationHistory.value.previous.length === 0) return
  let targetPath = null
  while (navigationHistory.value.previous.length > 0 && !targetPath) {
    const candidate = navigationHistory.value.previous.pop()
    if (candidate.includes('::')) {
      targetPath = candidate // virtual archive paths are always valid
    } else {
      try { await fsStat(candidate); targetPath = candidate } catch { /* skip gone paths */ }
    }
  }
  if (targetPath) changeTabPath(targetPath, { isHistoryNavigation: true, clearNextHistory: false, addToPrevious: false })
}

async function handleNavigateNext() {
  if (navigationHistory.value.next.length === 0) return
  let targetPath = null
  while (navigationHistory.value.next.length > 0 && !targetPath) {
    const candidate = navigationHistory.value.next.pop()
    if (candidate.includes('::')) {
      targetPath = candidate
    } else {
      try { await fsStat(candidate); targetPath = candidate } catch { /* skip gone paths */ }
    }
  }
  if (targetPath) changeTabPath(targetPath, { isHistoryNavigation: true, clearNextHistory: false, addToPrevious: true })
}
</script>

<style scoped>
.directory-tab-root { position: relative; height: 100%; display: flex; flex-direction: column; }

.loading-overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  background: var(--editor-background, #1e1e1e);
  z-index: 10;
}

.loading-spinner {
  width: 28px;
  height: 28px;
  border: 3px solid rgba(255,255,255,0.1);
  border-top-color: var(--accent, #007acc);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin { to { transform: rotate(360deg); } }

.loading-label { font-size: 13px; color: var(--text-muted); user-select: none; }
</style>
