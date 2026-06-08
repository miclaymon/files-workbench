<template>
  <div class="vscode-shell">

    <!-- Titlebar -->
    <div class="titlebar">
      <div class="left">
        <strong style="font-size: 13px;">Files</strong>
        <button ref="fileMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('file')">File</button>
        <button ref="editMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('edit')">Edit</button>
        <button ref="viewMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('view')">View</button>

        <FloatingMenu :visible="fileMenuOpen" type="menu" :items="fileMenuItems" :x="fileMenuPos.x" :y="fileMenuPos.y" @close="fileMenuOpen = false" @item-click="runAction" />
        <FloatingMenu :visible="editMenuOpen" type="menu" :items="editMenuItems" :x="editMenuPos.x" :y="editMenuPos.y" @close="editMenuOpen = false" @item-click="runAction" />
        <FloatingMenu :visible="viewMenuOpen" type="menu" :items="viewMenuItems" :x="viewMenuPos.x" :y="viewMenuPos.y" @close="viewMenuOpen = false" @item-click="runAction" />
      </div>

      <div class="center">
        <div class="omnibar no-drag" @click="openCommandPalette">Search files, commands…</div>
      </div>

      <div class="right">
        <template v-if="isElectron">
          <button class="no-drag winbtn" title="Minimize" @click="windowMinimize">—</button>
          <button class="no-drag winbtn" title="Maximize" @click="windowToggleMaximize">□</button>
          <button class="no-drag winbtn close" title="Close" @click="windowClose">×</button>
        </template>
      </div>
    </div>

    <!-- Main area -->
    <div class="main">

      <!-- Activity Bar -->
      <div class="activitybar">
        <div class="activitybar-top">
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activeActivity === 'explorer' }" title="Explorer" @click="toggleActivity('explorer')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSegment" /></svg>
          </a>
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activeActivity === 'search' }" title="Search" @click="toggleActivity('search')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiMagnify" /></svg>
          </a>
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activeActivity === 'storage' }" title="Storage" @click="toggleActivity('storage')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiHarddisk" /></svg>
          </a>
        </div>
        <div class="activitybar-bottom">
          <a ref="settingsButton" href="javascript:void(0)" class="activitybar-icon" title="Settings" @click.stop="showMenuDelayed('settings')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiCog" /></svg>
          </a>
        </div>
        <FloatingMenu :visible="settingsMenuOpen" type="menu" :items="settingsMenuItems" :x="settingsMenuPos.x" :y="settingsMenuPos.y" @close="settingsMenuOpen = false" @item-click="runAction" />
      </div>

      <!-- Sidebar + Editor split -->
      <div class="workbench-content">

        <!-- Sidebar -->
        <div v-if="sidebarVisible" class="sidebar" :style="{ width: sidebarWidth + 'px' }">
          <ExplorerPanel
            v-if="activeActivity === 'explorer'"
            ref="explorerPanelRef"
            :selectedPath="selectedPath"
            :showCheckboxes="prefs.explorer.alwaysShowCheckboxes"
            :isTreeView="true"
            :excludedCategories="prefs.excludedCategories"
            :indentScale="prefs.explorer.indentScale ?? 1.0"
            :explorerState="explorerContext"
            @select="handleExplorerSelect"
            @dblclick="handleDoubleClick"
            @contextmenu="showItemContextMenu"
            @rename="handleRename"
            @move="({ items, destPath }) => doMove(items, destPath)"
            @state-change="updateExplorerContext"
          />
          <div v-else-if="activeActivity === 'search'" class="sidebar-placeholder">
            Search panel coming soon…
          </div>
        </div>
        <div v-if="sidebarVisible" class="resize-handle resize-handle--col" @mousedown="onResizeSidebar" />

        <!-- Editor column (editor + bottom panel) -->
        <div class="editor-column">

          <!-- Editor area -->
          <div class="editor-area">

            <!-- Tab bar -->
            <div class="tabs">
              <button
                v-for="t in tabs"
                :key="t.id"
                class="tab"
                :class="{
                  active: t.id === activeTabId,
                  peek: t.kind === 'dir' && t.mode === 'peek',
                  dragging: draggedTab?.id === t.id,
                  'drag-over': dragOverTab?.id === t.id
                }"
                :data-tab-id="t.id"
                draggable="true"
                @click="handleTabClick(t)"
                @dblclick="pinTab(t.id)"
                @contextmenu.prevent="showTabContextMenu($event, t)"
                @dragstart="handleDragStart($event, t)"
                @dragend="handleDragEnd"
                @dragover="handleDragOver($event, t)"
                @dragleave="handleDragLeave($event)"
                @drop="handleTabDrop($event, t)"
              >
                <svg v-if="t.kind === 'dir'" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" style="flex-shrink:0"><path :d="mdiFolder" /></svg>
                <span class="tab-label">{{ t.title }}</span>
                <span v-if="t.selectedItems?.length > 0" class="tab-badge">{{ t.selectedItems.length }}</span>
                <span class="tab-close" @click.stop="closeTab(t.id)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
                </span>
              </button>
            </div>

            <!-- Center pane -->
            <div class="centerpane">
              <HomePage v-if="activeTab?.kind === 'home'" />
              <DirectoryTab
                v-else-if="activeTab?.kind === 'dir'"
                ref="directoryTabRef"
                :path="activeTab.path"
                :excludedCategories="prefs.excludedCategories"
                :selectedPath="activeTab.selectedPath ?? ''"
                :selectedItems="selectedItems"
                :focusedItem="focusedItem"
                :prefs="prefs.explorer"
                @select="handleSelectFromDirectory"
                @open="handleOpenFromTab"
                @navigate="navigateInCurrentTab"
                @contextmenu="showItemContextMenu"
                @rename="handleRename"
                @stats="dirStats = $event"
                @update:layout="handleLayoutChange"
              />
              <PreferencesActivity
                v-else-if="activeTab?.kind === 'preferences'"
                :prefs="prefs"
                @save="savePreferences"
                @change="onPreferencesChanged"
              />
              <div v-else style="padding: 12px; color: var(--text-muted); font-size: 13px;">No tab.</div>
            </div>

          </div>

          <!-- Bottom panel resize handle + panel -->
          <div class="resize-handle resize-handle--row" @mousedown="onResizeBottompane" />
          <div class="bottompane" :style="{ height: bottompaneHeight + 'px' }">
            <Panel :activities="bottomPanelActivities" v-model="bottomPanel">
              <template #debug-actions>
                <button class="bp-action-btn" @click="debugLog.clear()" title="Clear">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </template>
              <template #debug>
                <DebugPanel />
              </template>
            </Panel>
          </div>

        </div>

        <!-- Right pane -->
        <div class="resize-handle resize-handle--col" @mousedown="onResizeRightpane" />
        <div class="rightpane" :style="{ width: rightpaneWidth + 'px' }">
          <Panel :activities="rightPanelActivities" v-model="rightPanel" :maxActivities="4" @reorder="reorderRightPanel">
            <template #preview>
              <PreviewPanel :selectedItems="selectedItems" :editorFontSize="prefs.preview?.editorFontSize ?? 13" />
            </template>
            <template #details>
              <DetailsPanel :selectedPath="selectedPath" :details="selectedDetails" />
            </template>
            <template #chat>
              <div :selectedPath="selectedPath" :details="selectedDetails">
                <div style="padding: 12px; color: var(--text-muted); font-size: 13px;">
                  Chat panel coming soon.
                </div>
              </div>
            </template>
          </Panel>
        </div>

      </div>
    </div>

    <!-- Status bar -->
    <div class="statusbar">
      <div class="status-left">
        <template v-if="activeTab?.kind === 'dir'">
          <div class="status-bar-item">Directory: {{ formatCount(dirStats.count) }} item{{ dirStats.count === 1 ? '' : 's' }} | {{ formatBytes(dirStats.totalSize) }}</div>
          <div v-if="selectedItems.length > 0" class="status-bar-item">Selected: {{ formatCount(selectedItems.length) }} item{{ selectedItems.length === 1 ? '' : 's' }} | {{ formatBytes(selectedItems.reduce((s, i) => s + (i.size ?? 0), 0)) }}</div>
        </template>
        <div v-else-if="status.left" class="status-bar-item">{{ status.left }}</div>
      </div>
      <span class="spacer"></span>
      <span class="status-connection" :class="{ disconnected: !serverConnected }">
        <span class="connection-dot" />{{ statusRight }}
      </span>
    </div>

    <!-- Clipboard toast -->
    <div v-if="clipboard.count > 0" class="toast">
      <div style="font-weight: 600; margin-bottom: 4px;">Clipboard</div>
      <div style="color: var(--text-muted);">{{ clipboard.mode }}: {{ clipboard.count }} item(s)</div>
    </div>

    <!-- Context menu -->
    <ContextMenu
      :visible="contextMenu.visible"
      :x="contextMenu.x"
      :y="contextMenu.y"
      :items="contextMenu.items"
      :quickActions="contextMenu.quickActions"
      @close="hideContextMenu"
    />

    <!-- Elevation dialog -->
    <div v-if="elevationPrompt" class="modal-overlay" @click.self="cancelElevation">
      <div class="modal-dialog">
        <div class="modal-title">Administrator permission required</div>
        <div class="modal-body">
          <p>{{ elevationPrompt.message }}</p>
          <p class="modal-paths">{{ elevationPrompt.paths.join('\n') }}</p>
          <template v-if="elevationPrompt.method === 'sudo_password'">
            <label class="modal-label">sudo password</label>
            <input
              ref="elevationPasswordRef"
              v-model="elevationPassword"
              type="password"
              class="modal-input"
              placeholder="Enter your password…"
              autocomplete="current-password"
              @keydown.enter="confirmElevation"
              @keydown.esc="cancelElevation"
            />
            <div v-if="elevationError" class="modal-error">{{ elevationError }}</div>
          </template>
          <template v-else-if="elevationPrompt.method === 'osascript'">
            <p class="modal-hint">macOS will display a system authentication dialog.</p>
          </template>
          <template v-else>
            <p class="modal-hint">Restart Files Workbench as Administrator and try again.</p>
          </template>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" @click="cancelElevation">Cancel</button>
          <button
            v-if="elevationPrompt.method !== 'windows_uac'"
            class="modal-btn modal-btn--primary"
            @click="confirmElevation"
          >{{ elevationPrompt.method === 'osascript' ? 'Authenticate…' : 'Confirm' }}</button>
        </div>
      </div>
    </div>

    <!-- Missing tool / install prompt -->
    <div v-if="installPrompt" class="modal-overlay" @click.self="installPrompt = null">
      <div class="modal-dialog">
        <div class="modal-title">Missing tool: {{ installPrompt.tool }}</div>
        <div class="modal-body">
          <p>{{ installPrompt.message }}</p>
          <div class="install-cmds">
            <div v-if="installPrompt.installApt"  class="install-cmd"><span class="install-cmd-label">apt</span><code>{{ installPrompt.installApt }}</code></div>
            <div v-if="installPrompt.installDnf"  class="install-cmd"><span class="install-cmd-label">dnf</span><code>{{ installPrompt.installDnf }}</code></div>
            <div v-if="installPrompt.installPac"  class="install-cmd"><span class="install-cmd-label">pacman</span><code>{{ installPrompt.installPac }}</code></div>
            <div v-if="installPrompt.installBrew" class="install-cmd"><span class="install-cmd-label">brew</span><code>{{ installPrompt.installBrew }}</code></div>
          </div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn modal-btn--primary" @click="installPrompt = null">OK</button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { mdiHarddisk, mdiSegment, mdiMagnify, mdiFolder, mdiMessage, mdiCog, mdiClose, mdiEye, mdiInformation, mdiBug } from '@mdi/js'
