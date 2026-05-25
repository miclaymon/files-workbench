<template>
  <div class="directory-tab-root">
    <div v-if="loading" class="loading-overlay">
      <div class="loading-spinner" />
      <span class="loading-label">Loading…</span>
    </div>
    <DirectoryPanel
      ref="directoryPanelRef"
      :items="itemsWithThumbnails"
      :selectedItems="props.selectedItems"
      :focusedItem="props.focusedItem"
      :layout="prefs.layout ?? 'grid'"
      :alwaysShowCheckboxes="prefs.alwaysShowCheckboxes"
      :currentPath="props.path"
      :navigationHistory="navigationHistory"
      :changeTabPath="changeTabPath"
      @select="handleSelect"
      @focus="handleFocus"
      @contextmenu="showContextMenu"
      @navigate="handleNavigate"
      @navigate-up="handleNavigateUp"
      @navigate-previous="handleNavigatePrevious"
      @navigate-next="handleNavigateNext"
      @update:layout="$emit('update:layout', $event)"
      @rename="$emit('rename', $event)"
    />
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { MEDIA_BASE } from '~/lib/api-config.js'
import { fsStat, fsListDir } from '~/lib/fs-api.js'
import { perfStart, perfMark, perfFlush } from '~/lib/perf-log.js'

const props = defineProps({
  path: { type: String, required: true },
  excludedCategories: { type: Array, default: () => ['System'] },
  selectedPath: { type: String, required: true },
  prefs: { type: Object, required: true },
  selectedItems: { type: Array, default: () => [] },
  focusedItem: { type: Object, default: null },
})

const emit = defineEmits(['select', 'open', 'navigate', 'contextmenu', 'update:layout', 'rename', 'stats'])

const directoryPanelRef = ref(null)
const navigationHistory = ref({ previous: [], next: [] })

// Internal fetch state
const items = ref([])
const loading = ref(false)
let _gen = 0
let _ctrl = null

async function fetchItems(path) {
  const gen = ++_gen
  _ctrl?.abort()

  const ctrl = new AbortController()
  _ctrl = ctrl

  const excl = (props.excludedCategories ?? ['System']).join(',')
  const showHidden = props.prefs?.showHiddenFiles ?? false

  perfStart(`list_dir:${path}`)
  perfMark('mount')

  loading.value = true
  items.value = []
  emit('stats', { count: 0, totalSize: 0 })
  try {
    const result = await fsListDir(path, { includeMetadata: true, showHidden, excludeCategories: excl, signal: ctrl.signal })
    if (gen !== _gen) return
    items.value = result.items ?? []
    const totalSize = items.value.reduce((sum, i) => sum + (i.size ?? 0), 0)
    emit('stats', { count: items.value.length, totalSize })
  } catch {
    if (!ctrl.signal.aborted) items.value = []
  } finally {
    if (_ctrl === ctrl) {
      _ctrl = null
      loading.value = false
    }
  }

  perfMark('items-ready')
  perfFlush()
}

watch(() => props.path, (newPath) => { fetchItems(newPath) })

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

const itemsWithThumbnails = computed(() => items.value.map(item => {
  const ext = item.name.split('.').pop()?.toLowerCase()
  return {
    ...item,
    thumbnail: thumbnailsEnabled.value
      ? IMAGE_EXTS.has(ext) ? `${MEDIA_BASE}/image?path=${encodeURIComponent(item.path)}&size=${THUMB_SIZE}`
      : (VIDEO_EXTS.has(ext) || AUDIO_EXTS.has(ext)) ? `${MEDIA_BASE}/thumbnail?path=${encodeURIComponent(item.path)}&size=${THUMB_SIZE}`
      : null
      : null,
    icon: item.icon ?? null
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

defineExpose({ changeTabPath, navigationHistory, refresh: () => fetchItems(props.path) })

function showContextMenu({ event, item }) { emit('contextmenu', { event, item }) }

function handleNavigate(item) {
  const path = typeof item === 'string' ? item : item.path
  changeTabPath(path)
}

function handleSelect(payload) { emit('select', payload) }
function handleFocus() { /* focus is managed by DirectoryPanel */ }

function handleNavigateUp() {
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
    try {
      await fsStat(candidate)
      targetPath = candidate
    } catch {
      // path no longer exists, skip
    }
  }

  if (targetPath) {
    changeTabPath(targetPath, { isHistoryNavigation: true, clearNextHistory: false, addToPrevious: false })
  }
}

async function handleNavigateNext() {
  if (navigationHistory.value.next.length === 0) return

  let targetPath = null
  while (navigationHistory.value.next.length > 0 && !targetPath) {
    const candidate = navigationHistory.value.next.pop()
    try {
      await fsStat(candidate)
      targetPath = candidate
    } catch {
      // path no longer exists, skip
    }
  }

  if (targetPath) {
    changeTabPath(targetPath, { isHistoryNavigation: true, clearNextHistory: false, addToPrevious: true })
  }
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
