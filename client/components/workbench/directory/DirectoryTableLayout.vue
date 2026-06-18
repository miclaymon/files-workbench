<template>
  <div class="table-layout">
    <table class="file-table">
      <thead>
        <tr>
          <th class="checkbox-col"></th>
          <th class="name-col">Name</th>
          <th class="size-col">Size</th>
          <th class="date-col">Modified</th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="item in items"
          :key="item.path"
          class="table-row"
          :class="{ selected: isSelected(item), focused: isFocused(item), dragging: draggingPath === item.path, hidden: item.hidden }"
          @mousedown="(e) => onMouseDown(e, item)"
          @click="(e) => onItemClick(e, item)"
          @mouseenter="hoverFocus = item"
          @mouseleave="hoverFocus = null"
        >
          <td class="checkbox-col">
            <div class="item-checkbox" v-show="showCheckbox(item)">
              <input type="checkbox" :checked="isSelected(item)" @click.stop="onCheckboxClick($event, item)" @change="onCheckboxChange($event, item)" />
            </div>
          </td>

          <td class="name-col">
            <div class="name-cell">
              <img v-if="item.thumbnail && !failedThumbnails.has(item.path)" crossorigin="anonymous" :src="item.thumbnail" :alt="item.name" class="thumbnail" loading="lazy" @error="onThumbnailError(item)" />
              <svg v-else class="fallback-icon" :width="14" :height="14" viewBox="0 0 24 24" fill="currentColor">
                <path :d="defaultIcon(item)" />
              </svg>
              <span class="item-name">{{ item.name }}</span>
            </div>
          </td>

          <td class="size-col">
            <span>{{ item.kind === 'file' ? formatBytes(item.size) : '—' }}</span>
          </td>

          <td class="date-col">
            <span v-if="item.modified">{{ formatDate(item.modified) }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant } from '@mdi/js'
import { useClickDebounce } from '~/composables/interaction/useClickDebounce.js'
import { useDrag } from '~/composables/interaction/useDrag.js'

const props = defineProps({
  items: { type: Array, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false }
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate'])

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
.table-layout { height: 100%; overflow: auto; padding: 8px; }

.file-table { width: 100%; border-collapse: collapse; font-size: 13px; }

.file-table th {
  background: var(--surface-alt);
  padding: 8px 12px;
  text-align: left;
  font-weight: 600;
  color: var(--text-muted);
  border-bottom: 2px solid var(--border);
  position: sticky;
  top: 0;
  z-index: 10;
}

.checkbox-col { width: 40px; }
.size-col { width: 100px; text-align: right; }
.date-col { width: 150px; }

.file-table td { padding: 6px 12px; border-bottom: 1px solid var(--border); cursor: pointer; }

.table-row:hover { background: rgba(255,255,255,0.05); }
.table-row.selected { background: rgba(0,122,204,0.1); }
.table-row.focused { box-shadow: inset 0 0 0 1px var(--accent); }
.table-row.hidden { opacity: 0.45; }

.item-checkbox { opacity: 0; transition: opacity 0.2s; }
.table-row:hover .item-checkbox, .table-row.selected .item-checkbox { opacity: 1; }
.item-checkbox input { width: 14px; height: 14px; cursor: pointer; }

.name-cell { display: flex; align-items: center; gap: 8px; }

.thumbnail { width: 16px; height: 16px; object-fit: cover; border-radius: 2px; user-select: none; -webkit-user-drag: none; }
.table-row.dragging { opacity: 0.4; }
.fallback-icon { color: #9e9e9e; flex-shrink: 0; }
.item-name { font-weight: 500; }
</style>
