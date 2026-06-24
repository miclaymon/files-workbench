<template>
  <div class="dl-wrap" :style="cssVars" tabindex="0" @keydown="onKeyDown">

    <!-- Find widget — anchored to top-right, above scroll content -->
    <div v-if="findOpen" class="dl-find-wrap">
      <DirectoryFindWidget
        ref="findWidgetRef"
        v-model:query="findQuery"
        v-model:caseSensitive="findCaseSensitive"
        v-model:wholeWord="findWholeWord"
        v-model:useRegex="findUseRegex"
        :matchCount="findMatches.length"
        :currentIdx="findCurrentIdx"
        @close="findOpen = false"
        @next="findNext"
        @prev="findPrev"
        @replace="doFindReplace"
        @replace-all="doFindReplaceAll"
      />
    </div>

    <!-- Non-columnar header (Grid / Gallery / Mosaic / Feed) — outside the scroll container -->
    <div v-if="!isColumnarLayout" class="dl-nc-header">
      <input
        type="range" min="0" max="100" step="5"
        :value="zoomLevel"
        @input="emit('zoom-change', Number($event.target.value))"
        @click.stop @mousedown.stop
        class="dl-nc-zoom"
        title="Zoom"
      />
      <button
        class="dl-nc-sort-btn"
        :class="{ 'dl-nc-sort-btn--active': isSortNonDefault }"
        @click.stop="toggleSortDropdown"
        ref="sortDropdownBtnRef"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0">
          <path d="M3 18h6v-2H3v2zm0-5h9v-2H3v2zm0-7v2h18V6H3z"/>
        </svg>
        {{ SORT_FIELD_LABELS.find(f => f.key === sortField)?.label ?? 'Name' }}{{ isSortNonDefault ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '' }}
      </button>
      <button class="dl-hdr-icon-btn" :class="{ 'dl-hdr-icon-btn--active': filterActive }" @click.stop="emit('filter-click', $event.currentTarget)" title="Filter">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z"/>
        </svg>
      </button>
    </div>

    <div class="dl" :data-layout="layout" @scroll.passive="onNestedScroll" @contextmenu.self.prevent="emit('background-contextmenu', $event)" ref="dlRef">

    <!-- Column header — visible in details/list/nested layouts via CSS -->
    <div class="dl-header">
      <template v-if="layout === 'details'">
        <label class="dl-hdr-check-wrap" @click.stop @mousedown.stop>
          <input type="checkbox" :checked="allSelected" @change="onSelectAll" />
        </label>
        <span class="dl-hdr-thumb-gap" />
      </template>
      <span v-else-if="isColumnarLayout" class="dl-hdr-spacer" />

      <template v-if="isColumnarLayout">
        <button class="dl-col-name dl-hdr-col-btn" @click.stop="onColSort('name')">
          Name<span v-if="sortField === 'name'" class="dl-sort-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
        </button>

        <template v-if="layout === 'details'">
          <button v-if="visibleColumns.has('size')" class="dl-col-size dl-hdr-col-btn" @click.stop="onColSort('size')">
            Size<span v-if="sortField === 'size'" class="dl-sort-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
          </button>
          <button v-if="visibleColumns.has('date')" class="dl-col-date dl-hdr-col-btn" @click.stop="onColSort('modified')">
            Modified<span v-if="sortField === 'modified'" class="dl-sort-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
          </button>
        </template>
        <template v-else>
          <button class="dl-col-size dl-hdr-col-btn" @click.stop="onColSort('size')">
            Size<span v-if="sortField === 'size'" class="dl-sort-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
          </button>
          <button class="dl-col-date dl-hdr-col-btn" @click.stop="onColSort('modified')">
            Modified<span v-if="sortField === 'modified'" class="dl-sort-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
          </button>
        </template>

        <button class="dl-hdr-icon-btn" :class="{ 'dl-hdr-icon-btn--active': filterActive }" @click.stop="emit('filter-click', $event.currentTarget)" title="Filter">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0 0 18.95 4H5.04a1 1 0 0 0-.79 1.61z"/>
          </svg>
        </button>
        <button v-if="layout === 'details'" class="dl-hdr-menu-btn" @click.stop="toggleColumnMenu" ref="columnMenuBtnRef" title="Columns">⋮</button>
      </template>
    </div>

    <!-- JS-driven sticky ancestor overlay for nested layout -->
    <!-- v-show keeps element in DOM so transform is never reset by Vue recreating the element -->
    <div v-show="layout === 'nested' && stickyDirs.length"
         class="dl-nest-sticky-ctx"
         ref="stickyCtxRef">
      <div v-for="dir in stickyDirs" :key="dir.path"
           class="dl-item dl-item--ctx"
           @click="(e) => onItemClick(e, dir)"
           @contextmenu.prevent.stop="$emit('contextmenu', { event: $event, item: dir })">
        <label class="dl-check" style="visibility:hidden" @click.stop @mousedown.stop>
          <input type="checkbox" disabled />
        </label>
        <span v-for="(_, i) in (dir._depth ?? 0)" :key="i" class="dl-nest-guide" />
        <button class="dl-nest-toggle" @click.stop="toggleNested(dir)">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path :d="mdiChevronDown" />
          </svg>
        </button>
        <div class="dl-thumb">
          <img v-if="dir.thumbnail && imageStates[dir.path] === 'loaded'"
               crossorigin="anonymous" :src="dir.thumbnail" :alt="dir.name"
               class="dl-img" style="opacity:1" />
          <img v-else-if="customIconUrl(dir)" :src="customIconUrl(dir)" class="dl-pack-icon" :alt="dir.name" @error="onCustomIconError(dir.path)" />
          <svg v-else-if="customFolderColor(dir)" class="dl-icon" viewBox="0 0 24 24" fill="currentColor" :style="{ color: customFolderColor(dir) }">
            <path :d="iconPath(dir)" />
          </svg>
          <img v-else-if="itemIconUrl(dir)" :src="itemIconUrl(dir)" class="dl-pack-icon" :alt="dir.name" @error="onPackIconError(dir.path)" />
          <svg v-else class="dl-icon" viewBox="0 0 24 24" fill="currentColor">
            <path :d="iconPath(dir)" />
          </svg>
        </div>
        <div class="dl-body">
          <span class="dl-name" :title="dir.customization?.comment || undefined">{{ itemDisplayName(dir) }}</span>
          <div class="dl-meta">
            <span class="dl-size"><DirSizeCell :item="dir" :dir-sizes="dirSizes" /></span>
            <span class="dl-date">{{ dir.modified ? formatDate(dir.modified) : '' }}</span>
          </div>
        </div>
      </div>
    </div>

    <div
      v-for="item in activeItems"
      :key="(item._id ?? item.path) + '|' + (item._depth ?? 0)"
      class="dl-item"
      :data-path="item.path"
      :class="{
        'dl-item--selected':     isSelected(item),
        'dl-item--focused':      isFocused(item),
        'dl-item--dragging':     draggingPath === item.path,
        'dl-item--hidden':       item.hidden,
        'dl-item--find-match':   findOpen && findMatchPaths.has(item.path),
        'dl-item--find-current': findOpen && findMatches[findCurrentIdx]?.path === item.path,
      }"
      @mousedown="(e) => { cancelPending(); onMouseDown(e, item); onRightMouseDown(e, item) }"
      @click="(e) => onItemClick(e, item)"
      @contextmenu.prevent.stop="$emit('contextmenu', { event: $event, item })"
      @mouseenter="hoverItem = item; onItemEnter(item, $event)"
      @mouseleave="hoverItem = null; endHover(); onItemLeave()"
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

      <!-- Nested indent guides + expand toggle -->
      <template v-if="layout === 'nested'">
        <span v-for="(_, i) in (item._depth ?? 0)" :key="i"
              class="dl-nest-guide"
              :class="{
                'dl-nest-guide--last':   i === (item._depth ?? 0) - 1,
                'dl-nest-guide--corner': i === (item._depth ?? 0) - 1 && item._lastChild,
              }" />
        <button
          v-if="item.kind === 'dir' || item.kind === 'archive'"
          class="dl-nest-toggle"
          @click.stop="toggleNested(item)"
          :disabled="nestedLoadingPaths.has(item.path)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path v-if="expandedPaths.has(item.path)" :d="mdiChevronDown"/>
            <path v-else :d="mdiChevronRight"/>
          </svg>
        </button>
        <span v-else class="dl-nest-leaf" />
      </template>

      <!-- Thumbnail -->
      <div class="dl-thumb" @mouseenter="onThumbEnter(item, $event)" @mouseleave="onThumbLeave($event)">
        <img
          v-if="item.thumbnail && (imageStates[item.path] === 'loading' || imageStates[item.path] === 'loaded')"
          crossorigin="anonymous"
          :src="imgSrc(item)"
          :alt="item.name"
          class="dl-img"
          :style="{ opacity: imageStates[item.path] === 'loaded' ? 1 : 0 }"
          @load="onImgLoad(item)"
          @error="onImgError(item)"
        />
        <div v-if="item.thumbnail && (imageStates[item.path] === 'idle' || imageStates[item.path] === 'loading')" class="dl-skeleton" />
        <template v-if="!item.thumbnail || imageStates[item.path] === 'failed'">
          <img v-if="customIconUrl(item)" :src="customIconUrl(item)" class="dl-pack-icon" :alt="item.name" @error="onCustomIconError(item.path)" />
          <svg v-else-if="customFolderColor(item)" class="dl-icon" viewBox="0 0 24 24" fill="currentColor" :style="{ color: customFolderColor(item) }">
            <path :d="iconPath(item)" />
          </svg>
          <img v-else-if="itemIconUrl(item)" :src="itemIconUrl(item)" class="dl-pack-icon" :alt="item.name" @error="onPackIconError(item.path)" />
          <svg v-else class="dl-icon" viewBox="0 0 24 24" fill="currentColor">
            <path :d="iconPath(item)" />
          </svg>
        </template>
        <!-- Video badge -->
        <svg v-if="isVideoItem(item) && item.thumbnail && imageStates[item.path] === 'loaded'"
             class="dl-video-badge" viewBox="0 0 24 24" fill="currentColor">
          <path :d="mdiPlayCircle" />
        </svg>
      </div>

      <!-- Body: name + metadata row -->
      <div class="dl-body">
        <span
          v-if="renamingPath !== item.path"
          class="dl-name"
          :title="item.customization?.comment || undefined"
          @click="onNameClick($event, item)"
        ><template v-if="findOpen && findMatchPaths.has(item.path)"><template v-for="(p, pi) in highlightParts(itemDisplayName(item))" :key="pi"><mark v-if="p.hl" class="dl-find-hl" :class="{ 'dl-find-active-index': findMatches[findCurrentIdx]?.path === item.path }">{{ p.text }}</mark><template v-else>{{ p.text }}</template></template></template><template v-else>{{ itemDisplayName(item) }}</template></span>
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
          ><DirSizeCell :item="item" :dir-sizes="dirSizes" /></span>
          <span
            class="dl-date"
            :class="{ 'dl-col--hidden': layout === 'details' && !visibleColumns.has('date') }"
          >{{ item.modified ? formatDate(item.modified) : '' }}</span>
        </div>
      </div>

      <!-- Gallery-grid name overlay (shown on hover) -->
      <div class="dl-overlay">
        <span class="dl-overlay-name">{{ itemDisplayName(item) }}</span>
      </div>

      <!-- Hover preview: fixed-position, grows from thumbnail center -->
      <Transition name="hp-expand">
        <div
          v-if="hpItem?.path === item.path && hpRect && hpMediaReady"
          class="dl-hp-overlay"
          :style="{
            ...hpPosition,
            ...(hpMediaSize ? { width: hpMediaSize.w + 'px', height: hpMediaSize.h + 'px' } : {})
          }"
        >
          <video v-if="isVideoItem(item)" :src="hpSrc(item)" autoplay loop muted playsinline class="dl-hp-media" />
          <img v-else :src="hpSrc(item)" class="dl-hp-media" draggable="false" />
        </div>
      </Transition>
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

    <!-- Sort dropdown for non-columnar views -->
    <div v-if="sortDropdownVisible" class="dl-sort-dropdown" :style="sortDropdownStyle" ref="sortDropdownRef">
      <button
        v-for="f in SORT_FIELD_LABELS"
        :key="f.key"
        class="dl-sort-dd-item"
        :class="{ 'dl-sort-dd-item--active': sortField === f.key }"
        @click.stop="onSortDropdownPick(f.key)"
      >
        {{ f.label }}<span v-if="sortField === f.key" class="dl-sort-dd-arrow">{{ sortDir === 'asc' ? ' ↑' : ' ↓' }}</span>
      </button>
      <div class="dl-sort-dd-sep" />
      <button class="dl-sort-dd-item" @click.stop="emit('sort-change', { field: 'name', dir: 'asc' }); sortDropdownVisible = false">Reset</button>
    </div>

    </div><!-- end .dl -->

    <!-- Directory info / selection status — bottom-left overlay -->
    <div v-if="infoText" class="dl-info-widget">{{ infoText }}</div>

    <!-- Item hover tooltip — fixed, populated async for extra metadata -->
    <div v-if="ttVisible && ttItem" class="dl-tooltip" :style="ttStyle">
      <div class="dl-tt-row"><span class="dl-tt-key">Type</span><span>{{ itemTypeLabel(ttItem) }}</span></div>
      <div v-if="ttSizeDisplay" class="dl-tt-row"><span class="dl-tt-key">Size</span><span>{{ ttSizeDisplay }}</span></div>
      <div v-if="ttItem.modified" class="dl-tt-row"><span class="dl-tt-key">Modified</span><span>{{ formatDateLong(ttItem.modified) }}</span></div>
      <div v-if="ttMeta" class="dl-tt-row"><span class="dl-tt-key">Resolution</span><span>{{ ttMeta.w }} × {{ ttMeta.h }}</span></div>
    </div>

  </div><!-- end .dl-wrap -->
