<template>
  <div v-show="visible" class="resize-handle resize-handle--row" @mousedown="onResize" />
  <div v-show="visible" ref="paneRef" class="bottompane" :style="{ height: height + 'px' }">
    <ViewContainer
      containerId="panel"
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
        <button class="panel-action-btn" :title="maximized ? 'Restore Panel' : 'Maximize Panel'" @click="$emit('toggle-maximize')">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="maximized ? mdiArrowCollapse : mdiArrowExpand" /></svg>
        </button>
        <button class="panel-action-btn" title="Hide Panel" @click="$emit('update:visible', false)">
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

// The bottom panel. Functionally the same movable/droppable container as the
// secondary side bar, differing only in placement: it resizes by height from a
// top edge and (being wide) stacks merged views as rows. Split direction is
// derived from the pane shape via useSideBar (wide → 'row').
const props = defineProps({
  visible:      { type: Boolean, default: true },
  height:       { type: Number,  default: 200 },
  views:        { type: Array,   default: () => [] },
  modelValue:   { type: String,  default: '' },
  mergedSlots:  { type: Object,  default: () => ({}) },
  viewSections: { type: Object,  default: () => ({}) },
  maximized:    { type: Boolean, default: false },
})
const emit = defineEmits([
  'update:height', 'update:visible', 'update:modelValue', 'update:mergedSlots',
  'update:viewSections', 'transfer', 'merge', 'unmerge', 'section-move', 'section-to-tab', 'view-reabsorb', 'toggle-maximize',
])

const paneRef = ref(null)
const { dropDirection, startResize } = useSideBar(paneRef, { initialOrientation: 'row' })

// Handle sits on the pane's top edge: dragging up grows it (sign -1).
function onResize(event) {
  startResize(event, { axis: 'y', sign: -1, min: 60, current: props.height, onUpdate: v => emit('update:height', v) })
}
</script>

<style scoped>
.bottompane {
  flex-shrink: 0;
  min-height: 60px;
  background: var(--panel);
  border-top: 1px solid var(--border);
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
.resize-handle--row { height: var(--resize-handle-size); cursor: row-resize; }
</style>
