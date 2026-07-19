<template>
  <div class="mosaic-layout" tabindex="0" @keydown="onKeyDown">
    <div
      v-for="item in items"
      :key="item.path"
      class="mosaic-item"
      :class="{ selected: isSelected(item), focused: isFocused(item), hidden: item.hidden }"
      @click="onItemClick($event, item)"
      @contextmenu.prevent="$emit('contextmenu', { event: $event, item })"
      @dblclick="onDblClick(item)"
      @mouseenter="props.hoverPreviewEnabled && item.thumbnail ? startHover(item, $event.currentTarget, props.hoverPreviewDelayMs) : null"
      @mouseleave="endHover"
      @mousedown="cancelPending"
    >
      <div class="mosaic-thumb">
        <img
          v-if="item.thumbnail && imageStates[item.path] !== 'failed'"
          crossorigin="anonymous"
          loading="lazy"
          :src="item.thumbnail"
          :alt="item.name"
          class="mosaic-img"
          :style="{ opacity: imageStates[item.path] === 'loaded' ? 1 : 0 }"
          @load="imageStates[item.path] = 'loaded'"
          @error="imageStates[item.path] = 'failed'"
        />
        <svg v-if="!item.thumbnail || imageStates[item.path] === 'failed'" class="fallback-icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="iconPath(item)" />
        </svg>
        <svg v-if="isVideo(item) && item.thumbnail && imageStates[item.path] !== 'failed'" class="video-badge" viewBox="0 0 24 24" fill="currentColor">
          <path :d="mdiPlayCircle" />
        </svg>
      </div>
      <div class="mosaic-name">{{ item.name }}</div>
    </div>
  </div>

  <DirectoryHoverPreview :item="hpItem" :triggerRect="hpRect" />
</template>

<script setup>
import { reactive } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant, mdiPlayCircle } from '@mdi/js'
import { useHoverPreview } from '@workbench/vue'
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

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'rename'])

const { activeItem: hpItem, triggerRect: hpRect, startHover, endHover, cancelPending } = useHoverPreview()

const imageStates = reactive({})
props.items.forEach(item => {
  imageStates[item.path] = item.thumbnail ? 'loading' : ''
})

function isSelected(item) { return props.selectedItems.some(s => s.path === item.path) }
function isFocused(item) { return props.focusedItem?.path === item.path }

function iconPath(item) {
  switch (item.kind) {
    case 'dir': return mdiFolder
    case 'shortcut': return mdiLinkVariant
    default: return mdiFile
  }
}

function onItemClick(e, item) {
  emit('focus', item)
  if (e.ctrlKey || e.metaKey) {
    emit('select', { item, mode: isSelected(item) ? 'remove' : 'add' })
  } else if (e.shiftKey && props.selectedItems.length > 0) {
    emit('select', { item, mode: 'shift' })
  } else {
    emit('select', { item, mode: 'replace' })
  }
}

function onDblClick(item) {
  if (item.kind === 'dir') emit('navigate', item.path)
  else emit('select', { item, mode: 'open' })
}

function onKeyDown(event) {
  if (event.key === 'Enter' && props.focusedItem) {
    event.preventDefault()
    if (props.focusedItem.kind === 'dir') emit('navigate', props.focusedItem.path)
    else emit('select', { item: props.focusedItem, mode: 'open' })
  }
}
</script>

<style scoped>
.mosaic-layout {
  columns: 4 180px;
  gap: 6px;
  padding: 8px;
  height: 100%;
  overflow-y: auto;
  outline: none;
}
.mosaic-layout:focus { box-shadow: inset 0 0 0 1px var(--accent); }

.mosaic-item {
  break-inside: avoid;
  margin-bottom: 6px;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  background: var(--surface);
  transition: border-color 0.1s;

  &:hover { border-color: rgba(255,255,255,0.15); }
  &.selected { border-color: var(--accent); }
  &.focused { box-shadow: 0 0 0 2px var(--accent); }
  &.hidden { opacity: 0.45; }
}

.mosaic-thumb {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-alt);
  min-height: 60px;
}

.mosaic-img {
  width: 100%;
  height: auto;
  display: block;
  transition: opacity 0.2s;
}

.fallback-icon { width: 40px; height: 40px; color: #9e9e9e; margin: 12px; }

.video-badge {
  position: absolute;
  width: 36px;
  height: 36px;
  color: white;
  opacity: 0.85;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
  pointer-events: none;
}

.mosaic-name {
  font-size: 11px;
  padding: 4px 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: var(--text-muted);
}
</style>
