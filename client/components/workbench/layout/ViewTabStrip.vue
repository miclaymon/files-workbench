<template>
  <div
    class="vc-view-tab-bar"
    role="tablist"
    @dragover="onBarDragOver"
    @dragleave="onBarDragLeave"
    @drop="onBarDrop"
  >
    <template v-for="(view, i) in views" :key="view.id">
      <span v-if="dropBeforeIdx === i" class="vc-drop-indicator" />
      <button
        class="vc-view-tab"
        :class="{ active: modelValue === view.id, 'is-dragging': draggedId === view.id }"
        role="tab"
        :aria-selected="modelValue === view.id"
        :title="view.label"
        draggable="true"
        @click="$emit('select', view.id)"
        @contextmenu.prevent.stop="$emit('tab-contextmenu', { view, event: $event })"
        @dragstart="onTabDragStart(view, i, $event)"
        @dragend="onTabDragEnd"
      >
        <svg v-if="showTabIcons && view.icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="vc-view-tab-icon">
          <path :d="view.icon" />
        </svg>
        <span class="vc-view-tab-label">{{ view.label }}</span>
      </button>
    </template>
    <span v-if="dropBeforeIdx === views.length" class="vc-drop-indicator" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useViewDrag, DRAG_MIME, SECTION_DRAG_MIME } from '../../../composables/interaction/useViewDrag.js'

// The sidebar/panel view tab strip. Presentational: owns its own reorder /
// cross-container drag-and-drop visuals and emits semantic events upward. The
// host ViewContainer turns those into transfer/unmerge/section-to-tab moves.
// Distinct from the editor's tab strip (peek/pin/preview) — kept separate by design.
const props = defineProps({
  views:        { type: Array,   required: true },   // [{ id, icon, label }]
  modelValue:   { type: String,  required: true },   // active tab id
  containerId:  { type: String,  default: '' },      // for cross-container drag
  droppable:    { type: Boolean, default: true },    // false for the primary sidebar
  showTabIcons: { type: Boolean, default: true },
})
const emit = defineEmits(['select', 'tab-contextmenu', 'transfer', 'unmerge', 'section-to-tab'])

const { activeDrag, activeSectionDrag } = useViewDrag()

const draggedId     = ref(null)
const dropBeforeIdx = ref(-1)

function onTabDragStart(view, index, event) {
  draggedId.value = view.id
  activeDrag.value = { viewId: view.id, fromContainerId: props.containerId }
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ viewId: view.id, fromContainerId: props.containerId }))
  event.dataTransfer.effectAllowed = 'move'
}

// Reset all drag state. `dragend` normally clears the module-level refs, but a
// drop that removes the dragged element (merge / re-absorb / transfer) can stop
// `dragend` from firing, so drop handlers call this explicitly — otherwise a
// stale activeDrag keeps the drop overlay mounted and blocks interaction.
function reset() {
  draggedId.value         = null
  dropBeforeIdx.value     = -1
  activeDrag.value        = null
  activeSectionDrag.value = null
}

function onTabDragEnd() {
  reset()
}

// A section can be dropped on the tab strip to spawn its biological parent as a
// new tab — but only where dropping is allowed and the section may leave its home.
function _sectionDroppableOnBar() {
  const d = activeSectionDrag.value
  return props.droppable && !!d && !d.locked && d.dockable !== false
}

function onBarDragOver(event) {
  const types = event.dataTransfer.types
  const accepts = types.includes(DRAG_MIME) || (types.includes(SECTION_DRAG_MIME) && _sectionDroppableOnBar())
  if (!accepts) return   // no preventDefault — drop event won't fire; browser shows not-allowed cursor
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  const tabs = [...event.currentTarget.querySelectorAll('.vc-view-tab')]
  let insertIdx = tabs.length
  for (let i = 0; i < tabs.length; i++) {
    const rect = tabs[i].getBoundingClientRect()
    if (event.clientX < rect.left + rect.width / 2) { insertIdx = i; break }
  }
  dropBeforeIdx.value = insertIdx
}

function onBarDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) dropBeforeIdx.value = -1
}

function onBarDrop(event) {
  // Section dropped on the tab strip → spawn its biological parent as a new tab.
  const secRaw = props.droppable ? event.dataTransfer.getData(SECTION_DRAG_MIME) : ''
  if (secRaw) {
    event.preventDefault()
    try {
      const p = JSON.parse(secRaw)
      if (!p.locked && p.dockable !== false) {
        const toIndex = dropBeforeIdx.value < 0 ? props.views.length : dropBeforeIdx.value
        emit('section-to-tab', {
          sectionId:       p.sectionId,
          fromViewId:      p.fromViewId,
          fromContainerId: p.fromContainerId,
          homeViewId:      p.homeViewId,
          toContainerId:   props.containerId,
          toIndex,
        })
      }
    } catch {}
    reset()
    return
  }

  const raw = event.dataTransfer.getData(DRAG_MIME)
  if (!raw) return
  event.preventDefault()
  try {
    const { viewId, fromContainerId, fromMergedViewId } = JSON.parse(raw)
    const toIndex = dropBeforeIdx.value < 0 ? props.views.length : dropBeforeIdx.value

    if (fromMergedViewId) {
      // SplitView heading dragged back to the tab bar → extract from merge group
      emit('unmerge', {
        fromViewId:    fromMergedViewId,
        fromContainerId,
        extractViewId: viewId,
        toContainerId: props.containerId,
        toIndex,
      })
    } else {
      // Normal tab reorder / cross-container transfer
      if (fromContainerId === props.containerId) {
        const fromIdx = props.views.findIndex(v => v.id === viewId)
        if (fromIdx < 0) return
        if (toIndex === fromIdx || toIndex === fromIdx + 1) return
      }
      emit('transfer', { fromContainerId, toContainerId: props.containerId, viewId, toIndex })
    }
  } catch {}
  reset()
}

defineExpose({ reset })
</script>

<style scoped>
.vc-view-tab-bar {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding-inline: 8px;
  gap: 8px;
}

.vc-view-tab {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text);
  opacity: 0.45;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.025ch;
  white-space: nowrap;
  flex-shrink: 0;
  user-select: none;
  transition: opacity 0.12s, border-color 0.12s;
  height: 100%;
}
.vc-view-tab:hover  { opacity: 0.8; }
.vc-view-tab.active { opacity: 1; border-bottom-color: var(--accent); }
.vc-view-tab.is-dragging { opacity: 0.25; }

.vc-view-tab-icon { flex-shrink: 0; }

.vc-drop-indicator {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--accent);
  border-radius: 1px;
  flex-shrink: 0;
  align-self: center;
}
</style>