</template>

<script setup>
import { ref, reactive, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { mdiChevronDown, mdiChevronRight, mdiFile, mdiFolder, mdiLinkVariant, mdiPlayCircle } from '@mdi/js'
import { useClickDebounce } from '~/composables/interaction/useClickDebounce.js'
import { useHoverPreview } from '~/composables/interaction/useHoverPreview.js'
import { useDrag } from '~/composables/interaction/useDrag.js'
import { useRightClickDrag } from '~/composables/interaction/useRightClickDrag.js'
import { useIconPack } from '~/composables/useIconPack.js'
import { resolveCustomIcon } from '~/composables/useCustomIcon.js'
import { fsListDir, fsArchiveList } from '~/lib/fs-api.js'
import { MEDIA_BASE } from '~/lib/api-config.js'
import DirectoryFindWidget from './DirectoryFindWidget.vue'
import DirSizeCell from './DirSizeCell.vue'

const MEDIA_EXTS = new Set([
  'png','jpg','jpeg','webp','gif','bmp','ico','avif',
  'mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts',
  'mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma',
])

// Separate sets used to pick the right thumbnail endpoint for nested children
const _THUMB_IMG  = new Set(['png','jpg','jpeg','webp','gif','bmp','ico','avif'])
const _THUMB_MEDIA = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts','mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma'])
const _THUMB_SIZE = 256

function _withThumbnails(items) {
  // Detect whether the server has thumbnails enabled by finding a media file in the
  // current top-level items and checking if it received a thumbnail URL. If no media
  // files exist at the top level we can't tell, so we add URLs optimistically and let
  // onImgError fall back to the file icon if the server doesn't support them.
  const topLevelMediaItem = props.items.find(i => {
    const ext = i.name.split('.').pop()?.toLowerCase()
    return _THUMB_IMG.has(ext) || _THUMB_MEDIA.has(ext)
  })
  const enabled = topLevelMediaItem ? topLevelMediaItem.thumbnail != null : true
  if (!enabled) return items
  return items.map(item => {
    const ext = item.name.split('.').pop()?.toLowerCase()
    const thumbnail = _THUMB_IMG.has(ext)
      ? `${MEDIA_BASE}/image?path=${encodeURIComponent(item.path)}&size=${_THUMB_SIZE}`
      : _THUMB_MEDIA.has(ext)
      ? `${MEDIA_BASE}/thumbnail?path=${encodeURIComponent(item.path)}&size=${_THUMB_SIZE}`
      : null
    return { ...item, thumbnail, icon: item.icon ?? null }
  })
}

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  layout: { type: String, default: 'grid' },
  zoomLevel: { type: Number, default: 50 },
  hoverPreviewEnabled: { type: Boolean, default: true },
  hoverPreviewDelayMs: { type: Number, default: 2000 },
  sortField: { type: String, default: 'name' },
  sortDir: { type: String, default: 'asc' },
  filterText: { type: String, default: '' },
  filterActive: { type: Boolean, default: false },
  // path → { size, files, loading } for directories, computed asynchronously and
  // owned by DirectoryTab. Files carry their own `size` from the listing.
  dirSizes: { type: Object, default: () => ({}) },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'background-contextmenu', 'right-drag-drop', 'navigate', 'rename', 'rename-batch', 'zoom-change', 'sort-change', 'filter-change', 'filter-click', 'copy', 'cut', 'paste'])

