<template>
  <div class="explorer-tree">
    <div v-if="showHeader" class="view-header">
      <button @click="onSelectAll">Select All</button>
      <button @click="onPaste" :disabled="!clipboardData">Paste</button>
    </div>
    <TreeList
      :items="treeItems"
      :selectedPaths="selectedPaths"
      :expanded="expanded"
      :showIcons="true"
      :indentScale="indentScale"
      @select="onSelect"
      @dblclick="onOpen"
      @toggleExpand="onToggleExpand"
      @rename="$emit('rename', $event)"
    />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import TreeList from './TreeList.vue'
import { explorerList } from '~/lib/explorer-api.js'

const STORAGE_KEY = 'workbench-explorer-tree'

function loadStoredState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

let _saveTimer = null
function scheduleSave(expandedSet, childrenMap) {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        expanded: [...expandedSet],
        childrenByPath: childrenMap,
      }))
    } catch {}
  }, 400)
}

const props = defineProps({
  items: { type: Array, required: true },
  selectedPaths: { type: Set, required: true },
  showCheckboxes: { type: Boolean, default: false },
  showHeader: { type: Boolean, default: false },
  clipboardData: { type: Object, default: null },
  excludedCategories: { type: Array, default: () => ['System'] },
  indentScale: { type: Number, default: 1.0 },
})

const emit = defineEmits(['select', 'open', 'selectAll', 'paste', 'rename'])

const stored = loadStoredState()
const expanded = ref(new Set(stored?.expanded ?? []))
const childrenByPath = ref(stored?.childrenByPath ?? {})

async function listDir(path) {
  try {
    const excludeCategories = (props.excludedCategories ?? ['System']).join(',')
    // includeMetadata=false skips stat() on every entry — much faster for large dirs
    const res = await explorerList({ root: path, excludeCategories, includeMetadata: false })
    return res.items ?? []
  } catch {
    return []
  }
}

function isExpandable(node) {
  return node.type === 'directory' || node.type === 'drive' || node.type === 'root'
}

function buildTreeNode(item, rootKey = null) {
  const effectiveRoot = rootKey ?? (item.path ?? item.name ?? 'root')
  const expandKey = `${effectiveRoot}::${item.path ?? item.name}`
  const node = { ...item, _expandKey: expandKey }
  if (isExpandable(node) && expanded.value.has(expandKey)) {
    node.children = (childrenByPath.value[node.path] ?? []).map(c => buildTreeNode(c, effectiveRoot))
  } else {
    node.children = []
  }
  return node
}

const treeItems = computed(() => (props.items || []).map(item => buildTreeNode(item)))

watch(() => props.items, (newItems) => {
  if (!newItems?.length) return
  const newCache = { ...childrenByPath.value }
  const newExpanded = new Set(expanded.value)
  for (const item of newItems) {
    if (item._preloadedItems) {
      newCache[item.path] = item._preloadedItems
      const effectiveRoot = item.path ?? item.name ?? 'root'
      newExpanded.add(`${effectiveRoot}::${item.path ?? item.name}`)
    }
  }
  childrenByPath.value = newCache
  expanded.value = newExpanded
}, { immediate: true })

function onSelect(item) { emit('select', item) }
function onOpen(item) { emit('open', item) }
function onSelectAll() { emit('selectAll', new Set(props.items.map(i => i.path))) }

async function onToggleExpand({ expandKey, path }) {
  const wasExpanded = expanded.value.has(expandKey)
  if (wasExpanded) {
    expanded.value.delete(expandKey)
  } else {
    expanded.value.add(expandKey)
    if (path && !childrenByPath.value[path]) {
      const childItems = await listDir(path)
      childrenByPath.value = { ...childrenByPath.value, [path]: childItems }
    }
  }
  expanded.value = new Set(expanded.value)
  scheduleSave(expanded.value, childrenByPath.value)
}

function onPaste() { emit('paste') }
</script>

<style scoped>
.explorer-tree { height: 100%; display: flex; flex-direction: column; }

/* Show all indent guides when hovering anywhere in the tree */
.explorer-tree:hover :deep(.ig) { background: rgba(255,255,255,0.1); }
/* Highlight the direct-parent guide on the hovered row */
.explorer-tree:hover :deep(.tree-item:hover .ig:last-of-type) { background: rgba(255,255,255,0.32); }

.view-header {
  display: flex;
  gap: 8px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
}

.view-header button {
  font-size: 12px;
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
}
.view-header button:hover { color: var(--text); background: var(--hover-background); }
</style>
