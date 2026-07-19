<template>
  <li class="tree-node" :class="{ 'tree-node--root': level === 0 }">
    <button
      class="tree-item"
      :class="{
        selected: isSelected,
        'tree-item--root': level === 0,
        'drag-over': isDragOverTarget,
        dragging: isDraggingThis,
      }"
      :style="{ paddingLeft: (6 + level * 16 * indentScale) + 'px' }"
      :title="node.customization?.comment || undefined"
      @mousedown="(e) => onMouseDown(e, node)"
      @mouseenter="onNodeMouseEnter(node)"
      @mouseleave="onNodeMouseLeave(node)"
      @click="onItemClick"
    >
      <i
        v-for="n in level"
        :key="n"
        class="ig"
        :style="{ left: (12 + (n - 1) * 16 * indentScale) + 'px' }"
      />

      <span
        v-if="node.type === 'directory' || node.type === 'drive' || node.type === 'root'"
        class="expand-icon"
        :class="{ expanded: isExpanded }"
        @click.stop.prevent="onToggle"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </span>
      <span v-else class="expand-spacer" />

      <span v-if="showIcons" class="folder-icon">
        <!-- 1. Explicit image path from .directory/desktop.ini -->
        <img v-if="customIconUrl && !customIconFailed" :src="customIconUrl" width="16" height="16" class="pack-icon" @error="customIconFailed = true" />
        <!-- 2. folder-color: inline SVG so currentColor picks up the tint (img cannot) -->
        <svg v-else-if="customIconColor" :width="16" :height="16" viewBox="0 0 24 24" fill="currentColor" :style="{ color: customIconColor }">
          <path :d="iconPath" />
        </svg>
        <!-- 3. Icon pack -->
        <ResolvedIcon v-else-if="packResult && !packIconFailed" :result="packResult" :size="16" icon-class="pack-icon" @fail="packIconFailed = true" />
        <!-- 4. MDI default -->
        <svg v-else :width="16" :height="16" viewBox="0 0 24 24" fill="currentColor">
          <path :d="iconPath" />
        </svg>
      </span>

      <span
        v-if="!isRenaming"
        class="item-name-label"
        :style="node.hidden ? { opacity: 0.5 } : {}"
        @click="onNameClick"
      >{{ displayName }}</span>
      <span
        v-else
        ref="nameEl"
        class="item-name-label"
        contenteditable="true"
        spellcheck="false"
        @keydown.enter.prevent.stop="commitRename"
        @keydown.escape.prevent.stop="cancelRename"
        @blur="commitRename"
        @click.stop
        @mousedown.stop
      />
    </button>

    <ul v-if="shouldShowChildren" class="tree-children">
      <TreeItem
        v-for="c in node.children"
        :key="c.key || c.path"
        :node="c"
        :level="level + 1"
        :selectedPaths="selectedPaths"
        :expanded="expanded"
        :showIcons="showIcons"
        :indentScale="indentScale"
        @select="$emit('select', $event)"
        @toggleExpand="$emit('toggleExpand', $event)"
        @dblclick="$emit('dblclick', $event)"
        @rename="$emit('rename', $event)"
      />
    </ul>
  </li>
</template>

<script setup>
import { computed, ref, nextTick, watch } from 'vue'
import { mdiFile, mdiFolder, mdiFolderOpen, mdiHarddisk, mdiLinkVariant } from '@mdi/js'
import { useClickDebounce } from '@workbench/vue'
import { useTreeDrag } from '@workbench/vue'
import { useIconRegistry } from '@workbench/framework'
import { resolveCustomIcon } from '~/composables/useCustomIcon.js'
import { ResolvedIcon } from '@workbench/vue'

const props = defineProps({
  node: { type: Object, required: true },
  level: { type: Number, required: true },
  selectedPaths: { type: Set, default: () => new Set() },
  expanded: { type: Object, default: () => ({}) },
  showIcons: { type: Boolean, default: true },
  indentScale: { type: Number, default: 1.0 },
})

const emit = defineEmits(['select', 'toggleExpand', 'dblclick', 'rename'])

const isSelected = computed(() =>
  props.selectedPaths?.has?.(props.node.path) ?? false
)

const isExpanded = computed(() =>
  props.expanded?.has?.(props.node._expandKey) ?? false
)

const shouldShowChildren = computed(() =>
  (props.node.children?.length ?? 0) > 0 && isExpanded.value
)

