<template>
  <div class="view-container">

    <!-- Header: view tab strip + action slots + ellipsis menu -->
    <div class="vc-header">
      <div
        class="vc-view-tab-bar"
        role="tablist"
        @dragover.prevent="onBarDragOver"
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
            @click="onViewTabClick(view)"
            @dragstart="onTabDragStart(view, i, $event)"
            @dragend="onTabDragEnd"
          >
            <svg v-if="view.icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor" class="vc-view-tab-icon">
              <path :d="view.icon" />
            </svg>
            <span class="vc-view-tab-label">{{ view.label }}</span>
          </button>
        </template>
        <span v-if="dropBeforeIdx === views.length" class="vc-drop-indicator" />
      </div>

      <!-- Per-view (context) action buttons: shown in the tab strip only while the
           active view is standalone. When it's merged, they move into its
           SplitViewHeading instead. -->
      <div v-if="!activeIsMerged && tablistActions.length" class="vc-header-actions">
        <ViewActions :actions="tablistActions" />
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

    <!-- Body: one SplitViewArea per tab slot. The primary sidebar is just a
         single, non-droppable slot whose one View (Explorer) carries the
         sections accordion. -->
    <div class="vc-tabs-body">
      <div
        v-for="view in views"
        :key="view.id"
        v-show="modelValue === view.id"
        class="vc-tab-content"
      >
        <SplitViewArea
          :views="slotViews(view.id)"
          :viewSections="viewSections"
          :direction="dropDirection"
          :containerId="containerId"
          :slotKey="view.id"
          :showOverlay="droppable && overlayFor(view.id)"
          @commit-views="emit('update:mergedSlots', { ...mergedSlots })"
          @commit-sections="emit('update:viewSections', { ...viewSections })"
          @section-move="emit('section-move', $event)"
          @content-drop="onContentDrop(view.id, $event)"
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
import SplitViewArea from './SplitViewArea.vue'
import ViewActions from './ViewActions.vue'
import FloatingMenu from './FloatingMenu.vue'
import { useViewDrag, DRAG_MIME } from '../../composables/useViewDrag.js'
import { resolveViewActions } from '../../composables/useViewRegistry.js'

const { activeDrag } = useViewDrag()

// ── Props / emits ─────────────────────────────────────────────────────────────

const props = defineProps({
  views:          { type: Array,  required: true },         // [{ id, icon, label }]
  modelValue:     { type: String, required: true },         // active tab id
  containerId:    { type: String, default: '' },            // unique id for cross-container drag
  mergedSlots:    { type: Object, default: () => ({}) },    // { [primaryId]: [{ id, collapsed, size }] } — view stacking
  viewSections:   { type: Object, default: () => ({}) },    // { [viewId]: Section[] } — each view's own sections
  droppable:      { type: Boolean, default: true },         // false for the (non-mergeable) primary sidebar
  menuItems:      { type: Array,  default: () => [] },
  dropDirection:  { type: String, default: 'col' },         // 'col' = top/bottom split, 'row' = left/right split
})
const emit = defineEmits(['update:modelValue', 'update:viewSections', 'update:mergedSlots', 'transfer', 'merge', 'unmerge', 'section-move'])

// ── Body adapters: shape the existing props into the SplitViewArea model ──────
// References (not copies) are passed through so in-place size/collapse mutations
// reach the real reactive data; the area emits `commit` and we re-emit a fresh
// copy for persistence.

// A slot is either a merge group (multiple SplitViews) or a single view (one
// SplitView, no heading). Single-view arrays are cached so the slot's SplitView
// isn't recreated on every render.
const _singleCache = {}
function slotViews(viewId) {
  const merged = props.mergedSlots[viewId]
  if (merged && merged.length) return merged
  if (!_singleCache[viewId]) _singleCache[viewId] = [{ id: viewId, collapsed: false, size: 1 }]
  return _singleCache[viewId]
}

// The active tab's slot holds more than one View (so each shows a SplitViewHeading
// that hosts its own context actions — the tab strip should not duplicate them).
const activeIsMerged = computed(() => (props.mergedSlots[props.modelValue]?.length ?? 0) > 1)
// The active standalone view's actions, with its lone-section actions promoted in.
const tablistActions = computed(() => resolveViewActions(props.modelValue, props.viewSections[props.modelValue]))

// ── Content-area drop (merge into this tab slot) + overlay visibility ─────────

function isMergedSection(primaryId, sectionId) {
  return props.mergedSlots[primaryId]?.some(sv => sv.id === sectionId) ?? false
}

function overlayFor(viewId) {
  const ad = activeDrag.value
  return !!ad && ad.viewId !== viewId && !isMergedSection(viewId, ad.viewId)
}

function onContentDrop(targetViewId, { zone }) {
  if (!activeDrag.value) return
  const { viewId, fromContainerId } = activeDrag.value
  if (viewId === targetViewId && fromContainerId === props.containerId) return
  emit('merge', { toContainerId: props.containerId, toViewId: targetViewId, fromContainerId, viewId, zone })
}

// ── Tab drag-to-reorder / cross-container drag ────────────────────────────────

const draggedId     = ref(null)
const dropBeforeIdx = ref(-1)

function onTabDragStart(view, index, event) {
  draggedId.value = view.id
  activeDrag.value = { viewId: view.id, fromContainerId: props.containerId }
  event.dataTransfer.setData(DRAG_MIME, JSON.stringify({ viewId: view.id, fromContainerId: props.containerId }))
  event.dataTransfer.effectAllowed = 'move'
}

function onTabDragEnd() {
  draggedId.value     = null
  dropBeforeIdx.value = -1
  // activeDrag cleared by the global dragend listener in useViewDrag
}

function onBarDragOver(event) {
  if (!event.dataTransfer.types.includes(DRAG_MIME)) return
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
  draggedId.value     = null
  dropBeforeIdx.value = -1
}

// ── Section / tab interaction ─────────────────────────────────────────────────

function onViewTabClick(view) {
  emit('update:modelValue', view.id)
}

// ── Ellipsis menu ─────────────────────────────────────────────────────────────

const menuBtnRef = ref(null)
const menuOpen   = ref(false)
const menuPos    = ref({ x: 0, y: 0 })

const allMenuItems = computed(() => {
  // Section show/hide toggles for the active view's own sections (when it has
  // more than one). Sources from the unified per-view section map.
  const active = props.viewSections[props.modelValue]
  const sectionItems = (Array.isArray(active) && active.length > 1)
    ? active.map(s => ({
        key:      s.id,
        label:    s.title ?? s.id,
        type:     'toggle',
        // Locked sections (e.g. Places) are essential to the View and can't be
        // hidden from the menu: always checked, click disabled.
        disabled: !!s.locked,
        checked:  () => s.locked ? true : !s.collapsed,
        action:   () => {
          if (s.locked) return
          const list = props.viewSections[props.modelValue]
          const i = list?.findIndex(sec => sec.id === s.id) ?? -1
          if (i >= 0) {
            list[i].collapsed = !list[i].collapsed
            emit('update:viewSections', { ...props.viewSections })
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
