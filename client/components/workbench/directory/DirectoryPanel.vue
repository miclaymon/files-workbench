<template>
  <div class="directory-panel">
    <div class="navigation-header">
      <div class="nav-buttons">
        <Tooltip content="Go to parent directory (Alt+Up)" :delay="500">
          <button class="nav-button" @click="handleNavigateUp" :disabled="!hasParentDirectory">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 8l-6 6 1.41 1.41L12 10.83l4.59 4.58L18 14z"/>
            </svg>
          </button>
        </Tooltip>

        <div class="nav-button-wrapper">
          <Tooltip v-if="!historyMenuVisible" content="Go to previous directory (Alt+Left)" :delay="500">
            <button class="nav-button" ref="previousButtonRef" @click="handleNavigatePrevious" @mousedown="handlePreviousMouseDown" :disabled="!hasPrevious">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
              </svg>
            </button>
          </Tooltip>
          <button v-else class="nav-button" ref="previousButtonRef" @click="handleNavigatePrevious" @mousedown="handlePreviousMouseDown" :disabled="!hasPrevious">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
            </svg>
          </button>
        </div>

        <div class="nav-button-wrapper">
          <Tooltip v-if="!historyMenuVisible" content="Go to next directory (Alt+Right)" :delay="500">
            <button class="nav-button" ref="nextButtonRef" @click="handleNavigateNext" @mousedown="handleNextMouseDown" :disabled="!hasNext">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </button>
          </Tooltip>
          <button v-else class="nav-button" ref="nextButtonRef" @click="handleNavigateNext" @mousedown="handleNextMouseDown" :disabled="!hasNext">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
            </svg>
          </button>
        </div>
      </div>

      <DirectoryBreadcrumb
        :path="currentPath"
        :changeTabPath="changeTabPath"
        @navigate="handleNavigate"
      />

      <div class="layout-buttons">
        <!-- View picker -->
        <Tooltip :content="'View: ' + (LAYOUT_META[layout]?.label ?? layout)" :delay="300">
          <button class="nav-button layout-picker-btn" @click.stop="toggleLayoutMenu" ref="layoutBtnRef">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z"/>
            </svg>
          </button>
        </Tooltip>
      </div>
    </div>

    <!-- Active sort/filter bar -->
    <div v-if="showActiveBar" class="active-bar">
      <span v-if="isSortNonDefault" class="active-chip">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M3 18h6v-2H3v2zm0-5h9v-2H3v2zm0-7v2h18V6H3z"/></svg>
        {{ SORT_FIELDS.find(f => f.key === sortField)?.label }} {{ sortDir === 'asc' ? '↑' : '↓' }}
        <button class="chip-remove" @click.stop="clearSort">×</button>
      </span>
      <template v-for="type in filterTypes" :key="type">
        <span class="active-chip">
          {{ TYPE_GROUP_LABELS[type] }}
          <button class="chip-remove" @click.stop="toggleFilterType(type)">×</button>
        </span>
      </template>
      <span v-if="filterSizePreset" class="active-chip">
        {{ SIZE_PRESETS[filterSizePreset].label }}
        <button class="chip-remove" @click.stop="filterSizePreset = ''">×</button>
      </span>
      <span v-if="filterDatePreset" class="active-chip">
        {{ DATE_PRESETS[filterDatePreset].label }}
        <button class="chip-remove" @click.stop="filterDatePreset = ''">×</button>
      </span>
      <button v-if="isFilterActive" class="clear-all-btn" @click.stop="clearFilter">Clear filters</button>
    </div>

    <component
      :is="currentLayout"
      :items="processedItems"
      :selectedItems="localSelectedItems"
      :focusedItem="localFocusedItem"
      :alwaysShowCheckboxes="alwaysShowCheckboxes"
      :layout="layout"
      :zoomLevel="zoomLevel"
      :hoverPreviewEnabled="hoverPreviewEnabled"
      :hoverPreviewDelayMs="hoverPreviewDelayMs"
      :sortField="sortField"
      :sortDir="sortDir"
      :filterText="filterText"
      :filterActive="isFilterActive"
      @select="handleSelect"
      @focus="handleFocus"
      @contextmenu="handleContextMenu"
      @background-contextmenu="$emit('background-contextmenu', $event)"
      @right-drag-drop="$emit('right-drag-drop', $event)"
      @navigate="handleNavigate"
      @rename="$emit('rename', $event)"
      @zoom-change="zoomLevel = $event"
      @sort-change="handleSortChange"
      @filter-change="filterText = $event"
      @filter-click="handleFilterClick"
      @copy="$emit('copy', $event)"
      @cut="$emit('cut', $event)"
      @paste="$emit('paste')"
    />

    <FloatingMenu
      :visible="historyMenuVisible"
      type="menu"
      :items="historyMenuItems"
      :x="historyMenuPosition.x"
      :y="historyMenuPosition.y"
      @close="hideHistoryMenu"
      @item-click="hideHistoryMenu"
    />

    <FloatingMenu
      :visible="layoutMenuVisible"
      type="menu"
      :items="layoutMenuItems"
      :x="layoutMenuPos.x"
      :y="layoutMenuPos.y"
      @close="layoutMenuVisible = false"
      @item-click="layoutMenuVisible = false"
    />

    <!-- Filter panel -->
    <Teleport to="body">
      <div
        v-if="filterMenuVisible"
        class="dp-floating-panel"
        :style="{ top: filterMenuPos.y + 'px', right: filterMenuPos.right + 'px' }"
        ref="filterPanelRef"
      >
        <div class="dp-panel-section">
          <div class="dp-panel-title">File type</div>
          <div class="dp-type-grid">
            <button
              v-for="(label, type) in TYPE_GROUP_LABELS"
              :key="type"
              class="dp-type-btn"
              :class="{ 'dp-type-btn--active': filterTypes.has(type) }"
              @click="toggleFilterType(type)"
            >
              {{ label }}
            </button>
          </div>
        </div>

        <div class="dp-panel-section">
          <div class="dp-panel-title">Size</div>
          <div class="dp-size-options">
            <button
              v-for="(preset, key) in SIZE_PRESETS"
              :key="key"
              class="dp-size-btn"
              :class="{ 'dp-size-btn--active': filterSizePreset === key }"
              @click="filterSizePreset = filterSizePreset === key ? '' : key"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div class="dp-panel-section">
          <div class="dp-panel-title">Date modified</div>
          <div class="dp-date-options">
            <button
              v-for="(preset, key) in DATE_PRESETS"
              :key="key"
              class="dp-size-btn"
              :class="{ 'dp-size-btn--active': filterDatePreset === key }"
              @click="filterDatePreset = filterDatePreset === key ? '' : key"
            >
              {{ preset.label }}
            </button>
          </div>
        </div>

        <div v-if="isFilterActive" class="dp-panel-footer">
          <button class="dp-clear-btn" @click="clearFilter">Clear all filters</button>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import DirectoryLayout from './DirectoryLayout.vue'
