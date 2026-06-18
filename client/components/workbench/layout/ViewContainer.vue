<template>
  <div class="view-container">

    <!-- Header: view tab strip + action slots + ellipsis menu -->
    <div class="vc-header" @contextmenu.prevent="openHeaderMenu($event)">
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
            @click="onViewTabClick(view)"
            @contextmenu.prevent.stop="openTabMenu(view, $event)"
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

      <!-- Action buttons that have no heading to live in: while the active view is
           standalone (no SplitViewHeading) its bubbled section actions + view
           actions surface here, grouped. When merged, each SplitViewHeading hosts
           its own, so the strip shows none. -->
      <div v-if="!activeIsMerged && tablistHasActions" class="vc-header-actions">
        <ViewActions :groups="tablistGroups" />
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
          :showOverlay="overlayFor(view.id)"
          @commit-views="emit('update:mergedSlots', { ...mergedSlots })"
          @commit-sections="emit('update:viewSections', { ...viewSections })"
          @section-move="emit('section-move', $event)"
          @section-contextmenu="openSectionMenu($event)"
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

    <!-- Cursor-positioned context menu (tab / header / section heading) -->
    <FloatingMenu
      :visible="ctxOpen"
      type="menu"
      :items="ctxItems"
      :x="ctxPos.x"
      :y="ctxPos.y"
      @close="ctxOpen = false"
    />
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { mdiDotsHorizontal } from '@mdi/js'
import SplitViewArea from './SplitViewArea.vue'
import ViewActions from './ViewActions.vue'
import FloatingMenu from '../ui/FloatingMenu.vue'
import { useViewDrag, DRAG_MIME, SECTION_DRAG_MIME } from '../../../composables/useViewDrag.js'
import { getViewEntry, viewActions, bubbledSectionActions } from '../../../composables/useViewRegistry.js'
import { uuidv4 } from '../../../composables/useWorkspaces.js'

const { activeDrag, activeSectionDrag } = useViewDrag()

// Workbench-level chrome actions (hide/show/move views, tab-icon + badge toggles)
// provided once by Workbench so the container wrappers don't thread them through.
const chrome = inject('workbenchChrome', null)
const showTabIcons = computed(() => chrome?.showTabIcons?.value !== false)
// This container hosts movable tabs (tab/header context menus apply); the primary
// sidebar (Explorer only) doesn't.
const isMovable = computed(() => props.containerId === 'secondarySidebar' || props.containerId === 'panel')

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
const emit = defineEmits(['update:modelValue', 'update:viewSections', 'update:mergedSlots', 'transfer', 'merge', 'unmerge', 'section-move', 'section-to-tab', 'view-reabsorb'])

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
// The active standalone view's buttons, grouped by hierarchy (bubbled section
// actions, then the view's own) since there's no SplitViewHeading to hold them.
const tablistGroups = computed(() => {
  const sections = props.viewSections[props.modelValue]
  return [
    bubbledSectionActions(props.modelValue, sections),
    viewActions(props.modelValue),
  ]
})
const tablistHasActions = computed(() => tablistGroups.value.some(g => g.length))

// ── Content-area drop (merge into this tab slot) + overlay visibility ─────────

function isMergedSection(primaryId, sectionId) {
  return props.mergedSlots[primaryId]?.some(sv => sv.id === sectionId) ?? false
}

function overlayFor(viewId) {
  const ad = activeDrag.value
  if (!ad) return false
  // Re-absorb: the *same* View dragged in from elsewhere folds its sections back
  // into this one (e.g. a floated "Explorer" tab/heading dropped on the primary
  // sidebar's Explorer). Works even where view stacking is disabled (droppable false).
  if (ad.viewId === viewId) return ad.fromContainerId !== props.containerId
  // Normal merge: a different view dropped into a droppable slot it isn't already in.
  return props.droppable && !isMergedSection(viewId, ad.viewId)
}