import { useDragAndDrop } from '~/composables/useDragAndDrop.js'
import { useWorkspaces, uuidv4 } from '~/composables/useWorkspaces.js'
import { usePreferences } from '~/composables/usePreferences.js'
import { useDebugLog } from '~/composables/useDebugLog.js'
import { useFileOpsQueue } from '~/composables/useFileOpsQueue.js'
import { useActionHistory } from '~/composables/useActionHistory.js'
import { fsStat, fsOpenWithSystem, fsArchiveCapabilities } from '~/lib/fs-api.js'

function uuid() { return uuidv4() }

const isElectron = computed(() => !!window.electron)

// Status bar
const serverConnected = ref(true)
const dirStats = ref({ count: 0, totalSize: 0 })

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0
  let val = bytes
  while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
  return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
}

function formatCount(n) {
  return n.toLocaleString()
}

const statusRight = computed(() => serverConnected.value ? 'Connected' : 'Disconnected')

// Server connection ping
let _pingInterval = null
async function pingServer() {
  try {
    const res = await fetch('/health', { signal: AbortSignal.timeout(3000) })
    serverConnected.value = res.ok
  } catch {
    serverConnected.value = false
  }
}

const status = ref({ left: 'Ready', right: 'Connected' })

// Layout state (persisted via workspace)
const {
  sidebarVisible, sidebarWidth, activeActivity,
  rightpaneWidth, rightPanel, bottompaneHeight,
  rightPanelActivityIds,
  explorerContext, updateExplorerContext,
  getInitialTabs, getInitialActiveTabId, saveTabs,
} = useWorkspaces()

// Debug log
const debugLog = useDebugLog()
const { log } = debugLog

// File operations queue + undo/redo
const { enqueue } = useFileOpsQueue()
const history = useActionHistory()

// Elevation dialog state
const elevationPasswordRef = ref(null)
const elevationPrompt = ref(null)  // { op, paths, password-based method, message, onConfirm }
const elevationPassword = ref('')
const elevationError = ref('')