import DirectoryBreadcrumb from './DirectoryBreadcrumb.vue'
import Tooltip from '../ui/Tooltip.vue'
import FloatingMenu from '../ui/FloatingMenu.vue'
import { mdiFolder } from '@mdi/js'
import { useDebugLog } from '~/composables/useDebugLog.js'

const { log } = useDebugLog()

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  layout: { type: String, default: 'grid' },
  showDebug: { type: Boolean, default: false },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  hoverPreviewEnabled: { type: Boolean, default: true },
  hoverPreviewDelayMs: { type: Number, default: 2000 },
  currentPath: { type: String, default: '' },
  navigationHistory: { type: Object, default: () => ({ previous: [], next: [] }) },
  changeTabPath: { type: Function, default: null },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'background-contextmenu', 'right-drag-drop', 'navigate', 'navigate-up', 'navigate-previous', 'navigate-next', 'update:layout', 'rename', 'copy', 'cut', 'paste'])

const currentLayout = DirectoryLayout

// ── Layout ────────────────────────────────────────────────────────────────
const ICON_GRID = '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>'
const ICON_LIST = '<path d="M3 5h2v2H3zm4 0h14v2H7zM3 10h2v2H3zm4 0h14v2H7zM3 15h2v2H3zm4 0h14v2H7z"/>'
const ICON_TABLE = '<path d="M3 3h18v3H3zm0 5h18v2H3zm0 4h18v2H3zm0 4h18v3H3z"/>'
const ICON_GALLERY = '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>'
const ICON_MOSAIC = '<path d="M3 3h5v8H3zm7 0h4v5h-4zm6 0h5v5h-5zM3 13h5v8H3zm7 3h4v5h-4zm6-3h5v8h-5zm-6-5h4v5h-4z"/>'
const ICON_FEED = '<path d="M3 4h18v4H3zm0 6h8v4H3zm10 0h8v4h-8zM3 16h8v4H3zm10 0h8v4h-8z"/>'

