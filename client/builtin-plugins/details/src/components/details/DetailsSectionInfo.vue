<template>
  <div class="dsi">
    <div v-if="!selectedPath" class="dsi-empty">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiInformationOutline" /></svg>
      Select a file to see details
    </div>

    <template v-else>
      <!-- Identity: thumb + name + path -->
      <div class="dsi-identity">
        <div class="dsi-thumb">
          <img v-if="thumbSrc && !thumbFailed"
               :src="thumbSrc" class="dsi-thumb-img"
               :style="{ opacity: thumbLoaded ? 1 : 0 }"
               @load="thumbLoaded = true" @error="thumbFailed = true" />
          <img v-else-if="packIconSrc && !packIconFailed"
               :src="packIconSrc" class="dsi-thumb-pack"
               @error="packIconFailed = true" />
          <svg v-else class="dsi-thumb-mdi" viewBox="0 0 24 24" fill="currentColor">
            <path :d="fallbackIcon" />
          </svg>
        </div>
        <div class="dsi-identity-meta">
          <!-- Inline rename: double-click to edit -->
          <input v-if="isRenaming"
                 ref="renameInputRef"
                 v-model="renameValue"
                 class="dsi-filename-input"
                 @keydown.enter.prevent="commitRename"
                 @keydown.escape.prevent="cancelRename"
                 @blur="commitRename" />
          <div v-else
               class="dsi-filename"
               :title="itemName"
               @dblclick="startRename">{{ itemName }}</div>
          <div class="dsi-filepath mono" :title="selectedPath">{{ selectedPath }}</div>
        </div>
      </div>

      <!-- Open actions -->
      <div class="dsi-actions">
        <button class="dsi-btn dsi-btn--primary" @click="doOpen">Open</button>
        <button class="dsi-btn" @click="doOpenWith">Open with…</button>
      </div>

      <!-- Key-value rows -->
      <dl class="dsi-rows">
        <template v-if="details">
          <div class="dsi-row">
            <dt>Type</dt>
            <dd>{{ typeLabel }}</dd>
          </div>
          <div v-if="mimeType" class="dsi-row">
            <dt>MIME</dt>
            <dd class="mono dsi-row-trunc" :title="mimeType">{{ mimeType }}</dd>
          </div>
          <div class="dsi-row">
            <dt>Size</dt>
            <dd>
              <span v-if="dirSizeLoading" class="dsi-shimmer dsi-shimmer--inline" />
              <template v-else>{{ sizeDisplay }}</template>
            </dd>
          </div>
          <div v-if="details.mtime" class="dsi-row">
            <dt>Modified</dt>
            <dd>{{ formatDate(details.mtime) }}</dd>
          </div>
          <div v-if="meta?.width" class="dsi-row">
            <dt>Dimensions</dt>
            <dd>{{ meta.width }} × {{ meta.height }}px</dd>
          </div>
        </template>
        <template v-else>
          <div v-for="n in 3" :key="n" class="dsi-row dsi-row--skeleton">
            <dt><span class="dsi-shimmer" /></dt>
            <dd><span class="dsi-shimmer dsi-shimmer--wide" /></dd>
          </div>
        </template>
      </dl>
    </template>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { mdiFile, mdiFolder, mdiArchive, mdiInformationOutline } from '@mdi/js'
import { useIconPack } from '~/composables/useIconPack.js'
import { resolveCustomIcon } from '~/composables/useCustomIcon.js'
import { API_BASE, API_V, MEDIA_BASE } from '~/lib/api-config.js'
import { fsOpenWithSystem } from '~/lib/fs-api.js'

const props = defineProps({
  selectedPath: { type: String, default: '' },
  selectedItem: { type: Object, default: null },
  details:      { type: Object, default: null },
})

const emit = defineEmits(['rename'])

// ── Icon pack ─────────────────────────────────────────────────────────────────

const { ensureLoaded, resolveIcon, iconUrl, isAvailable: iconPackAvailable } = useIconPack()
ensureLoaded()

// ── Fetched data ──────────────────────────────────────────────────────────────

const meta           = ref(null)
const dirSize        = ref(null)   // { size: number, files: number }
const dirSizeLoading = ref(false)
const thumbLoaded    = ref(false)
const thumbFailed    = ref(false)
const packIconFailed = ref(false)

// ── Rename state ──────────────────────────────────────────────────────────────

