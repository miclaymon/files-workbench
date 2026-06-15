<template>
  <div class="explorer-panel">
    <div v-if="loading" class="state-message">Loading…</div>
    <div v-else-if="error" class="state-message error">
      <div>{{ error }}</div>
      <button @click="loadRootItems">Retry</button>
    </div>
    <ExplorerTree
      v-else-if="isTreeView"
      :items="items"
      :selectedPath="selectedPath"
      :selectedPaths="selectedPaths"
      :showCheckboxes="showCheckboxes"
      :clipboardData="clipboardData"
      :excludedCategories="excludedCategories"
      :indentScale="indentScale"
      :explorerState="explorerState"
      @select="$emit('select', $event)"
      @open="$emit('dblclick', $event)"
      @contextmenu="$emit('contextmenu', $event)"
      @toggleSelect="$emit('toggleSelect', $event)"
      @selectAll="$emit('selectAll', $event)"
      @paste="$emit('paste', $event)"
      @rename="$emit('rename', $event)"
      @move="$emit('move', $event)"
      @state-change="$emit('state-change', $event)"
    />
    <div v-else class="state-message">Flat list view not yet implemented.</div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import ExplorerTree from './ExplorerTree.vue'
import { explorerRoot, explorerHome, explorerDrives } from '~/lib/explorer-api.js'

const props = defineProps({
  selectedPath:       { type: String,  default: '' },
  selectedPaths:      { type: Set,     default: () => new Set() },
  showIcons:          { type: Boolean, default: true },
  showHiddenFiles:    { type: Boolean, default: false },
  showCheckboxes:     { type: Boolean, default: false },
  isTreeView:         { type: Boolean, default: true },
  clipboardData:      { type: Object,  default: null },
  excludedCategories: { type: Array,   default: () => ['System'] },
  indentScale:        { type: Number,  default: 1.0 },
  explorerState:      { type: Object,  default: null },
})

const emit = defineEmits(['select', 'dblclick', 'contextmenu', 'toggleSelect', 'selectAll', 'paste', 'rename', 'move', 'state-change'])

const loading   = ref(false)
const error     = ref('')
const rootItems = ref([])

const items = computed(() => rootItems.value)

const platform = (typeof window !== 'undefined' && window.electron?.platform) ?? 'linux'

async function loadRootItems() {
  try {
    loading.value = true
    error.value   = ''

    const showHidden       = props.showHiddenFiles ?? false
    const excludeCategories = (props.excludedCategories ?? ['System']).join(',')

    const tasks = [
      platform !== 'win32'
        ? explorerRoot({ showHidden, excludeCategories, includeMetadata: false })
        : Promise.reject(new Error('not applicable')),
      explorerHome({ showHidden, excludeCategories, includeMetadata: false }),
      explorerDrives({ showHidden, excludeCategories }),
    ]

    const [rootResult, homeResult, drivesResult] = await Promise.allSettled(tasks)

    const roots = []
    if (platform !== 'win32' && rootResult.status === 'fulfilled' && rootResult.value?.root) {
      roots.push({ ...rootResult.value.root, _preloadedItems: rootResult.value.items ?? [] })
    }
    if (homeResult.status === 'fulfilled' && homeResult.value?.root) {
      roots.push({ ...homeResult.value.root, _preloadedItems: homeResult.value.items ?? [] })
    }
    if (drivesResult.status === 'fulfilled' && drivesResult.value?.root && drivesResult.value.items?.length > 0) {
      roots.push({ ...drivesResult.value.root, _preloadedItems: drivesResult.value.items })
    }

    rootItems.value = roots
  } catch (err) {
    error.value = String(err?.message ?? 'Failed to load')
  } finally {
    loading.value = false
  }
}

onMounted(loadRootItems)
defineExpose({ refresh: loadRootItems })
</script>

<style scoped>
.explorer-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  height: 100%;
}

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