const ICON_NESTED = '<path d="M3 5h18v2H3zm4 4h14v2H7zm-4 4h18v2H3zm4 4h14v2H7z"/>'

const LAYOUT_META = {
  'grid':           { label: 'Grid',    icon: ICON_GRID    },
  'list':           { label: 'List',    icon: ICON_LIST    },
  'details':        { label: 'Details', icon: ICON_TABLE   },
  'nested':         { label: 'Nested',  icon: ICON_NESTED  },
  'gallery-grid':   { label: 'Gallery', icon: ICON_GALLERY },
  'gallery-mosaic': { label: 'Mosaic',  icon: ICON_MOSAIC  },
  'feed':           { label: 'Feed',    icon: ICON_FEED    },
}

const layoutBtnRef = ref(null)
const layoutMenuVisible = ref(false)
const layoutMenuPos = ref({ x: 0, y: 0 })

const layoutMenuItems = computed(() =>
  Object.entries(LAYOUT_META).map(([id, meta]) => ({
    key: id,
    label: meta.label,
    shortcut: props.layout === id ? '✓' : '',
    action: () => emit('update:layout', id),
  }))
)

function toggleLayoutMenu() {
  if (layoutMenuVisible.value) { layoutMenuVisible.value = false; return }
  const rect = layoutBtnRef.value?.getBoundingClientRect()
  if (rect) layoutMenuPos.value = { x: rect.left, y: rect.bottom + 2 }
  layoutMenuVisible.value = true
}

// ── Sort ──────────────────────────────────────────────────────────────────
const SORT_FIELDS = [
  { key: 'name',     label: 'Name' },
  { key: 'size',     label: 'Size' },
  { key: 'type',     label: 'Type' },
  { key: 'modified', label: 'Date Modified' },
  { key: 'created',  label: 'Date Created' },
  { key: 'accessed', label: 'Date Accessed' },
]


const sortField = ref('name')
const sortDir = ref('asc')

function handleSortChange({ field, dir }) {
  sortField.value = field
  sortDir.value = dir
  log('sort', `Sort: ${field} ${dir}`)
}

function clearSort() {
  sortField.value = 'name'
  sortDir.value = 'asc'
  log('sort', 'Sort reset')
}

const filterText = ref('')

const isSortNonDefault = computed(() => sortField.value !== 'name' || sortDir.value !== 'asc')