// Install-tool prompt state
const installPrompt = ref(null)  // { tool, message, installApt, ... }

// Archive capabilities (loaded once at startup)
const archiveCaps = ref(null)
const platform = ref('linux')

// Archive-file extensions for context menu detection
const ARCHIVE_EXTS = new Set(['.zip', '.tar', '.gz', '.bz2', '.xz', '.7z', '.rar', '.tgz', '.tbz2', '.txz'])
function getArchiveExt(name) {
  const lower = name.toLowerCase()
  for (const ext of ['.tar.gz', '.tar.bz2', '.tar.xz']) {
    if (lower.endsWith(ext)) return ext
  }
  for (const ext of ARCHIVE_EXTS) {
    if (lower.endsWith(ext)) return ext
  }
  return null
}
function isArchiveItem(item) { return !!getArchiveExt(item.name) }

// Bottom panel
const bottomPanel = ref('debug')
const bottomPanelActivities = [{ id: 'debug', icon: mdiBug, label: 'Debug' }]

// Icon registry for well-known right-panel activities
const PANEL_ACTIVITY_REGISTRY = {
  preview: { icon: mdiEye,         label: 'Preview' },
  details: { icon: mdiInformation, label: 'Details' },
  chat:    { icon: mdiMessage,      label: 'Chat'    },
}

const rightPanelActivities = computed({
  get: () => rightPanelActivityIds.value.map(id => ({
    id,
    icon:  PANEL_ACTIVITY_REGISTRY[id]?.icon,
    label: PANEL_ACTIVITY_REGISTRY[id]?.label ?? id,
  })),
  set: list => { rightPanelActivityIds.value = list.map(a => a.id) },
})

function reorderRightPanel({ activityId, targetId, before }) {
  const list = [...rightPanelActivities.value]
  const fromIdx = list.findIndex(a => a.id === activityId)
  const toIdx   = list.findIndex(a => a.id === targetId)
  if (fromIdx === -1 || toIdx === -1) return
  const [item] = list.splice(fromIdx, 1)
  const insertAt = list.findIndex(a => a.id === targetId)
  list.splice(before ? insertAt : insertAt + 1, 0, item)
  rightPanelActivities.value = list
}

function startResize(event, sizeRef, { axis = 'x', sign = 1, min = 60 } = {}) {
  event.preventDefault()
  const startPos = axis === 'x' ? event.clientX : event.clientY
  const startSize = sizeRef.value
  const onMove = (e) => {
    sizeRef.value = Math.max(min, startSize + ((axis === 'x' ? e.clientX : e.clientY) - startPos) * sign)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
  }
  document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

// Named handlers so refs aren't auto-unwrapped when passed through the template
const onResizeSidebar   = (e) => startResize(e, sidebarWidth,    { axis: 'x', sign:  1, min: 150 })
const onResizeRightpane = (e) => startResize(e, rightpaneWidth,  { axis: 'x', sign: -1, min: 200 })
const onResizeBottompane = (e) => startResize(e, bottompaneHeight, { axis: 'y', sign: -1, min:  60 })

function handleLayoutChange(layout) {
  prefs.explorer.layout = layout
  log('layout', 'Layout changed', layout)
}

function toggleActivity(name) {
  if (activeActivity.value === name && sidebarVisible.value) {
    sidebarVisible.value = false
  } else {
    activeActivity.value = name
    sidebarVisible.value = true
  }
}

// Selection state
const selectedPath = ref('')
const selectedItems = ref([])
const focusedItem = ref(null)
const selectedDetails = ref(null)

// Tab state — initialised from the active workspace
const directoryTabRef = ref(null)
const explorerPanelRef = ref(null)
const tabs       = ref(getInitialTabs())
const activeTabId = ref(getInitialActiveTabId() ?? tabs.value[0]?.id ?? 'home')
const activeTab  = computed(() => tabs.value.find(t => t.id === activeTabId.value))

// Persist tab changes to workspace.
// We track a lightweight signature so we never deep-watch large selectedItems arrays.
// Selected items are captured via their paths (cheap string join).
const _tabSignature = computed(() =>
  tabs.value.map(t =>
    `${t.id}:${t.kind}:${t.title}:${t.path ?? ''}:${t.mode ?? ''}:`
    + (t.selectedItems ?? []).map(i => i.path ?? i.name).join(',')
    + `:${t.focusedItem?.path ?? ''}`
  ).join('|') + '||' + activeTabId.value
)
watch(_tabSignature, () => saveTabs(tabs.value, activeTabId.value))

// Clear dir stats when navigating away from a dir tab
watch(activeTab, (tab) => {
  if (tab?.kind !== 'dir') dirStats.value = { count: 0, totalSize: 0 }
})

// Preferences
const { prefs, save: savePrefs } = usePreferences()

// Clipboard
const clipboard = ref({ mode: 'Copy', count: 0, items: [] })

// Context menu
const contextMenu = ref({ visible: false, x: 0, y: 0, items: [], quickActions: [] })

// Menu refs & state
const fileMenuButton = ref(null)
const editMenuButton = ref(null)
const viewMenuButton = ref(null)
const settingsButton = ref(null)
const fileMenuOpen = ref(false)
const editMenuOpen = ref(false)
const viewMenuOpen = ref(false)
const settingsMenuOpen = ref(false)
const fileMenuPos = ref({ x: 0, y: 0 })
const editMenuPos = ref({ x: 0, y: 0 })
const viewMenuPos = ref({ x: 0, y: 0 })
const settingsMenuPos = ref({ x: 0, y: 0 })

// Tab drag-and-drop
const {
  draggedItem: draggedTab,
  dragOverItem: dragOverTab,
  handleDragStart,
  handleDragEnd,
  handleDragOver,
  handleDragLeave,
  handleDrop: handleTabDrop
} = useDragAndDrop({
  onDragStart: (event) => event.target.classList.add('dragging'),
  onDragEnd: (event) => event.target.classList.remove('dragging'),
  onDrop: (event, dragged, target) => {
    const from = tabs.value.findIndex(t => t.id === dragged.id)
    const to = tabs.value.findIndex(t => t.id === target.id)
    if (from === -1 || to === -1) return
    const copy = [...tabs.value]
    const [moved] = copy.splice(from, 1)
    copy.splice(to, 0, moved)
    tabs.value = copy
  },
  dragLeaveSelector: '.tab'
})

// Menu items
const fileMenuItems = computed(() => [
  { key: 'newfolder', label: 'New Folder', action: createNewFolder }
])

const editMenuItems = computed(() => [
  { key: 'undo', label: `Undo${history.undoLabel.value ? ` "${history.undoLabel.value}"` : ''}`, action: doUndo, disabled: !history.canUndo.value },
  { key: 'redo', label: `Redo${history.redoLabel.value ? ` "${history.redoLabel.value}"` : ''}`, action: doRedo, disabled: !history.canRedo.value },
  { separator: true },
  { key: 'copy',  label: 'Copy',  action: () => copyToClipboard(selectedItems.value) },
  { key: 'cut',   label: 'Cut',   action: () => cutToClipboard(selectedItems.value)  },
  { key: 'paste', label: 'Paste', action: doPaste, disabled: clipboard.value.count === 0 },
  { separator: true },
  { key: 'preferences', label: 'Preferences', action: openPreferencesTab }
])

const viewMenuItems = computed(() => [
  { key: 'sidebar', label: 'Toggle Sidebar', action: () => { sidebarVisible.value = !sidebarVisible.value } },
  { key: 'alwaysShowCheckboxes', label: 'Always show checkboxes', type: 'toggle', checked: () => prefs.explorer.alwaysShowCheckboxes, action: () => { prefs.explorer.alwaysShowCheckboxes = !prefs.explorer.alwaysShowCheckboxes } },
  { separator: true },
  { key: 'preview', label: 'Preview Panel', type: 'toggle', checked: () => rightPanel.value === 'preview', action: () => { rightPanel.value = 'preview' } },
  { key: 'details', label: 'Details Panel', type: 'toggle', checked: () => rightPanel.value === 'details', action: () => { rightPanel.value = 'details' } }
])

const settingsMenuItems = computed(() => [
  { key: 'preferences', label: 'Preferences', action: openPreferencesTab }
])

function showMenuDelayed(type) {
  setTimeout(() => {
    const map = {
      file:     [fileMenuButton,     fileMenuPos,     fileMenuOpen],
      edit:     [editMenuButton,     editMenuPos,     editMenuOpen],
      view:     [viewMenuButton,     viewMenuPos,     viewMenuOpen],
      settings: [settingsButton,     settingsMenuPos, settingsMenuOpen]
    }
    const [btnRef, posRef, openRef] = map[type]
    const el = btnRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      if (type === 'settings') {
        posRef.value = { x: rect.right + 4, y: rect.top }
      } else {
        posRef.value = { x: rect.left, y: rect.bottom + 2 }
      }
    }
    openRef.value = true
  }, 50)
}