// ── Hover preview ─────────────────────────────────────────────────────────────
const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts'])
function isVideoItem(item) { return VIDEO_EXTS.has(item.name?.split('.').pop()?.toLowerCase() ?? '') }

const { activeItem: hpItem, triggerRect: hpRect, startHover, endHover, cancelPending } = useHoverPreview()

const hpMediaReady = ref(false)
// Explicit pixel size computed during preload so translate(-50%,-50%) is correct
// from the very first frame — no layout pass needed on the freshly-inserted element.
const hpMediaSize = ref(null) // { w, h } in px, or null (video / unknown)

// Center-point position clamped so the popup never escapes the viewport.
// Uses known media size when available; falls back to CSS-max estimates for video.
const HP_SAFE = 12
const hpPosition = computed(() => {
  const r = hpRect.value
  if (!r) return { left: '-9999px', top: '-9999px' }
  const vw = window.innerWidth
  const vh = window.innerHeight
  const W = hpMediaSize.value?.w ?? Math.min(600, vw * 0.88)
  const H = hpMediaSize.value?.h ?? Math.min(500, vh * 0.85)
  const cx = Math.max(W / 2 + HP_SAFE, Math.min(r.left + r.width  / 2, vw - W / 2 - HP_SAFE))
  const cy = Math.max(H / 2 + HP_SAFE, Math.min(r.top  + r.height / 2, vh - H / 2 - HP_SAFE))
  return { left: Math.round(cx) + 'px', top: Math.round(cy) + 'px' }
})

function preloadMedia(item) {
  hpMediaReady.value = false
  hpMediaSize.value = null
  const url = `${MEDIA_BASE}/preview?path=${encodeURIComponent(item.path)}`
  if (isVideoItem(item)) {
    fetch(url, { method: 'GET', headers: { Range: 'bytes=0-65535' } }).catch(() => {})
    hpMediaReady.value = true
  } else {
    const img = new Image()
    const applySize = () => {
      if (img.naturalWidth && img.naturalHeight) {
        const maxW = Math.min(600, window.innerWidth * 0.88)
        const maxH = Math.min(500, window.innerHeight * 0.85)
        const scale = Math.min(1, maxW / img.naturalWidth, maxH / img.naturalHeight)
        hpMediaSize.value = { w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) }
      }
    }
    img.onload = () => { applySize(); hpMediaReady.value = true }
    img.onerror = () => { hpMediaReady.value = true }
    img.src = url
    if (img.complete && img.naturalWidth) { applySize(); hpMediaReady.value = true }
  }
}

function hpStart(item, thumbEl) {
  if (!props.hoverPreviewEnabled || !item.thumbnail) return
  hpMediaReady.value = false
  hpMediaSize.value = null
  const preloadMs = Math.min(500, Math.round(props.hoverPreviewDelayMs / 2))
  startHover(item, thumbEl, props.hoverPreviewDelayMs, preloadMs, preloadMedia)
}

function hpSrc(item) {
  return `${MEDIA_BASE}/preview?path=${encodeURIComponent(item.path)}`
}

// ── Find widget ───────────────────────────────────────────────────────────────
const findOpen          = ref(false)
const findQuery         = ref('')
const findCaseSensitive = ref(false)
const findWholeWord     = ref(false)
const findUseRegex      = ref(false)
const findCurrentIdx    = ref(0)
const findWidgetRef     = ref(null)

function _buildFindRe(flags = '') {
  try {
    const q = findUseRegex.value
      ? findQuery.value
      : findQuery.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const pattern = findWholeWord.value ? `\\b${q}\\b` : q
    return new RegExp(pattern, (findCaseSensitive.value ? '' : 'i') + flags)
  } catch { return null }
}

const findMatches = computed(() => {
  if (!findOpen.value || !findQuery.value) return []
  const re = _buildFindRe()
  return re ? activeItems.value.filter(item => re.test(itemDisplayName(item))) : []
})

const findMatchPaths = computed(() => new Set(findMatches.value.map(i => i.path)))

function highlightParts(name) {
  const re = _buildFindRe('g')
  if (!re) return [{ text: name, hl: false }]
  const parts = []
  let last = 0, m
  while ((m = re.exec(name)) !== null) {
    if (m.index > last) parts.push({ text: name.slice(last, m.index), hl: false })
    parts.push({ text: m[0], hl: true })
    last = m.index + m[0].length
    if (m[0].length === 0) re.lastIndex++
  }
  if (last < name.length) parts.push({ text: name.slice(last), hl: false })
  return parts
}

function findNext() {
  if (!findMatches.value.length) return
  findCurrentIdx.value = (findCurrentIdx.value + 1) % findMatches.value.length
}

function findPrev() {
  if (!findMatches.value.length) return
  findCurrentIdx.value = (findCurrentIdx.value - 1 + findMatches.value.length) % findMatches.value.length
}

function openFind() {
  findOpen.value = true
  nextTick(() => findWidgetRef.value?.focus())
}

watch([findQuery, findCaseSensitive, findWholeWord, findUseRegex], () => {
  findCurrentIdx.value = 0
  nextTick(scrollToFindMatch)
})

watch(findCurrentIdx, () => nextTick(scrollToFindMatch))

watch(findOpen, (v) => {
  if (!v) { findQuery.value = '' }
  else nextTick(() => findWidgetRef.value?.focus())
})