// ── Filter ────────────────────────────────────────────────────────────────
const TYPE_GROUPS = {
  images:      new Set(['png','jpg','jpeg','webp','gif','bmp','ico','avif','svg','tiff','raw','heic','heif']),
  videos:      new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts']),
  audio:       new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma']),
  documents:   new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','rtf','odt','ods','odp','csv']),
  archives:    new Set(['zip','tar','gz','bz2','7z','rar','xz','iso','tar.gz','tar.bz2']),
  code:        new Set(['js','ts','vue','jsx','tsx','py','go','rs','java','c','cpp','h','hpp','css','html','json','yaml','yml','toml','sh','bash','rb','php','swift','kt']),
  apps:        new Set(['appimage','deb','rpm','exe','msi','pkg','flatpak','snap','apk']),
  directories: null, // matched by item.kind === 'dir'
}
const TYPE_GROUP_LABELS = {
  images: 'Images', videos: 'Videos', audio: 'Audio',
  documents: 'Documents', archives: 'Archives', code: 'Code',
  apps: 'Apps', directories: 'Directories',
}

const SIZE_PRESETS = {
  tiny:   { label: '< 100 KB', min: 0,                   max: 100 * 1024 },
  small:  { label: '< 1 MB',   min: 0,                   max: 1024 * 1024 },
  medium: { label: '1 – 100 MB', min: 1024 * 1024,       max: 100 * 1024 * 1024 },
  large:  { label: '> 100 MB', min: 100 * 1024 * 1024,   max: Infinity },
}

const now = Date.now()
const DATE_PRESETS = {
  today:   { label: 'Today',      min: now - 86400000,          max: Infinity },
  week:    { label: 'This week',  min: now - 7 * 86400000,      max: Infinity },
  month:   { label: 'This month', min: now - 30 * 86400000,     max: Infinity },
  year:    { label: 'This year',  min: now - 365 * 86400000,    max: Infinity },
  older:   { label: 'Older',      min: 0,                       max: now - 365 * 86400000 },
}

const filterTypes = ref(new Set())
const filterSizePreset = ref('')
const filterDatePreset = ref('')

const filterMenuVisible = ref(false)
const filterMenuPos = ref({ y: 0, right: 0 })
const filterPanelRef = ref(null)

function handleFilterClick(btnEl) {
  if (filterMenuVisible.value) { filterMenuVisible.value = false; return }
  const rect = btnEl.getBoundingClientRect()
  filterMenuPos.value = { y: rect.bottom + 4, right: window.innerWidth - rect.right }
  filterMenuVisible.value = true
}

function toggleFilterType(type) {
  const s = new Set(filterTypes.value)
  if (s.has(type)) s.delete(type)
  else s.add(type)
  filterTypes.value = s
  log('filter', `Type filter: ${type} ${s.has(type) ? 'on' : 'off'}`)
}

function clearFilter() {
  filterTypes.value = new Set()
  filterSizePreset.value = ''
  filterDatePreset.value = ''
  log('filter', 'Filters cleared')
}

const isFilterActive = computed(() =>
  filterTypes.value.size > 0 || filterSizePreset.value !== '' || filterDatePreset.value !== '' || filterText.value !== ''
)

const showActiveBar = computed(() => isSortNonDefault.value || isFilterActive.value)