const iconPath = computed(() => {
  // A node may pin its own MDI icon (virtual roots: Root/Home/Drives) — used as the
  // icon when it has no custom or icon-pack image.
  if (props.node.mdiPath) return props.node.mdiPath
  switch (props.node.type) {
    case 'root':
    case 'drive': return mdiHarddisk
    case 'directory': return isExpanded.value ? mdiFolderOpen : mdiFolder
    case 'symlink':
    case 'shortcut': return mdiLinkVariant
    default: return mdiFile
  }
})

// Custom icon from .directory / desktop.ini (layer 1 — wins over the icon pack)
const customIconDescriptor = computed(() => resolveCustomIcon(props.node.customization?.icon))
const customIconUrl = computed(() => customIconDescriptor.value?.type === 'url' ? customIconDescriptor.value.url : null)
const customIconColor = computed(() => customIconDescriptor.value?.type === 'folder-color' ? customIconDescriptor.value.color : null)
const customIconFailed = ref(false)
watch(customIconDescriptor, () => { customIconFailed.value = false })

// Icon pack (layer 2) — the active icon theme resolves a descriptor for this node.
// Virtual roots (Root/Home/Drives) pin their own MDI icon and skip the pack.
const { resolveIcon } = useIconRegistry()
const packResult = computed(() => props.node.mdiPath ? null : resolveIcon({
  path: props.node.path,
  name: props.node.name,
  kind: props.node.type,
  isDir: props.node.type === 'directory' || props.node.type === 'drive' || props.node.type === 'root',
  expanded: isExpanded.value,
  hasCustomIcon: !!customIconDescriptor.value,
  activityName: 'explorer',
}))
const packIconFailed = ref(false)
watch(packResult, () => { packIconFailed.value = false })

const displayName = computed(() => props.node.customization?.name || props.node.name)

const { handleClick, cancel: cancelPendingClick } = useClickDebounce()
const { draggingNode, dragOverNode, wasDragging, onMouseDown, onNodeMouseEnter, onNodeMouseLeave } = useTreeDrag()

const isDragOverTarget = computed(() => dragOverNode.value?.path === props.node.path)
const isDraggingThis = computed(() => draggingNode.value?.path === props.node.path)

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
    nameEl.value.textContent = props.node.name
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
  if (newName && newName !== props.node.name) {
    emit('rename', { path: props.node.path, newName })
  }
}

function cancelRename() {
  if (!isRenaming.value) return
  isRenaming.value = false
}

function onItemClick() {
  if (isRenaming.value) return
  if (wasDragging.value) return
  handleClick(
    props.node.path,
    () => emit('select', { path: props.node.path, kind: props.node.type }),
    () => emit('dblclick', { path: props.node.path, kind: props.node.type }),
  )
}
function onToggle() { emit('toggleExpand', { expandKey: props.node._expandKey, path: props.node.path }) }
</script>

<style scoped>
.tree-node { list-style: none; padding: 0; margin: 0; }
.tree-node--root { margin-block-start: 12px; }
.tree-node--root:first-child { margin-block-start: 0; }

.tree-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  cursor: pointer;
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  border-radius: 4px;
  font-size: 13px;
  color: var(--text);
  user-select: none;
}

.item-name-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

span[contenteditable]:focus-within {
  outline-offset: 2px;
  outline-width: 0px;
  outline-color: transparent;
  background: rgba(255, 255, 255, 0.1);
  outline-style: auto;
  box-shadow: 0 0 3px 1px var(--accent);
  border-radius: 2px;
  user-select: text;
  white-space: nowrap;
  overflow: visible;
}
.tree-item:hover { background: rgba(255,255,255,0.05); }
.tree-item.selected { background: rgba(0,122,204,0.2); }
.tree-item.drag-over { background: rgba(0,122,204,0.25); outline: 1px solid var(--accent); outline-offset: -1px; }
.tree-item.dragging { opacity: 0.4; }

.ig {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 1px;
  background: transparent;
  pointer-events: none;
  transition: background 0.1s;
}

.tree-item--root {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  padding-top: 3px;
  padding-bottom: 3px;
}
.tree-item--root:hover { background: rgba(255,255,255,0.03); }

.expand-icon {
  display: inline-flex; align-items: center; justify-content: center;
  cursor: pointer; opacity: 0.6; flex-shrink: 0; width: 16px;
  transform: rotate(0deg); transition: transform 0.15s ease, opacity 0.15s;
}
.expand-icon.expanded { transform: rotate(90deg); }
.expand-icon:hover { opacity: 1; }
.expand-spacer { width: 16px; flex-shrink: 0; }

.folder-icon { display: inline-flex; align-items: center; color: #9e9e9e; flex-shrink: 0; }
.pack-icon { display: block; object-fit: contain; }

.tree-children { list-style: none; margin: 0; padding: 0; }
</style>
