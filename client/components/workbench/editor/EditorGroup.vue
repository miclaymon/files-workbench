<template>
  <div
    class="editor-group"
    :class="{ 'is-active': isActive }"
    @pointerdown="controller.setActiveGroup(group.id)"
  >
    <!-- Tab bar: scrollable tabs + fixed right actions -->
    <div class="tabs-bar">
      <div
        ref="stripRef"
        class="tabs"
        @dragover="onStripDragOver"
        @drop="onStripDrop"
        @dragleave="onStripDragLeave"
      >
        <button
          v-for="t in tabs"
          :key="t.id"
          class="tab"
          :class="{
            active:  t.id === group.activeTabId,
            preview: t.mode === 'peek',
            pinned:  t.pinned,
            'drop-before': insertBeforeId === t.id,
            'drop-after':  insertAfterId === t.id,
          }"
          :data-tab-id="t.id"
          draggable="true"
          @click="controller.activateTab(group.id, t.id)"
          @dblclick="controller.promoteTab(group.id, t.id)"
          @auxclick.middle.prevent="controller.closeTab(group.id, t.id)"
          @contextmenu.prevent="$emit('tab-contextmenu', { event: $event, tab: t, groupId: group.id })"
          @dragstart="onTabDragStart($event, t)"
          @dragend="onTabDragEnd"
        >
          <ResolvedIcon v-if="iconResult(t)" :result="iconResult(t)" :size="14" icon-class="tab-icon" @fail="onIconFail(t.id)" />
          <span class="tab-label">{{ t.title }}</span>
          <span v-if="t.selectedItems?.length > 0" class="tab-badge">{{ t.selectedItems.length }}</span>
          <span
            class="tab-close"
            :class="{ 'is-pinned': t.pinned }"
            :title="t.pinned ? 'Unpin' : 'Close (Ctrl+W)'"
            @click.stop="t.pinned ? controller.togglePin(group.id, t.id) : controller.closeTab(group.id, t.id)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="t.pinned ? mdiPin : mdiClose" /></svg>
          </span>
        </button>

        <div class="tabs-spacer" />

        <button
          v-if="isOverflowing"
          ref="overflowBtnRef"
          class="tabs-overflow-btn"
          title="Open tabs"
          @click.stop="toggleOverflowMenu"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiChevronDown" /></svg>
        </button>
      </div>

      <!-- Active tab's contributed actions (e.g. markdown "Open as Preview") -->
      <div v-if="tabActions.length" class="tab-actions">
        <ViewActions :actions="tabActions" :ctx="tabActionCtx" />
      </div>

      <!-- Fixed right: lock indicator + group actions menu -->
      <div class="group-actions">
        <button
          v-if="group.locked"
          class="group-action-btn"
          title="Group is locked — click to unlock"
          @click.stop="controller.toggleLockGroup(group.id)"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiLock" /></svg>
        </button>
        <button
          ref="groupMenuBtnRef"
          class="group-action-btn"
          title="Group actions"
          @click.stop="toggleGroupMenu"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiDotsHorizontal" /></svg>
        </button>
      </div>
    </div>

    <!-- Content -->
    <div
      class="group-body"
      @dragover="onBodyDragOver"
      @drop="onBodyDrop"
      @dragleave="onBodyDragLeave"
    >
      <!-- Tabs are kept alive (LRU-capped): switching tabs caches the previous
           instance instead of destroying it, so a directory tab's listing /
           thumbnails / sizes survive and switching back is instant. -->
      <KeepAlive :max="25">
        <TabContentHost
          v-if="activeTab"
          :key="activeTab.id"
          :tab="activeTab"
          :prefs="prefs"
          :excludedCategories="excludedCategories"
          :registerInstance="setTabInstance"
          @select="$emit('select', $event)"
          @open="$emit('open', $event)"
          @navigate="$emit('navigate', $event)"
          @contextmenu="$emit('contextmenu', $event)"
          @background-contextmenu="$emit('background-contextmenu', $event)"
          @right-drag-drop="$emit('right-drag-drop', $event)"
          @rename="$emit('rename', $event)"
          @rename-batch="$emit('rename-batch', $event)"
          @stats="$emit('stats', { groupId: group.id, stats: $event })"
          @update:layout="$emit('update:layout', $event)"
          @preferences-save="$emit('preferences-save', $event)"
          @preferences-change="$emit('preferences-change', $event)"
        />
      </KeepAlive>
      <div v-if="!activeTab" class="group-placeholder">
        <span>No open tabs in this group.</span>
      </div>

      <EditorDropOverlay v-if="bodyRegion" :region="bodyRegion" />
    </div>

    <FloatingMenu
      :visible="overflowMenuOpen"
      type="menu"
      :items="overflowItems"
      :x="overflowMenuPos.x"
      :y="overflowMenuPos.y"
      @close="overflowMenuOpen = false"
    />

    <FloatingMenu
      :visible="groupMenuOpen"
      type="menu"
      :items="groupMenuItems"
      :x="groupMenuPos.x"
      :y="groupMenuPos.y"
      @close="groupMenuOpen = false"
    />
  </div>