// ── Sort + Filter applied ─────────────────────────────────────────────────
const processedItems = computed(() => {
  let result = props.items

  // Type filter
  if (filterTypes.value.size > 0) {
    result = result.filter(item => {
      return [...filterTypes.value].some(g => {
        if (g === 'directories') return item.kind === 'dir' || item.kind === 'archive'
        if (item.kind === 'dir' || item.kind === 'archive') return true // dirs/archives always shown alongside file-type filters
        const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
        return TYPE_GROUPS[g]?.has(ext)
      })
    })
  }

  // Size filter
  if (filterSizePreset.value && SIZE_PRESETS[filterSizePreset.value]) {
    const { min, max } = SIZE_PRESETS[filterSizePreset.value]
    result = result.filter(item => {
      if (item.kind === 'dir' || item.kind === 'archive') return true
      const s = item.size ?? 0
      return s >= min && s <= max
    })
  }

  // Date modified filter
  if (filterDatePreset.value && DATE_PRESETS[filterDatePreset.value]) {
    const { min, max } = DATE_PRESETS[filterDatePreset.value]
    result = result.filter(item => {
      if (item.kind === 'dir' || item.kind === 'archive') return true
      const ts = (item.modified ?? 0) * 1000
      return ts >= min && ts <= max
    })
  }

  // Text filter (name search)
  if (filterText.value.trim()) {
    const q = filterText.value.trim().toLowerCase()
    result = result.filter(item => item.name.toLowerCase().includes(q))
  }

  // Sort — dirs always first unless sorting by size (then sort everything together)
  result.sort((a, b) => {
    if (sortField.value !== 'size') {
      const aIsDir = a.kind === 'dir' || a.kind === 'archive'
      const bIsDir = b.kind === 'dir' || b.kind === 'archive'
      if (aIsDir && !bIsDir) return -1
      if (!aIsDir && bIsDir) return 1
    }

    const dir = sortDir.value === 'asc' ? 1 : -1

    switch (sortField.value) {
      case 'name': {
        const na = a.name?.toLowerCase() ?? ''
        const nb = b.name?.toLowerCase() ?? ''
        return dir * na.localeCompare(nb)
      }
      case 'size':
        return dir * ((a.size ?? -1) - (b.size ?? -1))
      case 'type': {
        const ea = a.name.split('.').pop()?.toLowerCase() ?? ''
        const eb = b.name.split('.').pop()?.toLowerCase() ?? ''
        return dir * ea.localeCompare(eb)
      }
      case 'modified':
        return dir * ((a.modified ?? 0) - (b.modified ?? 0))
      case 'created':
        return dir * ((a.created ?? a.modified ?? 0) - (b.created ?? b.modified ?? 0))
      case 'accessed':
        return dir * ((a.accessed ?? a.modified ?? 0) - (b.accessed ?? b.modified ?? 0))
      default:
        return 0
    }
  })

  return result
})

watch(filterText, (v) => { if (v) log('filter', 'Text filter', v) })
watch(filterSizePreset, (v) => { if (v) log('filter', 'Size filter', v) })
watch(filterDatePreset, (v) => { if (v) log('filter', 'Date filter', v) })

// ── Zoom ──────────────────────────────────────────────────────────────────
const zoomLevel = ref(50)
watch(zoomLevel, (v) => log('zoom', `Zoom ${v}%`))

// ── Close menus on outside click ──────────────────────────────────────────
function onDocClick(e) {
  if (filterMenuVisible.value && !filterPanelRef.value?.contains(e.target))
    filterMenuVisible.value = false
}

function onDocKeyDown(e) {
  if (!e.ctrlKey && !e.metaKey) return
  if (e.key === '=' || e.key === '+') {
    e.preventDefault()
    zoomLevel.value = Math.min(100, zoomLevel.value + 5)
  } else if (e.key === '-') {
    e.preventDefault()
    zoomLevel.value = Math.max(0, zoomLevel.value - 5)
  } else if (e.key === '0') {
    e.preventDefault()
    zoomLevel.value = 50
  }
}

// ── Selection state ───────────────────────────────────────────────────────
const localSelectedItems = ref(props.selectedItems)
const localFocusedItem = ref(props.focusedItem)
const lastSelected = ref(null)

// ── Nav history ───────────────────────────────────────────────────────────
const previousButtonRef = ref(null)
const nextButtonRef = ref(null)
const historyMenuVisible = ref(false)
const historyMenuPosition = ref({ x: 0, y: 0 })
const historyMenuItems = ref([])

let previousLongPressTimer = null
let nextLongPressTimer = null
const LONG_PRESS_DELAY = 500

const hasParentDirectory = computed(() => {
  if (!props.currentPath) return false
  return props.currentPath.split(/[\/\\]/).filter(Boolean).length > 1
})

const hasPrevious = computed(() => props.navigationHistory.previous.length > 0)
const hasNext = computed(() => props.navigationHistory.next.length > 0)

function handlePreviousMouseDown(event) { startLongPress(event, 'previous') }
function handleNextMouseDown(event) { startLongPress(event, 'next') }