function scrollToFindMatch() {
  const match = findMatches.value[findCurrentIdx.value]
  if (!match || !dlRef.value) return
  dlRef.value.querySelector(`[data-path="${CSS.escape(match.path)}"]`)
    ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function doFindReplace(replaceWith) {
  const match = findMatches.value[findCurrentIdx.value]
  if (!match) return
  const re = _buildFindRe('g')
  if (!re) return
  const newName = itemDisplayName(match).replace(re, replaceWith)
  if (newName !== itemDisplayName(match) && newName.trim()) {
    emit('rename', { path: match.path, newName })
  }
}

function doFindReplaceAll(replaceWith) {
  const re = _buildFindRe('g')
  if (!re || !findMatches.value.length) return
  const renames = []
  for (const match of findMatches.value) {
    const name = itemDisplayName(match)
    const newName = name.replace(re, replaceWith)
    if (newName !== name && newName.trim()) renames.push({ path: match.path, newName })
  }
  if (renames.length) emit('rename-batch', renames)
}

// ── Info widget ───────────────────────────────────────────────────────────────
const totalSize    = computed(() => props.items.reduce((s, i) =>
  s + (i.kind === 'dir' ? (props.dirSizes[i.path]?.size ?? 0) : (i.size ?? 0)), 0))
const selectedSize = computed(() => props.selectedItems.reduce((s, i) =>
  s + (i.kind === 'dir' ? (props.dirSizes[i.path]?.size ?? 0) : (i.size ?? 0)), 0))

const infoText = computed(() => {
  const c = props.items.length
  if (c === 0) return ''
  let t = `${c.toLocaleString()} ${c === 1 ? 'item' : 'items'}`
  if (totalSize.value > 0) t += ` (${formatBytes(totalSize.value)})`
  const sc = props.selectedItems.length
  if (sc > 0) {
    t += ` | ${sc.toLocaleString()} selected`
    if (selectedSize.value > 0) t += ` (${formatBytes(selectedSize.value)})`
  }
  return t
})

// ── Item hover tooltip ────────────────────────────────────────────────────────
const ttItem    = ref(null)
// Size row for the hovered item — directories read the async map, files their own.
const ttSizeDisplay = computed(() => {
  const it = ttItem.value
  if (!it) return ''
  const sz = it.kind === 'dir' ? props.dirSizes[it.path]?.size : it.size
  return sz != null ? formatBytes(sz) : ''
})
const ttPos     = ref({ x: 0, y: 0 })
const ttVisible = ref(false)
const ttMeta    = ref(null)
let _ttTimer    = null
let _ttOverThumb = false
let _ttHoverItem = null

const AUDIO_EXT_SET = new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma'])
const IMAGE_EXT_SET = new Set(['png','jpg','jpeg','webp','gif','bmp','ico','avif'])

function itemTypeLabel(item) {
  if (item.kind === 'dir')      return 'Folder'
  if (item.kind === 'shortcut') return 'Symbolic Link'
  if (item.kind === 'archive')  return 'Archive'
  const ext = item.name.split('.').pop()?.toLowerCase() ?? ''
  if (!ext) return 'File'
  const up = ext.toUpperCase()
  if (IMAGE_EXT_SET.has(ext)) return `${up} Image`
  if (VIDEO_EXTS.has(ext))    return `${up} Video`
  if (AUDIO_EXT_SET.has(ext)) return `${up} Audio`
  return `${up} File`
}

function formatDateLong(ts) {
  return new Date(ts * 1000).toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

async function _loadTtMeta(item) {
  ttMeta.value = null
  if (!IMAGE_EXT_SET.has(item.name.split('.').pop()?.toLowerCase() ?? '')) return
  try {
    const res = await fetch(`${MEDIA_BASE}/metadata?path=${encodeURIComponent(item.path)}`)
    if (!res.ok) return
    const data = await res.json()
    if (data.width && data.height && ttItem.value?.path === item.path)
      ttMeta.value = { w: data.width, h: data.height }
  } catch { /* ignore */ }
}

const ttStyle = computed(() => {
  if (!ttVisible.value) return { display: 'none' }
  const TW = 230
  const x = Math.min(ttPos.value.x + 16, window.innerWidth - TW - 8)
  const y = Math.min(ttPos.value.y + 10, window.innerHeight - 130)
  return { left: `${x}px`, top: `${y}px`, width: `${TW}px` }
})

function _scheduleTt(item, e) {
  clearTimeout(_ttTimer)
  ttVisible.value = false
  ttPos.value = { x: e.clientX, y: e.clientY }
  _ttTimer = setTimeout(() => {
    if (!_ttOverThumb && _ttHoverItem?.path === item.path && !hpItem.value) {
      ttItem.value = item
      ttVisible.value = true
      _loadTtMeta(item)
    }
  }, 500)
}

function _clearTt() {
  clearTimeout(_ttTimer)
  ttVisible.value = false
  ttItem.value = null
  ttMeta.value = null
  _ttHoverItem = null
}

function onItemEnter(item, e) {
  _ttHoverItem = item
  _ttOverThumb = false
  _scheduleTt(item, e)
}

function onItemLeave() {
  _clearTt()
}

function onThumbEnter(item, e) {
  _ttOverThumb = true
  clearTimeout(_ttTimer)
  ttVisible.value = false
  hpStart(item, e.currentTarget)
}

function onThumbLeave(e) {
  _ttOverThumb = false
  endHover()
  if (_ttHoverItem) _scheduleTt(_ttHoverItem, e)
}

watch(hpItem, (v) => { if (v) { clearTimeout(_ttTimer); ttVisible.value = false } })

// ── Sort / filter header ──────────────────────────────────────────────────────
const isColumnarLayout = computed(() =>
  props.layout === 'list' || props.layout === 'details' || props.layout === 'nested'
)
const isSortNonDefault = computed(() => props.sortField !== 'name' || props.sortDir !== 'asc')

const SORT_FIELD_LABELS = [
  { key: 'name',     label: 'Name' },
  { key: 'size',     label: 'Size' },
  { key: 'type',     label: 'Type' },
  { key: 'modified', label: 'Modified' },
  { key: 'created',  label: 'Created' },
  { key: 'accessed', label: 'Accessed' },
]

function onColSort(field) {
  const dir = props.sortField === field && props.sortDir === 'asc' ? 'desc' : 'asc'
  emit('sort-change', { field, dir })
}

// Sort dropdown for non-columnar views
const sortDropdownVisible = ref(false)
const sortDropdownStyle = ref({})
const sortDropdownBtnRef = ref(null)
const sortDropdownRef = ref(null)

function toggleSortDropdown() {
  if (sortDropdownVisible.value) { sortDropdownVisible.value = false; return }
  const rect = sortDropdownBtnRef.value?.getBoundingClientRect()
  if (rect) sortDropdownStyle.value = { position: 'fixed', top: rect.bottom + 4 + 'px', left: rect.left + 'px', zIndex: 100 }
  sortDropdownVisible.value = true
}

function closeSortDropdown(e) {
  if (!sortDropdownVisible.value) return
  if (sortDropdownRef.value?.contains(e.target) || sortDropdownBtnRef.value?.contains(e.target)) return
  sortDropdownVisible.value = false
}

function onSortDropdownPick(field) {
  onColSort(field)
  sortDropdownVisible.value = false
}

// ── Zoom-driven CSS vars (all layout sizes derive from zoomLevel 0–100) ──
const cssVars = computed(() => {
  const z = props.zoomLevel ?? 50
  return {
    '--min-cell':      Math.round(72  + z * 1.88) + 'px',  // 72–260px
    '--icon-size':     Math.round(36  + z * 1.12) + 'px',  // 36–148px
    '--gallery-cell':  Math.round(100 + z * 2)    + 'px',  // 100–300px
    '--mosaic-width':  Math.round(100 + z * 2)    + 'px',  // 100–300px
    '--feed-min-card': Math.round(180 + z * 2.7)  + 'px',  // 180–450px
    '--row-height':    Math.round(22  + z * 0.26) + 'px',  // 22–48px
    '--nested-row':    Math.round(36  + z * 0.20) + 'px',  // 36–56px
    '--nested-thumb':  Math.round(28  + z * 0.14) + 'px',  // 28–42px
  }
})

const nestedRowPx = computed(() => Math.round(36 + (props.zoomLevel ?? 50) * 0.20))

// ── Container ref (for IntersectionObserver root) ─────────────────────────
const dlRef = ref(null)

// ── Image state ───────────────────────────────────────────────────────────
// States: '' = no thumbnail | 'idle' = not yet in viewport | 'loading' = fetching | 'loaded' | 'failed'
const imageStates = reactive({})

// Thumbnail load retry with exponential backoff. The main case this covers: a lazy
// load racing an in-flight rename — the <img> fetches the pre-rename path just as the
// file is moved, 404ing. Retrying (with a cache-bust nonce to force a re-fetch) lets it
// succeed once the path settles. While an optimistic rename is in flight (item has a
// thumbnailPath) we retry generously; otherwise we fail fast to the file-type icon.
const _imgRetryCount  = new Map()  // path → attempts (non-reactive)
const _imgRetryTimers = new Map()  // path → timeout id
const imgRetryNonce   = reactive({})  // path → nonce appended to src to force re-fetch

function imgSrc(item) {
  const n = imgRetryNonce[item.path]
  return n ? `${item.thumbnail}&_r=${n}` : item.thumbnail
}

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
  // With v-show the overlay element exists immediately — set its initial transform
  if (stickyCtxRef.value) {
    stickyCtxRef.value.style.transform = `translateY(${nestedRowPx.value}px)`
  }
})