</template>

<script setup>
import { computed, inject, ref, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { mdiClose, mdiPin, mdiChevronDown, mdiLock, mdiDotsHorizontal } from '@mdi/js'
import { useEditorDnd, dropRegion, regionToSide } from '~/composables/interaction/useEditorDnd.js'
import { tabIconDescriptor, tabViewForKind } from '~/composables/useViewRegistry.js'
import ResolvedIcon from '~/components/workbench/ResolvedIcon.vue'
import ViewActions from '~/components/workbench/layout/ViewActions.vue'

// A tab's icon comes from its registered editor-view (by kind) — and, when that
// view defines a per-tab tabIcon (e.g. Preview's thumbnail / file-type icon), from
// the tab itself. So every tab kind shows its own icon with no per-kind branching.
// If a dynamic <img> icon (thumbnail / icon-pack URL) 404s, the tab id is recorded
// and we fall back to the view's static kind glyph.
const iconFailed = ref(new Set())
function iconResult(tab) { return tabIconDescriptor(tab, { dynamic: !iconFailed.value.has(tab.id) }) }
function onIconFail(id) { iconFailed.value = new Set(iconFailed.value).add(id) }

const props = defineProps({
  group:       { type: Object,  required: true },
  isActive:    { type: Boolean, default: false },
  isMaximized: { type: Boolean, default: false },
  prefs:       { type: Object,  required: true },
  excludedCategories: { type: Array, default: () => ['System'] },
})

defineEmits([
  'select', 'open', 'navigate', 'contextmenu', 'background-contextmenu',
  'right-drag-drop', 'rename', 'rename-batch', 'stats', 'update:layout',
  'preferences-save', 'preferences-change', 'tab-contextmenu',
])

const controller = inject('editorController')
const viewCtx = inject('viewCtx', null)
const { dragState, startTabDrag, endTabDrag } = useEditorDnd()

const tabs = computed(() => props.group.tabs)
const activeTab = computed(() => tabs.value.find(t => t.id === props.group.activeTabId) ?? tabs.value[0] ?? null)

// Actions contributed by the active tab's editor-view (kind), rendered in the tab
// bar for this group — the editor twin of a panel's ViewActions. The action ctx is
// the host augmented with `tab` so an action can gate on / read the active tab
// (e.g. markdown's "Open as Preview"). Clicking activates the group first (root
// @pointerdown), so facade actions target this group.
const tabActions = computed(() => (activeTab.value ? tabViewForKind(activeTab.value.kind)?.actions ?? [] : []))
const tabActionCtx = computed(() => ({ ...(viewCtx ?? {}), tab: activeTab.value }))

// Mounted content instances, keyed by tab id (handed back by TabContentHost with
// its own id). A Map — not a single ref — because tabs are kept alive: switching
// tabs deactivates rather than unmounts the previous one, so we resolve the active
// tab's instance by id at call time. Kept for imperative directory ops (refresh /
// optimistic rename); non-directory tabs lack those methods, so calls below no-op
// via `?.`. On unmount (close / LRU evict) TabContentHost reports a null instance,
// keyed by its own id, so the right entry is dropped.
const tabInstances = new Map()
function setTabInstance(el, tabId) {
  if (!tabId) return
  if (el) tabInstances.set(tabId, el)
  else tabInstances.delete(tabId)
}
const activeTabInstance = () => (activeTab.value ? tabInstances.get(activeTab.value.id) ?? null : null)

// Prune handles for tabs that have closed. A kept-alive instance may linger in the
// KeepAlive cache until LRU eviction (its ref doesn't fire null on deactivate), but
// we don't want stale handles for tabs no longer in the group.
watch(() => props.group.tabs.map(t => t.id), (ids) => {
  const live = new Set(ids)
  for (const id of tabInstances.keys()) if (!live.has(id)) tabInstances.delete(id)
})

// ── Tab drag (reorder within strip + cross-group via body regions) ────────────

const insertBeforeId = ref(null)
const insertAfterId  = ref(null)
const bodyRegion     = ref(null)

function onTabDragStart(event, tab) {
  controller.setActiveGroup(props.group.id)
  startTabDrag(event, { groupId: props.group.id, tabId: tab.id, pinned: !!tab.pinned })
}
function onTabDragEnd() {
  endTabDrag()
  clearIndicators()
}
function clearIndicators() {
  insertBeforeId.value = null
  insertAfterId.value = null
  bodyRegion.value = null
}

function onStripDragOver(event) {
  if (!dragState.active) return
  event.preventDefault()
  bodyRegion.value = null
  const tabEl = event.target.closest('.tab')
  let beforeId = null, afterId = null
  if (tabEl) {
    const rect = tabEl.getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    beforeId = before ? tabEl.dataset.tabId : null
    afterId  = before ? null : tabEl.dataset.tabId
  } else {
    afterId = tabs.value[tabs.value.length - 1]?.id ?? null
  }

  // Pinned tabs stay grouped at the front: if the indicator points at a tab in the
  // other band (pinned vs unpinned) than the dragged tab, snap it to the boundary so
  // a pinned tab can't be dropped after unpinned ones (and vice-versa). The drop
  // itself is re-partitioned server-side (reorderForPin), this just keeps the hint honest.
  const hovered = tabs.value.find(t => t.id === (beforeId ?? afterId))
  if (hovered && !!hovered.pinned !== dragState.pinned) {
    const firstUnpinned = tabs.value.find(t => !t.pinned)
    const pinnedTabs = tabs.value.filter(t => t.pinned)
    const lastPinned = pinnedTabs[pinnedTabs.length - 1]
    if (dragState.pinned) { beforeId = firstUnpinned?.id ?? null; afterId = beforeId ? null : (lastPinned?.id ?? null) }
    else                  { afterId = lastPinned?.id ?? null; beforeId = null }
  }
  insertBeforeId.value = beforeId
  insertAfterId.value = afterId
}
function onStripDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) { insertBeforeId.value = null; insertAfterId.value = null }
}
function onStripDrop(event) {
  if (!dragState.active) return
  event.preventDefault()
  const beforeId = insertBeforeId.value
    ?? (insertAfterId.value ? nextTabId(insertAfterId.value) : null)
  controller.dropTab({
    sourceGroupId: dragState.sourceGroupId,
    tabId: dragState.tabId,
    targetGroupId: props.group.id,
    region: 'center',
    beforeTabId: beforeId,
  })
  endTabDrag()
  clearIndicators()
}
function nextTabId(id) {
  const i = tabs.value.findIndex(t => t.id === id)
  return i >= 0 ? (tabs.value[i + 1]?.id ?? null) : null
}

