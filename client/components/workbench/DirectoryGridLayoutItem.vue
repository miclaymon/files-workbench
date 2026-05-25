<template>
  <div
    class="grid-item"
    :class="{ selected: isSelected, focused: isFocused, dragging: draggingPath === props.item.path, hidden: props.item.hidden }"
    @mousedown="(e) => onMouseDown(e, props.item)"
    @click="onItemClick"
    @mouseenter="hoverFocus = item"
    @mouseleave="hoverFocus = null"
  >
    <div class="item-checkbox" v-show="showCheckbox">
      <input
        type="checkbox"
        :checked="isSelected"
        @click.stop="onCheckboxClick"
        @change="onCheckboxChange"
      />
    </div>

    <div class="item-content">
      <div class="item-thumbnail" :style="{ height: iconSize }">
        <img
          v-if="imageSrc && imageState !== 'failed'"
          crossorigin="anonymous"
          loading="lazy"
          :src="imageSrc"
          :alt="item.name"
          class="custom-icon"
          :style="{ opacity: imageState === 'loading' ? 0 : 1 }"
          @load="imageState = 'loaded'; onThumbnailSettled?.()"
          @error="imageState = 'failed'; onThumbnailSettled?.()"
        />
        <div v-if="imageState === 'loading'" class="skeleton-placeholder" />
        <svg v-if="!imageSrc || imageState === 'failed'" class="fallback-icon" viewBox="0 0 24 24" fill="currentColor" :style="{ width: iconSize, height: iconSize, maxWidth: '80%', maxHeight: '80%' }">
          <path :d="iconPath" />
        </svg>
      </div>

      <div class="item-name" :class="{ renaming: isRenaming }">
        <span
          v-if="!isRenaming"
          class="item-name-text"
          @click="onNameClick"
        >{{ item.name }}</span>
        <span
          v-else
          ref="nameEl"
          class="item-name-text"
          contenteditable="true"
          spellcheck="false"
          @keydown.enter.prevent.stop="commitRename"
          @keydown.escape.prevent.stop="cancelRename"
          @blur="commitRename"
          @click.stop
          @mousedown.stop
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, inject, nextTick } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant } from '@mdi/js'
import { useClickDebounce } from '~/composables/useClickDebounce.js'
import { useDrag } from '~/composables/useDrag.js'

const onThumbnailSettled = inject('onThumbnailSettled', null)

const props = defineProps({
  item: { type: Object, required: true },
  selectedItems: { type: Array, required: true },
  focusedItem: { type: Object, default: null },
  alwaysShowCheckboxes: { type: Boolean, default: false },
  iconSize: { type: String, default: '64px' },
})

const emit = defineEmits(['select', 'focus', 'contextmenu', 'navigate', 'rename'])

const hoverFocus = ref(null)
const imageState = ref('')

const isSelected = computed(() => props.selectedItems.some(s => s.path === props.item.path))
const isFocused = computed(() => props.focusedItem?.path === props.item.path)
const showCheckbox = computed(() => props.alwaysShowCheckboxes || isSelected.value || hoverFocus.value?.path === props.item.path)

const imageSrc = computed(() => {
  if (props.item.thumbnail) return props.item.thumbnail
  if (props.item.icon) return props.item.icon.startsWith('data:') ? props.item.icon : null
  return null
})

const iconPath = computed(() => {
  switch (props.item.kind) {
    case 'dir': return mdiFolder
    case 'shortcut': return mdiLinkVariant
    default: return mdiFile
  }
})

watch(() => props.item, () => {
  imageState.value = imageSrc.value ? 'loading' : ''
}, { immediate: true, deep: true })

const isRenaming = ref(false)
const nameEl = ref(null)
let _nameClickTimer = null
let _nameClickCount = 0

function onNameClick(e) {
  _nameClickCount++
  if (_nameClickTimer) clearTimeout(_nameClickTimer)
  if (_nameClickCount >= 2) {
    _nameClickCount = 0
    _nameClickTimer = null
    e.stopPropagation()
    startRename()
  } else {
    _nameClickTimer = setTimeout(() => { _nameClickCount = 0; _nameClickTimer = null }, 230)
  }
}

