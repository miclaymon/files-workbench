<template>
  <div v-if="visible" ref="paneRef" class="sidebar" :style="{ width: width + 'px' }">
    <ViewContainer
      v-if="activeView === 'explorer'"
      containerId="primarySidebar"
      :views="views"
      :modelValue="activeView"
      :viewSections="viewSections"
      :droppable="false"
      @update:modelValue="$emit('update:activeView', $event)"
      @update:viewSections="$emit('update:viewSections', $event)"
      @transfer="$emit('transfer', $event)"
      @section-move="$emit('section-move', $event)"
      @view-reabsorb="$emit('view-reabsorb', $event)"
    />
    <!-- view/section content is rendered via the registry (ViewContentHost) -->
    <div v-else-if="activeView === 'search'" class="sidebar-placeholder">
      Search panel coming soon…
    </div>
  </div>
  <div v-if="visible" class="resize-handle resize-handle--col" @mousedown="onResize" />
</template>

<script setup>
import { ref } from 'vue'
import ViewContainer from '../layout/ViewContainer.vue'
import { useSideBar } from '../../composables/interaction/useSideBar.js'

// The primary side bar (left). Unlike the movable panels it is non-droppable,
// never merges views, and switches its content by the active primary view
// (Explorer / Search). Logic stays in Workbench; this just owns the pane chrome
// + edge resize and forwards ViewContainer events.
const props = defineProps({
  visible:      { type: Boolean, default: true },
  width:        { type: Number,  default: 240 },
  views:        { type: Array,   default: () => [] },
  activeView:   { type: String,  default: 'explorer' },
  viewSections: { type: Object,  default: () => ({}) },
})
const emit = defineEmits(['update:width', 'update:activeView', 'update:viewSections', 'transfer', 'section-move', 'view-reabsorb'])

const paneRef = ref(null)
const { startResize } = useSideBar(paneRef)

// Handle sits on the pane's right edge: dragging right widens it (sign +1).
function onResize(event) {
  startResize(event, { axis: 'x', sign: 1, min: 150, current: props.width, onUpdate: v => emit('update:width', v) })
}
</script>

<style scoped>
.sidebar {
  flex-shrink: 0;
  min-width: 150px;
  background: var(--panel);
  border-right: 1px solid var(--border);
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.sidebar-placeholder { padding: 20px; color: var(--text-muted); font-size: 13px; }

.resize-handle { flex-shrink: 0; background: transparent; transition: background 0.15s; z-index: 10; --resize-handle-size: 2px; }
.resize-handle:hover, .resize-handle:active { background: var(--accent); opacity: 0.4; }
.resize-handle--col { width: var(--resize-handle-size); cursor: col-resize; }
</style>