function runAction(item) {
  if (typeof item.action === 'function') item.action()
}

// Window controls
function windowMinimize() { window.electron?.window?.minimize?.() }
function windowToggleMaximize() { window.electron?.window?.toggleMaximize?.() }
function windowClose() { window.electron?.window?.close?.() }

function openCommandPalette() {
  status.value.left = 'Command palette not implemented yet'
  setTimeout(() => { status.value.left = 'Ready' }, 1200)
}

// Preferences
function openPreferencesTab() {
  const existing = tabs.value.find(t => t.kind === 'preferences')
  if (existing) { activeTabId.value = existing.id; return }
  const tab = { id: uuid(), kind: 'preferences', title: 'Preferences', selectedItems: [], focusedItem: null, selectedPath: '' }
  tabs.value.push(tab)
  nextTick(() => { activeTabId.value = tab.id })
}

function onPreferencesChanged() {
  const tab = tabs.value.find(t => t.kind === 'preferences')
  if (tab) tab.title = 'Preferences (unsaved)'
}

async function savePreferences(newPrefs) {
  try {
    await savePrefs(newPrefs)
  } catch {
    status.value.left = 'Failed to save preferences'
    setTimeout(() => { status.value.left = 'Ready' }, 2000)
    return
  }
  const tab = tabs.value.find(t => t.kind === 'preferences')
  if (tab) tab.title = 'Preferences'
  explorerPanelRef.value?.refresh()
  status.value.left = 'Preferences saved'
  setTimeout(() => { status.value.left = 'Ready' }, 2000)
}

onMounted(async () => {
  pingServer()
  _pingInterval = setInterval(pingServer, 10000)
  window.addEventListener('keydown', onKeyDown)
  // Load platform + archive capabilities in the background
  try {
    const init = await fetch('/_api/v2/app/init').then(r => r.json())
    platform.value = init.platform ?? 'linux'
  } catch { /* non-fatal */ }
  try { archiveCaps.value = await fsArchiveCapabilities() } catch { /* non-fatal */ }

  // Restore selection state from the active tab on startup
  const tab = activeTab.value
  if (tab?.kind === 'dir') {
    selectedItems.value  = tab.selectedItems ?? []
    focusedItem.value    = tab.focusedItem   ?? null
    selectedPath.value   = tab.selectedPath  ?? tab.path ?? ''
    if (selectedPath.value) {
      try { selectedDetails.value = await fsStat(selectedPath.value) } catch { selectedDetails.value = null }
    }
  }
})

onUnmounted(() => {
  clearInterval(_pingInterval)
  window.removeEventListener('keydown', onKeyDown)
})