function startLongPress(event, type) {
  clearLongPressTimers()
  const button = event.currentTarget
  const timer = setTimeout(() => showHistoryMenu(button, type), LONG_PRESS_DELAY)
  if (type === 'previous') previousLongPressTimer = timer
  else nextLongPressTimer = timer
}

function clearLongPressTimers() {
  clearTimeout(previousLongPressTimer)
  clearTimeout(nextLongPressTimer)
  previousLongPressTimer = null
  nextLongPressTimer = null
}

function showHistoryMenu(button, type) {
  const history = type === 'previous' ? props.navigationHistory.previous : props.navigationHistory.next
  if (!history.length) return
  const items = type === 'previous'
    ? [...history].reverse().map((path, i) => createHistoryMenuItem(path, i, type))
    : history.map((path, i) => createHistoryMenuItem(path, i, type))
  historyMenuItems.value = items
  const rect = button.getBoundingClientRect()
  historyMenuPosition.value = { x: rect.left, y: rect.bottom + 2 }
  historyMenuVisible.value = true
}

function createHistoryMenuItem(path, index, type) {
  const dirName = path.split(/[\/\\]/).filter(Boolean).pop() || path
  return { key: path, label: dirName, icon: mdiFolder, action: () => navigateToHistoryPath(path, type, index) }
}

function navigateToHistoryPath(targetPath, type, index) {
  historyMenuVisible.value = false
  const history = type === 'previous' ? props.navigationHistory.previous : props.navigationHistory.next
  if (type === 'previous') {
    const itemsToRemove = history.length - index
    props.navigationHistory.previous.splice(-itemsToRemove, itemsToRemove)
    props.navigationHistory.next.push(props.currentPath)
  } else {
    props.navigationHistory.next.splice(0, index + 1)
    props.navigationHistory.previous.push(props.currentPath)
  }
  props.changeTabPath?.(targetPath, { isHistoryNavigation: true, clearNextHistory: false, addToPrevious: type === 'next' })
}

function hideHistoryMenu() { historyMenuVisible.value = false; historyMenuItems.value = [] }
function handleNavigateUp() { if (hasParentDirectory.value) emit('navigate-up') }
function handleNavigatePrevious() { if (hasPrevious.value) emit('navigate-previous') }
function handleNavigateNext() { if (hasNext.value) emit('navigate-next') }

function handleNavigate(item) {
  const path = typeof item === 'string' ? item : item.path
  if (props.changeTabPath) props.changeTabPath(path)
  else emit('navigate', path)
}

function handleSelect(payload) {
  let newSelectedItems = [...localSelectedItems.value]
  let newFocusedItem = null

  if (payload.mode === 'clear') {
    newSelectedItems = []
    newFocusedItem = null
  } else if (payload.item) {
    const item = payload.item
    newFocusedItem = item
    switch (payload.mode) {
      case 'add':
        newSelectedItems = newSelectedItems.filter(s => s.path !== item.path)
        newSelectedItems.push(item)
        break
      case 'remove':
        newSelectedItems = newSelectedItems.filter(s => s.path !== item.path)
        break
      case 'replace':
        newSelectedItems = [item]
        break
      case 'open':
        emit('select', { item, mode: 'open' })
        return
    }
  } else if (payload.items) {
    const clicked = payload.items[payload.items.length - 1] ?? null
    newSelectedItems = payload.items
    newFocusedItem = clicked
  }

  localSelectedItems.value = newSelectedItems
  localFocusedItem.value = newFocusedItem
  lastSelected.value = newFocusedItem

  emit('select', { selectedItems: newSelectedItems, focusedItem: newFocusedItem, lastSelected: newFocusedItem })
}

function handleFocus(item) { emit('focus', item) }
function handleContextMenu({ event, item }) { emit('contextmenu', { event, item }) }

watch(() => props.currentPath, () => {
  localSelectedItems.value = []
  localFocusedItem.value = null
  lastSelected.value = null
  emit('select', { selectedItems: [], focusedItem: null, lastSelected: null })
})

