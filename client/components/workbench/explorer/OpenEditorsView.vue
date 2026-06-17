<template>
  <div class="open-editors">
    <template v-for="(leaf, gi) in leaves" :key="leaf.id">
      <div v-if="leaves.length > 1" class="oe-group-header">Group {{ gi + 1 }}</div>
      <div
        v-for="tab in leaf.tabs"
        :key="tab.id"
        class="oe-item"
        :class="{
          'oe-item--active': tab.id === leaf.activeTabId && leaf.id === activeGroupId,
          'oe-item--peek':   tab.mode === 'peek',
        }"
        @click="controller.setActiveGroup(leaf.id); controller.activateTab(leaf.id, tab.id)"
      >
        <svg class="oe-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path :d="tabIcon(tab)" />
        </svg>
        <span class="oe-label">{{ tab.title }}</span>
        <button class="oe-close" title="Close" @click.stop="controller.closeTab(leaf.id, tab.id)">×</button>
      </div>
    </template>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { mdiFolder, mdiHome, mdiCog } from '@mdi/js'
import { collectLeaves } from '~/composables/useLayoutGrid.js'

const props = defineProps({
  editorRoot:    { type: Object, required: true },
  activeGroupId: { type: String, default: null },
})

const controller = inject('editorController')

const leaves = computed(() => collectLeaves(props.editorRoot))

function tabIcon(tab) {
  if (tab.kind === 'dir')         return mdiFolder
  if (tab.kind === 'preferences') return mdiCog
  return mdiHome
}
</script>

<style scoped>
.open-editors {
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  height: 100%;
}

.oe-group-header {
  padding: 2px 8px;
  font-size: 11px;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  user-select: none;
  flex-shrink: 0;
}

.oe-item {
  height: 22px;
  min-height: 22px;
  display: flex;
  align-items: center;
  padding: 0 4px 0 20px;
  gap: 5px;
  cursor: pointer;
  user-select: none;
  color: var(--text);
  font-size: 13px;
  flex-shrink: 0;
}
.oe-item:hover { background: var(--hover); }
.oe-item--active { color: var(--accent); }
.oe-item--peek .oe-label { font-style: italic; }

.oe-icon {
  flex-shrink: 0;
  color: var(--text-muted);
}
.oe-item--active .oe-icon { color: var(--accent); }

.oe-label {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.oe-close {
  opacity: 0;
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: none;
  cursor: pointer;
  color: var(--text-muted);
  font-size: 14px;
  line-height: 1;
  border-radius: 3px;
  padding: 0;
}
.oe-item:hover .oe-close,
.oe-item--active .oe-close { opacity: 1; }
.oe-close:hover {
  background: var(--hover);
  color: var(--text);
}
</style>
