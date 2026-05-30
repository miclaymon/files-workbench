<template>
  <div class="list-layout">
    <div
      v-for="item in items"
      :key="item.path"
      class="list-item"
      :class="{ selected: isSelected(item), focused: isFocused(item), dragging: draggingPath === item.path, hidden: item.hidden }"
      @mousedown="(e) => { cancelPending(); onMouseDown(e, item) }"
      @click="(e) => onItemClick(e, item)"
      @mouseenter="hoverFocus = item; props.hoverPreviewEnabled && item.thumbnail ? startHover(item, $event.currentTarget, props.hoverPreviewDelayMs) : null"
      @mouseleave="hoverFocus = null; endHover()"
    >
      <div class="item-checkbox" v-show="showCheckbox(item)">
        <input type="checkbox" :checked="isSelected(item)" @click.stop="onCheckboxClick($event, item)" @change="onCheckboxChange($event, item)" />
      </div>

      <div class="item-icon">
        <img v-if="item.thumbnail && !failedThumbnails.has(item.path)" crossorigin="anonymous" :src="item.thumbnail" :alt="item.name" class="thumbnail" loading="lazy" @error="onThumbnailError(item)" />
        <svg v-else class="fallback-icon" :width="16" :height="16" viewBox="0 0 24 24" fill="currentColor">
          <path :d="defaultIcon(item)" />
        </svg>
        <svg v-if="isVideo(item) && item.thumbnail && !failedThumbnails.has(item.path)" class="video-badge" viewBox="0 0 24 24" fill="currentColor">
          <path :d="mdiPlayCircle" />
        </svg>
      </div>

      <div class="item-details">
        <div class="item-name">{{ item.name }}</div>
        <div class="item-meta">
          <span class="item-size">{{ item.kind === 'file' ? formatBytes(item.size) : '—' }}</span>
          <span v-if="item.modified" class="item-date">{{ formatDate(item.modified) }}</span>
        </div>
      </div>
    </div>
  </div>

  <DirectoryHoverPreview :item="hpItem" :triggerRect="hpRect" />
</template>

<script setup>
import { ref, computed } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant, mdiPlayCircle } from '@mdi/js'
import { useClickDebounce } from '~/composables/useClickDebounce.js'
import { useDrag } from '~/composables/useDrag.js'
import { useHoverPreview } from '~/composables/useHoverPreview.js'
import DirectoryHoverPreview from './DirectoryHoverPreview.vue'

const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts'])
function isVideo(item) { return VIDEO_EXTS.has(item.name?.split('.').pop()?.toLowerCase() ?? '') }

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  hoverPreviewEnabled: { type: Boolean, default: true },
  hoverPreviewDelayMs: { type: Number, default: 2000 },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate'])

const { activeItem: hpItem, triggerRect: hpRect, startHover, endHover, cancelPending } = useHoverPreview()

const hoverFocus = ref(null)
const failedThumbnails = ref(new Set())

function onThumbnailError(item) {
  failedThumbnails.value = new Set([...failedThumbnails.value, item.path])
}

const isSelected = computed(() => (item) => props.selectedItems.some(s => s.path === item.path))
const isFocused = computed(() => (item) => props.focusedItem?.path === item.path)
const showCheckbox = computed(() => (item) => props.alwaysShowCheckboxes || isSelected.value(item) || hoverFocus.value?.path === item.path)

function defaultIcon(item) {
  if (item.kind === 'dir') return mdiFolder
  if (item.kind === 'shortcut') return mdiLinkVariant
  return mdiFile
}

const { handleClick } = useClickDebounce()
const { draggingPath, wasDragging, onMouseDown } = useDrag({
  onActivate: (item) => {
    const alreadySelected = props.selectedItems.some(s => s.path === item.path)
    if (!alreadySelected) {
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
        emit('select', { item, mode: isSelected.value(item) ? 'remove' : 'add' })
      } else if (e.shiftKey && props.selectedItems.length > 0) {
        const lastSelected = props.selectedItems[props.selectedItems.length - 1]
        const lastIndex = props.items.findIndex(i => i.path === lastSelected.path)
        const currentIndex = props.items.findIndex(i => i.path === item.path)
        const start = Math.min(lastIndex, currentIndex)
        const end = Math.max(lastIndex, currentIndex)
        emit('select', { items: props.items.slice(start, end + 1), mode: 'replace' })
      } else {
        emit('select', { item, mode: 'replace' })
      }
    },
    () => {
      emit('focus', item)
      if (item.kind === 'dir') emit('navigate', item)
      else if (item.kind === 'shortcut') {
        if (item.brokenLink) alert(`Broken link: ${item.target || 'Unknown'}`)
        else if (item.target) emit('navigate', { path: item.target, name: item.target.split(/[\\\/]/).pop(), kind: 'dir' })
        else alert('Invalid shortcut')
      } else {
        emit('select', { item, mode: 'open' })
      }
    },
    { e },
  )
}

function onCheckboxClick(event, item) {
  event.stopPropagation()
  emit('focus', item)
  emit('select', { item, mode: isSelected.value(item) ? 'remove' : 'add' })
}

function onCheckboxChange(event, item) {
  emit('focus', item)
  emit('select', { item, mode: event.target.checked ? 'add' : 'remove' })
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—'
  const units = ['B', 'KB', 'MB', 'GB']
  let i = 0, b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

function formatDate(timestamp) {
  return new Date(timestamp * 1000).toLocaleDateString()
}
</script>

<style scoped>
.list-layout { height: 100%; overflow-y: auto; padding: 4px; }

.list-item {
  display: flex;
  align-items: center;
  padding: 8px 12px;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.15s;
  border: 1px solid transparent;
}
.list-item:hover { background: rgba(255,255,255,0.05); }
.list-item.selected { background: rgba(0,122,204,0.1); border-color: var(--accent); }
.list-item.focused { box-shadow: 0 0 0 1px var(--accent); }
.list-item.hidden { opacity: 0.45; }

.item-checkbox { margin-right: 8px; opacity: 0; transition: opacity 0.2s; }
.list-item:hover .item-checkbox, .list-item.selected .item-checkbox { opacity: 1; }
.item-checkbox input { width: 14px; height: 14px; cursor: pointer; }

.item-icon { position: relative; margin-right: 12px; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.thumbnail { width: 24px; height: 24px; object-fit: cover; border-radius: 2px; user-select: none; -webkit-user-drag: none; }
.list-item.dragging { opacity: 0.4; }
.fallback-icon { color: #9e9e9e; }

.video-badge {
  position: absolute;
  width: 14px;
  height: 14px;
  color: white;
  opacity: 0.9;
  filter: drop-shadow(0 1px 2px rgba(0,0,0,0.7));
  pointer-events: none;
}

.item-details { flex: 1; min-width: 0; }
.item-name { font-weight: 500; margin-bottom: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.item-meta { display: flex; gap: 16px; font-size: 12px; color: var(--text-muted); }
.item-size { min-width: 60px; }
</style>