async function createNewFolder() {
  const name = prompt('Enter folder name:')
  if (!name) return
  const dir = activeTab.value?.kind === 'dir' ? activeTab.value.path : '/'
  const sep = dir.includes('\\') ? '\\' : '/'
  try {
    await enqueue({ label: `Create folder "${name}"`, kind: 'create_dir', params: { path: dir + sep + name } })
    directoryTabRef.value?.refresh()
  } catch (e) {
    status.value.left = `Error: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2000)
  }
}

// Tab management
async function openPeekTabForDir(path) {
  const title = path.split(/[/\\]/).filter(Boolean).pop() || path
  const tab = { id: uuid(), kind: 'dir', mode: 'peek', title, path, selectedItems: [], focusedItem: null, selectedPath: '' }
  const existingPeekIdx = tabs.value.findIndex(t => t.kind === 'dir' && t.mode === 'peek')
  if (existingPeekIdx >= 0) tabs.value.splice(existingPeekIdx, 1, tab)
  else tabs.value.push(tab)
  await nextTick()
  activeTabId.value = tab.id
}

function handleTabClick(tab) {
  log('tab', 'Tab activated', tab.title)
  nextTick(() => {
    activeTabId.value = tab.id
    if (tab.kind === 'dir' && tab.mode === 'peek') tab.mode = 'pinned'
  })
}

function pinTab(tabId) {
  const t = tabs.value.find(x => x.id === tabId)
  if (t?.kind === 'dir' && t.mode === 'peek') t.mode = 'pinned'
}

function closeTab(tabId) {
  const idx = tabs.value.findIndex(t => t.id === tabId)
  if (idx === -1 || tabs.value.length === 1) return
  tabs.value.splice(idx, 1)
  if (activeTabId.value === tabId) nextTick(() => { activeTabId.value = tabs.value[Math.max(0, idx - 1)].id })
}

function flashTab(tabId) {
  const el = document.querySelector(`[data-tab-id="${tabId}"]`)
  if (!el) return
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 600)
}

// ── file operations ───────────────────────────────────────────────────────────

// Rename — receives { path: string, newName: string } from tree or directory view.
// { items } form (F2 on multi-select) is ignored for now — single rename only.
async function handleRename({ path, newName }) {
  if (!path || !newName) return
  const oldName = path.split(/[/\\]/).filter(Boolean).pop()
  if (newName === oldName) return
  const label = `Rename "${oldName}" → "${newName}"`

  // Compute expected new path for optimistic update
  const sep = path.includes('\\') ? '\\' : '/'
  const dir = path.slice(0, path.lastIndexOf(sep))
  const optimisticPath = dir + sep + newName

  // Apply immediately — user sees the change before the server responds
  directoryTabRef.value?.renameItem(path, newName, optimisticPath)
  updateSelectionAfterRename(path, newName, optimisticPath)

  try {
    const result = await enqueue({ label, kind: 'rename', params: { path, new_name: newName } })

    // If the server returned a slightly different path (e.g. case normalization), reconcile
    if (result.path !== optimisticPath) {
      const serverName = result.path.split(/[/\\]/).pop()
      directoryTabRef.value?.renameItem(optimisticPath, serverName, result.path)
      updateSelectionAfterRename(optimisticPath, serverName, result.path)
    }

    history.push({
      label,
      undo: () => enqueue({ label: `Undo ${label}`, kind: 'rename', params: { path: result.path, new_name: oldName } }),
      redo: () => enqueue({ label: `Redo ${label}`, kind: 'rename', params: { path, new_name: newName } }),
    })
    explorerPanelRef.value?.refresh()
  } catch (e) {
    // Roll back the optimistic update
    directoryTabRef.value?.renameItem(optimisticPath, oldName, path)
    updateSelectionAfterRename(optimisticPath, oldName, path)
    status.value.left = `Rename failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

function updateSelectionAfterRename(oldPath, newName, newPath) {
  selectedItems.value = selectedItems.value.map(item =>
    item.path === oldPath ? { ...item, name: newName, path: newPath } : item
  )
  if (focusedItem.value?.path === oldPath) {
    focusedItem.value = { ...focusedItem.value, name: newName, path: newPath }
  }
}

async function doTrash(items) {
  if (!items.length) return
  const paths = items.map(i => i.path)
  const label = items.length === 1 ? `Trash "${items[0].name}"` : `Trash ${items.length} items`
  try {
    const result = await enqueue({ label, kind: 'trash', params: { paths } })
    if (result?.requiresElevation) {
      showElevationPrompt({
        op: 'trash', paths: result.elevationPaths, method: result.elevationMethod,
        message: `Moving ${result.elevationPaths.length === 1 ? `"${result.elevationPaths[0].split(/[/\\]/).pop()}"` : `${result.elevationPaths.length} items`} to trash requires administrator permission.`,
        onConfirm: async (password) => {
          await enqueue({ label: label + ' (elevated)', kind: 'trash_elevated', params: { paths, password } })
          afterDelete()
        }
      })
      return
    }
    afterDelete()
  } catch (e) {
    status.value.left = `Trash failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doDelete(items) {
  if (!items.length) return
  const names = items.length === 1 ? `"${items[0].name}"` : `${items.length} items`
  if (!confirm(`Permanently delete ${names}? This cannot be undone.`)) return
  const paths = items.map(i => i.path)
  const label = `Permanently delete ${names}`
  try {
    const result = await enqueue({ label, kind: 'delete', params: { paths } })
    if (result?.requiresElevation) {
      showElevationPrompt({
        op: 'delete', paths: result.elevationPaths, method: result.elevationMethod,
        message: `Permanently deleting ${result.elevationPaths.length === 1 ? `"${result.elevationPaths[0].split(/[/\\]/).pop()}"` : `${result.elevationPaths.length} items`} requires administrator permission.`,
        onConfirm: async (password) => {
          await enqueue({ label: label + ' (elevated)', kind: 'delete_elevated', params: { paths, password } })
          afterDelete()
        }
      })
      return
    }
    afterDelete()
  } catch (e) {
    status.value.left = `Delete failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

function afterDelete() {
  directoryTabRef.value?.refresh()
  explorerPanelRef.value?.refresh()
  selectedItems.value = []
  focusedItem.value = null
}

// ── elevation dialog ──────────────────────────────────────────────────────────

function showElevationPrompt({ op, paths, method, message, onConfirm }) {
  elevationPassword.value = ''
  elevationError.value = ''
  elevationPrompt.value = { op, paths, method, message, onConfirm }
  nextTick(() => elevationPasswordRef.value?.focus())
}

function cancelElevation() {
  elevationPrompt.value = null
  elevationPassword.value = ''
  elevationError.value = ''
}

async function confirmElevation() {
  if (!elevationPrompt.value) return
  const { onConfirm, method } = elevationPrompt.value
  const password = method === 'sudo_password' ? elevationPassword.value : ''
  if (method === 'sudo_password' && !password) {
    elevationError.value = 'Please enter your password.'
    return
  }
  elevationError.value = ''
  try {
    await onConfirm(password)
    cancelElevation()
  } catch (e) {
    const msg = e?.message ?? String(e)
    if (msg.includes('incorrect password') || msg.includes('Incorrect password')) {
      elevationError.value = 'Incorrect password. Try again.'
      elevationPassword.value = ''
      nextTick(() => elevationPasswordRef.value?.focus())
    } else {
      status.value.left = `Elevated operation failed: ${msg}`
      setTimeout(() => { status.value.left = 'Ready' }, 3000)
      cancelElevation()
    }
  }
}

// ── archive operations ────────────────────────────────────────────────────────

async function doCompress(items, format) {
  if (!items.length) return
  const destDir = items[0].path.split(/[/\\]/).slice(0, -1).join('/')  || '/'
  const extMap = { zip: '.zip', tar: '.tar', 'tar.gz': '.tar.gz', '7z': '.7z' }
  const ext = extMap[format] ?? '.zip'
  const baseName = items.length === 1 ? items[0].name : 'Archive'
  const defaultName = baseName + ext
  const name = prompt(`Archive name:`, defaultName)
  if (!name) return
  const dest = destDir + '/' + name
  const paths = items.map(i => i.path)
  const label = `Compress to ${name}`
  try {
    await enqueue({ label, kind: 'compress', params: { paths, format, dest } })
    directoryTabRef.value?.refresh()
    log('ops-queue', 'Compressed', `${paths.length} item(s) → ${name}`)
  } catch (e) {
    status.value.left = `Compress failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doDecompress(item, toNewFolder = false) {
  if (!item) return
  const srcDir = item.path.split(/[/\\]/).slice(0, -1).join('/') || '/'
  let destDir = srcDir
  if (toNewFolder) {
    // Strip known archive extension(s) to make folder name
    let folderName = item.name
    for (const ext of ['.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.tbz2', '.txz', '.zip', '.7z', '.rar', '.tar', '.gz']) {
      if (folderName.toLowerCase().endsWith(ext)) { folderName = folderName.slice(0, -ext.length); break }
    }
    destDir = srcDir + '/' + folderName
  }
  const label = `Extract "${item.name}"`
  try {
    const result = await enqueue({ label, kind: 'decompress', params: { path: item.path, dest_dir: destDir } })
    if (result?.missingTool) {
      installPrompt.value = {
        tool: result.tool,
        message: `Extracting "${item.name}" requires ${result.tool}, which is not installed.`,
        installApt: result.installApt,
        installDnf: result.installDnf,
        installPac: result.installPac,
        installBrew: result.installBrew,
      }
      return
    }
    directoryTabRef.value?.refresh()
    log('ops-queue', 'Extracted', `"${item.name}" → ${destDir}`)
  } catch (e) {
    status.value.left = `Extract failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doPaste() {
  const cb = clipboard.value
  if (!cb.count) return
  const destDir = activeTab.value?.kind === 'dir' ? activeTab.value.path : null
  if (!destDir) return
  const paths = cb.items.map(i => i.path)
  const label = `${cb.mode} ${cb.count} item(s) into "${destDir.split(/[/\\]/).filter(Boolean).pop()}"`
  try {
    let result
    if (cb.mode === 'Cut') {
      result = await enqueue({ label, kind: 'move', params: { paths, dest_dir: destDir } })
      const movedPaths = result.moved.map(m => m.path)
      const oldPaths   = result.moved.map(m => m.old_path)
      const undoDestDir = oldPaths[0] ? oldPaths[0].split(/[/\\]/).slice(0, -1).join('/') : destDir
      history.push({
        label,
        undo: () => enqueue({ label: `Undo ${label}`, kind: 'move', params: { paths: movedPaths, dest_dir: undoDestDir } }),
        redo: () => enqueue({ label: `Redo ${label}`, kind: 'move', params: { paths: oldPaths, dest_dir: destDir } }),
      })
      clipboard.value = { mode: 'Copy', count: 0, items: [] }
    } else {
      result = await enqueue({ label, kind: 'copy', params: { paths, dest_dir: destDir } })
      const copiedPaths = result.copied.map(c => c.path)
      history.push({
        label,
        undo: () => enqueue({ label: `Undo ${label}`, kind: 'delete', params: { paths: copiedPaths } }),
        redo: () => enqueue({ label: `Redo ${label}`, kind: 'copy', params: { paths, dest_dir: destDir } }),
      })
    }
    directoryTabRef.value?.refresh()
  } catch (e) {
    status.value.left = `Paste failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doMove(items, destDir) {
  if (!items.length || !destDir) return
  const paths = items.map(i => i.path)
  const label = `Move ${items.length === 1 ? `"${items[0].name}"` : `${items.length} items`} → "${destDir.split(/[/\\]/).filter(Boolean).pop()}"`
  try {
    const result = await enqueue({ label, kind: 'move', params: { paths, dest_dir: destDir } })
    const movedPaths = result.moved.map(m => m.path)
    const srcDir = paths[0].split(/[/\\]/).slice(0, -1).join('/')
    history.push({
      label,
      undo: () => enqueue({ label: `Undo ${label}`, kind: 'move', params: { paths: movedPaths, dest_dir: srcDir } }),
      redo: () => enqueue({ label: `Redo ${label}`, kind: 'move', params: { paths, dest_dir: destDir } }),
    })
    directoryTabRef.value?.refresh()
    selectedItems.value = []
    focusedItem.value = null
  } catch (e) {
    status.value.left = `Move failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doUndo() {
  try { await history.undo(); directoryTabRef.value?.refresh() }
  catch (e) { status.value.left = `Undo failed: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2500) }
}

async function doRedo() {
  try { await history.redo(); directoryTabRef.value?.refresh() }
  catch (e) { status.value.left = `Redo failed: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2500) }
}

function onKeyDown(e) {
  // Skip when typing in an input, textarea, or contenteditable
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); doUndo(); return }
    if (e.key === 'y') { e.preventDefault(); doRedo(); return }
    if (e.key === 'c') { e.preventDefault(); copyToClipboard(selectedItems.value); return }
    if (e.key === 'x') { e.preventDefault(); cutToClipboard(selectedItems.value); return }
    if (e.key === 'v') { e.preventDefault(); doPaste(); return }
  }
  if (e.key === 'Delete') {
    e.preventDefault()
    if (e.shiftKey) doDelete(selectedItems.value)
    else doTrash(selectedItems.value)
  }
}

// Selection
async function handleExplorerSelect(payload) {
  const path = typeof payload === 'string' ? payload : payload?.path
  if (!path) return
  log('select', 'Explorer selected', path.split(/[/\\]/).filter(Boolean).pop() ?? path)
  selectedPath.value = path
  const kind = payload?.kind
  if (kind === 'directory' || kind === 'dir' || kind === 'drive' || kind === 'root') {
    selectedItems.value = []
    focusedItem.value = null
    const existing = tabs.value.find(t => t.path === path)
    if (existing) { activeTabId.value = existing.id; flashTab(existing.id) }
    else await openPeekTabForDir(path)
  }
  try { selectedDetails.value = await fsStat(path) } catch { selectedDetails.value = null }
}

async function handleSelectFromDirectory(payload) {
  if (payload && Array.isArray(payload.selectedItems)) {
    log('select', `${payload.selectedItems.length} item(s) selected`, payload.selectedItems.length === 1 ? payload.selectedItems[0]?.name : `${payload.selectedItems.length} items`)
  }
  if (payload?.mode === 'open' && payload?.item?.kind === 'file') {
    try {
      await fsOpenWithSystem(payload.item.path)
      status.value.left = `Opened ${payload.item.name}`
      setTimeout(() => { status.value.left = 'Ready' }, 1500)
    } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
    return
  }
  if (payload && Array.isArray(payload.selectedItems)) {
    selectedItems.value = payload.selectedItems
    focusedItem.value = payload.focusedItem ?? null
    const path = payload.focusedItem?.path ?? payload.selectedItems[0]?.path
    if (path) selectedPath.value = path
    if (activeTab.value) {
      activeTab.value.selectedItems = payload.selectedItems
      activeTab.value.focusedItem = payload.focusedItem ?? null
      activeTab.value.selectedPath = path ?? ''
    }
  }
  try { selectedDetails.value = selectedPath.value ? await fsStat(selectedPath.value) : null } catch { selectedDetails.value = null }
}

async function handleDoubleClick(payload) {
  // macOS .app bundles: launch with OS, don't navigate inside
  if (payload.kind === 'app') {
    try { await fsOpenWithSystem(payload.path) } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
    return
  }

  // Archive files: open as virtual directory
  if (payload.kind === 'archive' || (payload.kind === 'file' && isArchiveItem(payload))) {
    const virtualPath = payload.path + '::'
    const existing = tabs.value.find(t => t.path === virtualPath)
    if (existing) { activeTabId.value = existing.id; existing.mode = 'pinned'; return }
    const title = payload.name || payload.path.split(/[/\\]/).filter(Boolean).pop()
    const tab = { id: uuid(), kind: 'dir', mode: 'pinned', title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' }
    tabs.value.push(tab)
    await nextTick()
    activeTabId.value = tab.id
    return
  }

  if (payload.kind !== 'directory' && payload.kind !== 'dir' && payload.kind !== 'drive' && payload.kind !== 'root') return
  const existing = tabs.value.find(t => t.path === payload.path)
  if (existing) { activeTabId.value = existing.id; existing.mode = 'pinned'; return }
  const title = payload.path.split(/[/\\]/).filter(Boolean).pop() || payload.path
  const tab = { id: uuid(), kind: 'dir', mode: 'pinned', title, path: payload.path, selectedItems: [], focusedItem: null, selectedPath: '' }
  tabs.value.push(tab)
  await nextTick()
  activeTabId.value = tab.id
}

function navigateInCurrentTab(path) {
  const active = activeTab.value
  if (!active || active.kind !== 'dir') return
  log('nav', 'Navigate', path)
  active.path = path
  if (path.includes('::')) {
    const [archivePath, innerPath] = path.split('::')
    const innerSegs = innerPath.split('/').filter(Boolean)
    active.title = innerSegs.length > 0
      ? innerSegs[innerSegs.length - 1]
      : (archivePath.split(/[/\\]/).filter(Boolean).pop() || archivePath)
  } else {
    active.title = path.split(/[/\\]/).filter(Boolean).pop() || path
  }
  selectedPath.value = path
  selectedItems.value = []
  focusedItem.value = null
  active.selectedItems = []
  active.focusedItem = null
  active.selectedPath = path
}

async function handleOpenFromTab(item) {
  selectedPath.value = item.path
  selectedItems.value = [item]
  focusedItem.value = item
  if (item.kind !== 'file') return
  try {
    await fsOpenWithSystem(item.path)
    status.value.left = `Opened ${item.name}`
    setTimeout(() => { status.value.left = 'Ready' }, 1500)
  } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
}

// Clipboard
function copyToClipboard(items) {
  clipboard.value = { mode: 'Copy', count: items.length, items: [...items] }
  log('clipboard', 'Copy', `${items.length} item(s)`)
}
function cutToClipboard(items) {
  clipboard.value = { mode: 'Cut', count: items.length, items: [...items] }
  log('clipboard', 'Cut', `${items.length} item(s)`)
}

// Context menus
function hideContextMenu() { contextMenu.value.visible = false }

function showTabContextMenu(e, tab) {
  contextMenu.value = {
    visible: true, x: e.clientX, y: e.clientY, quickActions: [],
    items: [
      { key: 'close', label: 'Close', action: () => closeTab(tab.id) },
      { separator: true },
      { key: 'copypath', label: 'Copy Path', action: () => navigator.clipboard.writeText(tab.path ?? '') }
    ]
  }
}

function openArchiveInTab(item) {
  const virtualPath = item.path + '::'
  const existing = tabs.value.find(t => t.path === virtualPath)
  if (existing) { activeTabId.value = existing.id; return }
  const title = item.name || item.path.split(/[/\\]/).filter(Boolean).pop()
  const tab = { id: uuid(), kind: 'dir', mode: 'pinned', title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' }
  tabs.value.push(tab)
  nextTick(() => { activeTabId.value = tab.id })
}

function showItemContextMenu({ event, item }) {
  const targets = selectedItems.value.some(s => s.path === item.path)
    ? selectedItems.value
    : [item]

  // Detect if we're currently browsing inside an archive (read-only)
  const inArchive = activeTab.value?.path?.includes('::')

  // Build compress submenu from available capabilities
  const compressItems = []
  if (!inArchive) {
    compressItems.push({ key: 'compress-zip',   label: 'Compress to ZIP',    action: () => doCompress(targets, 'zip') })
    compressItems.push({ key: 'compress-targz', label: 'Compress to TAR.GZ', action: () => doCompress(targets, 'tar.gz') })
    if (archiveCaps.value?.seven_zip?.available) {
      compressItems.push({ key: 'compress-7z', label: 'Compress to 7Z', action: () => doCompress(targets, '7z') })
    }
  }

  // Single-item checks
  const singleItem = targets.length === 1 ? targets[0] : null
  const isArchive = singleItem?.kind === 'archive' || (singleItem?.kind === 'file' && isArchiveItem(singleItem))
  const isApp = singleItem?.kind === 'app'

  contextMenu.value = {
    visible: true, x: event.clientX, y: event.clientY,
    quickActions: inArchive ? [] : [
      { key: 'copy',   icon: '📋', label: 'Copy',   action: () => copyToClipboard(targets) },
      { key: 'cut',    icon: '✂️', label: 'Cut',    action: () => cutToClipboard(targets)  },
      { key: 'rename', icon: '✏️', label: 'Rename', action: () => directoryTabRef.value?.$el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })) },
      { key: 'delete', icon: '🗑️', label: 'Delete', action: () => doTrash(targets) },
      { key: 'info',   icon: 'ℹ️', label: 'Info',   action: () => {} }
    ],
    items: [
      { key: 'open', label: isApp ? 'Open Application' : 'Open', action: () => handleOpenFromTab(item) },
      ...(isArchive || isApp ? [
        { separator: true },
        { key: 'view-contents', label: 'Browse Contents', action: () => openArchiveInTab(singleItem) },
      ] : []),
      ...(isArchive && !inArchive ? [
        { key: 'extract-here',   label: 'Extract Here',       action: () => doDecompress(singleItem, false) },
        { key: 'extract-folder', label: 'Extract to Folder…', action: () => doDecompress(singleItem, true)  },
      ] : []),
      ...(!inArchive ? [
        { separator: true },
        { key: 'copy',  label: 'Copy',  action: () => copyToClipboard(targets) },
        { key: 'cut',   label: 'Cut',   action: () => cutToClipboard(targets)  },
        { key: 'paste', label: 'Paste', action: doPaste, disabled: clipboard.value.count === 0 },
        { separator: true },
        ...compressItems,
        { separator: true },
        { key: 'rename', label: 'Rename',             action: () => directoryTabRef.value?.$el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true })) },
        { key: 'trash',  label: 'Move to Trash',      action: () => doTrash(targets) },
        { key: 'delete', label: 'Delete Permanently', action: () => doDelete(targets) },
      ] : []),
    ]
  }
}
</script>

