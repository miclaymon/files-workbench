<template>
  <div class="view-container">

    <!-- Header: activity tab strip + action slots + ellipsis menu -->
    <div class="vc-header">
      <div
        class="vc-activity-bar"
        role="tablist"
        @dragover.prevent="onBarDragOver"
        @dragleave="onBarDragLeave"
        @drop="onBarDrop"
      >
        <template v-for="(activity, i) in activities" :key="activity.id">
          <span v-if="dropBeforeIdx === i" class="vc-drop-indicator" />
          <button
            class="vc-activity-tab"
            :class="{ active: modelValue === activity.id, 'is-dragging': draggedId === activity.id }"
            role="tab"
            :aria-selected="modelValue === activity.id"
            :title="activity.label"
            draggable="true"
            @click="onActivityTabClick(activity)"
            @dragstart="onTabDragStart(activity, i, $event)"
            @dragend="onTabDragEnd"
          >
            <svg v-if="activity.icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="vc-activity-icon">
              <path :d="activity.icon" />
            </svg>
            <span class="vc-activity-label">{{ activity.label }}</span>
          </button>
        </template>
        <span v-if="dropBeforeIdx === activities.length" class="vc-drop-indicator" />
      </div>

      <!-- Per-activity action buttons (e.g. "Clear" for debug) -->
      <div v-if="$slots[`${modelValue}-actions`]" class="vc-header-actions">
        <slot :name="`${modelValue}-actions`" />
      </div>

      <!-- Panel-level action buttons (always visible, right-most group) -->
      <div v-if="$slots['panel-actions']" class="vc-panel-actions">
        <slot name="panel-actions" />
      </div>

      <button v-if="allMenuItems.length > 0" ref="menuBtnRef" class="vc-menu-btn" title="More actions…" @click.stop="openMenu">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path :d="mdiDotsHorizontal" />
        </svg>
      </button>
    </div>

    <!-- Body: sections mode (accordion with sash resize, used for primary sidebar) -->
    <div v-if="isSectionsMode" ref="sectionsRef" class="vc-sections">
      <template v-for="(section, i) in sections" :key="section.id">
        <Sash
          v-if="needsSash(i)"
          direction="column"
          :active="activeSash === i"
          @resize-start="onSashDown(prevExpandedIdx(i), i, $event)"
        />
        <div class="vc-section-wrap" :style="wrapStyle(i)">
          <ViewSection
            :title="section.title"
            :modelValue="section.collapsed"
            @update:modelValue="setCollapsed(i, $event)"
          >
            <slot :name="section.id" />
          </ViewSection>
        </div>
      </template>
    </div>

    <!-- Body: tabs mode (one activity visible at a time) -->
    <div v-else class="vc-tabs-body">
      <div
        v-for="activity in activities"
        :key="activity.id"
        v-show="modelValue === activity.id"
        class="vc-tab-content"
      >
        <!-- Merged sections: multiple views stacked inside this tab slot -->
        <template v-if="mergedSlots[activity.id]?.length">
          <div
            :ref="el => { if (el) _subSectionsEls[activity.id] = el; else delete _subSectionsEls[activity.id] }"
            class="vc-sections"
            :class="dropDirection === 'row' ? 'vc-sections--row' : 'vc-sections--col'"
          >
            <template v-for="(sv, j) in mergedSlots[activity.id]" :key="sv.id">
              <Sash
                v-if="subNeedsSash(mergedSlots[activity.id], j)"
                :direction="dropDirection === 'row' ? 'row' : 'column'"
                :active="activeSubSash === `${activity.id}-${j}`"
                @resize-start="onSubSashDown(activity.id, subPrevExpandedIdx(mergedSlots[activity.id], j), j, $event)"
              />
              <div class="vc-section-wrap" :style="subWrapStyle(sv)">
                <ViewSection
                  :title="sv.title"
                  :modelValue="dropDirection === 'row' ? false : sv.collapsed"
                  :draggable="true"
                  @update:modelValue="dropDirection !== 'row' && setSubViewCollapsed(activity.id, j, $event)"
                  @header-drag-start="onSectionHeaderDragStart(activity.id, sv.id, $event)"
                >
                  <slot :name="sv.id" />
                </ViewSection>
              </div>
            </template>
          </div>
        </template>

        <!-- Single view: normal slot render -->
        <template v-else>
          <slot :name="activity.id" />
        </template>

        <!-- Drop overlay: shown when an activity drag is in progress that is
             not this tab's own id AND is not already a section in this slot -->
        <ViewDropOverlay
          v-if="_activeDrag
            && _activeDrag.activityId !== activity.id
            && !isMergedSection(activity.id, _activeDrag.activityId)"
          :direction="dropDirection"
          @drop="onContentDrop(activity.id, $event)"
        />
      </div>
    </div>

    <FloatingMenu
      :visible="menuOpen"
      type="menu"
      :items="allMenuItems"
      :x="menuPos.x"
      :y="menuPos.y"
      @close="menuOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { mdiDotsHorizontal } from '@mdi/js'
