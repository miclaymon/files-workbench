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

      <BreadcrumbFullPath
        :path="currentPath"
        :changeTabPath="changeTabPath"
        @navigate="handleNavigate"
      />

      <div class="layout-buttons">
        <!-- Sort -->
        <Tooltip content="Sort" :delay="300">
          <button
            class="nav-button"
            :class="{ active: isSortNonDefault }"
            @click.stop="toggleSortMenu"
            ref="sortBtnRef"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M3 18h6v-2H3v2zm0-5h9v-2H3v2zm0-7v2h18V6H3zm16 9.41V10h-2v7.59l-2.29-2.3-1.42 1.42L17 20.17l3.71-3.46-1.42-1.42L17 17.41z"/>
            </svg>
          </button>
        </Tooltip>

        <!-- Filter -->
        <Tooltip content="Filter" :delay="300">
          <button
            class="nav-button"
            :class="{ active: isFilterActive }"
            @click.stop="toggleFilterMenu"
            ref="filterBtnRef"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
              <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z"/>
            </svg>
          </button>
        </Tooltip>

        <!-- Layout picker -->
        <Tooltip :content="'Layout: ' + (LAYOUT_META[layout]?.label ?? layout)" :delay="300">
          <button class="nav-button layout-picker-btn" @click.stop="toggleLayoutMenu" ref="layoutBtnRef">
            <svg v-html="LAYOUT_META[layout]?.icon ?? LAYOUT_META['grid'].icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" />
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
      @select="handleSelect"
      @focus="handleFocus"
      @contextmenu="handleContextMenu"
      @navigate="handleNavigate"
      @rename="$emit('rename', $event)"
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

    <!-- Sort menu -->
    <Teleport to="body">
      <div
        v-if="sortMenuVisible"
        class="dp-floating-menu"
        :style="{ top: sortMenuPos.y + 'px', left: sortMenuPos.x + 'px' }"
        ref="sortMenuRef"
      >
        <button
          v-for="field in SORT_FIELDS"
          :key="field.key"
          class="dp-menu-item"
          :class="{ 'dp-menu-item--active': sortField === field.key }"
          @click="setSortField(field.key)"
        >
          <span class="dp-menu-item-label">{{ field.label }}</span>
          <span class="dp-menu-item-badge" v-if="sortField === field.key">
            {{ sortDir === 'asc' ? '↑' : '↓' }}
          </span>
        </button>
        <div class="dp-menu-sep" />
        <button class="dp-menu-item" @click="clearSort">
          <span class="dp-menu-item-label">Reset to default</span>
        </button>
      </div>

      <!-- Filter panel -->
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
import BreadcrumbFullPath from './BreadcrumbFullPath.vue'
import Tooltip from './Tooltip.vue'
import FloatingMenu from './FloatingMenu.vue'
import { mdiFolder } from '@mdi/js'

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  layout: { type: String, default: 'grid' },
  showDebug: { type: Boolean, default: false },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  currentPath: { type: String, default: '' },
  navigationHistory: { type: Object, default: () => ({ previous: [], next: [] }) },
  changeTabPath: { type: Function, default: null },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'navigate-up', 'navigate-previous', 'navigate-next', 'update:layout', 'rename'])

const currentLayout = DirectoryLayout

// ── Layout ────────────────────────────────────────────────────────────────
const ICON_GRID = '<path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zm11 0h7v7h-7z"/>'
const ICON_LIST = '<path d="M3 5h2v2H3zm4 0h14v2H7zM3 10h2v2H3zm4 0h14v2H7zM3 15h2v2H3zm4 0h14v2H7z"/>'
const ICON_TABLE = '<path d="M3 3h18v3H3zm0 5h18v2H3zm0 4h18v2H3zm0 4h18v3H3z"/>'
const ICON_GALLERY = '<path d="M3 3h8v8H3zm10 0h8v8h-8zM3 13h8v8H3zm10 0h8v8h-8z"/>'
const ICON_MOSAIC = '<path d="M3 3h5v8H3zm7 0h4v5h-4zm6 0h5v5h-5zM3 13h5v8H3zm7 3h4v5h-4zm6-3h5v8h-5zm-6-5h4v5h-4z"/>'
const ICON_FEED = '<path d="M3 4h18v4H3zm0 6h8v4H3zm10 0h8v4h-8zM3 16h8v4H3zm10 0h8v4h-8z"/>'