onUnmounted(() => {
  _observer?.disconnect(); _observer = null
  _imgRetryTimers.forEach(clearTimeout); _imgRetryTimers.clear()
})

watch(() => props.items, (items) => {
  items.forEach(item => {
    if (item.thumbnail) {
      // During optimistic rename, carry the loaded state from the old path so the
      // thumbnail doesn't flicker or attempt to load from the not-yet-renamed path.
      if (item.thumbnailPath && !imageStates[item.path] && imageStates[item.thumbnailPath]) {
        imageStates[item.path] = imageStates[item.thumbnailPath]
      } else if (!imageStates[item.path]) {
        imageStates[item.path] = 'idle'
      }
    } else {
      imageStates[item.path] = ''
    }
  })
  if (_observer) _observeAll()
}, { immediate: true })

function onImgLoad(item) {
  imageStates[item.path] = 'loaded'
  _imgRetryCount.delete(item.path)
}

function onImgError(item) {
  const path = item.path
  const attempts = _imgRetryCount.get(path) ?? 0
  // Retry generously while a rename is in flight (transient self-inflicted 404s);
  // fail fast for genuine failures (corrupt/unsupported media).
  const maxRetries = item.thumbnailPath ? 6 : 1
  if (attempts >= maxRetries) {
    _imgRetryCount.delete(path)
    imageStates[path] = 'failed'  // give up → file-type icon
    return
  }
  _imgRetryCount.set(path, attempts + 1)
  imageStates[path] = 'loading'   // keep the skeleton, hide the broken img
  const delay = Math.min(2000, 200 * 2 ** attempts)  // 200,400,800,1600,2000,2000
  clearTimeout(_imgRetryTimers.get(path))
  _imgRetryTimers.set(path, setTimeout(() => {
    _imgRetryTimers.delete(path)
    // Bump the nonce to force the <img> to re-fetch; by now the path has usually settled.
    if (imageStates[path] === 'loading') imgRetryNonce[path] = (imgRetryNonce[path] ?? 0) + 1
  }, delay))
}

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

// ── Nested view ───────────────────────────────────────────────────────────
const expandedPaths = ref(new Set())
const nestedChildren = ref(new Map())
const nestedLoadingPaths = ref(new Set())
const nestedScrollTop = ref(0)
const stickyCtxRef = ref(null)

function onNestedScroll(e) {
  if (props.layout !== 'nested') return
  const st = e.target.scrollTop

  // Direct GPU transform — no Vue overhead, no frame lag
  if (stickyCtxRef.value) {
    stickyCtxRef.value.style.transform = `translateY(${st + nestedRowPx.value}px)`
  }

  // Synchronous reactive update — Vue 3 batches this as a microtask that flushes
  // before the next paint, so stickyDirs content is always fresh in the same frame
  nestedScrollTop.value = st
}

// Re-sync transform when zoom changes while not scrolling
watch(nestedRowPx, rowH => {
  if (stickyCtxRef.value) {
    stickyCtxRef.value.style.transform = `translateY(${nestedScrollTop.value + rowH}px)`
  }
})

// Dirs that have scrolled above the visible area but whose subtree is still visible.
// Rendered as a JS-positioned overlay so they correctly un-stick when their section ends.
const stickyDirs = computed(() => {
  if (props.layout !== 'nested') return []
  const rowH = nestedRowPx.value
  const items = activeItems.value
  const st = nestedScrollTop.value

  const result = []
  for (let i = 0; i < items.length; i++) {
    // Item tops start after the header: item[i] is at scroll-y (i+1)*rowH
    const itemTop = (i + 1) * rowH
    if (itemTop > st) break  // item is still at or below the viewport top — done

    const item = items[i]
    if ((item.kind !== 'dir' && item.kind !== 'archive') || !expandedPaths.value.has(item.path)) continue

    // Find index of the last descendant of this dir
    const depth = item._depth ?? 0
    let lastDescIdx = i
    for (let j = i + 1; j < items.length; j++) {
      if ((items[j]._depth ?? 0) <= depth) break
      lastDescIdx = j
    }

    // The subtree must still have items visible (last desc bottom is below viewport top)
    if ((lastDescIdx + 2) * rowH > st) result.push(item)
  }
  return result
})

const nestedDisplayItems = computed(() => {
  function buildList(items, depth) {
    const result = []
    for (const item of items) {
      result.push({ ...item, _depth: depth })
      if ((item.kind === 'dir' || item.kind === 'archive') && expandedPaths.value.has(item.path)) {
        const children = nestedChildren.value.get(item.path) ?? []
        result.push(...buildList(children, depth + 1))
      }
    }
    return result
  }
  const flat = buildList(props.items, 0)
  // Mark each item as last child: true if the next item with depth <= this item's depth
  // has a smaller depth (or no such item exists), meaning no more siblings follow.
  for (let i = 0; i < flat.length; i++) {
    const d = flat[i]._depth
    let isLast = true
    for (let j = i + 1; j < flat.length; j++) {
      if (flat[j]._depth <= d) { isLast = flat[j]._depth < d; break }
    }
    flat[i]._lastChild = isLast
  }
  return flat
})

async function toggleNested(item) {
  if (item.kind !== 'dir' && item.kind !== 'archive') return
  const paths = new Set(expandedPaths.value)
  if (paths.has(item.path)) {
    paths.delete(item.path)
    expandedPaths.value = paths
    return
  }
  paths.add(item.path)
  expandedPaths.value = paths
  if (!nestedChildren.value.has(item.path)) {
    nestedLoadingPaths.value = new Set(nestedLoadingPaths.value).add(item.path)
    try {
      let rawItems
      const sepIdx = item.path.indexOf('::')
      if (item.kind === 'archive') {
        // Top-level archive: list root of archive
        const result = await fsArchiveList(item.path, '')
        rawItems = (result.items ?? []).map(child => ({
          ...child,
          path: item.path + '::' + child.name + (child.kind === 'dir' ? '/' : ''),
        }))
      } else if (sepIdx !== -1) {
        // Virtual archive subdirectory: list inner path
        const archiveFile = item.path.slice(0, sepIdx)
        const innerPath = item.path.slice(sepIdx + 2)
        const result = await fsArchiveList(archiveFile, innerPath)
        rawItems = (result.items ?? []).map(child => ({
          ...child,
          path: archiveFile + '::' + innerPath + child.name + (child.kind === 'dir' ? '/' : ''),
        }))
      } else {
        const result = await fsListDir(item.path, { includeMetadata: true })
        rawItems = result.items ?? []
      }
      const children = _withThumbnails(rawItems)
      children.forEach(child => { if (child.thumbnail && !imageStates[child.path]) imageStates[child.path] = 'idle' })
      const map = new Map(nestedChildren.value)
      map.set(item.path, children)
      nestedChildren.value = map
      if (_observer) _observeAll()
    } catch {
      const p = new Set(expandedPaths.value)
      p.delete(item.path)
      expandedPaths.value = p
    } finally {
      const l = new Set(nestedLoadingPaths.value)
      l.delete(item.path)
      nestedLoadingPaths.value = l
    }
  }
}

// Active item list — nested uses its own flattened tree, others use displayItems
const activeItems = computed(() =>
  props.layout === 'nested' ? nestedDisplayItems.value : displayItems.value
)

// ── Selection mode ────────────────────────────────────────────────────────
const selectionMode = ref(false)

watch(() => props.selectedItems, (items) => {
  if (items.length > 0 && !selectionMode.value) selectionMode.value = true
  else if (items.length === 0) selectionMode.value = false
})

