<template>
  <div
    ref="areaRef"
    class="split-section-area"
    :class="direction === 'row' ? 'ssa--row' : 'ssa--col'"
    @dragover="onAreaDragOver"
    @dragleave="onAreaDragLeave"
    @drop="onAreaDrop"
  >
    <template v-for="(section, i) in sections" :key="section.instanceId ?? section.id">
      <div v-if="dropBeforeIdx === i" class="ssa-drop-indicator" />
      <Sash
        v-if="needsSash(sections, i)"
        :direction="direction === 'row' ? 'row' : 'column'"
        :active="activeSash === i"
        @resize-start="onSash(i, $event)"
      />
      <div class="ssa-wrap" :style="wrapStyle(section, direction)">
        <SplitSection
          :title="titleFor(section)"
          :collapsed="direction === 'row' ? false : section.collapsed"
          :showHeading="sectionHeadingShown(sections, section)"
          :draggable="isDraggable(section)"
          :hasDivider="i > 0 && !needsSash(sections, i)"
          :instanceId="section.instanceId"
          :sectionDataId="sectionDataId(section.id, section.homeViewId ?? viewId)"
          @toggle="onToggle(i, $event)"
          @header-drag-start="onSectionDragStart(section, $event)"
          @heading-contextmenu="onSectionContextMenu(section, $event)"
        >
          <template v-if="section.id !== viewId && getViewEntry(section.id)?.actions?.length" #actions>
            <ViewActions :actions="getViewEntry(section.id)?.actions ?? []" />
          </template>
          <ViewContentHost :id="section.id" />
        </SplitSection>
      </div>
    </template>
    <div v-if="dropBeforeIdx === sections.length" class="ssa-drop-indicator" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Sash from './Sash.vue'
import SplitSection from './SplitSection.vue'
import ViewContentHost from './ViewContentHost.vue'
import ViewActions from './ViewActions.vue'
import { useStackResize } from '../../../composables/interaction/useStackResize.js'
import { useViewDrag } from '../../../composables/interaction/useViewDrag.js'
import { getViewEntry, viewAcceptsSections, sectionHeadingShown, viewAllowsDuplicateSections, sectionDataId } from '../../../composables/useViewRegistry.js'

// Stacks the SplitSections of a single View. Section headings appear only when
// the View owns more than one section. Sections can be reordered within the area
// by dragging their headings.
const props = defineProps({
  sections:    { type: Array,  required: true },   // [{ id, homeViewId, collapsed, size, locked? }] (mutated in place)
  direction:   { type: String, default: 'col' },
  viewId:      { type: String, default: '' },      // the View that owns these sections
  containerId: { type: String, default: '' },
})
const emit = defineEmits(['commit', 'section-move', 'section-contextmenu'])

const areaRef = ref(null)
const { activeSash, prevExpandedIdx, needsSash, wrapStyle, startResize } = useStackResize()
const { activeSectionDrag, SECTION_DRAG_MIME } = useViewDrag()

// Display label: an "adopted" section (living under a View other than its home)
// is prefixed with its home View's name. Display-only — driven by homeViewId vs
// the View it currently sits under, so it reverts automatically if moved home.
function titleFor(section) {
  const base = getViewEntry(section.id)?.label ?? section.id
  if (section.homeViewId && section.homeViewId !== props.viewId) {
    const home = getViewEntry(section.homeViewId)?.label ?? section.homeViewId
    return `${home}: ${base}`
  }
  return base
}

// A section can be picked up whenever the View has more than one, except its own
// self-section (id === viewId), which is the View's native content. Locked
// (Places) and `dockable: false` sections ARE draggable so they can be
// reordered in place — they're only barred from *leaving* their biological
// parent, which is enforced on the drop side (see acceptsDrop).
function isDraggable(section) {
  return props.sections.length > 1 && section.id !== props.viewId
}

function onToggle(i, collapsed) {
  if (props.direction === 'row') return
  props.sections[i].collapsed = collapsed
  emit('commit')
}

function onSash(i, event) {
  startResize({
    containerEl: areaRef.value,
    items:       props.sections,
    direction:   props.direction,
    aIdx:        prevExpandedIdx(props.sections, i),
    bIdx:        i,
    event,
    onCommit:    () => emit('commit'),
  })
}

