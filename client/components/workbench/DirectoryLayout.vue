<template>
  <div class="dl" :data-layout="layout" :style="cssVars" tabindex="0" @keydown="onKeyDown" ref="dlRef">

    <!-- Column header — only visible in details layout -->
    <div class="dl-header">
      <template v-if="layout === 'details'">
        <label class="dl-hdr-check-wrap" @click.stop @mousedown.stop>
          <input type="checkbox" :checked="allSelected" @change="onSelectAll" />
        </label>
        <span class="dl-hdr-thumb-gap" />
      </template>
      <span v-else class="dl-hdr-spacer" />

      <span class="dl-col-name">Name</span>

      <template v-if="layout === 'details'">
        <span v-if="visibleColumns.has('size')" class="dl-col-size">Size</span>
        <span v-if="visibleColumns.has('date')" class="dl-col-date">Modified</span>
        <button class="dl-hdr-menu-btn" @click.stop="toggleColumnMenu" ref="columnMenuBtnRef" title="Columns">⋮</button>
      </template>
      <template v-else>
        <span class="dl-col-size">Size</span>
        <span class="dl-col-date">Modified</span>
      </template>
    </div>

    <div
      v-for="item in displayItems"
      :key="item.path"
      class="dl-item"
      :data-path="item.path"
      :class="{
        'dl-item--selected': isSelected(item),
        'dl-item--focused':  isFocused(item),
        'dl-item--dragging': draggingPath === item.path,
        'dl-item--hidden':   item.hidden,
      }"
      @mousedown="(e) => onMouseDown(e, item)"
      @click="(e) => onItemClick(e, item)"
      @contextmenu.prevent="$emit('contextmenu', { event: $event, item })"
      @mouseenter="hoverItem = item"
      @mouseleave="hoverItem = null"
    >
      <!-- Checkbox -->
      <label
        class="dl-check"
        :class="{ 'dl-check--on': effectiveShowCheckboxes || isSelected(item) || hoverItem?.path === item.path }"
        @click.stop
        @mousedown.stop
      >
        <input
          type="checkbox"
          :checked="isSelected(item)"
          @change="(e) => onCheckboxChange(e, item)"
        />
      </label>

      <!-- Thumbnail -->
      <div class="dl-thumb">
        <img
          v-if="item.thumbnail && (imageStates[item.path] === 'loading' || imageStates[item.path] === 'loaded')"
          crossorigin="anonymous"
          :src="item.thumbnail"
          :alt="item.name"
          class="dl-img"
          :style="{ opacity: imageStates[item.path] === 'loaded' ? 1 : 0 }"
          @load="onImgLoad(item)"
          @error="onImgError(item)"
        />
        <div v-if="item.thumbnail && (imageStates[item.path] === 'idle' || imageStates[item.path] === 'loading')" class="dl-skeleton" />
        <svg
          v-if="!item.thumbnail || imageStates[item.path] === 'failed'"
          class="dl-icon"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path :d="iconPath(item)" />
        </svg>
      </div>

      <!-- Body: name + metadata row -->
      <div class="dl-body">
        <span
          v-if="renamingPath !== item.path"
          class="dl-name"
          @click="onNameClick($event, item)"
        >{{ item.name }}</span>
        <span
          v-else
          :ref="(el) => { if (el) nameEls[item.path] = el }"
          class="dl-name dl-name--editing"
          contenteditable="true"
          spellcheck="false"
          @keydown.enter.prevent.stop="commitRename(item)"
          @keydown.escape.prevent.stop="cancelRename()"
          @blur="commitRename(item)"
          @click.stop
          @mousedown.stop
        />
        <div class="dl-meta">
          <span
            class="dl-size"
            :class="{ 'dl-col--hidden': layout === 'details' && !visibleColumns.has('size') }"
          >{{ item.kind === 'file' ? formatBytes(item.size) : '—' }}</span>
          <span
            class="dl-date"
            :class="{ 'dl-col--hidden': layout === 'details' && !visibleColumns.has('date') }"
          >{{ item.modified ? formatDate(item.modified) : '' }}</span>
        </div>
      </div>

      <!-- Gallery-grid name overlay (shown on hover) -->
      <div class="dl-overlay">
        <span class="dl-overlay-name">{{ item.name }}</span>
      </div>
    </div>

    <!-- Column picker dropdown -->
    <div v-if="columnMenuVisible" class="dl-col-picker" :style="columnMenuStyle" ref="columnMenuRef">
      <label class="dl-col-option">
        <input type="checkbox" :checked="visibleColumns.has('size')" @change="toggleColumn('size')" />
        Size
      </label>
      <label class="dl-col-option">
        <input type="checkbox" :checked="visibleColumns.has('date')" @change="toggleColumn('date')" />
        Modified
      </label>
    </div>

  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant } from '@mdi/js'
