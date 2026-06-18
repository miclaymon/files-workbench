<template>
  <div v-show="visible" class="resize-handle resize-handle--col" @mousedown="onResize" />
  <div v-show="visible" ref="paneRef" class="rightpane" :style="{ width: width + 'px' }">
    <ViewContainer
      containerId="secondarySidebar"
      :views="views"
      :modelValue="modelValue"
      :mergedSlots="mergedSlots"
      :viewSections="viewSections"
      :dropDirection="dropDirection"
      @update:modelValue="$emit('update:modelValue', $event)"
      @update:mergedSlots="$emit('update:mergedSlots', $event)"
      @update:viewSections="$emit('update:viewSections', $event)"
      @transfer="$emit('transfer', $event)"
      @merge="$emit('merge', $event)"
      @unmerge="$emit('unmerge', $event)"
      @section-move="$emit('section-move', $event)"
      @section-to-tab="$emit('section-to-tab', $event)"
      @view-reabsorb="$emit('view-reabsorb', $event)"
    >
      <template #panel-actions>
        <button class="panel-action-btn" :title="maximized ? 'Restore Secondary Side Bar' : 'Maximize Secondary Side Bar'" @click="$emit('toggle-maximize')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="maximized ? mdiArrowCollapse : mdiArrowExpand" /></svg>
        </button>
        <button class="panel-action-btn" title="Hide Secondary Side Bar" @click="$emit('update:visible', false)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
        </button>
      </template>
    </ViewContainer>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { mdiClose, mdiArrowExpand, mdiArrowCollapse } from '@mdi/js'
import ViewContainer from '../layout/ViewContainer.vue'
import { useSideBar } from '../../composables/interaction/useSideBar.js'

// The secondary side bar (right). A movable, droppable panel: views can merge,
// transfer in/out, and adopt sections. Split direction adapts to the pane shape
// via useSideBar (tall → 'col'). Cross-container coordination stays in
// Workbench; this forwards ViewContainer events and owns its pane chrome,
// left-edge resize, and maximize/hide actions.
const props = defineProps({
  visible:      { type: Boolean, default: true },
  width:        { type: Number,  default: 300 },
  views:        { type: Array,   default: () => [] },
  modelValue:   { type: String,  default: '' },
  mergedSlots:  { type: Object,  default: () => ({}) },
  viewSections: { type: Object,  default: () => ({}) },
  maximized:    { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:width', 'update:visible', 'update:modelValue', 'update:mergedSlots',
  'update:viewSections', 'transfer', 'merge', 'unmerge', 'section-move', 'section-to-tab', 'view-reabsorb', 'toggle-maximize',
])

const paneRef = ref(null)
const { dropDirection, startResize } = useSideBar(paneRef, { initialOrientation: 'col' })

// Handle sits on the pane's left edge: dragging left widens it (sign -1).
function onResize(event) {
  startResize(event, { axis: 'x', sign: -1, min: 200, current: props.width, onUpdate: v => emit('update:width', v) })
}
</script>

<style scoped>
.rightpane {
  flex-shrink: 0;
  min-width: 200px;
  border-left: 1px solid var(--border);
  background: var(--panel-2);
  overflow: hidden;
}

.panel-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  background: transparent;
  border: none;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.55;
}
.panel-action-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

.resize-handle { flex-shrink: 0; background: transparent; transition: background 0.15s; z-index: 10; --resize-handle-size: 2px; }
.resize-handle:hover, .resize-handle:active { background: var(--accent); opacity: 0.4; }
.resize-handle--col { width: var(--resize-handle-size); cursor: col-resize; }
</style>
