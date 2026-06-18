<template>
  <div class="gallery-layout" tabindex="0" @keydown="onKeyDown">
    <div
      v-for="item in items"
      :key="item.path"
      class="gallery-item"
      :class="{ selected: isSelected(item), focused: isFocused(item), hidden: item.hidden }"
      @click="onItemClick($event, item)"
      @contextmenu.prevent="$emit('contextmenu', { event: $event, item })"
      @dblclick="onDblClick(item)"
      @mouseenter="hpEnabled && item.thumbnail ? startHover(item, $event.currentTarget, hpDelayMs) : null"
      @mouseleave="endHover"
      @mousedown="cancelPending"
    >
      <div class="gallery-thumb">
        <img
          v-if="item.thumbnail && imageStates[item.path] !== 'failed'"
          crossorigin="anonymous"
          loading="lazy"
          :src="item.thumbnail"
          :alt="item.name"
          class="gallery-img"
          :style="{ opacity: imageStates[item.path] === 'loaded' ? 1 : 0 }"
          @load="imageStates[item.path] = 'loaded'"
          @error="imageStates[item.path] = 'failed'"
        />
        <div v-if="item.thumbnail && imageStates[item.path] === 'loading'" class="skeleton-placeholder" />
        <svg v-if="!item.thumbnail || imageStates[item.path] === 'failed'" class="fallback-icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="iconPath(item)" />
        </svg>
        <svg v-if="isVideo(item) && item.thumbnail && imageStates[item.path] !== 'failed'" class="video-badge" viewBox="0 0 24 24" fill="currentColor">
          <path :d="mdiPlayCircle" />
        </svg>
      </div>
      <div class="gallery-name-overlay">
        <span class="gallery-name-text">{{ item.name }}</span>
      </div>
      <div class="gallery-checkbox" v-show="alwaysShowCheckboxes || isSelected(item)">
        <input type="checkbox" :checked="isSelected(item)" @click.stop="toggleSelect(item)" />
      </div>
    </div>
  </div>

  <DirectoryHoverPreview :item="hpItem" :triggerRect="hpRect" />
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant, mdiPlayCircle } from '@mdi/js'
import { useHoverPreview } from '~/composables/interaction/useHoverPreview.js'
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
const hpEnabled = computed(() => props.hoverPreviewEnabled)
const hpDelayMs = computed(() => props.hoverPreviewDelayMs)

const imageStates = reactive({})

function initImageState(item) {
  if (!(item.path in imageStates)) {
    imageStates[item.path] = item.thumbnail ? 'loading' : ''
  }
}

props.items.forEach(initImageState)

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

function toggleSelect(item) {
  emit('focus', item)
  emit('select', { item, mode: isSelected(item) ? 'remove' : 'add' })
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
.gallery-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 4px;
  padding: 8px;
  height: 100%;
  overflow-y: auto;
  align-content: start;
  outline: none;
}
.gallery-layout:focus { box-shadow: inset 0 0 0 1px var(--accent); }

.gallery-item {
  position: relative;
  aspect-ratio: 1;
  border-radius: 4px;
  overflow: hidden;
  cursor: pointer;
  border: 2px solid transparent;
  transition: border-color 0.1s;

  &:hover .gallery-name-overlay { opacity: 1; }
  &:hover .gallery-checkbox { opacity: 1; }
  &.selected { border-color: var(--accent); }
  &.focused { box-shadow: 0 0 0 2px var(--accent); }
  &.hidden { opacity: 0.45; }
}

.gallery-thumb {
  position: relative;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface-alt);
}

.gallery-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: opacity 0.2s;
}

.fallback-icon { width: 48px; height: 48px; color: #9e9e9e; }

.video-badge {
  position: absolute;
  width: 40px;
  height: 40px;
  color: white;
  opacity: 0.85;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.6));
  pointer-events: none;
}

.skeleton-placeholder {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.gallery-name-overlay {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 4px 6px 6px;
  background: linear-gradient(transparent, rgba(0,0,0,0.7));
  opacity: 0;
  transition: opacity 0.15s;
}

.gallery-name-text {
  font-size: 11px;
  color: #fff;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gallery-checkbox {
  position: absolute;
  top: 4px;
  left: 4px;
  opacity: 0;
  transition: opacity 0.1s;
}
.gallery-checkbox input { width: 14px; height: 14px; cursor: pointer; }
</style>