import Sash from './Sash.vue'
import ViewSection from './ViewSection.vue'
import ViewDropOverlay from './ViewDropOverlay.vue'
import FloatingMenu from './FloatingMenu.vue'

const HEADER_PX   = 22
const MIN_BODY_PX = 40

// ── Module-level global drag tracker ─────────────────────────────────────────
// Shared across all ViewContainer instances so the overlay knows when to appear
// even when the drag originates from a different container.
const _activeDrag = ref(null)  // { activityId, fromContainerId } | null
if (typeof document !== 'undefined') {
  document.addEventListener('dragend', () => { _activeDrag.value = null }, { capture: true })
}

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = defineProps({
  activities:     { type: Array,  required: true },         // [{ id, icon, label }]
  modelValue:     { type: String, required: true },         // active tab id
  containerId:    { type: String, default: '' },            // unique id for cross-container drag
  sections:       { type: Array,  default: null },          // null → tabs mode; array → sections/accordion mode
  mergedSlots:    { type: Object, default: () => ({}) },   // { [primaryId]: [{ id, title, collapsed, size }] }
  menuItems:      { type: Array,  default: () => [] },
  dropDirection:  { type: String, default: 'col' },        // 'col' = top/bottom split, 'row' = left/right split
})
const emit = defineEmits(['update:modelValue', 'update:sections', 'update:mergedSlots', 'transfer', 'merge', 'unmerge'])

const isSectionsMode = computed(() => Array.isArray(props.sections))

// ── Tab drag-to-reorder / cross-container drag ────────────────────────────────

const DRAG_MIME = 'application/wb-view-container-activity'

const draggedId     = ref(null)
const dropBeforeIdx = ref(-1)

function onTabDragStart(activity, index, event) {
  draggedId.value = activity.id
  _activeDrag.value = { activityId: activity.id, fromContainerId: props.containerId }
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ activityId: activity.id, fromContainerId: props.containerId }))
  event.dataTransfer.effectAllowed = 'move'
}

function onTabDragEnd() {
  draggedId.value     = null
  dropBeforeIdx.value = -1
  // _activeDrag cleared by global dragend listener
}

function onBarDragOver(event) {
  if (!event.dataTransfer.types.includes(DRAG_MIME)) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  const tabs = [...event.currentTarget.querySelectorAll('.vc-activity-tab')]
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
  const raw = event.dataTransfer.getData(DRAG_MIME)
  if (!raw) return
  event.preventDefault()
  try {
    const { activityId, fromContainerId, fromMergedActivityId } = JSON.parse(raw)
    const toIndex = dropBeforeIdx.value < 0 ? props.activities.length : dropBeforeIdx.value

    if (fromMergedActivityId) {
      // Section header dragged back to tab bar → extract from merge group
      emit('unmerge', {
        fromActivityId:  fromMergedActivityId,
        fromContainerId,
        extractId:       activityId,
        toContainerId:   props.containerId,
        toIndex,
      })
    } else {
      // Normal tab reorder / cross-container transfer
      if (fromContainerId === props.containerId) {
        const fromIdx = props.activities.findIndex(a => a.id === activityId)
        if (fromIdx < 0) return
        if (toIndex === fromIdx || toIndex === fromIdx + 1) return
      }
      emit('transfer', { fromContainerId, toContainerId: props.containerId, activityId, toIndex })
    }
  } catch {}
  draggedId.value     = null
  dropBeforeIdx.value = -1
}

// ── Content-area drop (merge into this tab slot as stacked section) ───────────

// True when sectionId is already a merged sub-section inside primaryId's slot.
// Used to prevent the drop overlay from blocking section-header drag-out.
function isMergedSection(primaryId, sectionId) {
  return props.mergedSlots[primaryId]?.some(sv => sv.id === sectionId) ?? false
}

