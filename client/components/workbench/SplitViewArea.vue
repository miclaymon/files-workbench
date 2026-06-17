<template>
  <div ref="areaRef" class="split-view-area" :class="direction === 'row' ? 'sva--row' : 'sva--col'">
    <template v-for="(view, i) in views" :key="view.id">
      <Sash
        v-if="needsSash(views, i)"
        :direction="direction === 'row' ? 'row' : 'column'"
        :active="activeSash === i"
        @resize-start="onSash(i, $event)"
      />
      <div class="sva-wrap" :style="wrapStyle(view, direction)">
        <SplitView
          :view="view"
          :sections="sectionsFor(view.id)"
          :label="labelFor(view)"
          :icon="iconFor(view)"
          :showHeading="views.length > 1"
          :direction="direction"
          :containerId="containerId"
          @toggle="onToggle(i, $event)"
          @commit-sections="$emit('commit-sections')"
          @section-move="$emit('section-move', $event)"
          @heading-drag-start="onHeadingDragStart(view, $event)"
        />
      </div>
    </template>

    <ViewDropOverlay
      v-if="showOverlay"
      :direction="direction"
      @drop="$emit('content-drop', $event)"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Sash from './Sash.vue'
import SplitView from './SplitView.vue'
import ViewDropOverlay from './ViewDropOverlay.vue'
import { useStackResize } from '../../composables/useStackResize.js'
import { useViewDrag, DRAG_MIME } from '../../composables/useViewDrag.js'
import { getViewEntry } from '../../composables/useViewRegistry.js'

// Stacks the SplitViews of one tab slot (a "SplitViewArea"). View headings
// appear only when more than one View is merged into the slot. Dragging a
// SplitView heading back out extracts it (unmerge); the parent container's tab
// bar handles the drop.
const props = defineProps({
  views:        { type: Array,   required: true },   // [{ id, collapsed, size }] — the SplitViews (mutated in place)
  viewSections: { type: Object,  default: () => ({}) }, // { [viewId]: Section[] }
  direction:    { type: String,  default: 'col' },
  containerId:  { type: String,  default: '' },
  slotKey:      { type: String,  default: '' },      // the tab slot's primary id (for unmerge)
  showOverlay:  { type: Boolean, default: false },
})
const emit = defineEmits(['commit-views', 'commit-sections', 'section-move', 'content-drop'])

const areaRef = ref(null)
const { activeSash, prevExpandedIdx, needsSash, wrapStyle, startResize } = useStackResize()
const { activeDrag } = useViewDrag()

function labelFor(view) { return getViewEntry(view.id)?.label ?? view.id }
function iconFor(view)  { return getViewEntry(view.id)?.icon ?? '' }

// A View's sections, or a single implicit self-section (its own content, no heading).
function sectionsFor(viewId) {
  return props.viewSections[viewId] ?? [{ id: viewId, homeViewId: viewId, collapsed: false, size: 1 }]
}

function onToggle(i, collapsed) {
  if (props.direction === 'row') return
  props.views[i].collapsed = collapsed
  emit('commit-views')
}

function onSash(i, event) {
  startResize({
    containerEl: areaRef.value,
    items:       props.views,
    direction:   props.direction,
    aIdx:        prevExpandedIdx(props.views, i),
    bIdx:        i,
    event,
    onCommit:    () => emit('commit-views'),
  })
}

function onHeadingDragStart(view, event) {
  activeDrag.value = { viewId: view.id, fromContainerId: props.containerId }
  event.dataTransfer.setData(
    DRAG_MIME,
    JSON.stringify({ viewId: view.id, fromContainerId: props.containerId, fromMergedViewId: props.slotKey })
  )
  event.dataTransfer.effectAllowed = 'move'
}
</script>

<style scoped>
.split-view-area {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  position: relative;
  overflow: hidden;
}
.sva--col { flex-direction: column; }
.sva--row { flex-direction: row; }

.sva-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}
</style>