function onContentDrop(targetViewId, { zone }) {
  if (!activeDrag.value) return
  const { viewId, fromContainerId } = activeDrag.value
  if (viewId === targetViewId) {
    if (fromContainerId !== props.containerId) {
      emit('view-reabsorb', { fromContainerId, toContainerId: props.containerId, viewId })
    }
  } else {
    emit('merge', { toContainerId: props.containerId, toViewId: targetViewId, fromContainerId, viewId, zone })
  }
  // The drop may remove the dragged tab/view from the DOM (merge, re-absorb), in
  // which case `dragend` never fires — clear drag state here so the drop overlay
  // doesn't linger and block interaction.
  clearDragState()
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

// Reset all drag state. `dragend` normally clears the module-level refs, but a
// drop that removes the dragged element (merge / re-absorb / transfer) can stop
// `dragend` from firing, so drop handlers call this explicitly — otherwise a
// stale activeDrag keeps the drop overlay mounted and blocks interaction.
function clearDragState() {
  draggedId.value         = null
  dropBeforeIdx.value     = -1
  activeDrag.value        = null
  activeSectionDrag.value = null
}

function onTabDragEnd() {
  clearDragState()
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
    clearDragState()
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
  clearDragState()
}

// ── Section / tab interaction ─────────────────────────────────────────────────

function onViewTabClick(view) {
  emit('update:modelValue', view.id)
}

// ── Section presence menu (shared: "More actions…" dropdown + section menu) ────
// One line per *present* section instance, in view order, followed by a "ghost"
// line for each declared true-child section with no present instance. Toggling a
// present instance removes that specific instance; toggling a ghost adds a fresh
// one. So declared sections stay available forever (hidden true children can be
// re-added), while adopted/foreign sections vanish once removed. Duplicates of a
// section therefore each get their own line.
function sectionMenuItems(viewId) {
  const present  = props.viewSections[viewId] ?? []
  const declared = getViewEntry(viewId)?.sections ?? []
  const items = present.map(sec => ({
    key:      `inst:${sec.instanceId ?? sec.id}`,
    label:    getViewEntry(sec.id)?.label ?? sec.id,
    type:     'toggle',
    disabled: !!sec.locked,             // locked (Places) can't be removed
    checked:  () => true,
    action:   () => removeSectionInstance(viewId, sec),
  }))
  for (const sid of declared) {
    if (present.some(s => s.id === sid)) continue
    items.push({
      key:     `ghost:${sid}`,
      label:   getViewEntry(sid)?.label ?? sid,
      type:    'toggle',
      checked: () => false,
      action:  () => addSectionInstance(viewId, sid),
    })
  }
  return items
}

function removeSectionInstance(viewId, sec) {
  if (sec.locked) return
  const map = props.viewSections
  const key = sec.instanceId ?? sec.id
  const list = (map[viewId] ?? []).filter(s => (s.instanceId ?? s.id) !== key)
  emit('update:viewSections', { ...map, [viewId]: list })
}

function addSectionInstance(viewId, sid) {
  const map  = props.viewSections
  const list = [...(map[viewId] ?? [])]
  // Re-add a fresh instance under its biological parent.
  list.push({ id: sid, homeViewId: getViewEntry(sid)?.homeView ?? viewId, collapsed: false, size: 1, instanceId: uuidv4() })
  emit('update:viewSections', { ...map, [viewId]: list })
}

// ── Ellipsis ("More actions…") dropdown ───────────────────────────────────────

const menuBtnRef = ref(null)
const menuOpen   = ref(false)
const menuPos    = ref({ x: 0, y: 0 })

const allMenuItems = computed(() => [...sectionMenuItems(props.modelValue), ...props.menuItems])

function openMenu() {
  const el = menuBtnRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  menuPos.value = { x: rect.left, y: rect.bottom + 2 }
  menuOpen.value = true
}

// ── Context menus (tab / header / section heading) ────────────────────────────
// A single cursor-positioned FloatingMenu, shared by all three since only one is
// open at a time.
const ctxOpen  = ref(false)
const ctxItems = ref([])
const ctxPos   = ref({ x: 0, y: 0 })
// Per-instance badge visibility placeholder (no badges are rendered yet).
const hiddenSectionBadges = ref(new Set())

function showCtxMenu(items, x, y) {
  ctxItems.value = items
  ctxPos.value   = { x, y }
  ctxOpen.value  = true
}

// Right-click a view tab.
function openTabMenu(view, event) {
  if (!isMovable.value || !chrome) return
  const id = view.id
  const moveTargets = chrome.moveTargetsFor(props.containerId) ?? []
  showCtxMenu([
    { key: 'hide', label: `Hide '${view.label}'`, action: () => chrome.hideView(id, props.containerId) },
    { key: 'hide-badge', label: 'Hide Badge', type: 'toggle',
      checked: () => chrome.isTabBadgeHidden(id), action: () => chrome.toggleTabBadge(id) },
    { separator: true },
    { key: 'move', label: 'Move to', submenu: moveTargets.map(t => ({
        key: `move-${t.id}`, label: t.label,
        action: () => chrome.moveViewToContainer(id, props.containerId, t.id),
      })) },
  ], event.clientX, event.clientY)
}

// Right-click the header (tab strip / chrome) but not a tab.
function openHeaderMenu(event) {
  if (!isMovable.value || !chrome) return
  const cid = props.containerId
  const viewItems = (chrome.viewsForContainer(cid) ?? []).map(v => ({
    key:      `view-${v.id}`,
    label:    v.label,
    shortcut: v.shortcut,
    type:     'toggle',
    checked:  () => chrome.isViewVisible(v.id),
    action:   () => chrome.toggleViewVisibility(v.id, cid),
  }))
  const tail = [
    { key: 'tab-icons', label: 'Show Tab Icons', type: 'toggle',
      checked: () => showTabIcons.value, action: () => chrome.toggleTabIcons() },
  ]
  if (cid === 'secondarySidebar') {
    tail.push({ key: 'ssb-left', label: 'Move Secondary Side Bar Left', disabled: true })
    tail.push({ key: 'hide-ssb', label: 'Hide Secondary Side Bar', action: () => chrome.hideContainer(cid) })
  } else if (cid === 'panel') {
    tail.push({ key: 'hide-panel', label: 'Hide Panel', action: () => chrome.hideContainer(cid) })
  }
  const items = viewItems.length ? [...viewItems, { separator: true }, ...tail] : tail
  showCtxMenu(items, event.clientX, event.clientY)
}

// Right-click a section heading (bubbled up from the SplitSectionArea).
function openSectionMenu({ viewId, sectionId, instanceId, locked, x, y }) {
  const sec   = (props.viewSections[viewId] ?? []).find(s => (s.instanceId ?? s.id) === instanceId)
                ?? { id: sectionId, instanceId, locked }
  const label = getViewEntry(sectionId)?.label ?? sectionId
  showCtxMenu([
    { key: 'hide', label: `Hide '${label}'`, disabled: !!locked, action: () => removeSectionInstance(viewId, sec) },
    { key: 'hide-badge', label: 'Hide Badge', type: 'toggle',
      checked: () => hiddenSectionBadges.value.has(instanceId),
      action:  () => {
        const s = new Set(hiddenSectionBadges.value)
        if (s.has(instanceId)) s.delete(instanceId); else s.add(instanceId)
        hiddenSectionBadges.value = s
      } },
    { separator: true },
    ...sectionMenuItems(viewId),
  ], x, y)
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