function onContentDrop(targetActivityId, { zone }) {
  if (!_activeDrag.value) return
  const { activityId, fromContainerId } = _activeDrag.value
  if (activityId === targetActivityId && fromContainerId === props.containerId) return
  emit('merge', {
    toContainerId:  props.containerId,
    toActivityId:   targetActivityId,
    fromContainerId,
    activityId,
    zone,
  })
}

// ── Section / tab interaction ─────────────────────────────────────────────────

function onActivityTabClick(activity) {
  emit('update:modelValue', activity.id)
  // In sections mode: expand the clicked section if currently collapsed
  if (isSectionsMode.value) {
    const idx = props.sections.findIndex(s => s.id === activity.id)
    if (idx >= 0 && props.sections[idx].collapsed) {
      emit('update:sections', props.sections.map((s, i) => i === idx ? { ...s, collapsed: false } : s))
    }
  }
}

// ── Merged sub-section handling ───────────────────────────────────────────────

const _subSectionsEls = {}
const activeSubSash = ref(null)

function subPrevExpandedIdx(subViews, i) {
  for (let j = i - 1; j >= 0; j--) {
    if (!subViews[j].collapsed) return j
  }
  return -1
}

function subNeedsSash(subViews, i) {
  return !subViews[i].collapsed && subPrevExpandedIdx(subViews, i) >= 0
}

function subWrapStyle(sv) {
  if (props.dropDirection === 'row') {
    return { flex: `${sv.size} 1 0`, minWidth: '80px', overflow: 'hidden' }
  }
  if (sv.collapsed) return { flex: '0 0 22px', overflow: 'hidden' }
  return { flex: `${sv.size} 1 0`, minHeight: '60px', overflow: 'hidden' }
}

function setSubViewCollapsed(activityId, idx, collapsed) {
  const updated = props.mergedSlots[activityId].map((sv, j) =>
    j === idx ? { ...sv, collapsed } : sv
  )
  emit('update:mergedSlots', { ...props.mergedSlots, [activityId]: updated })
}

function onSectionHeaderDragStart(primaryActivityId, sectionId, event) {
  _activeDrag.value = { activityId: sectionId, fromContainerId: props.containerId }
  event.dataTransfer.setData(
    DRAG_MIME,
    JSON.stringify({ activityId: sectionId, fromContainerId: props.containerId, fromMergedActivityId: primaryActivityId })
  )
  event.dataTransfer.effectAllowed = 'move'
}