import { useClickDebounce } from '~/composables/useClickDebounce.js'
import { useDrag } from '~/composables/useDrag.js'

const MEDIA_EXTS = new Set([
  'png','jpg','jpeg','webp','gif','bmp','ico','avif',
  'mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts',
  'mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma',
])

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  layout: { type: String, default: 'grid' },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'rename'])

// ── Layout CSS vars ───────────────────────────────────────────────────────
const GRID_CONFIG = {
  'grid-xs':  { minCell: 72,  iconSize: 36  },
  'grid-sm':  { minCell: 96,  iconSize: 48  },
  'grid':     { minCell: 120, iconSize: 64  },
  'grid-md':  { minCell: 120, iconSize: 64  },
  'grid-lg':  { minCell: 160, iconSize: 88  },
  'grid-xl':  { minCell: 200, iconSize: 112 },
  'grid-xxl': { minCell: 260, iconSize: 148 },
}

const cssVars = computed(() => {
  const cfg = GRID_CONFIG[props.layout]
  return cfg ? { '--min-cell': cfg.minCell + 'px', '--icon-size': cfg.iconSize + 'px' } : {}
})

// ── Container ref (for IntersectionObserver root) ─────────────────────────
const dlRef = ref(null)

// ── Image state ───────────────────────────────────────────────────────────
// States: '' = no thumbnail | 'idle' = not yet in viewport | 'loading' = fetching | 'loaded' | 'failed'
const imageStates = reactive({})

let _observer = null

function _onIntersect(entries) {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return
    const path = entry.target.dataset.path
    if (!path) return
    _observer?.unobserve(entry.target)
    if (imageStates[path] === 'idle') imageStates[path] = 'loading'
  })
}

async function _observeAll() {
  await nextTick()
  if (!_observer || !dlRef.value) return
  _observer.disconnect()
  dlRef.value.querySelectorAll('.dl-item[data-path]').forEach(el => {
    if (imageStates[el.dataset.path] === 'idle') _observer.observe(el)
  })
}

onMounted(() => {
  _observer = new IntersectionObserver(_onIntersect, {
    root: dlRef.value,
    rootMargin: '300px 0px',
  })
  _observeAll()
})

onUnmounted(() => { _observer?.disconnect(); _observer = null })

watch(() => props.items, (items) => {
  items.forEach(item => {
    if (item.thumbnail) {
      const prev = imageStates[item.path]
      if (!prev) imageStates[item.path] = 'idle'
    } else {
      imageStates[item.path] = ''
    }
  })
  if (_observer) _observeAll()
}, { immediate: true })

function onImgLoad(item) { imageStates[item.path] = 'loaded' }
function onImgError(item) { imageStates[item.path] = 'failed' }

// ── Gallery filter — media items only ─────────────────────────────────────
const displayItems = computed(() => {
  if (props.layout === 'gallery-grid') {
    return props.items.filter(item => {
      const ext = item.name.split('.').pop()?.toLowerCase()
      return ext && MEDIA_EXTS.has(ext)
    })
  }
  return props.items
})

// ── Selection mode ────────────────────────────────────────────────────────
const selectionMode = ref(false)

watch(() => props.selectedItems, (items) => {
  if (items.length > 0 && !selectionMode.value) selectionMode.value = true
  else if (items.length === 0) selectionMode.value = false
})

watch(() => props.items, () => {
  // Items change = navigation — exit selection mode
  selectionMode.value = false
})

const effectiveShowCheckboxes = computed(() => props.alwaysShowCheckboxes || selectionMode.value)

// ── Details column picker ─────────────────────────────────────────────────
const visibleColumns = ref(new Set(['size', 'date']))
const columnMenuVisible = ref(false)
const columnMenuStyle = ref({})
const columnMenuBtnRef = ref(null)
const columnMenuRef = ref(null)