function startRename() {
  cancelPendingClick()
  isRenaming.value = true
  nextTick(() => {
    if (!nameEl.value) return
    nameEl.value.textContent = props.item.name
    nameEl.value.focus()
    const range = document.createRange()
    range.selectNodeContents(nameEl.value)
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  })
}

function commitRename() {
  if (!isRenaming.value) return
  const newName = nameEl.value?.textContent?.trim() ?? ''
  isRenaming.value = false
  if (newName && newName !== props.item.name) {
    emit('rename', { path: props.item.path, newName })
  }
}

function cancelRename() {
  if (!isRenaming.value) return
  isRenaming.value = false
}

const { handleClick, cancel: cancelPendingClick } = useClickDebounce()
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

function onItemClick(e) {
  if (isRenaming.value) return
  if (wasDragging.value) return
  handleClick(
    props.item.path,
    () => {
      emit('focus', props.item)
      if (e.ctrlKey || e.metaKey) {
        emit('select', { item: props.item, mode: isSelected.value ? 'remove' : 'add' })
      } else if (e.shiftKey && props.selectedItems.length > 0) {
        emit('select', { item: props.item, mode: 'shift' })
      } else {
        emit('select', { item: props.item, mode: 'replace' })
      }
    },
    () => {
      emit('focus', props.item)
      if (props.item.kind === 'dir') {
        emit('navigate', props.item.path)
      } else if (props.item.kind === 'shortcut') {
        if (props.item.brokenLink) alert(`Broken link: ${props.item.target || 'Unknown'}`)
        else if (props.item.target) emit('navigate', props.item.target)
        else alert('Invalid shortcut: no destination path')
      } else {
        emit('select', { item: props.item, mode: 'open' })
      }
    },
    { e },
  )
}

function onCheckboxClick(event) {
  event.stopPropagation()
  emit('focus', props.item)
  emit('select', { item: props.item, mode: isSelected.value ? 'remove' : 'add' })
}

function onCheckboxChange(event) {
  emit('focus', props.item)
  emit('select', { item: props.item, mode: event.target.checked ? 'add' : 'remove' })
}
</script>

<style scoped>
.grid-item {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.15s;
  background: var(--surface);

  &:hover { background: rgba(255,255,255,0.05); border-color: var(--accent); }
  &.selected { background: rgba(0,122,204,0.1); border-color: var(--accent); }
  &.focused {
    box-shadow: 0 0 0 2px var(--accent);
    box-shadow: 0 0 3px 1px color-mix(in srgb, var(--accent) 75%, transparent)
  }
  &.hidden { opacity: 0.45; }
}

.item-checkbox { position: absolute; top: 4px; left: 4px; z-index: 10; }
.item-checkbox input { width: 14px; height: 14px; cursor: pointer; }

.item-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
  text-align: center;
}

.item-thumbnail {
  position: relative;
  max-width: 100%;
  height: 64px; /* overridden by inline :style binding */
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  overflow: hidden;
  background: var(--surface-alt);
}

.custom-icon { width: 100%; height: 100%; object-fit: cover; object-position: center; transition: opacity 0.2s; user-select: none; -webkit-user-drag: none; }
.grid-item.dragging { opacity: 0.4; }

.skeleton-placeholder {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, #333 25%, #444 50%, #333 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 2px;
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.fallback-icon { color: #9e9e9e; }

.item-name {
  font-size: 12px;
  word-break: break-word;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  padding-bottom: 2px;
  user-select: none;
  width: 100%;
}

.item-name-text { display: inline; }
.item-name.renaming { display: block; overflow: visible; }

span[contenteditable]:focus-within {
  outline-offset: 2px;
  outline-width: 0px;
  outline-color: transparent;
  background: rgba(255, 255, 255, 0.1);
  outline-style: auto;
  box-shadow: 0 0 3px 1px var(--accent);
  border-radius: 2px;
  user-select: text;
  white-space: normal;
  word-break: break-word;
  display: block;
  width: 100%;
}
</style>
