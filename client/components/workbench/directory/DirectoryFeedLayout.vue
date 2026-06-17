<template>
  <div class="feed-layout" tabindex="0" @keydown="onKeyDown">
    <div
      v-for="item in items"
      :key="item.path"
      class="feed-item"
      :class="{ selected: isSelected(item), focused: isFocused(item), hidden: item.hidden }"
      @click="onItemClick($event, item)"
      @contextmenu.prevent="$emit('contextmenu', { event: $event, item })"
      @dblclick="onDblClick(item)"
    >
      <div class="feed-thumb">
        <img
          v-if="item.thumbnail && imageStates[item.path] !== 'failed'"
          crossorigin="anonymous"
          loading="lazy"
          :src="item.thumbnail"
          :alt="item.name"
          class="feed-img"
          :style="{ opacity: imageStates[item.path] === 'loaded' ? 1 : 0 }"
          @load="imageStates[item.path] = 'loaded'"
          @error="imageStates[item.path] = 'failed'"
        />
        <div v-if="item.thumbnail && imageStates[item.path] === 'loading'" class="skeleton-placeholder" />
        <svg v-if="!item.thumbnail || imageStates[item.path] === 'failed'" class="fallback-icon" viewBox="0 0 24 24" fill="currentColor">
          <path :d="iconPath(item)" />
        </svg>
      </div>
      <div class="feed-meta">
        <div class="feed-name">{{ item.name }}</div>
        <div class="feed-details">
          <span v-if="item.size != null" class="feed-size">{{ formatBytes(item.size) }}</span>
          <span v-if="item.modified" class="feed-date">{{ formatDate(item.modified) }}</span>
        </div>
      </div>
      <div class="feed-checkbox" v-show="alwaysShowCheckboxes || isSelected(item)">
        <input type="checkbox" :checked="isSelected(item)" @click.stop="toggleSelect(item)" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant } from '@mdi/js'

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'rename'])

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

function formatBytes(bytes) {
  if (bytes == null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 ** 3) return (bytes / 1024 ** 2).toFixed(1) + ' MB'
  return (bytes / 1024 ** 3).toFixed(2) + ' GB'
}

function formatDate(ts) {
  if (!ts) return ''
  return new Date(ts * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
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
.feed-layout {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 8px;
  padding: 12px;
  height: 100%;
  overflow-y: auto;
  align-content: start;
  outline: none;
}
.feed-layout:focus { box-shadow: inset 0 0 0 1px var(--accent); }

.feed-item {
  position: relative;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: 8px;
  overflow: hidden;
  cursor: pointer;
  background: var(--surface);
  transition: border-color 0.1s, background 0.1s;

  &:hover { background: rgba(255,255,255,0.04); border-color: rgba(255,255,255,0.2); }
  &.selected { background: rgba(0,122,204,0.1); border-color: var(--accent); }
  &.focused { box-shadow: 0 0 0 2px var(--accent); }
  &.hidden { opacity: 0.45; }
}

.feed-thumb {
  width: 100%;
  aspect-ratio: 16/9;
  background: var(--surface-alt);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
}

.feed-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
  transition: opacity 0.2s;
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

.fallback-icon { width: 48px; height: 48px; color: #9e9e9e; }

.feed-meta {
  padding: 8px 10px 10px;
  min-width: 0;
}

.feed-name {
  font-size: 13px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-bottom: 4px;
}

.feed-details {
  display: flex;
  gap: 8px;
  font-size: 11px;
  color: var(--text-muted);
}

.feed-checkbox {
  position: absolute;
  top: 6px;
  left: 6px;
}
.feed-checkbox input { width: 14px; height: 14px; cursor: pointer; }
</style>