const LAYOUT_META = {
  'grid-xs':        { label: 'Grid XS',  icon: ICON_GRID,    group: 'grid' },
  'grid-sm':        { label: 'Grid SM',  icon: ICON_GRID,    group: 'grid' },
  'grid':           { label: 'Grid',     icon: ICON_GRID,    group: 'grid' },
  'grid-md':        { label: 'Grid MD',  icon: ICON_GRID,    group: 'grid' },
  'grid-lg':        { label: 'Grid LG',  icon: ICON_GRID,    group: 'grid' },
  'grid-xl':        { label: 'Grid XL',  icon: ICON_GRID,    group: 'grid' },
  'grid-xxl':       { label: 'Grid XXL', icon: ICON_GRID,    group: 'grid' },
  'list':           { label: 'List',     icon: ICON_LIST,    group: 'list' },
  'details':        { label: 'Details',  icon: ICON_TABLE,   group: 'list' },
  'gallery-grid':   { label: 'Gallery',  icon: ICON_GALLERY, group: 'gallery' },
  'gallery-mosaic': { label: 'Mosaic',   icon: ICON_MOSAIC,  group: 'gallery' },
  'feed':           { label: 'Feed',     icon: ICON_FEED,    group: 'feed' },
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
const sortMenuVisible = ref(false)
const sortMenuPos = ref({ x: 0, y: 0 })
const sortBtnRef = ref(null)
const sortMenuRef = ref(null)

function toggleSortMenu() {
  if (sortMenuVisible.value) { sortMenuVisible.value = false; return }
  closeFilterMenu()
  const rect = sortBtnRef.value?.getBoundingClientRect()
  if (rect) sortMenuPos.value = { x: rect.left, y: rect.bottom + 4 }
  sortMenuVisible.value = true
}

function closeSortMenu() { sortMenuVisible.value = false }

function setSortField(field) {
  if (sortField.value === field) {
    sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortField.value = field
    sortDir.value = 'asc'
  }
  sortMenuVisible.value = false
}

function clearSort() {
  sortField.value = 'name'
  sortDir.value = 'asc'
  sortMenuVisible.value = false
}

const isSortNonDefault = computed(() => sortField.value !== 'name' || sortDir.value !== 'asc')

// ── Filter ────────────────────────────────────────────────────────────────
const TYPE_GROUPS = {
  images:    new Set(['png','jpg','jpeg','webp','gif','bmp','ico','avif','svg','tiff','raw','heic','heif']),
  videos:    new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts']),
  audio:     new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma']),
  documents: new Set(['pdf','doc','docx','xls','xlsx','ppt','pptx','txt','md','rtf','odt','ods','odp','csv']),
  archives:  new Set(['zip','tar','gz','bz2','7z','rar','xz','dmg','iso','tar.gz','tar.bz2']),
  code:      new Set(['js','ts','vue','jsx','tsx','py','go','rs','java','c','cpp','h','hpp','css','html','json','yaml','yml','toml','sh','bash','rb','php','swift','kt']),
}
const TYPE_GROUP_LABELS = {
  images: 'Images', videos: 'Videos', audio: 'Audio',
  documents: 'Documents', archives: 'Archives', code: 'Code',
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
const filterBtnRef = ref(null)
const filterPanelRef = ref(null)

function toggleFilterMenu() {
  if (filterMenuVisible.value) { filterMenuVisible.value = false; return }
  closeSortMenu()
  const rect = filterBtnRef.value?.getBoundingClientRect()
  if (rect) filterMenuPos.value = { y: rect.bottom + 4, right: window.innerWidth - rect.right }
  filterMenuVisible.value = true
}

function closeFilterMenu() { filterMenuVisible.value = false }

function toggleFilterType(type) {
  const s = new Set(filterTypes.value)
  if (s.has(type)) s.delete(type)
  else s.add(type)
  filterTypes.value = s
}

function clearFilter() {
  filterTypes.value = new Set()
  filterSizePreset.value = ''
  filterDatePreset.value = ''
}

const isFilterActive = computed(() =>
  filterTypes.value.size > 0 || filterSizePreset.value !== '' || filterDatePreset.value !== ''
)

const showActiveBar = computed(() => isSortNonDefault.value || isFilterActive.value)

// ── Sort + Filter applied ─────────────────────────────────────────────────
const processedItems = computed(() => {
  let result = [...props.items]

  // Type filter
  if (filterTypes.value.size > 0) {
    result = result.filter(item => {
      if (item.kind === 'dir') return true
      const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
      return [...filterTypes.value].some(g => TYPE_GROUPS[g]?.has(ext))
    })
  }

  // Size filter
  if (filterSizePreset.value && SIZE_PRESETS[filterSizePreset.value]) {
    const { min, max } = SIZE_PRESETS[filterSizePreset.value]
    result = result.filter(item => {
      if (item.kind === 'dir') return true
      const s = item.size ?? 0
      return s >= min && s <= max
    })
  }

  // Date modified filter
  if (filterDatePreset.value && DATE_PRESETS[filterDatePreset.value]) {
    const { min, max } = DATE_PRESETS[filterDatePreset.value]
    result = result.filter(item => {
      if (item.kind === 'dir') return true
      const ts = (item.modified ?? 0) * 1000
      return ts >= min && ts <= max
    })
  }

  // Sort — directories always first
  result.sort((a, b) => {
    if (a.kind === 'dir' && b.kind !== 'dir') return -1
    if (a.kind !== 'dir' && b.kind === 'dir') return 1

    const dir = sortDir.value === 'asc' ? 1 : -1

    switch (sortField.value) {
      case 'name': {
        const na = a.name?.toLowerCase() ?? ''
        const nb = b.name?.toLowerCase() ?? ''
        return dir * na.localeCompare(nb)
      }
      case 'size':
        return dir * ((a.size ?? 0) - (b.size ?? 0))
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

// ── Close menus on outside click ──────────────────────────────────────────
function onDocClick(e) {
  if (sortMenuVisible.value && !sortMenuRef.value?.contains(e.target) && !sortBtnRef.value?.contains(e.target))
    sortMenuVisible.value = false
  if (filterMenuVisible.value && !filterPanelRef.value?.contains(e.target) && !filterBtnRef.value?.contains(e.target))
    filterMenuVisible.value = false
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
})
onUnmounted(() => {
  document.removeEventListener('mouseup', clearLongPressTimers)
  document.removeEventListener('click', onDocClick, true)
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

/* ── Sort menu (floating) ─────────────────────────────────────────────── */
.dp-floating-menu {
  position: fixed;
  z-index: 300;
  background: var(--surface-alt, #2d2d30);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px;
  box-shadow: 0 6px 20px rgba(0,0,0,0.4);
  min-width: 160px;
}

.dp-menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  color: var(--text);
  text-align: left;
  gap: 12px;
}
.dp-menu-item:hover { background: rgba(255,255,255,0.07); }
.dp-menu-item--active { color: var(--accent); }
.dp-menu-item--active .dp-menu-item-label { font-weight: 500; }
.dp-menu-item-badge { font-size: 14px; flex-shrink: 0; }

.dp-menu-sep { height: 1px; background: var(--border); margin: 4px 0; }

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
