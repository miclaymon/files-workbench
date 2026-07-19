<template>
  <div class="explorer-panel">
    <div v-if="loading" class="state-message">Loading…</div>
    <div v-else-if="error" class="state-message error">
      <div>{{ error }}</div>
      <button @click="loadRoots">Retry</button>
    </div>
    <div v-else class="explorer-tree">
      <TreeList
        :items="nodes"
        :selectedPaths="highlightedPaths"
        :expanded="expanded"
        :showIcons="true"
        :indentScale="indentScale"
        @select="$emit('select', $event)"
        @dblclick="$emit('dblclick', $event)"
        @toggleExpand="toggleExpand"
        @rename="$emit('rename', $event)"
      />
    </div>
  </div>
</template>

<script setup>
// Explorer Places panel — composable-driven folder tree using useDirectoryFileTree.
// Loads virtual roots (Root/Home/Drives) then lazily fetches children on expand.
// Tree logic (lazy fetch, expand state, caching, soft-refresh) lives in the composable.
import { ref, computed, watch, onMounted, onActivated } from 'vue'
import TreeList from './TreeList.vue'
import { explorerList } from '@files-workbench/core'
import { loadExplorerRoots } from '@files-workbench/core'
import { useDirectoryFileTree } from '~/composables/useDirectoryFileTree.js'
import { useTreeDrag } from '@workbench/vue'

const props = defineProps({
  selectedPath:       { type: String,  default: '' },
  showFiles:          { type: Boolean, default: false },
  showCheckboxes:     { type: Boolean, default: false },
  excludedCategories: { type: Array,   default: () => ['System'] },
  indentScale:        { type: Number,  default: 1.0 },
  explorerState:      { type: Object,  default: null },
})
const emit = defineEmits(['select', 'dblclick', 'contextmenu', 'rename', 'move', 'state-change'])

const loading   = ref(false)
const error     = ref('')
const rootItems = ref([])
const highlightedPaths = computed(() => (props.selectedPath ? new Set([props.selectedPath]) : new Set()))

// Hidden-item visibility is the Places tree's OWN state — persisted to the
// workspace alongside the expanded paths (not the global `showHiddenFiles` pref,
// which still governs the directory editor views) and defaulting to hidden.
// Restored from the persisted explorer state on mount.
const showHidden = ref(props.explorerState?.showHidden ?? false)

// Lazy children fetch — applies the tree's own hidden / show-files flags through
// the whole tree.
function loadChildren(path) {
  return explorerList({
    root: path,
    excludeCategories: (props.excludedCategories ?? ['System']).join(','),
    showFiles:  props.showFiles ?? false,
    showHidden: showHidden.value,
    includeMetadata: false,
  }).then(r => r.items ?? []).catch(() => [])
}

const { nodes, expanded, toggleExpand, reloadDir, reloadAll, expandRoots, collapseAll, softRefreshAll, state } =
  useDirectoryFileTree({
    items: rootItems,
    mode: 'tree',
    loadChildren,
    lazyDepth: 1,
    initialState: props.explorerState,
  })

// The Explorer is kept alive by the primary sidebar (its tree/expand state survives
// Activity Bar switches). On re-reveal, background diff-refresh the visible tree so it
// reflects filesystem changes without a rebuild. Skip the first activation — it
// coincides with the onMounted load.
let _activatedOnce = false
onActivated(() => {
  if (!_activatedOnce) { _activatedOnce = true; return }
  softRefreshAll()
})

// Persist expand/cache state AND the hidden-visibility flag up to the workspace.
watch([state, showHidden], () => emit('state-change', { ...state.value, showHidden: showHidden.value }))

// Re-list all cached directories when a visibility flag changes. Roots themselves
// don't change; only their children do, which reloadAll refreshes.
watch(() => props.showFiles, () => reloadAll())
watch(showHidden, () => reloadAll())

// Drag-move support: a node dropped on a directory bubbles up as a move.
useTreeDrag({ onDrop: ({ dragged, target }) => emit('move', { items: [dragged], destPath: target.path }) })

async function loadRoots() {
  try {
    loading.value = true; error.value = ''
    rootItems.value = await loadExplorerRoots({
      showHidden: showHidden.value,
      showFiles:  props.showFiles ?? false,
      excludeCategories: (props.excludedCategories ?? ['System']).join(','),
    })
  } catch (e) {
    error.value = String(e?.message ?? 'Failed to load')
  } finally {
    loading.value = false
  }
}

onMounted(loadRoots)
defineExpose({
  refresh: loadRoots, reloadDir, reloadAll, collapseAll, expandRoots,
  toggleHidden: () => { showHidden.value = !showHidden.value },
})
</script>

<style scoped>
/* Explorer Places panel layout. */
.explorer-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  height: 100%;
}
.explorer-tree { height: 100%; display: flex; flex-direction: column; }
.explorer-tree :deep(.tree) { padding-block-end: 1rem; }
.explorer-tree:hover :deep(.ig) { background: rgba(255,255,255,0.1); }
.explorer-tree:hover :deep(.tree-item:hover .ig:last-of-type) { background: rgba(255,255,255,0.32); }

.state-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 20px;
  color: var(--text-muted);
  font-size: 13px;
  height: 100%;
  text-align: center;
  user-select: none;
}
.state-message.error { color: var(--danger, #f14c4c); }
.state-message button {
  border: 1px solid var(--border);
  padding: 6px 12px;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 12px;
  background: none;
  cursor: pointer;
}
.state-message button:hover { color: var(--text); background: var(--hover); }
</style>