<style scoped>
/* Shell grid */
.vscode-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: var(--titlebar-height) 1fr var(--statusbar-height);
  overflow: hidden;
  background: var(--bg);
  color: var(--text);
}

/* Titlebar */
.titlebar {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 600px) 1fr;
  align-items: center;
  padding: 0 10px;
  background: #2a2a2a;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}
.titlebar .left  { display: flex; gap: 8px; align-items: center; min-width: 0; }
.titlebar .center { justify-self: stretch; display: flex; justify-content: center; }
.titlebar .right  { justify-self: end; display: flex; }

.titlebar-menu-btn { font-size: 12px; color: var(--text-muted); padding: 2px 6px; border-radius: 3px; }
.titlebar-menu-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }

.omnibar {
  width: min(600px, 60vw);
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #1f1f1f;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.omnibar:hover { border-color: var(--accent); }

.no-drag { -webkit-app-region: no-drag; }

.winbtn {
  width: 46px;
  height: var(--titlebar-height);
  display: grid;
  place-items: center;
  font-size: 16px;
  color: var(--text-muted);
}
.winbtn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.winbtn.close:hover { background: #c42b1c; color: white; }

/* Main area */
.main { display: flex; min-height: 0; overflow: hidden; }

/* Activity bar */
.activitybar {
  width: var(--activitybar-width);
  flex-shrink: 0;
  background: #333333;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 6px 0;
}
.activitybar-top, .activitybar-bottom { display: flex; flex-direction: column; }
.activitybar-icon {
  width: 100%;
  height: 44px;
  display: grid;
  place-items: center;
  color: rgba(255,255,255,0.4);
  text-decoration: none;
  transition: color 0.1s;
}
.activitybar-icon:hover { color: rgba(255,255,255,0.8); }
.activitybar-icon.active {
  color: white;
  border-left: 2px solid var(--accent);
  background: rgba(255,255,255,0.04);
}

/* Workbench content: sidebar + editor */
.workbench-content { display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }

/* Sidebar */
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

/* Editor column (editor area + bottom panel) */
.editor-column { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* Editor area */
.editor-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* Bottom panel */
.bottompane {
  flex-shrink: 0;
  min-height: 60px;
  background: var(--panel);
  border-top: 1px solid var(--border);
  overflow: hidden;
}
.bp-action-btn {
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
.bp-action-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

/* Resize handles */
.resize-handle { flex-shrink: 0; background: transparent; transition: background 0.15s; z-index: 10; --resize-handle-size: 2px; }
.resize-handle:hover, .resize-handle:active { background: var(--accent); opacity: 0.4; }
.resize-handle--col { width: var(--resize-handle-size); cursor: col-resize; }
.resize-handle--row { height: var(--resize-handle-size); cursor: row-resize; }

/* Tabs */
.tabs {
  height: 35px;
  min-height: 35px;
  display: flex;
  align-items: stretch;
  background: #252526;
  border-bottom: 1px solid var(--border);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: thin;
  flex-shrink: 0;
}
.tabs::-webkit-scrollbar { height: 3px; }

.tab {
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
}
.tab:hover { background: rgba(255,255,255,0.05); }
.tab.active {
  background: #1e1e1e;
  color: var(--text);
  border-top-color: var(--accent);
  border-bottom: 1px solid #1e1e1e;
}
.tab.peek .tab-label { font-style: italic; }
.tab.dragging { opacity: 0.5; }
.tab.drag-over { border-left: 2px solid var(--accent); }

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
}
.tab:hover .tab-close, .tab.active .tab-close { opacity: 1; }
.tab-close:hover { background: rgba(255,255,255,0.1); color: var(--text); }

.centerpane { flex: 1; min-height: 0; overflow: auto; background: var(--editor-background); }

.rightpane {
  flex-shrink: 0;
  min-width: 200px;
  border-left: 1px solid var(--border);
  background: var(--panel-2);
  overflow: hidden;
}


/* Status bar */
.statusbar {
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  gap: 8px;
}
.spacer { flex: 1; }
.status-left { display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
.status-bar-item { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 6px; border-radius: 3px; }
.status-bar-item:hover { background: rgba(255,255,255,0.12); }
.status-connection { display: flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; opacity: 0.85; }
.status-connection.disconnected { opacity: 1; color: #ffcdd2; }
.connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a5d6a7;
  flex-shrink: 0;
}
.status-connection.disconnected .connection-dot { background: #ef9a9a; }

/* Toast */
.toast {
  position: fixed;
  bottom: calc(var(--statusbar-height) + 12px);
  right: 12px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  padding: 10px 12px;
  border-radius: 6px;
  width: 280px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.35);
  font-size: 12px;
  z-index: 1000;
}

/* Modal dialogs (elevation + install prompt) */
.modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.55);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.modal-dialog {
  background: var(--panel-2, #252526);
  border: 1px solid var(--border, #454545);
  border-radius: 8px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 24px 64px rgba(0,0,0,0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.modal-title {
  font-size: 13px;
  font-weight: 600;
  padding: 14px 16px 10px;
  border-bottom: 1px solid var(--border, #454545);
}
.modal-body {
  padding: 14px 16px;
  font-size: 12px;
  color: var(--text, #ccc);
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.modal-body p { margin: 0; line-height: 1.5; }
.modal-paths {
  background: var(--bg, #1e1e1e);
  border: 1px solid var(--border, #454545);
  border-radius: 4px;
  padding: 6px 8px;
  font-family: monospace;
  font-size: 11px;
  white-space: pre;
  max-height: 120px;
  overflow-y: auto;
  color: var(--text-muted, #888);
}
.modal-label { font-size: 11px; color: var(--text-muted, #888); margin-bottom: -4px; }
.modal-input {
  background: var(--bg, #1e1e1e);
  border: 1px solid var(--border, #454545);
  border-radius: 4px;
  padding: 7px 10px;
  color: var(--text, #ccc);
  font-size: 13px;
  outline: none;
  width: 100%;
  box-sizing: border-box;
}
.modal-input:focus { border-color: var(--accent, #0078d4); }
.modal-hint { color: var(--text-muted, #888); font-size: 12px; }
.modal-error { color: #f48771; font-size: 12px; }
.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 16px 14px;
  border-top: 1px solid var(--border, #454545);
}
.modal-btn {
  background: var(--surface, #3c3c3c);
  border: 1px solid var(--border, #454545);
  color: var(--text, #ccc);
  border-radius: 4px;
  padding: 5px 14px;
  font-size: 12px;
  cursor: pointer;
}
.modal-btn:hover { background: var(--surface-hover, #4c4c4c); }
.modal-btn--primary {
  background: var(--accent, #0078d4);
  border-color: var(--accent, #0078d4);
  color: #fff;
}
.modal-btn--primary:hover { background: var(--accent-hover, #1c8be4); border-color: var(--accent-hover, #1c8be4); }

/* Install prompt */
.install-cmds { display: flex; flex-direction: column; gap: 6px; }
.install-cmd {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--bg, #1e1e1e);
  border: 1px solid var(--border, #454545);
  border-radius: 4px;
  padding: 5px 8px;
}
.install-cmd-label {
  font-size: 10px;
  font-weight: 600;
  color: var(--text-muted, #888);
  min-width: 44px;
  text-transform: uppercase;
}
.install-cmd code {
  font-family: monospace;
  font-size: 11px;
  color: var(--text, #ccc);
  user-select: text;
}
</style>