function toggleColumnMenu() {
  if (columnMenuVisible.value) { columnMenuVisible.value = false; return }
  const btn = columnMenuBtnRef.value
  if (!btn) return
  const rect = btn.getBoundingClientRect()
  const dlRect = dlRef.value?.getBoundingClientRect()
  columnMenuStyle.value = {
    position: 'fixed',
    top: rect.bottom + 4 + 'px',
    right: (window.innerWidth - rect.right) + 'px',
    zIndex: 100,
  }
  columnMenuVisible.value = true
}

function toggleColumn(col) {
  const cols = new Set(visibleColumns.value)
  if (cols.has(col)) cols.delete(col)
  else cols.add(col)
  visibleColumns.value = cols
}

function closeColumnMenu(e) {
  if (!columnMenuVisible.value) return
  if (columnMenuRef.value?.contains(e.target) || columnMenuBtnRef.value?.contains(e.target)) return
  columnMenuVisible.value = false
}

onMounted(() => document.addEventListener('click', closeColumnMenu))
onUnmounted(() => document.removeEventListener('click', closeColumnMenu))

// ── Select-all ────────────────────────────────────────────────────────────
const allSelected = computed(() =>
  displayItems.value.length > 0 && displayItems.value.every(item => isSelected(item))
)

function onSelectAll(e) {
  if (e.target.checked) {
    emit('select', { items: displayItems.value, mode: 'replace' })
  } else {
    emit('select', { mode: 'clear' })
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────
const isSelected = (item) => props.selectedItems.some(s => s.path === item.path)
const isFocused  = (item) => props.focusedItem?.path === item.path

function iconPath(item) {
  switch (item.kind) {
    case 'dir':      return mdiFolder
    case 'shortcut': return mdiLinkVariant
    default:         return mdiFile
  }
}

function formatBytes(bytes) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(ts) {
  return new Date(ts * 1000).toLocaleDateString()
}

// ── Hover state ───────────────────────────────────────────────────────────
const hoverItem = ref(null)

// ── Interaction ───────────────────────────────────────────────────────────
const { handleClick, cancel: cancelPendingClick } = useClickDebounce()
const { draggingPath, wasDragging, onMouseDown } = useDrag({
  onActivate: (item) => {
    if (!isSelected(item)) {
      emit('select', { item, mode: 'add' })
      return [...props.selectedItems, item]
    }
    return [...props.selectedItems]
  }
})

function onItemClick(e, item) {
  if (wasDragging.value) return
  handleClick(
    item.path,
    () => {
      emit('focus', item)
      if (e.ctrlKey || e.metaKey) {
        emit('select', { item, mode: isSelected(item) ? 'remove' : 'add' })
      } else if (e.shiftKey && props.selectedItems.length > 0) {
        const last = props.selectedItems[props.selectedItems.length - 1]
        const li = props.items.findIndex(i => i.path === last.path)
        const ci = props.items.findIndex(i => i.path === item.path)
        emit('select', { items: props.items.slice(Math.min(li, ci), Math.max(li, ci) + 1), mode: 'replace' })
      } else {
        emit('select', { item, mode: 'replace' })
      }
    },
    () => {
      emit('focus', item)
      if (item.kind === 'dir') {
        emit('navigate', item.path)
      } else if (item.kind === 'shortcut') {
        if (item.brokenLink) alert(`Broken link: ${item.target || 'Unknown'}`)
        else if (item.target) emit('navigate', item.target)
        else alert('Invalid shortcut: no destination path')
      } else {
        emit('select', { item, mode: 'open' })
      }
    },
    { e },
  )
}

function onCheckboxChange(e, item) {
  emit('focus', item)
  emit('select', { item, mode: e.target.checked ? 'add' : 'remove' })
}

// ── Rename ────────────────────────────────────────────────────────────────
const renamingPath = ref(null)
const nameEls = {}
const _nameClickCounts = {}
const _nameClickTimers = {}

function onNameClick(e, item) {
  _nameClickCounts[item.path] = (_nameClickCounts[item.path] ?? 0) + 1
  if (_nameClickTimers[item.path]) clearTimeout(_nameClickTimers[item.path])
  if (_nameClickCounts[item.path] >= 2) {
    _nameClickCounts[item.path] = 0
    e.stopPropagation()
    startRename(item)
  } else {
    _nameClickTimers[item.path] = setTimeout(() => { _nameClickCounts[item.path] = 0 }, 230)
  }
}

function startRename(item) {
  cancelPendingClick()
  renamingPath.value = item.path
  nextTick(() => {
    const el = nameEls[item.path]
    if (!el) return
    el.textContent = item.name
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  })
}

function commitRename(item) {
  if (renamingPath.value !== item.path) return
  const newName = nameEls[item.path]?.textContent?.trim() ?? ''
  renamingPath.value = null
  if (newName && newName !== item.name) emit('rename', { path: item.path, newName })
}

function cancelRename() { renamingPath.value = null }

// ── Keyboard nav ──────────────────────────────────────────────────────────
function onKeyDown(event) {
  if (event.key === 'Insert') {
    event.preventDefault()
    selectionMode.value = !selectionMode.value
    if (!selectionMode.value) emit('select', { mode: 'clear' })
    return
  }
  if (event.key === 'Escape') {
    if (selectionMode.value) {
      event.preventDefault()
      selectionMode.value = false
      emit('select', { mode: 'clear' })
    }
    return
  }
  if (event.key === 'Enter' && props.focusedItem) {
    event.preventDefault()
    if (props.focusedItem.kind === 'dir') emit('navigate', props.focusedItem.path)
    else emit('select', { item: props.focusedItem, mode: 'open' })
  }
}
</script>

<style scoped>
/* ── Container — default: grid ────────────────────────────────────────── */

.dl {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--min-cell, 120px), 1fr));
  gap: 12px;
  padding: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  outline: none;
}
.dl:focus { box-shadow: inset 0 0 0 1px var(--accent); }