// Right-click a section heading → bubble identity + cursor up to the
// ViewContainer, which owns viewSections and renders the section context menu.
function onSectionContextMenu(section, event) {
  event.preventDefault()
  emit('section-contextmenu', {
    viewId:     props.viewId,
    sectionId:  section.id,
    instanceId: section.instanceId ?? section.id,
    locked:     !!section.locked,
    x: event.clientX,
    y: event.clientY,
  })
}

// ── Section reorder (within this area) ────────────────────────────────────────

const dropBeforeIdx = ref(-1)

function onSectionDragStart(section, event) {
  const payload = {
    sectionId:       section.id,
    fromViewId:      props.viewId,
    fromContainerId: props.containerId,
    homeViewId:      section.homeViewId ?? props.viewId,
    locked:          !!section.locked,
    dockable:        section.dockable !== false,
  }
  activeSectionDrag.value = payload
  event.dataTransfer.setData(SECTION_DRAG_MIME, JSON.stringify(payload))
  event.dataTransfer.effectAllowed = 'move'
}

// Same-area drags always reorder. A cross-area drag is rejected for sections
// that can't leave their biological parent (locked, e.g. Places, or
// `dockable: false`), and otherwise only accepted if this View opts in to
// docked sections (Preview/Chat refuse).
function acceptsDrop() {
  const d = activeSectionDrag.value
  if (!d) return false
  const sameArea = d.fromViewId === props.viewId && d.fromContainerId === props.containerId
  if (sameArea) return true
  if (d.locked || d.dockable === false) return false
  if (!viewAcceptsSections(props.viewId)) return false
  // Block a same-view duplicate: when this area's View is the section's biological
  // parent and already holds that section, refuse (unless the View opts into
  // duplicates) — shows the not-allowed cursor. The cross-view path is also
  // guarded authoritatively upstream in handleSectionMove.
  if (props.viewId === d.homeViewId
      && !viewAllowsDuplicateSections(props.viewId)
      && props.sections.some(s => s.id === d.sectionId)) return false
  return true
}

function onAreaDragOver(event) {
  if (!acceptsDrop()) return
  if (!event.dataTransfer.types.includes(SECTION_DRAG_MIME)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  const isRow = props.direction === 'row'
  const wraps = [...event.currentTarget.querySelectorAll(':scope > .ssa-wrap')]
  let insertIdx = wraps.length
  for (let i = 0; i < wraps.length; i++) {
    const rect = wraps[i].getBoundingClientRect()
    const mid  = isRow ? rect.left + rect.width / 2 : rect.top + rect.height / 2
    const pos  = isRow ? event.clientX : event.clientY
    if (pos < mid) { insertIdx = i; break }
  }
  dropBeforeIdx.value = insertIdx
}

function onAreaDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) dropBeforeIdx.value = -1
}

function onAreaDrop(event) {
  const raw = event.dataTransfer.getData(SECTION_DRAG_MIME)
  if (!raw) { dropBeforeIdx.value = -1; return }
  event.preventDefault()
  const toIndex = dropBeforeIdx.value < 0 ? props.sections.length : dropBeforeIdx.value
  try {
    const { sectionId, fromViewId, fromContainerId, homeViewId } = JSON.parse(raw)
    if (fromViewId === props.viewId && fromContainerId === props.containerId) {
      // Same area → reorder in place.
      const fromIdx = props.sections.findIndex(s => s.id === sectionId)
      let to = toIndex
      if (fromIdx >= 0) {
        if (to > fromIdx) to--
        if (to !== fromIdx) {
          const [moved] = props.sections.splice(fromIdx, 1)
          props.sections.splice(to, 0, moved)
          emit('commit')
        }
      }
    } else {
      // Different area → adopt the section here (its biological parent surfaces as
      // a SplitView; cross-container handled upstream).
      emit('section-move', {
        sectionId,
        fromViewId,
        fromContainerId,
        homeViewId,
        toViewId:      props.viewId,
        toContainerId: props.containerId,
        toIndex,
      })
    }
  } catch {}
  dropBeforeIdx.value = -1
  // A cross-area move can remove this area from the DOM before `dragend` fires;
  // clear the shared section-drag state so nothing lingers.
  activeSectionDrag.value = null
}
</script>

<style scoped>
.split-section-area {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}
.ssa--col { flex-direction: column; }
.ssa--row { flex-direction: row; }

.ssa-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

.ssa-drop-indicator {
  flex: 0 0 2px;
  align-self: stretch;
  background: var(--accent);
}
</style>