function onBodyDragOver(event) {
  if (!dragState.active || props.group.locked) return
  event.preventDefault()
  insertBeforeId.value = null
  insertAfterId.value = null
  const rect = event.currentTarget.getBoundingClientRect()
  bodyRegion.value = dropRegion(rect, event.clientX, event.clientY)
}
function onBodyDragLeave(event) {
  if (!event.currentTarget.contains(event.relatedTarget)) bodyRegion.value = null
}
function onBodyDrop(event) {
  if (!dragState.active || props.group.locked) return
  event.preventDefault()
  const region = bodyRegion.value ?? 'center'
  controller.dropTab({
    sourceGroupId: dragState.sourceGroupId,
    tabId: dragState.tabId,
    targetGroupId: props.group.id,
    region,
    side: regionToSide(region),
  })
  endTabDrag()
  clearIndicators()
}

// ── Overflow menu ─────────────────────────────────────────────────────────────

const stripRef = ref(null)
const overflowBtnRef = ref(null)
const isOverflowing = ref(false)
const overflowMenuOpen = ref(false)
const overflowMenuPos = ref({ x: 0, y: 0 })

const overflowItems = computed(() => tabs.value.map(t => ({
  key: t.id,
  label: t.title,
  action: () => controller.activateTab(props.group.id, t.id),
})))

function toggleOverflowMenu() {
  if (overflowMenuOpen.value) { overflowMenuOpen.value = false; return }
  const rect = overflowBtnRef.value?.getBoundingClientRect()
  if (rect) overflowMenuPos.value = { x: Math.max(8, rect.right - 200), y: rect.bottom + 2 }
  nextTick(() => { overflowMenuOpen.value = true })
}

let ro = null
function measureOverflow() {
  const el = stripRef.value
  if (el) isOverflowing.value = el.scrollWidth > el.clientWidth + 1
}
onMounted(() => {
  measureOverflow()
  ro = new ResizeObserver(measureOverflow)
  if (stripRef.value) ro.observe(stripRef.value)
})
onBeforeUnmount(() => ro?.disconnect())

// ── Group actions menu ────────────────────────────────────────────────────────

const groupMenuBtnRef = ref(null)
const groupMenuOpen = ref(false)
const groupMenuPos  = ref({ x: 0, y: 0 })