.dl-header { display: none; }

/* list / details */
.dl[data-layout="list"],
.dl[data-layout="details"] {
  display: flex;
  flex-direction: column;
  gap: 0;
  padding: 0;
}

/* details: horizontal scroll support */
.dl[data-layout="details"] {
  overflow-x: auto;
}

/* details column header */
.dl[data-layout="details"] .dl-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--surface-alt);
  position: sticky;
  top: 0;
  z-index: 20;
  flex-shrink: 0;
  user-select: none;
  min-width: 420px;
}

.dl-hdr-check-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
  line-height: 0;
}
.dl-hdr-check-wrap input { width: 14px; height: 14px; cursor: pointer; }

/* gap between check and thumb in header — matches item gap between check and thumb */
.dl-hdr-thumb-gap { width: 18px; flex-shrink: 0; }

/* spacer = check-width + gap + thumb-width for non-details header (list etc.) */
.dl-hdr-spacer { width: calc(14px + 8px + 18px); flex-shrink: 0; }

.dl-col-name { flex: 1; min-width: 0; }
.dl-col-size { width: 80px; text-align: right; padding-right: 16px; flex-shrink: 0; }
.dl-col-date { width: 130px; flex-shrink: 0; }

.dl-hdr-menu-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0 4px;
  font-size: 16px;
  line-height: 1;
  flex-shrink: 0;
  border-radius: 3px;
  margin-left: auto;
}
.dl-hdr-menu-btn:hover { color: var(--text); background: var(--hover-background); }

/* ── Column picker dropdown ───────────────────────────────────────────── */
.dl-col-picker {
  background: var(--surface-alt, #2d2d30);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  min-width: 140px;
}
.dl-col-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  user-select: none;
}
.dl-col-option:hover { background: rgba(255,255,255,0.06); }
.dl-col-option input { width: 14px; height: 14px; cursor: pointer; }

/* gallery-grid */
.dl[data-layout="gallery-grid"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  grid-auto-rows: 180px;
  gap: 4px;
  padding: 8px;
  align-content: start;
}

/* gallery-mosaic — horizontal flow, wraps to new lines */
.dl[data-layout="gallery-mosaic"] {
  display: flex;
  flex-wrap: wrap;
  align-content: start;
  gap: 6px;
  padding: 8px;
  overflow-y: auto;
}

/* feed */
.dl[data-layout="feed"] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
  padding: 12px;
  align-content: start;
}

/* ── Item base (grid) ─────────────────────────────────────────────────── */