function onSubSashDown(activityId, a, b, mouseEvent) {
  const el = _subSectionsEls[activityId]
  if (!el) return
  const subViews = props.mergedSlots[activityId]
  if (!subViews) return
  const isRow = props.dropDirection === 'row'

  const totalPx         = isRow ? el.clientWidth : el.clientHeight
  const totalHeaderPx   = isRow ? 0 : subViews.length * HEADER_PX
  const availableBodyPx = totalPx - totalHeaderPx
  if (availableBodyPx <= 0) return

  const expandedViews = isRow ? subViews : subViews.filter(sv => !sv.collapsed)
  const totalWeight   = expandedViews.reduce((sum, sv) => sum + sv.size, 0)
  if (!totalWeight) return

  const pxPerWeight = availableBodyPx / totalWeight
  const minWeight   = MIN_BODY_PX / pxPerWeight
  const startPos    = isRow ? mouseEvent.clientX : mouseEvent.clientY
  const startA      = subViews[a].size
  const sum         = startA + subViews[b].size

  activeSubSash.value = `${activityId}-${b}`
  document.body.style.cursor     = isRow ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'

  const onMove = (e) => {
    const delta = ((isRow ? e.clientX : e.clientY) - startPos) / pxPerWeight
    const na = Math.max(minWeight, Math.min(sum - minWeight, startA + delta))
    subViews[a].size = na
    subViews[b].size = sum - na
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    activeSubSash.value = null
    emit('update:mergedSlots', { ...props.mergedSlots })
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
}

// ── Ellipsis menu ─────────────────────────────────────────────────────────────

const menuBtnRef = ref(null)
const menuOpen   = ref(false)
const menuPos    = ref({ x: 0, y: 0 })

const allMenuItems = computed(() => {
  const sectionItems = isSectionsMode.value
    ? props.sections.map(s => ({
        key:     s.id,
        label:   s.title,
        type:    'toggle',
        checked: () => !s.collapsed,
        action:  () => {
          const i = props.sections.findIndex(sec => sec.id === s.id)
          if (i >= 0) {
            emit('update:sections', props.sections.map((sec, j) =>
              j === i ? { ...sec, collapsed: !sec.collapsed } : sec
            ))
          }
        },
      }))
    : []
  return [...sectionItems, ...props.menuItems]
})

function openMenu() {
  const el = menuBtnRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  menuPos.value = { x: rect.left, y: rect.bottom + 2 }
  menuOpen.value = true
}

// ── Primary sections sash resize ──────────────────────────────────────────────

const sectionsRef = ref(null)
const activeSash  = ref(-1)

function prevExpandedIdx(i) {
  for (let j = i - 1; j >= 0; j--) {
    if (!props.sections[j].collapsed) return j
  }
  return -1
}

function needsSash(i) {
  return !props.sections[i].collapsed && prevExpandedIdx(i) >= 0
}

function wrapStyle(i) {
  const s = props.sections[i]
  if (s.collapsed) return { flex: '0 0 22px', overflow: 'hidden' }
  return { flex: `${s.size} 1 0`, minHeight: '60px', overflow: 'hidden' }
}

function setCollapsed(i, collapsed) {
  emit('update:sections', props.sections.map((s, j) => j === i ? { ...s, collapsed } : s))
  if (!collapsed) emit('update:modelValue', props.sections[i].id)
}

function onSashDown(a, b, mouseEvent) {
  const el = sectionsRef.value
  if (!el) return

  const totalPx         = el.clientHeight
  const totalHeaderPx   = props.sections.length * HEADER_PX
  const availableBodyPx = totalPx - totalHeaderPx
  if (availableBodyPx <= 0) return

  const expandedSections = props.sections.filter(s => !s.collapsed)
  const totalWeight      = expandedSections.reduce((sum, s) => sum + s.size, 0)
  if (!totalWeight) return

  const pxPerWeight = availableBodyPx / totalWeight
  const minWeight   = MIN_BODY_PX / pxPerWeight
  const startY      = mouseEvent.clientY
  const startA      = props.sections[a].size
  const sum         = startA + props.sections[b].size

  activeSash.value = b
  document.body.style.cursor     = 'row-resize'
  document.body.style.userSelect = 'none'

  const onMove = (e) => {
    const delta = (e.clientY - startY) / pxPerWeight
    const na = Math.max(minWeight, Math.min(sum - minWeight, startA + delta))
    props.sections[a].size = na
    props.sections[b].size = sum - na
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup',   onUp)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    activeSash.value = -1
    emit('update:sections', [...props.sections])
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup',   onUp)
}
</script>

<style scoped>
.view-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.vc-header {
  display: flex;
  align-items: stretch;
  height: 35px;
  flex-shrink: 0;
  border-bottom: 1px solid var(--border);
}

.vc-activity-bar {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  flex: 1;
  min-width: 0;
  overflow: hidden;
  padding-inline: 8px;
  gap: 8px;
}

.vc-activity-tab {
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
.vc-activity-tab:hover  { opacity: 0.8; }
.vc-activity-tab.active { opacity: 1; border-bottom-color: var(--accent); }
.vc-activity-tab.is-dragging { opacity: 0.25; }

.vc-activity-icon { flex-shrink: 0; }

.vc-drop-indicator {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--accent);
  border-radius: 1px;
  flex-shrink: 0;
  align-self: center;
}

.vc-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  flex-shrink: 0;
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.5;
  transition: opacity 0.12s, color 0.12s;
}
.vc-menu-btn:hover { opacity: 1; color: var(--text); }

/* ── Header action groups ────────────────────────────────────────────────── */
.vc-header-actions,
.vc-panel-actions {
  display: flex;
  align-items: center;
  padding-inline: 4px;
  gap: 2px;
  flex-shrink: 0;
}

.vc-header-actions + .vc-panel-actions {
  border-left: 1px solid var(--border);
  margin-left: 2px;
  padding-left: 6px;
}

/* ── Sections mode (primary sidebar accordion) ───────────────────────────── */
.vc-sections {
  flex: 1;
  min-height: 0;
  min-width: 0;
  display: flex;
  overflow: hidden;
}
.vc-sections--col { flex-direction: column; }
.vc-sections--row { flex-direction: row; }

.vc-section-wrap {
  display: flex;
  flex-direction: column;
  min-height: 0;
  min-width: 0;
}

/* ── Tabs mode ───────────────────────────────────────────────────────────── */
.vc-tabs-body {
  flex: 1;
  min-height: 0;
  position: relative;
  overflow: hidden;
}

.vc-tab-content {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
</style>