watch(() => props.focusedItem, (v) => { localFocusedItem.value = v })
watch(() => props.selectedItems, (v) => { localSelectedItems.value = v })

onMounted(() => {
  document.addEventListener('mouseup', clearLongPressTimers)
  document.addEventListener('click', onDocClick, true)
  document.addEventListener('keydown', onDocKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('mouseup', clearLongPressTimers)
  document.removeEventListener('click', onDocClick, true)
  document.removeEventListener('keydown', onDocKeyDown)
  clearLongPressTimers()
})
</script>

<style scoped>
.directory-panel { display: flex; flex-direction: column; height: 100%; width: 100%; overflow: hidden; }

/* ── Navigation header ────────────────────────────────────────────────── */
.navigation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px;
  background: var(--header-background, #2d2d30);
  border-bottom: 1px solid var(--border);
  min-height: 36px;
  flex-shrink: 0;
}

.nav-buttons { display: flex; align-items: center; gap: 2px; flex-shrink: 0; }
.nav-button-wrapper { display: inline-block; position: relative; }

.nav-button {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all 0.15s;
  font-size: 14px;
  flex-shrink: 0;
}
.nav-button:hover:not(:disabled) { background: var(--hover-background); border-color: var(--border); color: var(--text); }
.nav-button:disabled { opacity: 0.4; cursor: not-allowed; }
.nav-button.active { background: color-mix(in srgb, var(--accent) 15%, transparent); color: var(--accent); border-color: color-mix(in srgb, var(--accent) 40%, transparent); }

.layout-buttons { display: flex; gap: 2px; flex-shrink: 0; }

/* ── Active sort/filter bar ───────────────────────────────────────────── */
.active-bar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px;
  padding: 4px 10px;
  background: color-mix(in srgb, var(--accent) 8%, var(--header-background, #2d2d30));
  border-bottom: 1px solid color-mix(in srgb, var(--accent) 25%, var(--border));
  font-size: 11px;
  min-height: 28px;
  flex-shrink: 0;
}

.active-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 6px 2px 7px;
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border: 1px solid color-mix(in srgb, var(--accent) 35%, transparent);
  border-radius: 12px;
  color: var(--text);
  font-size: 11px;
  white-space: nowrap;
}

.chip-remove {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 13px;
  line-height: 1;
  padding: 0;
  display: flex;
  align-items: center;
  border-radius: 50%;
  width: 14px;
  height: 14px;
  justify-content: center;
}
.chip-remove:hover { color: var(--text); background: rgba(255,255,255,0.12); }

.clear-all-btn {
  background: transparent;
  border: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 11px;
  padding: 2px 6px;
  border-radius: 4px;
  margin-left: 4px;
}
.clear-all-btn:hover { color: var(--text); background: rgba(255,255,255,0.08); }

/* ── Filter panel (floating) ──────────────────────────────────────────── */
.dp-floating-panel {
  position: fixed;
  z-index: 300;
  background: var(--surface-alt, #2d2d30);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  width: 280px;
}

.dp-panel-section { margin-bottom: 14px; }
.dp-panel-section:last-of-type { margin-bottom: 0; }

.dp-panel-title {
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin-bottom: 7px;
}

.dp-type-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.dp-type-btn, .dp-size-btn {
  padding: 3px 10px;
  border-radius: 12px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.1s;
}
.dp-type-btn:hover, .dp-size-btn:hover { border-color: var(--accent); color: var(--text); }
.dp-type-btn--active, .dp-size-btn--active {
  background: color-mix(in srgb, var(--accent) 18%, transparent);
  border-color: var(--accent);
  color: var(--accent);
}

.dp-size-options, .dp-date-options {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.dp-panel-footer {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}

.dp-clear-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 4px 10px;
  font-size: 12px;
  color: var(--text-muted);
  cursor: pointer;
  width: 100%;
}
.dp-clear-btn:hover { border-color: var(--accent); color: var(--accent); }

</style>
