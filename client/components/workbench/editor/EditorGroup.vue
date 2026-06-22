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
          <svg v-if="t.kind === 'dir'" class="tab-icon" width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiFolder" /></svg>
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
      <div v-else class="group-placeholder">
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
import { computed, inject, ref, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { mdiFolder, mdiClose, mdiPin, mdiChevronDown, mdiLock, mdiDotsHorizontal } from '@mdi/js'
import { useEditorDnd, dropRegion, regionToSide } from '~/composables/interaction/useEditorDnd.js'

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
const { dragState, startTabDrag, endTabDrag } = useEditorDnd()

const tabs = computed(() => props.group.tabs)
const activeTab = computed(() => tabs.value.find(t => t.id === props.group.activeTabId) ?? tabs.value[0] ?? null)

// The active tab's mounted content instance, handed back by TabContentHost.
// Kept for imperative directory ops (refresh / optimistic rename); non-directory
// tabs simply lack those methods, so the proxied calls below no-op via `?.`.
const directoryTabRef = ref(null)
function setTabInstance(el) { directoryTabRef.value = el }

// ── Tab drag (reorder within strip + cross-group via body regions) ────────────

const insertBeforeId = ref(null)
const insertAfterId  = ref(null)
const bodyRegion     = ref(null)

function onTabDragStart(event, tab) {
  controller.setActiveGroup(props.group.id)
  startTabDrag(event, { groupId: props.group.id, tabId: tab.id })
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
  if (tabEl) {
    const rect = tabEl.getBoundingClientRect()
    const before = event.clientX < rect.left + rect.width / 2
    insertBeforeId.value = before ? tabEl.dataset.tabId : null
    insertAfterId.value  = before ? null : tabEl.dataset.tabId
  } else {
    insertBeforeId.value = null
    insertAfterId.value = tabs.value[tabs.value.length - 1]?.id ?? null
  }
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
  refresh: () => directoryTabRef.value?.refresh?.(),
  renameItem: (...a) => directoryTabRef.value?.renameItem?.(...a),
  batchRenameItems: (...a) => directoryTabRef.value?.batchRenameItems?.(...a),
  clearOptimisticThumbnails: (...a) => directoryTabRef.value?.clearOptimisticThumbnails?.(...a),
  getDirectoryTab: () => directoryTabRef.value,
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

  .tab-icon  { flex-shrink: 0; }
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