const isRenaming    = ref(false)
const renameValue   = ref('')
const renameInputRef = ref(null)

function startRename() {
  renameValue.value = itemName.value
  isRenaming.value  = true
  nextTick(() => renameInputRef.value?.select())
}

function cancelRename() {
  isRenaming.value = false
}

function commitRename() {
  if (!isRenaming.value) return
  isRenaming.value = false
  const newName = renameValue.value.trim()
  if (!newName || newName === itemName.value) return
  emit('rename', { path: props.selectedPath, newName })
}

// ── File type ─────────────────────────────────────────────────────────────────

const isDir = computed(() => props.details?.kind === 'dir')

const ext = computed(() => {
  const p = props.selectedPath
  if (!p) return ''
  const dot = p.lastIndexOf('.')
  return dot >= 0 ? p.slice(dot + 1).toLowerCase() : ''
})

// ── Display values ────────────────────────────────────────────────────────────

const itemName = computed(() =>
  props.selectedItem?.name ?? props.details?.name ?? props.selectedPath?.split('/').pop() ?? ''
)

const mimeType = computed(() => meta.value?.mime_type ?? null)

const typeLabel = computed(() => {
  const k = props.details?.kind
  if (k === 'dir')     return 'Directory'
  if (k === 'archive') return 'Archive'
  if (k === 'app')     return 'Application'
  if (!ext.value)      return 'File'
  return `.${ext.value.toUpperCase()} file`
})

const sizeDisplay = computed(() => {
  if (isDir.value) {
    if (dirSize.value != null) {
      const sz = formatBytes(dirSize.value.size)
      const fc = dirSize.value.files
      return fc != null ? `${sz} (${fc.toLocaleString()} files)` : sz
    }
    return '—'
  }
  return formatBytes(props.details?.size)
})

// ── Icon / thumbnail ──────────────────────────────────────────────────────────