watch(() => props.items, () => {
  selectionMode.value = false
  expandedPaths.value = new Set()
  nestedChildren.value = new Map()
  nestedScrollTop.value = 0
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

onMounted(() => {
  document.addEventListener('click', closeColumnMenu)
  document.addEventListener('click', closeSortDropdown)
})
onUnmounted(() => {
  document.removeEventListener('click', closeColumnMenu)
  document.removeEventListener('click', closeSortDropdown)
})

// ── Select-all ────────────────────────────────────────────────────────────
const allSelected = computed(() =>
  activeItems.value.length > 0 && activeItems.value.every(item => isSelected(item))
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

const { ensureLoaded: ensureIconPack, resolveIcon, iconUrl, isAvailable: iconPackAvailable } = useIconPack()
ensureIconPack()
const _packIconErrors = ref(new Set())
function onPackIconError(path) {
  _packIconErrors.value = new Set(_packIconErrors.value).add(path)
}

function iconPath(item) {
  switch (item.kind) {
    case 'dir':      return mdiFolder
    case 'shortcut': return mdiLinkVariant
    default:         return mdiFile
  }
}

function itemIconUrl(item) {
  if (_packIconErrors.value.has(item.path)) return null
  if (item.icon) return iconUrl(item.icon)
  if (!iconPackAvailable.value) return null
  const name = resolveIcon(item.name, item.kind === 'dir')
  return name ? iconUrl(name) : null
}

// Custom icon from .directory / desktop.ini
const _customIconErrors = ref(new Set())
function onCustomIconError(path) {
  _customIconErrors.value = new Set(_customIconErrors.value).add(path)
}
function _customDescriptor(item) {
  return item.kind === 'dir' ? resolveCustomIcon(item.customization?.icon) : null
}
function customIconUrl(item) {
  if (_customIconErrors.value.has(item.path)) return null
  const d = _customDescriptor(item)
  return d?.type === 'url' ? d.url : null
}
function customFolderColor(item) {
  if (_customIconErrors.value.has(item.path)) return null
  const d = _customDescriptor(item)
  return d?.type === 'folder-color' ? d.color : null
}
function itemDisplayName(item) {
  return item.customization?.name || item.name
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

const { onRightMouseDown } = useRightClickDrag({
  onActivate:    (item) => isSelected(item) ? [...props.selectedItems] : [item],
  onDrop:        (payload) => emit('right-drag-drop', payload),
  onRightClick:  ({ item, event }) => emit('contextmenu', { event, item }),
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
      } else if (item.kind === 'archive') {
        emit('navigate', item.path + '::')
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
  if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
    event.preventDefault()
    openFind()
    return
  }
  if (event.ctrlKey || event.metaKey) {
    if (event.key === '=' || event.key === '+') {
      event.preventDefault()
      emit('zoom-change', Math.min(100, (props.zoomLevel ?? 50) + 5))
      return
    }
    if (event.key === '-') {
      event.preventDefault()
      emit('zoom-change', Math.max(0, (props.zoomLevel ?? 50) - 5))
      return
    }
    if (event.key === '0') {
      event.preventDefault()
      emit('zoom-change', 50)
      return
    }
    if (event.key === 'a' || event.key === 'A') {
      event.preventDefault()
      emit('select', { items: activeItems.value, mode: 'replace' })
      return
    }
    if (event.key === 'c') {
      if (props.selectedItems.length > 0) {
        event.preventDefault()
        emit('copy', props.selectedItems)
      }
      return
    }
    if (event.key === 'x') {
      if (props.selectedItems.length > 0) {
        event.preventDefault()
        emit('cut', props.selectedItems)
      }
      return
    }
    if (event.key === 'v') {
      event.preventDefault()
      emit('paste')
      return
    }
  }
  if (event.key === 'F2') {
    event.preventDefault()
    if (props.selectedItems.length > 1) {
      emit('rename', { items: props.selectedItems })
    } else {
      const target = props.focusedItem ?? props.selectedItems[0]
      if (target) startRename(target)
    }
    return
  }
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
    else if (props.focusedItem.kind === 'archive') emit('navigate', props.focusedItem.path + '::')
    else emit('select', { item: props.focusedItem, mode: 'open' })
  }
}
</script>

<style scoped>
/* ── Wrapper ──────────────────────────────────────────────────────────────── */

.dl-wrap {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  outline: none;
  position: relative;
  container-type: inline-size;
  container-name: dl;

  &:focus { box-shadow: inset 0 0 0 1px var(--accent); }
}

/* ── Non-columnar header (Grid / Gallery / Mosaic / Feed) ─────────────────── */

.dl-nc-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 10px;
  background: var(--surface-alt);
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
  user-select: none;
}

.dl-nc-sort-btn {
  display: flex;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 4px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
  padding: 2px 6px;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover { color: var(--text); background: rgba(255,255,255,0.06); }
  &.dl-nc-sort-btn--active { color: var(--accent); border-color: rgba(0,122,204,0.3); }
}

.dl-nc-zoom {
  width: 80px;
  accent-color: var(--accent);
  cursor: pointer;
  flex-shrink: 0;
  margin-left: auto;
}

/* ── Shared header primitives ─────────────────────────────────────────────── */

.dl-hdr-icon-btn {
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
  flex-shrink: 0;
  transition: all 0.15s;

  &:hover { background: var(--hover-background, rgba(255,255,255,0.07)); color: var(--text); border-color: var(--border); }
  &.dl-hdr-icon-btn--active { color: var(--accent); background: color-mix(in srgb, var(--accent) 12%, transparent); border-color: color-mix(in srgb, var(--accent) 35%, transparent); }
}

.dl-hdr-col-btn {
  background: transparent;
  border: none;
  color: var(--text-muted);
  font: inherit;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 3px;
  display: flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;

  &:hover { color: var(--text); background: rgba(255,255,255,0.06); }
}

.dl-sort-arrow { color: var(--accent); font-size: 10px; }

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

  &:hover { color: var(--text); background: var(--hover-background); }
}

.dl-hdr-check-wrap {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  cursor: pointer;
  line-height: 0;

  input { width: 14px; height: 14px; cursor: pointer; }
}

/* gap between check and thumb in header */
.dl-hdr-thumb-gap { width: 18px; flex-shrink: 0; }
/* spacer = check-width + gap + thumb-width */
.dl-hdr-spacer    { width: calc(14px + 8px + 18px); flex-shrink: 0; }

.dl-col-name { flex: 1; min-width: 0; }
.dl-col-size { width: 80px; text-align: right; padding-right: 16px; flex-shrink: 0; }
.dl-col-date { width: 130px; flex-shrink: 0; }

/* ── Sort dropdown (non-columnar views) ───────────────────────────────────── */

.dl-sort-dropdown {
  background: var(--surface-alt, #2d2d30);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 4px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.4);
  min-width: 140px;
}

.dl-sort-dd-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 5px 10px;
  font-size: 13px;
  cursor: pointer;
  border-radius: 3px;
  user-select: none;
  background: transparent;
  border: none;
  color: var(--text);
  text-align: left;

  &:hover { background: rgba(255,255,255,0.06); }
  &.dl-sort-dd-item--active { color: var(--accent); }
}

.dl-sort-dd-arrow { font-size: 11px; color: var(--accent); }
.dl-sort-dd-sep   { border-top: 1px solid var(--border); margin: 4px 0; }

/* ── Column picker dropdown ───────────────────────────────────────────────── */

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

  &:hover { background: rgba(255,255,255,0.06); }
  input { width: 14px; height: 14px; cursor: pointer; }
}

/* ── Main scroll container + layout variants ──────────────────────────────── */