const groupMenuItems = computed(() => [
  { key: 'closeAll', label: 'Close All', action: () => { controller.closeAllTabs(props.group.id); groupMenuOpen.value = false } },
  { separator: true },
  { key: 'tabPreviews', label: 'Enable Tab Previews', type: 'toggle',
    checked: () => props.group.tabPreviews !== false,
    action: () => { controller.toggleTabPreviews(props.group.id) } },
  { key: 'maximize',
    label: props.isMaximized ? 'Restore Group' : 'Maximize Group',
    type: 'toggle', checked: () => props.isMaximized,
    action: () => { controller.maximizeGroup(props.group.id); groupMenuOpen.value = false } },
  { key: 'lock',
    label: props.group.locked ? 'Unlock Group' : 'Lock Group',
    type: 'toggle', checked: () => !!props.group.locked,
    action: () => { controller.toggleLockGroup(props.group.id) } },
])

function toggleGroupMenu() {
  if (groupMenuOpen.value) { groupMenuOpen.value = false; return }
  const rect = groupMenuBtnRef.value?.getBoundingClientRect()
  if (rect) groupMenuPos.value = { x: Math.max(8, rect.right - 200), y: rect.bottom + 2 }
  nextTick(() => { groupMenuOpen.value = true })
}

defineExpose({
  refresh: () => activeTabInstance()?.refresh?.(),
  renameItem: (...a) => activeTabInstance()?.renameItem?.(...a),
  batchRenameItems: (...a) => activeTabInstance()?.batchRenameItems?.(...a),
  clearOptimisticThumbnails: (...a) => activeTabInstance()?.clearOptimisticThumbnails?.(...a),
  getDirectoryTab: () => activeTabInstance(),
})
</script>

<style scoped>
.editor-group {
  flex: 1;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--editor-background);
}

/* Tab bar */
.tabs-bar {
  height: 35px;
  min-height: 35px;
  display: flex;
  align-items: stretch;
  background: #252526;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}

.tabs {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: stretch;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;

  &::-webkit-scrollbar { height: 3px; }
}

.tabs-spacer { flex: 1; min-width: 0; }

.tab-actions {
  display: flex;
  align-items: center;
  padding-inline: 4px;
  gap: 2px;
  flex-shrink: 0;
  border-left: 1px solid var(--border);
}

.group-actions {
  display: flex;
  align-items: stretch;
  border-left: 1px solid var(--border);
  flex-shrink: 0;
}

.group-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  background: transparent;
  border: none;
  border-left: 1px solid #2b2b2b;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;

  &:first-child { border-left: none; }
  &:hover { color: var(--text); background: rgba(255,255,255,0.06); }
}

.editor-group {
  &.is-active .tab.active { border-top-color: var(--accent); }
  &:not(.is-active) .tab.active { border-top-color: var(--text-muted); }
}

.tab {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 0 8px;
  height: 35px;
  flex-shrink: 0;
  max-width: 180px;
  min-width: 0;
  background: transparent;
  border: none;
  border-right: 1px solid #2b2b2b;
  border-top: 1px solid transparent;
  color: var(--text-muted);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;

  &:hover { background: rgba(255,255,255,0.05); }
  &.active { background: var(--editor-background, #1e1e1e); color: var(--text); border-top-color: var(--accent); }
  &.preview .tab-label { font-style: italic; }
  &.drop-before { box-shadow: inset 2px 0 0 var(--accent); }
  &.drop-after  { box-shadow: inset -2px 0 0 var(--accent); }
  &.flash { animation: tab-flash 0.6s ease; }

  &:hover .tab-close,
  &.active .tab-close { opacity: 1; }

  .tab-icon  { flex-shrink: 0; width: 14px; height: 14px; }
  /* When the icon is an image (thumbnail / icon-pack glyph), keep it square. */
  img.tab-icon { object-fit: cover; border-radius: 2px; }
  .tab-label { overflow: hidden; text-overflow: ellipsis; flex: 1; min-width: 0; }
  .tab-badge {
    background: var(--accent);
    color: white;
    font-size: 10px;
    font-weight: 600;
    padding: 1px 5px;
    border-radius: 10px;
    flex-shrink: 0;
  }
  .tab-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    padding: 2px;
    border-radius: 3px;
    flex-shrink: 0;
    color: var(--text-muted);
    transition: opacity 0.15s;

    &.is-pinned { opacity: 1; }
    &:hover { background: rgba(255,255,255,0.1); color: var(--text); }
  }
}

@keyframes tab-flash {
  0%, 100% { background: transparent; }
  35%      { background: color-mix(in srgb, var(--accent) 45%, transparent); }
}

.tabs-overflow-btn {
  position: sticky;
  right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  flex-shrink: 0;
  background: #252526;
  border: none;
  border-left: 1px solid var(--border);
  color: var(--text-muted);
  cursor: pointer;

  &:hover { color: var(--text); background: rgba(255,255,255,0.06); }
}

/* Body */
.group-body {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--editor-background);
}

.group-placeholder {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--text-muted);
  font-size: 13px;
  user-select: none;
}
</style>