// Media extensions whose thumbnail the server can render, mirroring DirectoryTab.
const THUMB_IMAGE = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'bmp', 'ico', 'avif'])
const THUMB_AV    = new Set(['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'flv', 'wmv', 'ts', 'mpeg', 'mpg', 'm2ts', 'mp3', 'm4a', 'flac', 'ogg', 'opus', 'aac', 'wav', 'aiff', 'wma'])
const THUMB_SIZE  = 256

// The selection item carries a `thumbnail` only when the directory view that
// produced it decorated one (it's a layout-side enrichment, not part of the
// published selection contract). So we derive the URL from the path ourselves —
// the same way Preview does — and only fall back to the carried field. This keeps
// Details self-sufficient as a selection consumer (a thumbnail shows whether the
// selection came from a grid, a tree, or anywhere else).
const thumbSrc = computed(() => {
  const path = props.selectedPath
  if (!path || isDir.value) return null
  if (ext.value === 'exe') return `${MEDIA_BASE}/exe_icon?path=${encodeURIComponent(path)}`
  if (THUMB_IMAGE.has(ext.value)) return `${MEDIA_BASE}/image?path=${encodeURIComponent(path)}&size=${THUMB_SIZE}`
  if (THUMB_AV.has(ext.value))    return `${MEDIA_BASE}/thumbnail?path=${encodeURIComponent(path)}&size=${THUMB_SIZE}`
  return props.selectedItem?.thumbnail ?? null
})

const packIconSrc = computed(() => {
  if (packIconFailed.value) return null
  const item = props.selectedItem
  if (!item) return null
  if (item.kind === 'dir') {
    const d = resolveCustomIcon(item.customization?.icon)
    if (d?.type === 'url') return d.url
  }
  if (item.icon) return iconUrl(item.icon)
  if (!iconPackAvailable.value) return null
  const name = resolveIcon(item.name, item.kind === 'dir')
  return name ? iconUrl(name) : null
})

const fallbackIcon = computed(() => {
  const k = props.details?.kind ?? props.selectedItem?.kind
  if (k === 'dir') return mdiFolder
  if (k === 'archive') return mdiArchive
  return mdiFile
})

// ── Data fetching ─────────────────────────────────────────────────────────────

watch(
  () => [props.selectedPath, props.details?.kind],
  async ([path, kind]) => {
    meta.value       = null
    dirSize.value    = null
    thumbLoaded.value    = false
    thumbFailed.value    = false
    packIconFailed.value = false
    isRenaming.value = false
    if (!path) return

    if (kind && kind !== 'dir') {
      try {
        const r = await fetch(`${MEDIA_BASE}/metadata?path=${encodeURIComponent(path)}`)
        if (r.ok) meta.value = await r.json()
      } catch { /* silent */ }
    }

    if (kind === 'dir') {
      dirSizeLoading.value = true
      try {
        const r = await fetch(`${API_BASE}/_api/${API_V}/fs/dir_size?path=${encodeURIComponent(path)}`)
        if (r.ok) dirSize.value = await r.json()
      } catch { /* silent */ }
      finally { dirSizeLoading.value = false }
    }
  },
  { immediate: true },
)

// ── Actions ───────────────────────────────────────────────────────────────────

function doOpen()     { if (props.selectedPath) fsOpenWithSystem(props.selectedPath) }
function doOpenWith() { /* TODO: open system dialog */ }

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatBytes(bytes) {
  if (bytes == null || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, b = Number(bytes)
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(ts) {
  if (!ts) return '—'
  const d = new Date(ts)
  return isNaN(d.getTime()) ? ts : d.toLocaleString()
}
</script>

<style scoped>
.dsi {
  display: flex;
  flex-direction: column;
  padding: 8px 10px 10px;
  font-size: 13px;
  color: var(--text);
}

.dsi-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 24px 0 8px;
  color: var(--text-muted);
  font-size: 13px;
  text-align: center;
}

/* ── Identity ──────────────────────────────────────────────────────────────── */

.dsi-identity {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding-bottom: 10px;
}

.dsi-thumb {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  background: var(--surface-alt, rgba(255,255,255,0.04));
  overflow: hidden;

  .dsi-thumb-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: opacity 0.15s;
  }

  .dsi-thumb-pack {
    width: 32px;
    height: 32px;
    object-fit: contain;
  }

  .dsi-thumb-mdi {
    width: 28px;
    height: 28px;
    color: var(--text-muted);
  }
}

.dsi-identity-meta {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 2px;
}

.dsi-filename {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: text;
  border-radius: 3px;

  &:hover { background: var(--hover-background, rgba(255,255,255,0.05)); }
}

.dsi-filename-input {
  font-size: 13px;
  font-weight: 600;
  font-family: inherit;
  background: var(--surface-alt, rgba(255,255,255,0.08));
  border: 1px solid var(--accent, #0078d4);
  border-radius: 3px;
  color: var(--text);
  padding: 1px 4px;
  width: 100%;
  outline: none;
  box-sizing: border-box;
}

.dsi-filepath {
  font-size: 11px;
  color: var(--text-muted);
  word-break: break-all;
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Actions ───────────────────────────────────────────────────────────────── */

.dsi-actions {
  display: flex;
  gap: 6px;
  padding-bottom: 10px;
}

.dsi-btn {
  flex: 1;
  height: 26px;
  border: 1px solid var(--border, rgba(255,255,255,0.15));
  border-radius: 4px;
  background: transparent;
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
  padding: 0 10px;

  &:hover { background: var(--hover-background); }

  &.dsi-btn--primary {
    background: var(--accent, #0078d4);
    border-color: transparent;
    color: #fff;

    &:hover { opacity: 0.85; }
  }
}

/* ── Key-value rows ────────────────────────────────────────────────────────── */

.dsi-rows {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.dsi-row {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  padding: 4px 0;
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.04));
  align-items: baseline;

  &:last-child { border-bottom: none; }

  dt {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  dd {
    font-size: 12px;
    color: var(--text);
    word-break: break-word;
    margin: 0;
  }

  &.dsi-row--skeleton {
    dt { height: 11px; }
    dd { height: 12px; }
  }
}

.dsi-row-trunc {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Shimmer ───────────────────────────────────────────────────────────────── */

.dsi-shimmer {
  display: block;
  height: 11px;
  width: 60%;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--surface-alt, rgba(255,255,255,0.06)) 25%,
    var(--hover-background, rgba(255,255,255,0.1)) 50%,
    var(--surface-alt, rgba(255,255,255,0.06)) 75%
  );
  background-size: 200% 100%;
  animation: dsi-shimmer 1.4s infinite;

  &.dsi-shimmer--wide   { width: 85%; }
  &.dsi-shimmer--inline { display: inline-block; height: 12px; width: 80px; vertical-align: middle; }
}

@keyframes dsi-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Mono ──────────────────────────────────────────────────────────────────── */

.mono {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 11px;
}
</style>