.dl {
  /* default: grid */
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(var(--min-cell, 120px), 1fr));
  gap: 12px;
  padding: 16px;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  align-content: start;
  outline: none;

  .dl-header { display: none; }

  /* Columnar layouts share flex-column base */
  &:is([data-layout="list"], [data-layout="details"], [data-layout="nested"]) {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
  }

  /* Shared column header for list + details */
  &:is([data-layout="list"], [data-layout="details"]) {
    .dl-header {
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

      .dl-hdr-icon-btn { margin-left: auto; }
    }
  }

  /* ── Gallery-grid ─────────────────────────────────────────────────────── */

  &[data-layout="gallery-grid"] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--gallery-cell, 180px), 1fr));
    grid-auto-rows: var(--gallery-cell, 180px);
    gap: 4px;
    padding: 8px;
    align-content: start;

    .dl-item {
      display: block;
      padding: 0;
      border-radius: 4px;
      overflow: hidden;
      border: 2px solid transparent;

      &.dl-item--selected { border-color: var(--accent); }

      .dl-check { top: 6px; left: 6px; }
      /* Thumb and image fill the square item absolutely */
      .dl-thumb {
        position: absolute;
        inset: 0;
        height: 100%;
        width: 100%;
        border-radius: 0;
        background: transparent;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .dl-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .dl-body    { display: none; }
      .dl-overlay { display: none; }
    }
  }

  /* ── Gallery-mosaic ───────────────────────────────────────────────────── */

  &[data-layout="gallery-mosaic"] {
    display: flex;
    flex-wrap: wrap;
    align-content: start;
    gap: 6px;
    padding: 8px;
    overflow-y: auto;

    .dl-item {
      display: flex;
      flex-direction: column;
      width: var(--mosaic-width, 180px);
      flex-shrink: 0;
      align-items: stretch;
      padding: 0;
      border-radius: 4px;
      overflow: hidden;
      border: 2px solid transparent;
      background: var(--surface);

      .dl-thumb    { height: auto; width: 100%; min-height: 80px; background: transparent; flex-shrink: 0; }
      .dl-img      { width: 100%; height: auto; object-fit: initial; }
      .dl-icon     { width: 32px; height: 32px; margin: 20px auto; }
      .dl-pack-icon{ width: 32px; height: 32px; margin: 20px auto; }
      .dl-skeleton { display: none; }
      .dl-body     { padding: 3px 6px 5px; margin-top: 0; }
      .dl-name     { font-size: 11px; color: var(--text-muted); text-align: left; -webkit-line-clamp: 1; }
    }
  }

  /* ── Feed ─────────────────────────────────────────────────────────────── */

  &[data-layout="feed"] {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(var(--feed-min-card, 280px), 1fr));
    gap: 8px;
    padding: 12px;
    align-content: start;

    .dl-item {
      flex-direction: column;
      align-items: stretch;
      padding: 0;
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid var(--border);

      &:hover             { border-color: rgba(255,255,255,0.2); }
      &.dl-item--selected { border-color: var(--accent); }

      .dl-check { top: 6px; left: 6px; }
      /* padding-bottom trick: height:0 + padding-bottom:56.25% = 16:9 aspect ratio */
      .dl-thumb {
        display: block;
        position: relative;
        width: 100%;
        height: 0;
        padding-bottom: 56.25%;
        background: transparent;
        overflow: hidden;
        flex-shrink: 0;
        border-radius: 0;
      }
      .dl-img      { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
      .dl-skeleton { position: absolute; inset: 0; }
      .dl-icon     { position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; }
      .dl-pack-icon{ position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); width: 40px; height: 40px; }
      .dl-body     { padding: 8px 10px 10px; margin-top: 0; }
      .dl-name     { font-size: 13px; font-weight: 500; text-align: left; -webkit-line-clamp: 2; }
      .dl-meta     { display: flex; gap: 8px; margin-top: 4px; }
      .dl-size,
      .dl-date     { font-size: 11px; color: var(--text-muted); }
    }
  }

  /* ── Details ──────────────────────────────────────────────────────────── */

  &[data-layout="details"] {
    overflow-x: auto;

    .dl-header { min-width: 420px; }

    .dl-item {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 3px 8px;
      border-radius: 0;
      border: none;
      border-bottom: 1px solid rgba(128,128,128,0.07);
      height: var(--row-height, 30px);
      min-width: 420px;

      .dl-check    { position: static; display: flex; align-items: center; flex-shrink: 0; }
      .dl-thumb    { width: 18px; height: 18px; background: transparent; }
      .dl-img      { object-fit: contain; }
      .dl-icon     { width: 16px; height: 16px; }
      .dl-pack-icon{ width: 16px; height: 16px; }
      .dl-skeleton { display: none; }
      .dl-body     { display: flex; align-items: center; flex: 1; margin-top: 0; min-width: 0; }
      .dl-name     { flex: 1; font-size: 13px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; -webkit-line-clamp: unset; }
      .dl-meta     { display: flex; flex-shrink: 0; margin-left: 0; }
      .dl-size     { width: 80px; text-align: right; padding-right: 16px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
      .dl-date     { width: 130px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    }
  }

  /* ── List ─────────────────────────────────────────────────────────────── */

  &[data-layout="list"] {
    .dl-item {
      flex-direction: row;
      align-items: center;
      gap: 8px;
      padding: 3px 8px;
      border-radius: 3px;
      border: 1px solid transparent;
      border-bottom-color: rgba(128,128,128,0.07);
      height: var(--row-height, 30px);

      &:hover             { border-color: transparent; border-bottom-color: rgba(128,128,128,0.07); }
      &.dl-item--selected { border-bottom-color: rgba(128,128,128,0.07); }

      .dl-check    { position: static; display: flex; align-items: center; flex-shrink: 0; }
      .dl-thumb    { width: 18px; height: 18px; background: transparent; }
      .dl-img      { object-fit: contain; }
      .dl-icon     { width: 16px; height: 16px; }
      .dl-pack-icon{ width: 16px; height: 16px; }
      .dl-skeleton { display: none; }
      .dl-body     { display: flex; align-items: center; flex: 1; margin-top: 0; }
      .dl-name     { flex: 1; font-size: 13px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; -webkit-line-clamp: unset; }
      .dl-meta     { display: flex; gap: 16px; flex-shrink: 0; margin-left: 8px; }
      .dl-size     { font-size: 12px; color: var(--text-muted); min-width: 60px; text-align: right; white-space: nowrap; }
      .dl-date     { font-size: 12px; color: var(--text-muted); white-space: nowrap; }
    }
  }

  /* ── Nested ───────────────────────────────────────────────────────────── */

  &[data-layout="nested"] {
    overflow-x: auto;
    position: relative; /* JS-driven sticky overlay is absolutely positioned inside */

    .dl-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 0 8px;
      height: var(--nested-row, 38px);
      flex-shrink: 0;
      position: sticky;
      top: 0;
      z-index: 60;
      background: var(--surface-alt);
      border-bottom: 1px solid var(--border);
      font-size: 11px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      user-select: none;
    }

    .dl-hdr-spacer { width: calc(20px + 18px + var(--nested-thumb, 30px) + 6px); }

    .dl-item {
      flex-direction: row;
      align-items: center;
      padding: 0 8px;
      border-radius: 0;
      border: none;
      border-bottom: 1px solid rgba(128,128,128,0.07);
      height: var(--nested-row, 38px);
      gap: 3px;

      .dl-check    { position: static; display: flex; align-items: center; flex-shrink: 0; margin: 0 2px; }
      .dl-thumb    { width: var(--nested-thumb, 30px); height: var(--nested-thumb, 30px); background: transparent; flex-shrink: 0; border-radius: 3px; margin-right: 6px; }
      .dl-img      { object-fit: cover; border-radius: 3px; }
      .dl-icon     { width: 20px; height: 20px; }
      .dl-pack-icon{ width: 20px; height: 20px; }
      .dl-skeleton { display: block; border-radius: 3px; }
      .dl-body     { display: flex; align-items: center; flex: 1; margin-top: 0; min-width: 0; }
      .dl-name     { flex: 1; font-size: 13px; text-align: left; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; -webkit-line-clamp: unset; }
      .dl-meta     { display: flex; flex-shrink: 0; margin-left: 0; }
      .dl-size     { width: 80px; text-align: right; padding-right: 16px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
      .dl-date     { width: 130px; font-size: 12px; color: var(--text-muted); white-space: nowrap; }
      .dl-overlay  { display: none; }
    }
  }
}

/* ── Item base (grid layout) ──────────────────────────────────────────────── */

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

  &:hover             { background: rgba(255,255,255,0.05); border-color: var(--accent); }
  &.dl-item--selected { background: rgba(0,122,204,0.1); border-color: var(--accent); }
  &.dl-item--focused  { box-shadow: 0 0 0 2px var(--accent); }
  &.dl-item--dragging { opacity: 0.4; }
  &.dl-item--hidden   { opacity: 0.45; }

  /* Checkbox — absolute in grid/gallery, overridden to static in row layouts */
  .dl-check {
    position: absolute;
    top: 4px;
    left: 4px;
    z-index: 10;
    line-height: 0;
    cursor: pointer;
    opacity: 0;
    transition: opacity 0.12s;

    &.dl-check--on { opacity: 1; }
    input { width: 14px; height: 14px; cursor: pointer; }
  }
  &:hover .dl-check { opacity: 1; }

  .dl-thumb {
    position: relative;
    width: 100%;
    height: var(--icon-size, 64px);
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 2px;
    overflow: hidden;
    background: transparent;
    flex-shrink: 0;
  }

  .dl-img {
    /* TODO: @Michael evaluate whether to use auto (maintain aspect ratio in thumbnail) or 100% (fill thumbnail space) */
    /*width: 100%;*/
    height: 100%;
    object-fit: cover;
    object-position: center;
    transition: opacity 0.2s;
    user-select: none;
    -webkit-user-drag: none;
  }

  .dl-icon      { color: #9e9e9e; width: 48px; height: 48px; }
  .dl-pack-icon { width: 48px; height: 48px; object-fit: contain; }

  .dl-video-badge {
    position: absolute;
    width: auto;
    height: clamp(12px, 50%, 48px);
    color: white;
    opacity: 0.5;
    transition: opacity 0.1s;
    filter: drop-shadow(0 1px 3px rgba(0,0,0,0.65));
    pointer-events: none;
  }
  &:hover .dl-video-badge { opacity: 0.75; }

  .dl-skeleton {
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
    background-size: 200% 100%;
    animation: shimmer 1.5s infinite;
  }

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

    &.dl-name--editing {
      display: block;
      overflow: visible;
      white-space: normal;
      -webkit-line-clamp: unset;
    }

    &[contenteditable]:focus-within {
      background: rgba(255,255,255,0.1);
      box-shadow: 0 0 3px 1px var(--accent);
      border-radius: 2px;
      user-select: text;
      outline: none;
    }
  }

  .dl-meta      { display: none; }
  .dl-col--hidden { display: none; }
  .dl-overlay   { display: none; }
}