.dl-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  background: var(--surface);
  user-select: none;
  transition: background 0.1s, border-color 0.1s;
  min-width: 0;
}
.dl-item:hover { background: rgba(255,255,255,0.05); border-color: var(--accent); }
.dl-item.dl-item--selected { background: rgba(0,122,204,0.1); border-color: var(--accent); }
.dl-item.dl-item--focused { box-shadow: 0 0 0 2px var(--accent); }
.dl-item.dl-item--dragging { opacity: 0.4; }
.dl-item.dl-item--hidden { opacity: 0.45; }

/* Checkbox — absolute in grid/gallery, static in row layouts */
.dl-check {
  position: absolute;
  top: 4px;
  left: 4px;
  z-index: 10;
  line-height: 0;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.dl-check.dl-check--on,
.dl-item:hover .dl-check { opacity: 1; }
.dl-check input { width: 14px; height: 14px; cursor: pointer; }

/* Thumbnail */
.dl-thumb {
  position: relative;
  width: 100%;
  height: var(--icon-size, 64px);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  overflow: hidden;
  background: var(--surface-alt);
  flex-shrink: 0;
}
.dl-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: opacity 0.2s;
  user-select: none;
  -webkit-user-drag: none;
}
.dl-icon { color: #9e9e9e; width: 48px; height: 48px; }
.dl-skeleton {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}
@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* Body */
.dl-body { width: 100%; margin-top: 6px; min-width: 0; }

.dl-name {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 12px;
  text-align: center;
  word-break: break-word;
  width: 100%;
  user-select: none;
}
.dl-name--editing {
  display: block;
  overflow: visible;
  white-space: normal;
  -webkit-line-clamp: unset;
}
span[contenteditable]:focus-within {
  background: rgba(255,255,255,0.1);
  box-shadow: 0 0 3px 1px var(--accent);
  border-radius: 2px;
  user-select: text;
  outline: none;
}

/* Meta hidden in grid */
.dl-meta { display: none; }
.dl-col--hidden { display: none; }

/* Gallery overlay hidden by default */
.dl-overlay { display: none; }

/* ── List ─────────────────────────────────────────────────────────────── */

.dl[data-layout="list"] .dl-item {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border-radius: 3px;
  border: 1px solid transparent;
  border-bottom-color: rgba(128,128,128,0.07);
  height: 30px;
}
.dl[data-layout="list"] .dl-item:hover { border-color: transparent; border-bottom-color: rgba(128,128,128,0.07); }
.dl[data-layout="list"] .dl-item.dl-item--selected { border-bottom-color: rgba(128,128,128,0.07); }

.dl[data-layout="list"] .dl-check { position: static; display: flex; align-items: center; flex-shrink: 0; }
.dl[data-layout="list"] .dl-thumb { width: 18px; height: 18px; background: transparent; }
.dl[data-layout="list"] .dl-img { object-fit: contain; }
.dl[data-layout="list"] .dl-icon { width: 16px; height: 16px; }
.dl[data-layout="list"] .dl-skeleton { display: none; }
.dl[data-layout="list"] .dl-body { display: flex; align-items: center; flex: 1; margin-top: 0; }
.dl[data-layout="list"] .dl-name {
  flex: 1; font-size: 13px; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block; -webkit-line-clamp: unset;
}
.dl[data-layout="list"] .dl-meta { display: flex; gap: 16px; flex-shrink: 0; margin-left: 8px; }
.dl[data-layout="list"] .dl-size { font-size: 12px; color: var(--text-muted); min-width: 60px; text-align: right; white-space: nowrap; }
.dl[data-layout="list"] .dl-date { font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* ── Details ──────────────────────────────────────────────────────────── */

.dl[data-layout="details"] .dl-item {
  flex-direction: row;
  align-items: center;
  gap: 8px;
  padding: 3px 8px;
  border-radius: 0;
  border: none;
  border-bottom: 1px solid rgba(128,128,128,0.07);
  height: 30px;
  min-width: 420px;
}

.dl[data-layout="details"] .dl-check { position: static; display: flex; align-items: center; flex-shrink: 0; }
.dl[data-layout="details"] .dl-thumb { width: 18px; height: 18px; background: transparent; }
.dl[data-layout="details"] .dl-img { object-fit: contain; }
.dl[data-layout="details"] .dl-icon { width: 16px; height: 16px; }
.dl[data-layout="details"] .dl-skeleton { display: none; }
.dl[data-layout="details"] .dl-body { display: flex; align-items: center; flex: 1; margin-top: 0; min-width: 0; }
.dl[data-layout="details"] .dl-name {
  flex: 1; font-size: 13px; text-align: left;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  display: block; -webkit-line-clamp: unset;
}
.dl[data-layout="details"] .dl-meta { display: flex; flex-shrink: 0; margin-left: 0; }
.dl[data-layout="details"] .dl-size { width: 80px; text-align: right; padding-right: 16px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
.dl[data-layout="details"] .dl-date { width: 130px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }

/* ── Gallery-grid ─────────────────────────────────────────────────────── */

.dl[data-layout="gallery-grid"] .dl-item {
  display: block;
  padding: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
}
.dl[data-layout="gallery-grid"] .dl-item.dl-item--selected { border-color: var(--accent); }

.dl[data-layout="gallery-grid"] .dl-check { top: 6px; left: 6px; }
/* Thumb and image fill the square item absolutely */
.dl[data-layout="gallery-grid"] .dl-thumb { position: absolute; inset: 0; height: 100%; width: 100%; border-radius: 0; background: var(--surface-alt); display: flex; align-items: center; justify-content: center; }
.dl[data-layout="gallery-grid"] .dl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.dl[data-layout="gallery-grid"] .dl-body { display: none; }
.dl[data-layout="gallery-grid"] .dl-overlay { display: none; }

/* ── Gallery-mosaic ───────────────────────────────────────────────────── */

.dl[data-layout="gallery-mosaic"] .dl-item {
  display: flex;
  flex-direction: column;
  width: 180px;
  flex-shrink: 0;
  align-items: stretch;
  padding: 0;
  border-radius: 4px;
  overflow: hidden;
  border: 2px solid transparent;
  background: var(--surface);
}

.dl[data-layout="gallery-mosaic"] .dl-thumb {
  height: auto;
  width: 100%;
  min-height: 80px;
  background: var(--surface-alt);
  flex-shrink: 0;
}
.dl[data-layout="gallery-mosaic"] .dl-img {
  width: 100%;
  height: auto;
  object-fit: initial;
}
.dl[data-layout="gallery-mosaic"] .dl-icon { width: 32px; height: 32px; margin: 20px auto; }
.dl[data-layout="gallery-mosaic"] .dl-skeleton { display: none; }

.dl[data-layout="gallery-mosaic"] .dl-body { padding: 3px 6px 5px; margin-top: 0; }
.dl[data-layout="gallery-mosaic"] .dl-name {
  font-size: 11px; color: var(--text-muted);
  text-align: left; -webkit-line-clamp: 1;
}

/* ── Feed ─────────────────────────────────────────────────────────────── */

.dl[data-layout="feed"] .dl-item {
  flex-direction: column;
  align-items: stretch;
  padding: 0;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid var(--border);
}
.dl[data-layout="feed"] .dl-item:hover { border-color: rgba(255,255,255,0.2); }
.dl[data-layout="feed"] .dl-item.dl-item--selected { border-color: var(--accent); }

.dl[data-layout="feed"] .dl-check { top: 6px; left: 6px; }
/* Use padding-bottom trick: thumb is a block with height:0 + padding-bottom:56.25% = 16:9.
   The .dl-item is display:flex but we make the thumb a positioned block so its children can fill it. */
.dl[data-layout="feed"] .dl-thumb {
  display: block;
  position: relative;
  width: 100%;
  height: 0;
  padding-bottom: 56.25%;
  background: var(--surface-alt);
  overflow: hidden;
  flex-shrink: 0;
  border-radius: 0;
}
.dl[data-layout="feed"] .dl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.dl[data-layout="feed"] .dl-skeleton { position: absolute; inset: 0; }
.dl[data-layout="feed"] .dl-icon { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; }

.dl[data-layout="feed"] .dl-body { padding: 8px 10px 10px; margin-top: 0; }
.dl[data-layout="feed"] .dl-name {
  font-size: 13px; font-weight: 500;
  text-align: left; -webkit-line-clamp: 2;
}
.dl[data-layout="feed"] .dl-meta { display: flex; gap: 8px; margin-top: 4px; }
.dl[data-layout="feed"] .dl-size,
.dl[data-layout="feed"] .dl-date { font-size: 11px; color: var(--text-muted); }
</style>