@keyframes shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Nested sticky ancestor overlay ──────────────────────────────────────── */

/* JS-driven; positioned via scrollTop, not CSS sticky — never change top */
.dl-nest-sticky-ctx {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  z-index: 55;
  will-change: transform;
}

.dl-item--ctx {
  background: var(--surface);
  border-bottom-color: rgba(128,128,128,0.18);
  cursor: pointer;

  &:hover { background: rgba(255,255,255,0.05); }
}

/* ── Nested guide lines ───────────────────────────────────────────────────── */

/* One guide span per depth level — draws a vertical hairline via ::before */
.dl-nest-guide {
  width: 16px;
  flex-shrink: 0;
  align-self: stretch;
  position: relative;

  &::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 0;
    bottom: 0;
    width: 1px;
    background: rgba(128, 128, 128, 0.22);
  }

  &.dl-nest-guide--corner::before { bottom: 50%; } /* L-shape: line stops at mid-point */

  &.dl-nest-guide--last::after {
    content: '';
    position: absolute;
    left: 7px;
    top: 50%;
    width: 27px; /* spans rest of guide (9px) + toggle/leaf (18px) */
    height: 1px;
    background: rgba(128, 128, 128, 0.22);
  }
}

.dl-nest-toggle {
  width: 18px;
  height: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  border-radius: 3px;

  &:hover:not(:disabled) { color: var(--text); background: rgba(255,255,255,0.08); }
  &:disabled { opacity: 0.5; cursor: default; }
}

/* Aligns files with expandable dirs */
.dl-nest-leaf { width: 18px; flex-shrink: 0; display: inline-block; }

/* ── Hover preview ────────────────────────────────────────────────────────── */

.dl-hp-overlay {
  position: fixed;
  z-index: 9100;
  pointer-events: none;
  /* Centered on thumbnail; media sizes this naturally (no letterboxing) */
  transform: translate(-50%, -50%);
  transform-origin: center center;
  border-radius: 8px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 2px 10px rgba(0, 0, 0, 0.4);
  background: #111;
}

.dl-hp-media {
  display: block;
  width: auto;
  height: auto;
  max-width: min(600px, 88vw);
  max-height: min(500px, 85vh);
}

/* Spring in from thumbnail point, quick fade out */
.hp-expand-enter-active { transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.15s ease; }
.hp-expand-leave-active { transition: transform 0.1s ease, opacity 0.08s ease; }
.hp-expand-enter-from,
.hp-expand-leave-to { transform: translate(-50%, -50%) scale(0.1); opacity: 0; }

/* ── Find widget ──────────────────────────────────────────────────────────── */

.dl-find-wrap {
  position: absolute;
  top: 0;
  right: 16px; /* leave room for scrollbar */
  z-index: 150;
}

.dl-find-hl {
  background: rgba(255, 200, 0, 0.28);
  color: inherit;
  border-radius: 2px;
  font-style: normal;
}

mark.dl-find-hl.dl-find-active-index {
  background: rgba(255, 200, 0, 0.33);
  outline: 1px solid rgba(255, 200, 0, 0.667);
  filter: brightness(1.25);
  outline-offset: -1px;
}

.dl-item--find-current {
  outline: 2px solid var(--accent);
  outline-offset: -1px;
}

/* ── Info widget ──────────────────────────────────────────────────────────── */

.dl-info-widget {
  position: absolute;
  bottom: 0;
  left: 0;
  z-index: 100;
  max-width: 50%;
  padding: 3px 8px;
  background: rgba(0, 0, 0, 0.667);
  backdrop-filter: blur(4px);
  -webkit-backdrop-filter: blur(4px);
  border-radius: 0 4px 0 0;
  color: rgba(255, 255, 255, 0.75);
  font-size: 11.5px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: auto;
  transition: max-width 0.2s ease;
  user-select: none;

  &:hover { max-width: 100%; }
}

/* ── Hover tooltip ────────────────────────────────────────────────────────── */

.dl-tooltip {
  position: fixed;
  z-index: 9200;
  background: rgba(0, 0, 0, 0.82);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 7px 10px;
  pointer-events: none;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
}

.dl-tt-row {
  display: flex;
  gap: 8px;
  font-size: 12px;
  line-height: 1.65;
  color: rgba(255, 255, 255, 0.9);

  &:first-child { color: #fff; font-weight: 500; }
}

.dl-tt-key {
  color: rgba(255, 255, 255, 0.45);
  min-width: 68px;
  flex-shrink: 0;
}

/* ── Container queries ────────────────────────────────────────────────────── */

/* Hide the date column when the panel is too narrow to show it comfortably */
@container dl (max-width: 480px) {
  .dl:is([data-layout="list"], [data-layout="details"], [data-layout="nested"]) {
    .dl-date     { display: none; }
    .dl-col-date { display: none; }
  }
}

/* Hide size column and zoom slider in very narrow panels */
@container dl (max-width: 300px) {
  .dl:is([data-layout="list"], [data-layout="details"], [data-layout="nested"]) {
    .dl-size     { display: none; }
    .dl-col-size { display: none; }
  }
  .dl-nc-zoom { display: none; }
}
</style>
