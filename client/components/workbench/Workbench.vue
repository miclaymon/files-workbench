<template>
  <div class="vscode-shell">

    <!-- Titlebar -->
    <div class="titlebar">
      <div class="left">
        <strong style="font-size: 13px;">Files</strong>
        <button ref="fileMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('file')">File</button>
        <button ref="editMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('edit')">Edit</button>
        <button ref="viewMenuButton" class="no-drag titlebar-menu-btn" @click.stop="showMenuDelayed('view')">View</button>

        <FloatingMenu :visible="fileMenuOpen" type="menu" :items="fileMenuItems" :x="fileMenuPos.x" :y="fileMenuPos.y" @close="fileMenuOpen = false" />
        <FloatingMenu :visible="editMenuOpen" type="menu" :items="editMenuItems" :x="editMenuPos.x" :y="editMenuPos.y" @close="editMenuOpen = false" />
        <FloatingMenu :visible="viewMenuOpen" type="menu" :items="viewMenuItems" :x="viewMenuPos.x" :y="viewMenuPos.y" @close="viewMenuOpen = false" />
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
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activePrimaryView === 'explorer' }" title="Explorer" @click="toggleActivity('explorer')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiSegment" /></svg>
          </a>
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activePrimaryView === 'search' }" title="Search" @click="toggleActivity('search')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiMagnify" /></svg>
          </a>
          <a href="javascript:void(0)" class="activitybar-icon" :class="{ active: activePrimaryView === 'storage' }" title="Storage" @click="toggleActivity('storage')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiHarddisk" /></svg>
          </a>
        </div>
        <div class="activitybar-bottom">
          <a ref="settingsButton" href="javascript:void(0)" class="activitybar-icon" title="Settings" @click.stop="showMenuDelayed('settings')">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiCog" /></svg>
          </a>
        </div>
        <FloatingMenu :visible="settingsMenuOpen" type="menu" :items="settingsMenuItems" :x="settingsMenuPos.x" :y="settingsMenuPos.y" @close="settingsMenuOpen = false" />
      </div>

      <!-- Sidebar + Editor split -->
      <div class="workbench-content" :class="{ 'left-maximized': leftPaneMaximized, 'right-maximized': rightPaneMaximized }">

        <!-- Sidebar -->
        <div v-if="sidebarVisible" class="sidebar" :style="{ width: sidebarWidth + 'px' }">
          <ViewContainer
            v-if="activePrimaryView === 'explorer'"
            containerId="primarySidebar"
            :activities="primarySidebarActivities"
            v-model="activePrimaryView"
            :sections="explorerSections"
            @update:sections="sections => { explorerSections = sections }"
            @transfer="handleActivityTransfer"
          >
            <template #openEditors>
              <OpenEditorsView
                :editorRoot="editorRoot"
                :activeGroupId="activeGroupId"
              />
            </template>
            <template #places>
              <ExplorerPanel
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
            </template>
          </ViewContainer>
          <div v-else-if="activePrimaryView === 'search'" class="sidebar-placeholder">
            Search panel coming soon…
          </div>
        </div>
        <div v-if="sidebarVisible" class="resize-handle resize-handle--col" @mousedown="onResizeSidebar" />

        <!-- Editor column (editor + bottom panel) -->
        <div class="editor-column" :class="{ 'bottom-maximized': bottomPaneMaximized }">

          <!-- Editor area: recursive grid of editor groups -->
          <div class="editor-area">
            <GridView :node="viewRoot">
              <template #leaf="{ node }">
                <EditorGroup
                  :ref="el => registerGroup(node.id, el)"
                  :group="node"
                  :isActive="node.id === activeGroupId"
                  :isMaximized="node.id === maximizedGroupId"
                  :prefs="prefs"
                  :excludedCategories="prefs.excludedCategories"
                  @select="handleSelectFromDirectory"
                  @open="handleOpenFromTab"
                  @navigate="navigateInCurrentTab"
                  @contextmenu="showItemContextMenu"
                  @background-contextmenu="showBackgroundContextMenu"
                  @right-drag-drop="showRightDragDropMenu"
                  @rename="handleRename"
                  @stats="onGroupStats"
                  @update:layout="handleLayoutChange"
                  @preferences-save="savePreferences"
                  @preferences-change="onPreferencesChanged"
                  @tab-contextmenu="handleTabContextMenu"
                />
              </template>
            </GridView>
          </div>

          <!-- Bottom panel resize handle + panel -->
          <div v-show="bottompaneVisible" class="resize-handle resize-handle--row" @mousedown="onResizeBottompane" />
          <div v-show="bottompaneVisible" class="bottompane" :style="{ height: bottompaneHeight + 'px' }">
            <ViewContainer
              containerId="panel"
              :activities="bottomPanelActivities"
              v-model="bottomPanel"
              :mergedSlots="bottomPanelMerges"
              dropDirection="row"
              @update:mergedSlots="slots => { bottomPanelMerges = slots }"
              @transfer="handleActivityTransfer"
              @merge="handleActivityMerge"
              @unmerge="handleActivityUnmerge"
            >
              <template #preview>
                <PreviewPanel :selectedItems="selectedItems" :editorFontSize="prefs.preview?.editorFontSize ?? 13" />
              </template>
              <template #details>
                <DetailsPanel :selectedPath="selectedPath" :details="selectedDetails" />
              </template>
              <template #chat>
                <div style="padding: 12px; color: var(--text-muted); font-size: 13px;">
                  Chat panel coming soon.
                </div>
              </template>
              <template #debug-actions>
                <button class="panel-action-btn" @click="debugLog.clear()" title="Clear">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
                </button>
              </template>
              <template #debug>
                <DebugPanel />
              </template>
              <template #panel-actions>
                <button class="panel-action-btn" :title="bottomPaneMaximized ? 'Restore Panel' : 'Maximize Panel'" @click="toggleBottomPaneMaximize">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="bottomPaneMaximized ? mdiArrowCollapse : mdiArrowExpand" /></svg>
                </button>
                <button class="panel-action-btn" title="Hide Panel" @click="bottompaneVisible = false">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
                </button>
              </template>
            </ViewContainer>
          </div>

        </div>

        <!-- Right pane -->
        <div v-show="rightpaneVisible" class="resize-handle resize-handle--col" @mousedown="onResizeRightpane" />
        <div v-show="rightpaneVisible" class="rightpane" :style="{ width: rightpaneWidth + 'px' }">
          <ViewContainer
            containerId="secondarySidebar"
            :activities="rightPanelActivities"
            v-model="rightPanel"
            :mergedSlots="rightPanelMerges"
            @update:mergedSlots="slots => { rightPanelMerges = slots }"
            @transfer="handleActivityTransfer"
            @merge="handleActivityMerge"
            @unmerge="handleActivityUnmerge"
          >
            <template #preview>
              <PreviewPanel :selectedItems="selectedItems" :editorFontSize="prefs.preview?.editorFontSize ?? 13" />
            </template>
            <template #details>
              <DetailsPanel :selectedPath="selectedPath" :details="selectedDetails" />
            </template>
            <template #chat>
              <div style="padding: 12px; color: var(--text-muted); font-size: 13px;">
                Chat panel coming soon.
              </div>
            </template>
            <template #debug-actions>
              <button class="panel-action-btn" @click="debugLog.clear()" title="Clear">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
              </button>
            </template>
            <template #debug>
              <DebugPanel />
            </template>
            <template #panel-actions>
              <button class="panel-action-btn" :title="rightPaneMaximized ? 'Restore Secondary Side Bar' : 'Maximize Secondary Side Bar'" @click="toggleRightPaneMaximize">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="rightPaneMaximized ? mdiArrowCollapse : mdiArrowExpand" /></svg>
              </button>
              <button class="panel-action-btn" title="Hide Secondary Side Bar" @click="rightpaneVisible = false">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
              </button>
            </template>
          </ViewContainer>
        </div>

      </div>
    </div>

    <!-- Status bar -->
    <div v-show="statusbarVisible" class="statusbar">
      <div class="status-left">
        <template v-if="activeTab?.kind === 'dir'">
          <div class="status-bar-item">Directory: {{ formatCount(dirStats.count) }} item{{ dirStats.count === 1 ? '' : 's' }} | {{ formatBytes(dirStats.totalSize) }}</div>
          <div v-if="selectedItems.length > 0" class="status-bar-item">Selected: {{ formatCount(selectedItems.length) }} item{{ selectedItems.length === 1 ? '' : 's' }} | {{ formatBytes(selectedItems.reduce((s, i) => s + (i.size ?? 0), 0)) }}</div>
          <div v-if="clipboard.count > 0" class="status-bar-item status-bar-item--clipboard">{{ clipboard.mode }}: {{ formatCount(clipboard.count) }} item{{ clipboard.count === 1 ? '' : 's' }} | {{ formatBytes(clipboard.items.reduce((s, i) => s + (i.size ?? 0), 0)) }}</div>
        </template>
        <div v-else-if="status.left" class="status-bar-item">{{ status.left }}</div>
      </div>
      <span class="spacer"></span>
      <span class="status-connection" :class="{ disconnected: !serverConnected }">
        <span class="connection-dot" />{{ statusRight }}
      </span>
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

    <!-- Command palette -->
    <CommandPalette
      :visible="commandPaletteOpen"
      :commands="allCommands"
      @close="commandPaletteOpen = false"
    />

  </div>
</template>

<script setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { mdiHarddisk, mdiSegment, mdiMagnify, mdiMessage, mdiCog, mdiEye, mdiInformation, mdiBug,
         mdiContentCopy, mdiContentCut, mdiPencilOutline, mdiTrashCanOutline, mdiInformationOutline,
         mdiFileTree, mdiClose, mdiArrowExpand, mdiArrowCollapse } from '@mdi/js'
import { createLeaf, findLeaf, firstLeaf, collectLeaves, leafCount, insertLeafBeside, removeLeaf, applyPreset } from '~/composables/useLayoutGrid.js'
import { useWorkspaces, uuidv4 } from '~/composables/useWorkspaces.js'
import ViewContainer from './ViewContainer.vue'
import OpenEditorsView from './OpenEditorsView.vue'
import CommandPalette from './CommandPalette.vue'
import { usePreferences } from '~/composables/usePreferences.js'
import { useDebugLog } from '~/composables/useDebugLog.js'
import { useFileOpsQueue } from '~/composables/useFileOpsQueue.js'
import { useActionHistory } from '~/composables/useActionHistory.js'
import { fsStat, fsOpenWithSystem, fsOpenTerminal, fsArchiveCapabilities } from '~/lib/fs-api.js'

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
  sidebarVisible, sidebarWidth, activePrimaryView,
  rightpaneVisible, rightpaneWidth, rightPanel, rightPanelActivityIds,
  secondarySidebarMergeGroups,
  bottompaneVisible, bottompaneHeight,
  bottomPanel, bottomPanelActivityIds,
  hiddenActivities,
  panelMergeGroups,
  explorerContext, updateExplorerContext,
  getSectionState, saveSectionState,
  getInitialEditor, saveEditor,
} = useWorkspaces()

// Primary sidebar view container definitions
const primarySidebarActivities = [{ id: 'explorer', icon: mdiFileTree, label: 'Explorer' }]

// Explorer sidebar sections (Open Editors + Places accordion)
const explorerSections = ref(getSectionState('explorer'))
const _expSecSig = computed(() =>
  explorerSections.value.map(s => `${s.id}:${s.collapsed ? 1 : 0}:${Math.round(s.size * 100)}`).join('|')
)
watch(_expSecSig, () => saveSectionState('explorer', explorerSections.value))

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

// Appearance / visibility state (local, not persisted)
const statusbarVisible    = ref(true)
const zenMode             = ref(false)
const centeredLayout      = ref(false)

// Maximize state (local, not persisted)
const rightPaneMaximized  = ref(false)
const leftPaneMaximized   = ref(false)
const bottomPaneMaximized = ref(false)

function toggleRightPaneMaximize()  { rightPaneMaximized.value  = !rightPaneMaximized.value  }
function toggleLeftPaneMaximize() {
  leftPaneMaximized.value = !leftPaneMaximized.value
  if (leftPaneMaximized.value) sidebarVisible.value = true
}
function toggleBottomPaneMaximize() { bottomPaneMaximized.value = !bottomPaneMaximized.value }

// Icon registry for well-known panel activities
const PANEL_ACTIVITY_REGISTRY = {
  preview: { icon: mdiEye,         label: 'Preview' },
  details: { icon: mdiInformation, label: 'Details' },
  chat:    { icon: mdiMessage,      label: 'Chat'    },
  debug:   { icon: mdiBug,          label: 'Debug'   },
}

// Bottom panel
const bottomPanelActivities = computed(() =>
  bottomPanelActivityIds.value.map(id => ({
    id,
    icon:  PANEL_ACTIVITY_REGISTRY[id]?.icon,
    label: PANEL_ACTIVITY_REGISTRY[id]?.label ?? id,
  }))
)

const rightPanelActivities = computed({
  get: () => rightPanelActivityIds.value.map(id => ({
    id,
    icon:  PANEL_ACTIVITY_REGISTRY[id]?.icon,
    label: PANEL_ACTIVITY_REGISTRY[id]?.label ?? id,
  })),
  set: list => { rightPanelActivityIds.value = list.map(a => a.id) },
})

// ── Merge state: which tab slots hold multiple stacked views ──────────────────
// Initialised from workspace; persisted via signature watches below.
const rightPanelMerges = ref(secondarySidebarMergeGroups.value)
const bottomPanelMerges = ref(panelMergeGroups.value)
const _rightMergeSig = computed(() => JSON.stringify(rightPanelMerges.value))
watch(_rightMergeSig, () => { secondarySidebarMergeGroups.value = rightPanelMerges.value })
const _botMergeSig = computed(() => JSON.stringify(bottomPanelMerges.value))
watch(_botMergeSig, () => { panelMergeGroups.value = bottomPanelMerges.value })

// Default container for each known activity (used when restoring a lost activity)
const ACTIVITY_DEFAULT_CONTAINER = {
  preview: 'secondarySidebar',
  details: 'secondarySidebar',
  chat:    'secondarySidebar',
  debug:   'panel',
}

// Returns true if the activity is visible in any container or merge group.
function isActivityVisible(id) {
  if (rightPanelActivityIds.value.includes(id)) return true
  if (bottomPanelActivityIds.value.includes(id)) return true
  const inMerges = (merges) => Object.values(merges).some(g => g.some(sv => sv.id === id))
  return inMerges(rightPanelMerges.value) || inMerges(bottomPanelMerges.value)
}

// Adds a missing activity back to its default container and makes it visible.
function addActivity(id) {
  if (isActivityVisible(id)) return
  hiddenActivities.value = hiddenActivities.value.filter(h => h !== id)
  const cid = ACTIVITY_DEFAULT_CONTAINER[id] ?? 'secondarySidebar'
  if (cid === 'panel') {
    bottomPanelActivityIds.value = [...bottomPanelActivityIds.value, id]
    bottomPanel.value = id
    bottompaneVisible.value = true
  } else {
    rightPanelActivityIds.value = [...rightPanelActivityIds.value, id]
    rightPanel.value = id
    rightpaneVisible.value = true
  }
}

// On startup: restore any known activities that got lost (e.g. from an un-persisted merge).
// Skips activities the user has intentionally hidden via the Views menu.
function recoverMissingActivities() {
  for (const id of Object.keys(PANEL_ACTIVITY_REGISTRY)) {
    if (!isActivityVisible(id) && !hiddenActivities.value.includes(id)) addActivity(id)
  }
}

// ── Container helpers ─────────────────────────────────────────────────────────

const MOVABLE_CONTAINERS = new Set(['secondarySidebar', 'panel'])

function getContainerIds(cid) {
  if (cid === 'secondarySidebar') return [...rightPanelActivityIds.value]
  if (cid === 'panel')            return [...bottomPanelActivityIds.value]
  return []
}
function setContainerIds(cid, ids) {
  if (cid === 'secondarySidebar') rightPanelActivityIds.value = ids
  if (cid === 'panel')            bottomPanelActivityIds.value = ids
}
function getContainerMerges(cid) {
  if (cid === 'secondarySidebar') return rightPanelMerges.value
  if (cid === 'panel')            return bottomPanelMerges.value
  return {}
}
function setContainerMerges(cid, merges) {
  if (cid === 'secondarySidebar') rightPanelMerges.value = merges
  if (cid === 'panel')            bottomPanelMerges.value = merges
}
function getActiveTab(cid) {
  if (cid === 'secondarySidebar') return rightPanel.value
  if (cid === 'panel')            return bottomPanel.value
  return ''
}
function setActiveTab(cid, id) {
  if (cid === 'secondarySidebar') rightPanel.value = id
  if (cid === 'panel')            bottomPanel.value = id
}

// ── Transfer: tab drag-to-reorder and cross-container ────────────────────────

function handleActivityTransfer({ fromContainerId, toContainerId, activityId, toIndex }) {
  if (!MOVABLE_CONTAINERS.has(fromContainerId) || !MOVABLE_CONTAINERS.has(toContainerId)) return

  if (fromContainerId === toContainerId) {
    // Reorder within the same container
    const list = getContainerIds(fromContainerId)
    const fromIdx = list.indexOf(activityId)
    if (fromIdx < 0) return
    list.splice(fromIdx, 1)
    const adjustedIdx = toIndex > fromIdx ? toIndex - 1 : toIndex
    list.splice(adjustedIdx, 0, activityId)
    setContainerIds(fromContainerId, list)
    // Merge group travels with the tab (already keyed by activityId, nothing to move)
  } else {
    // Cross-container: remove from source, insert in target
    const srcList = getContainerIds(fromContainerId).filter(id => id !== activityId)
    const dstList = getContainerIds(toContainerId)
    dstList.splice(toIndex, 0, activityId)
    setContainerIds(fromContainerId, srcList)
    setContainerIds(toContainerId, dstList)

    // If this activity was the primary of a merge group, move the group too
    const fromMerges = getContainerMerges(fromContainerId)
    if (fromMerges[activityId]) {
      const { [activityId]: group, ...restFromMerges } = fromMerges
      setContainerMerges(fromContainerId, restFromMerges)
      setContainerMerges(toContainerId, { ...getContainerMerges(toContainerId), [activityId]: group })
    }

    // Update active tabs
    if (getActiveTab(fromContainerId) === activityId) setActiveTab(fromContainerId, srcList[0] ?? '')
    setActiveTab(toContainerId, activityId)
  }
}

// ── Merge: drop on content area → stack as sections inside target tab slot ────

function handleActivityMerge({ toContainerId, toActivityId, fromContainerId, activityId, zone }) {
  if (!MOVABLE_CONTAINERS.has(fromContainerId)) return
  if (!MOVABLE_CONTAINERS.has(toContainerId)) return
  if (activityId === toActivityId && fromContainerId === toContainerId) return

  // Remove activityId from source container's tab list
  const srcList = getContainerIds(fromContainerId).filter(id => id !== activityId)
  setContainerIds(fromContainerId, srcList)

  // Add to target activity's merge group
  const toMerges = getContainerMerges(toContainerId)
  const existing = toMerges[toActivityId] ?? [
    { id: toActivityId, title: PANEL_ACTIVITY_REGISTRY[toActivityId]?.label ?? toActivityId, collapsed: false, size: 1 },
  ]
  const newEntry = { id: activityId, title: PANEL_ACTIVITY_REGISTRY[activityId]?.label ?? activityId, collapsed: false, size: 1 }
  const newGroup = zone === 'before' ? [newEntry, ...existing] : [...existing, newEntry]
  setContainerMerges(toContainerId, { ...toMerges, [toActivityId]: newGroup })

  // Update active tabs
  if (getActiveTab(fromContainerId) === activityId) setActiveTab(fromContainerId, srcList[0] ?? '')
  setActiveTab(toContainerId, toActivityId)
}

// ── Unmerge: section header dragged back to tab bar ───────────────────────────

function handleActivityUnmerge({ fromActivityId, fromContainerId, extractId, toContainerId, toIndex }) {
  if (!MOVABLE_CONTAINERS.has(fromContainerId)) return

  // Remove from the merge group
  const fromMerges = getContainerMerges(fromContainerId)
  const currentGroup = fromMerges[fromActivityId] ?? []
  const newGroup = currentGroup.filter(sv => sv.id !== extractId)

  if (newGroup.length <= 1) {
    // Only one view left → dissolve the merge group entirely
    const { [fromActivityId]: _, ...rest } = fromMerges
    setContainerMerges(fromContainerId, rest)
  } else {
    setContainerMerges(fromContainerId, { ...fromMerges, [fromActivityId]: newGroup })
  }

  // Insert extracted activity as a standalone tab
  const targetCid = MOVABLE_CONTAINERS.has(toContainerId) ? toContainerId : fromContainerId
  const dstList = getContainerIds(targetCid)
  dstList.splice(toIndex, 0, extractId)
  setContainerIds(targetCid, dstList)
  setActiveTab(targetCid, extractId)
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
  if (activePrimaryView.value === name && sidebarVisible.value) {
    sidebarVisible.value = false
  } else {
    activePrimaryView.value = name
    sidebarVisible.value = true
  }
}

// Selection state
const selectedPath = ref('')
const selectedItems = ref([])
const focusedItem = ref(null)
const selectedDetails = ref(null)

// Editor model — a recursive grid of editor groups (see useLayoutGrid.js).
const explorerPanelRef = ref(null)
const _initialEditor = getInitialEditor()
const editorRoot    = ref(_initialEditor.root)
const activeGroupId = ref(_initialEditor.activeGroupId ?? firstLeaf(_initialEditor.root)?.id ?? null)

const maximizedGroupId = ref(null)
// When a group is maximized, show only that leaf (GridView handles a leaf root fine).
const viewRoot = computed(() =>
  maximizedGroupId.value ? (findLeaf(editorRoot.value, maximizedGroupId.value) ?? editorRoot.value) : editorRoot.value
)

const activeGroup = computed(() => findLeaf(editorRoot.value, activeGroupId.value) ?? firstLeaf(editorRoot.value))
const activeTabs  = computed(() => activeGroup.value?.tabs ?? [])
const activeTab   = computed(() => activeTabs.value.find(t => t.id === activeGroup.value?.activeTabId) ?? activeTabs.value[0] ?? null)

// EditorGroup component instances, keyed by group id, for imperative refresh/rename.
const groupRefs = {}
function registerGroup(id, el) { if (el) groupRefs[id] = el; else delete groupRefs[id] }
function activeGroupEl() { return groupRefs[activeGroupId.value] }
function forEachGroup(fn) { Object.values(groupRefs).forEach(r => { try { fn(r) } catch {} }) }
function refreshAllDirs() { forEachGroup(r => r?.refresh?.()) }

// Persist the editor grid. A cheap signature avoids deep-watching big selection arrays.
function gridSignature(node) {
  if (!node) return ''
  if (node.type === 'leaf') {
    return 'L' + node.id + '#' + node.activeTabId
      + ':tp' + (node.tabPreviews !== false ? 1 : 0)
      + ':lk' + (node.locked ? 1 : 0)
      + '[' + node.tabs.map(t =>
        `${t.id}:${t.kind}:${t.title}:${t.path ?? ''}:${t.mode}:${t.pinned ? 1 : 0}:`
        + (t.selectedItems ?? []).map(i => i.path ?? i.name).join(',')
        + `:${t.focusedItem?.path ?? ''}`
      ).join('|') + ']'
  }
  return 'B' + node.direction + '(' + node.sizes.map(s => Math.round(s * 100) / 100).join(',') + ')'
    + node.children.map(gridSignature).join('~')
}
const _editorSignature = computed(() => gridSignature(editorRoot.value) + '||' + activeGroupId.value)
watch(_editorSignature, () => saveEditor(editorRoot.value, activeGroupId.value))

// Restore per-tab selection when the active group/tab changes; reset dir stats off-dir.
watch(activeTab, async (tab) => {
  if (tab?.kind === 'dir') {
    selectedItems.value = tab.selectedItems ?? []
    focusedItem.value   = tab.focusedItem ?? null
    selectedPath.value  = tab.selectedPath ?? tab.path ?? ''
  } else {
    dirStats.value = { count: 0, totalSize: 0 }
    selectedItems.value = []
    focusedItem.value   = null
    selectedPath.value  = ''
  }
  selectedDetails.value = null
  if (selectedPath.value) { try { selectedDetails.value = await fsStat(selectedPath.value) } catch { selectedDetails.value = null } }
})

// ── Editor grid controller (provided to EditorGroup children) ─────────────────

function reorderForPin(g) {
  const pinned = g.tabs.filter(t => t.pinned)
  const rest   = g.tabs.filter(t => !t.pinned)
  g.tabs.splice(0, g.tabs.length, ...pinned, ...rest)
}

function removeTabFrom(leaf, tabId) {
  const i = leaf.tabs.findIndex(t => t.id === tabId)
  if (i < 0) return
  leaf.tabs.splice(i, 1)
  if (leaf.activeTabId === tabId) leaf.activeTabId = leaf.tabs[Math.max(0, i - 1)]?.id ?? leaf.tabs[0]?.id ?? null
}

function cleanupEmpty(groupId) {
  const g = findLeaf(editorRoot.value, groupId)
  if (g && g.tabs.length === 0 && leafCount(editorRoot.value) > 1) {
    editorRoot.value = removeLeaf(editorRoot.value, groupId)
    if (!findLeaf(editorRoot.value, activeGroupId.value)) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
  }
}

function closeTabImpl(groupId, tabId) {
  const g = findLeaf(editorRoot.value, groupId)
  if (!g) return
  const idx = g.tabs.findIndex(t => t.id === tabId)
  if (idx === -1) return
  if (g.tabs.length === 1) {
    if (leafCount(editorRoot.value) === 1) return          // always keep one group + tab
    editorRoot.value = removeLeaf(editorRoot.value, groupId)
    if (activeGroupId.value === groupId) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
    return
  }
  g.tabs.splice(idx, 1)
  if (g.activeTabId === tabId) g.activeTabId = g.tabs[Math.max(0, idx - 1)]?.id ?? null
}

function dropTabImpl({ sourceGroupId, tabId, targetGroupId, region, side, beforeTabId }) {
  const source = findLeaf(editorRoot.value, sourceGroupId)
  const target = findLeaf(editorRoot.value, targetGroupId)
  if (!source || !target) return
  const tab = source.tabs.find(t => t.id === tabId)
  if (!tab) return

  if (region === 'center') {
    if (sourceGroupId === targetGroupId) {
      const from = source.tabs.findIndex(t => t.id === tabId)
      source.tabs.splice(from, 1)
      let to = beforeTabId ? source.tabs.findIndex(t => t.id === beforeTabId) : source.tabs.length
      if (to < 0) to = source.tabs.length
      source.tabs.splice(to, 0, tab)
    } else {
      removeTabFrom(source, tabId)
      let to = beforeTabId ? target.tabs.findIndex(t => t.id === beforeTabId) : target.tabs.length
      if (to < 0) to = target.tabs.length
      target.tabs.splice(to, 0, tab)
    }
    target.activeTabId = tab.id
    activeGroupId.value = targetGroupId
    if (sourceGroupId !== targetGroupId) cleanupEmpty(sourceGroupId)
    return
  }

  // edge → new group beside the target on `side`
  if (sourceGroupId === targetGroupId && source.tabs.length === 1) return  // no-op split of a lone tab
  removeTabFrom(source, tabId)
  const newLeaf = createLeaf({ tabs: [tab], activeTabId: tab.id })
  editorRoot.value = insertLeafBeside(editorRoot.value, targetGroupId, side, newLeaf)
  activeGroupId.value = newLeaf.id
  cleanupEmpty(sourceGroupId)
}

function splitActiveGroupImpl(side) {
  const g = activeGroup.value
  if (!g) return
  const src = g.tabs.find(t => t.id === g.activeTabId) ?? g.tabs[0]
  const clone = src
    ? { ...src, id: uuid(), mode: 'normal', pinned: false, selectedItems: [...(src.selectedItems ?? [])] }
    : { id: uuid(), kind: 'home', title: 'Home', mode: 'normal', pinned: false, selectedItems: [], focusedItem: null, selectedPath: '', path: '' }
  const newLeaf = createLeaf({ tabs: [clone], activeTabId: clone.id })
  editorRoot.value = insertLeafBeside(editorRoot.value, g.id, side, newLeaf)
  activeGroupId.value = newLeaf.id
  log('editor-layout', `Split ${side}`, { tab: src?.title ?? '(home)', side })
}

function splitWithTab(groupId, tabId, side) {
  const g = findLeaf(editorRoot.value, groupId)
  const src = g?.tabs.find(t => t.id === tabId)
  if (!src) return
  const clone = { ...src, id: uuid(), mode: 'normal', pinned: false, selectedItems: [...(src.selectedItems ?? [])] }
  const newLeaf = createLeaf({ tabs: [clone], activeTabId: clone.id })
  editorRoot.value = insertLeafBeside(editorRoot.value, groupId, side, newLeaf)
  activeGroupId.value = newLeaf.id
}

function closeOtherTabs(groupId, keepId) {
  const g = findLeaf(editorRoot.value, groupId)
  const keep = g?.tabs.find(t => t.id === keepId)
  if (!keep) return
  g.tabs.splice(0, g.tabs.length, keep)
  g.activeTabId = keepId
}

function applyLayoutPreset(name) {
  editorRoot.value = applyPreset(editorRoot.value, name)
  if (!findLeaf(editorRoot.value, activeGroupId.value)) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
  maximizedGroupId.value = null
  log('editor-layout', `Applied layout: ${name}`, { preset: name })
}

const editorController = {
  setActiveGroup(groupId) { if (findLeaf(editorRoot.value, groupId)) activeGroupId.value = groupId },
  activateTab(groupId, tabId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    activeGroupId.value = groupId
    g.activeTabId = tabId
    const t = g.tabs.find(x => x.id === tabId)
    if (t) log('tab', 'Tab activated', { title: t.title, path: t.path ?? null, kind: t.kind })
  },
  promoteTab(groupId, tabId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    const t = g.tabs.find(x => x.id === tabId)
    if (t && t.mode === 'peek') t.mode = 'normal'
    activeGroupId.value = groupId
    g.activeTabId = tabId
  },
  togglePin(groupId, tabId) {
    const g = findLeaf(editorRoot.value, groupId)
    const t = g?.tabs.find(x => x.id === tabId)
    if (!t) return
    t.pinned = !t.pinned
    if (t.pinned) t.mode = 'normal'
    reorderForPin(g)
  },
  closeTab: closeTabImpl,
  dropTab: dropTabImpl,
  splitActiveGroup: splitActiveGroupImpl,
  applyLayoutPreset,
  closeAllTabs(groupId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g || g.tabs.length === 0) return
    if (leafCount(editorRoot.value) > 1) {
      editorRoot.value = removeLeaf(editorRoot.value, groupId)
      if (activeGroupId.value === groupId || !findLeaf(editorRoot.value, activeGroupId.value)) {
        activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
      }
    } else {
      const first = g.tabs[0]
      g.tabs.splice(0, g.tabs.length, first)
      g.activeTabId = first.id
    }
    log('editor-layout', 'Closed all tabs in group', { groupId })
  },
  toggleTabPreviews(groupId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    g.tabPreviews = g.tabPreviews === false ? true : false
    log('editor-layout', `Tab previews ${g.tabPreviews ? 'enabled' : 'disabled'}`, { groupId })
  },
  maximizeGroup(groupId) {
    const wasMaximized = maximizedGroupId.value === groupId
    maximizedGroupId.value = wasMaximized ? null : groupId
    log('editor-layout', wasMaximized ? 'Restored group' : 'Maximized group', { groupId })
  },
  toggleLockGroup(groupId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    g.locked = !g.locked
    log('editor-layout', `Group ${g.locked ? 'locked' : 'unlocked'}`, { groupId })
  },
}
provide('editorController', editorController)

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

// Menu items
const fileMenuItems = computed(() => [
  { key: 'newfolder', label: 'New Folder', action: createNewFolder },
  { key: 'newfile',   label: 'New File',   action: createNewFile   }
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
  { key: 'appearance', label: 'Appearance', submenu: [
    { key: 'fullscreen',     label: 'Full Screen',     type: 'toggle',
      checked: () => !!document.fullscreenElement,
      action:  () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() } },
    { key: 'zenMode',        label: 'Zen Mode',        type: 'toggle', checked: () => zenMode.value,        action: () => { zenMode.value        = !zenMode.value        } },
    { key: 'centeredLayout', label: 'Centered Layout', type: 'toggle', checked: () => centeredLayout.value, action: () => { centeredLayout.value = !centeredLayout.value } },
    { separator: true },
    { key: 'menuBar',          label: 'Menu Bar',           type: 'toggle', checked: () => true,                      disabled: true },
    { key: 'primarySidebar',   label: 'Primary Side Bar',   type: 'toggle', checked: () => sidebarVisible.value,   action: () => { sidebarVisible.value   = !sidebarVisible.value   } },
    { key: 'secondarySidebar', label: 'Secondary Side Bar', type: 'toggle', checked: () => rightpaneVisible.value, action: () => { rightpaneVisible.value = !rightpaneVisible.value } },
    { key: 'statusBar',        label: 'Status Bar',         type: 'toggle', checked: () => statusbarVisible.value, action: () => { statusbarVisible.value = !statusbarVisible.value } },
    { key: 'panel',            label: 'Panel',              type: 'toggle', checked: () => bottompaneVisible.value, action: () => { bottompaneVisible.value = !bottompaneVisible.value } },
    { separator: true },
    { key: 'moveSidebar',      label: 'Move Primary Side Bar Right', disabled: true },
    { key: 'activityBarPos',   label: 'Activity Bar Position', submenu: [
      { key: 'activityDefault', label: 'Default', disabled: true },
      { key: 'activityTop',     label: 'Top',     disabled: true },
      { key: 'activityBottom',  label: 'Bottom',  disabled: true },
      { key: 'activityHidden',  label: 'Hidden',  disabled: true },
    ]},
    { key: 'panelPos',         label: 'Panel Position', submenu: [
      { key: 'panelBottom', label: 'Bottom', disabled: true },
      { key: 'panelTop',    label: 'Top',    disabled: true },
      { key: 'panelLeft',   label: 'Left',   disabled: true },
      { key: 'panelRight',  label: 'Right',  disabled: true },
    ]},
    { key: 'editorActionsPos', label: 'Editor Actions Position', submenu: [
      { key: 'editorActionsTitleBar', label: 'Title Bar', disabled: true },
      { key: 'editorActionsHidden',   label: 'Hidden',    disabled: true },
    ]},
    { key: 'tabBar', label: 'Tab Bar', submenu: [
      { key: 'tabBarShow', label: 'Show', disabled: true },
      { key: 'tabBarHide', label: 'Hide', disabled: true },
    ]},
    { separator: true },
    { key: 'wordWrap', label: 'Word Wrap', type: 'toggle', checked: () => false, disabled: true },
  ]},
  { key: 'editorLayout', label: 'Editor Layout', submenu: [
    { key: 'splitUp',    label: 'Split Up',    action: () => editorController.splitActiveGroup('top') },
    { key: 'splitDown',  label: 'Split Down',  action: () => editorController.splitActiveGroup('bottom') },
    { key: 'splitLeft',  label: 'Split Left',  action: () => editorController.splitActiveGroup('left') },
    { key: 'splitRight', label: 'Split Right', action: () => editorController.splitActiveGroup('right') },
    { separator: true },
    { key: 'single',       label: 'Single',         action: () => editorController.applyLayoutPreset('single') },
    { key: 'twoColumns',   label: 'Two Columns',    action: () => editorController.applyLayoutPreset('twoColumns') },
    { key: 'twoRows',      label: 'Two Rows',       action: () => editorController.applyLayoutPreset('twoRows') },
    { key: 'threeColumns', label: 'Three Columns',  action: () => editorController.applyLayoutPreset('threeColumns') },
    { key: 'grid',         label: 'Grid (2×2)',     action: () => editorController.applyLayoutPreset('grid') },
    { separator: true },
    { key: 'moveNewWindow', label: 'Move Editor into New Window', disabled: true },
    { key: 'copyNewWindow', label: 'Copy Editor into New Window', disabled: true },
  ] },
  { key: 'alwaysShowCheckboxes', label: 'Always show checkboxes', type: 'toggle', checked: () => prefs.explorer.alwaysShowCheckboxes, action: () => { prefs.explorer.alwaysShowCheckboxes = !prefs.explorer.alwaysShowCheckboxes } },
  { separator: true },
  { key: 'views', label: 'Views', submenu:
    Object.entries(PANEL_ACTIVITY_REGISTRY).map(([id, meta]) => ({
      key:     `view-${id}`,
      label:   meta.label,
      type:    'toggle',
      checked: () => isActivityVisible(id),
      action:  () => {
        if (isActivityVisible(id)) {
          // remove from wherever it currently lives and mark as intentionally hidden
          rightPanelActivityIds.value  = rightPanelActivityIds.value.filter(a => a !== id)
          bottomPanelActivityIds.value = bottomPanelActivityIds.value.filter(a => a !== id)
          const stripId = (merges) => {
            const out = {}
            for (const [k, arr] of Object.entries(merges)) out[k] = arr.filter(sv => sv.id !== id)
            return out
          }
          rightPanelMerges.value  = stripId(rightPanelMerges.value)
          bottomPanelMerges.value = stripId(bottomPanelMerges.value)
          hiddenActivities.value  = [...hiddenActivities.value.filter(h => h !== id), id]
        } else {
          addActivity(id)
        }
      },
    }))
  },
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

// Window controls
function windowMinimize() { window.electron?.window?.minimize?.() }
function windowToggleMaximize() { window.electron?.window?.toggleMaximize?.() }
function windowClose() { window.electron?.window?.close?.() }

// ── Command palette ───────────────────────────────────────────────────────────

const commandPaletteOpen = ref(false)

function flattenMenuItems(items, category = '') {
  const out = []
  for (const item of items) {
    if (item.separator || item.type === 'separator') continue
    const path = category
      ? (item.submenu ? `${category} > ${item.label}` : category)
      : (item.submenu ? item.label : '')
    if (item.submenu) {
      out.push(...flattenMenuItems(item.submenu, path))
    } else if (item.action && !item.disabled) {
      out.push({
        key:       item.key ?? item.label,
        label:     item.label,
        category:  path,
        action:    item.action,
        checkable: item.type === 'toggle',
        checked:   item.type === 'toggle' ? !!(item.checked?.()) : false,
      })
    }
  }
  return out
}

const allCommands = computed(() => [
  ...flattenMenuItems(fileMenuItems.value,     'File'),
  ...flattenMenuItems(editMenuItems.value,     'Edit'),
  ...flattenMenuItems(viewMenuItems.value,     'View'),
  ...flattenMenuItems(settingsMenuItems.value, 'Settings'),
])

function openCommandPalette() { commandPaletteOpen.value = true }

// Preferences
function openPreferencesTab() {
  const found = findTabByKind('preferences')
  if (found) { focusTab(found.groupId, found.tab.id); return }
  addTabToActiveGroup({ id: uuid(), kind: 'preferences', title: 'Preferences', mode: 'normal', pinned: false, selectedItems: [], focusedItem: null, selectedPath: '' })
}

function onPreferencesChanged() {
  const found = findTabByKind('preferences')
  if (found) found.tab.title = 'Preferences (unsaved)'
}

async function savePreferences(newPrefs) {
  try {
    await savePrefs(newPrefs)
  } catch {
    status.value.left = 'Failed to save preferences'
    setTimeout(() => { status.value.left = 'Ready' }, 2000)
    return
  }
  const found = findTabByKind('preferences')
  if (found) found.tab.title = 'Preferences'
  explorerPanelRef.value?.refresh()
  status.value.left = 'Preferences saved'
  setTimeout(() => { status.value.left = 'Ready' }, 2000)
}

function onSashResizeEnd() {
  log('editor-layout', 'Resized editor groups', {})
}

onMounted(async () => {
  recoverMissingActivities()
  pingServer()
  _pingInterval = setInterval(pingServer, 10000)
  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('editor:sash-resize-end', onSashResizeEnd)
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
  window.removeEventListener('editor:sash-resize-end', onSashResizeEnd)
})

async function createNewFolder() {
  const name = prompt('Enter folder name:')
  if (!name) return
  const dir = activeTab.value?.kind === 'dir' ? activeTab.value.path : '/'
  const sep = dir.includes('\\') ? '\\' : '/'
  try {
    await enqueue({ label: `Create folder "${name}"`, kind: 'create_dir', params: { path: dir + sep + name } })
    refreshAllDirs()
  } catch (e) {
    status.value.left = `Error: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2000)
  }
}

async function createNewFile() {
  const name = prompt('Enter file name:')
  if (!name) return
  const dir = activeTab.value?.kind === 'dir' ? activeTab.value.path : '/'
  const sep = dir.includes('\\') ? '\\' : '/'
  try {
    await enqueue({ label: `Create file "${name}"`, kind: 'create_file', params: { path: dir + sep + name } })
    refreshAllDirs()
  } catch (e) {
    status.value.left = `Error: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2000)
  }
}

// ── Tab helpers (operate on the editor grid) ──────────────────────────────────

function findTabByPath(path) {
  for (const leaf of collectLeaves(editorRoot.value)) {
    const tab = leaf.tabs.find(t => t.path === path)
    if (tab) return { groupId: leaf.id, tab }
  }
  return null
}

function findTabByKind(kind) {
  for (const leaf of collectLeaves(editorRoot.value)) {
    const tab = leaf.tabs.find(t => t.kind === kind)
    if (tab) return { groupId: leaf.id, tab }
  }
  return null
}

function focusTab(groupId, tabId) {
  const g = findLeaf(editorRoot.value, groupId)
  if (!g) return
  activeGroupId.value = groupId
  g.activeTabId = tabId
}

async function addTabToActiveGroup(tab, { activate = true } = {}) {
  const g = activeGroup.value
  if (!g || g.locked) return
  g.tabs.push(tab)
  if (activate) { await nextTick(); g.activeTabId = tab.id }
}

async function openPeekTabForDir(path) {
  const g = activeGroup.value
  if (!g || g.locked) return
  const title = path.split(/[/\\]/).filter(Boolean).pop() || path
  const usePeek = g.tabPreviews !== false
  const tab = { id: uuid(), kind: 'dir', mode: usePeek ? 'peek' : 'normal', pinned: false, title, path, selectedItems: [], focusedItem: null, selectedPath: '' }
  if (usePeek) {
    const peekIdx = g.tabs.findIndex(t => t.kind === 'dir' && t.mode === 'peek')
    if (peekIdx >= 0) g.tabs.splice(peekIdx, 1, tab)
    else g.tabs.push(tab)
  } else {
    g.tabs.push(tab)
  }
  await nextTick()
  g.activeTabId = tab.id
}

function flashTab(tabId) {
  const el = document.querySelector(`[data-tab-id="${tabId}"]`)
  if (!el) return
  el.classList.add('flash')
  setTimeout(() => el.classList.remove('flash'), 600)
}

function onGroupStats({ groupId, stats }) {
  if (groupId === activeGroupId.value) dirStats.value = stats
}

function triggerInlineRename() {
  const el = activeGroupEl()?.getDirectoryTab?.()?.$el
  el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
}

function handleTabContextMenu({ event, tab, groupId }) {
  contextMenu.value = {
    visible: true, x: event.clientX, y: event.clientY, quickActions: [],
    items: [
      { key: 'close',       label: 'Close',        action: () => editorController.closeTab(groupId, tab.id) },
      { key: 'closeOthers', label: 'Close Others', action: () => closeOtherTabs(groupId, tab.id) },
      { separator: true },
      { key: 'pin', label: tab.pinned ? 'Unpin' : 'Pin', action: () => editorController.togglePin(groupId, tab.id) },
      { separator: true },
      { key: 'splitRight', label: 'Split Right', action: () => splitWithTab(groupId, tab.id, 'right') },
      { key: 'splitDown',  label: 'Split Down',  action: () => splitWithTab(groupId, tab.id, 'bottom') },
      { separator: true },
      { key: 'copypath', label: 'Copy Path', action: () => navigator.clipboard.writeText(tab.path ?? ''), disabled: !tab.path },
    ],
  }
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
  forEachGroup(r => r.renameItem?.(path, newName, optimisticPath))
  updateSelectionAfterRename(path, newName, optimisticPath)

  try {
    const result = await enqueue({ label, kind: 'rename', params: { path, new_name: newName } })

    // If the server returned a slightly different path (e.g. case normalization), reconcile
    if (result.path !== optimisticPath) {
      const serverName = result.path.split(/[/\\]/).pop()
      forEachGroup(r => r.renameItem?.(optimisticPath, serverName, result.path))
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
    forEachGroup(r => r.renameItem?.(optimisticPath, oldName, path))
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
  refreshAllDirs()
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
    refreshAllDirs()
    log('ops-queue', 'Compressed', { dest, format, count: paths.length, sources: paths })
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
    refreshAllDirs()
    log('ops-queue', 'Extracted', { source: item.path, dest: destDir, toNewFolder })
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
    const destName = destDir.split(/[/\\]/).filter(Boolean).pop() || destDir
    log('clipboard', `Paste (${cb.mode}) → ${destName}`, {
      _type: 'item-table',
      items: cb.items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
    })
    refreshAllDirs()
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
    refreshAllDirs()
    selectedItems.value = []
    focusedItem.value = null
  } catch (e) {
    status.value.left = `Move failed: ${e?.message ?? e}`
    setTimeout(() => { status.value.left = 'Ready' }, 2500)
  }
}

async function doUndo() {
  try { await history.undo(); refreshAllDirs() }
  catch (e) { status.value.left = `Undo failed: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2500) }
}

async function doRedo() {
  try { await history.redo(); refreshAllDirs() }
  catch (e) { status.value.left = `Redo failed: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2500) }
}

function focusGroupByIndex(i) {
  const leaf = collectLeaves(editorRoot.value)[i]
  if (leaf) editorController.setActiveGroup(leaf.id)
}

function onKeyDown(e) {
  // Command palette shortcut fires even from inputs
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
    e.preventDefault(); openCommandPalette(); return
  }

  // Skip other shortcuts when typing in an input, textarea, or contenteditable
  const tag = e.target?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

  if (e.ctrlKey || e.metaKey) {
    if (e.key === 'z') { e.preventDefault(); doUndo(); return }
    if (e.key === 'y') { e.preventDefault(); doRedo(); return }
    if (e.key === 'c') { e.preventDefault(); copyToClipboard(selectedItems.value); return }
    if (e.key === 'x') { e.preventDefault(); cutToClipboard(selectedItems.value); return }
    if (e.key === 'v') { e.preventDefault(); doPaste(); return }
    if (e.key === '\\') { e.preventDefault(); editorController.splitActiveGroup('right'); return }
    if ((e.key === 'w' || e.key === 'W') && activeTab.value) { e.preventDefault(); editorController.closeTab(activeGroupId.value, activeTab.value.id); return }
    if (e.key >= '1' && e.key <= '9') { e.preventDefault(); focusGroupByIndex(Number(e.key) - 1); return }
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
  log('select', 'Explorer selected', { path, name: path.split(/[/\\]/).filter(Boolean).pop() ?? path })
  selectedPath.value = path
  const kind = payload?.kind
  if (kind === 'directory' || kind === 'dir' || kind === 'drive' || kind === 'root') {
    selectedItems.value = []
    focusedItem.value = null
    const existing = findTabByPath(path)
    if (existing) { focusTab(existing.groupId, existing.tab.id); flashTab(existing.tab.id) }
    else await openPeekTabForDir(path)
  }
  try { selectedDetails.value = await fsStat(path) } catch { selectedDetails.value = null }
}

async function handleSelectFromDirectory(payload) {
  if (payload?.selectedItems?.length > 0) {
    const count     = payload.selectedItems.length
    const totalSize = payload.selectedItems.reduce((s, i) => s + (i.size ?? 0), 0)
    log('select', `${count} item${count === 1 ? '' : 's'} | ${formatBytes(totalSize)}`, {
      _type: 'item-table',
      items: payload.selectedItems.map(i => ({
        name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null,
      })),
    })
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
    const existing = findTabByPath(virtualPath)
    if (existing) { focusTab(existing.groupId, existing.tab.id); existing.tab.mode = 'normal'; return }
    const title = payload.name || payload.path.split(/[/\\]/).filter(Boolean).pop()
    await addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' })
    return
  }

  if (payload.kind !== 'directory' && payload.kind !== 'dir' && payload.kind !== 'drive' && payload.kind !== 'root') return
  const existing = findTabByPath(payload.path)
  if (existing) { focusTab(existing.groupId, existing.tab.id); existing.tab.mode = 'normal'; return }
  const title = payload.path.split(/[/\\]/).filter(Boolean).pop() || payload.path
  await addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: payload.path, selectedItems: [], focusedItem: null, selectedPath: '' })
}

function navigateInCurrentTab(path) {
  const active = activeTab.value
  if (!active || active.kind !== 'dir') return
  if (active.mode === 'peek') active.mode = 'normal'
  log('nav', 'Navigate', { from: active.path, to: path })
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
  log('clipboard', `Copy  ${items.length} item${items.length === 1 ? '' : 's'}`, {
    _type: 'item-table',
    items: items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
  })
}
function cutToClipboard(items) {
  clipboard.value = { mode: 'Cut', count: items.length, items: [...items] }
  log('clipboard', `Cut  ${items.length} item${items.length === 1 ? '' : 's'}`, {
    _type: 'item-table',
    items: items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
  })
}

// Context menus
function hideContextMenu() { contextMenu.value.visible = false }

function openArchiveInTab(item) {
  const virtualPath = item.path + '::'
  const existing = findTabByPath(virtualPath)
  if (existing) { focusTab(existing.groupId, existing.tab.id); return }
  const title = item.name || item.path.split(/[/\\]/).filter(Boolean).pop()
  addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' })
}

function showBackgroundContextMenu(event) {
  const inArchive = activeTab.value?.path?.includes('::')
  const curDir = activeTab.value?.kind === 'dir' ? activeTab.value.path : null

  contextMenu.value = {
    visible: true, x: event.clientX, y: event.clientY, quickActions: [],
    items: inArchive ? [] : [
      { key: 'newfolder', label: 'New Folder', action: createNewFolder },
      { key: 'newfile',   label: 'New File',   action: createNewFile   },
      ...(curDir ? [{ key: 'terminal', label: 'Open in Terminal', action: () => fsOpenTerminal(curDir) }] : []),
      { separator: true },
      { key: 'paste', label: 'Paste', action: doPaste, disabled: clipboard.value.count === 0 },
    ],
  }
}

function showRightDragDropMenu({ items, dropPath, x, y }) {
  if (!items?.length) return

  // Determine effective destination: dropped dir item or current tab dir
  const destDir = (() => {
    if (dropPath) {
      const hit = items.find(i => i.path === dropPath)
      if (!hit || hit.kind === 'dir') return dropPath
    }
    return activeTab.value?.kind === 'dir' ? activeTab.value.path : null
  })()

  if (!destDir) return

  const label = destDir.split(/[/\\]/).filter(Boolean).pop() || destDir
  const allArchives = items.every(i => i.kind === 'archive' || isArchiveItem(i))

  contextMenu.value = {
    visible: true, x, y, quickActions: [],
    items: [
      { key: 'move-here', label: `Move Here "${label}"`, action: () => doMove(items, destDir) },
      { key: 'copy-here', label: `Copy Here "${label}"`, action: () => {
        const paths = items.map(i => i.path)
        enqueue({ label: `Copy ${items.length} item(s) to "${label}"`, kind: 'copy', params: { paths, dest_dir: destDir } })
          .then(() => refreshAllDirs())
          .catch(e => { status.value.left = `Error: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2000) })
      }},
      { key: 'link-here', label: 'Create Symlink Here', disabled: true },
      { separator: true },
      ...(allArchives
        ? [{ key: 'extract-here', label: 'Extract Here', action: () => { for (const arch of items) doDecompress(arch, false) } }]
        : [{ key: 'compress-here', label: 'Compress to Archive Here', action: () => doCompress(items, 'zip') }]
      ),
      { separator: true },
      { key: 'cancel', label: 'Cancel', action: () => {} },
    ],
  }
}

function showItemContextMenu({ event, item }) {
  const targets = selectedItems.value.some(s => s.path === item.path)
    ? selectedItems.value
    : [item]

  const inArchive = activeTab.value?.path?.includes('::')
  const isShift   = event.shiftKey

  const singleItem = targets.length === 1 ? targets[0] : null
  const isArchive  = singleItem?.kind === 'archive' || (singleItem?.kind === 'file' && isArchiveItem(singleItem))
  const isApp      = singleItem?.kind === 'app'
  const isDir      = singleItem?.kind === 'dir'
  const multi      = targets.length > 1

  // ── Quick action buttons (SVG icons) ──────────────────────────────────────
  const quickActions = inArchive ? [] : [
    { key: 'copy',   icon: mdiContentCopy,    label: 'Copy',   action: () => copyToClipboard(targets) },
    { key: 'cut',    icon: mdiContentCut,     label: 'Cut',    action: () => cutToClipboard(targets)  },
    { key: 'rename', icon: mdiPencilOutline,   label: 'Rename', action: () => triggerInlineRename() },
    { key: 'trash',  icon: mdiTrashCanOutline, label: isShift ? 'Delete Permanently' : 'Move to Trash', action: () => isShift ? doDelete(targets) : doTrash(targets) },
    ...(!multi ? [{ key: 'info', icon: mdiInformationOutline, label: 'Info', action: () => {} }] : []),
  ]

  // ── Compress submenu ──────────────────────────────────────────────────────
  const compressSubmenu = inArchive ? [] : [
    { key: 'c-zip',   label: 'ZIP',    action: () => doCompress(targets, 'zip') },
    { key: 'c-targz', label: 'TAR.GZ', action: () => doCompress(targets, 'tar.gz') },
    ...(archiveCaps.value?.seven_zip?.available ? [{ key: 'c-7z', label: '7-Zip', action: () => doCompress(targets, '7z') }] : []),
  ]

  // ── "Copy path" submenu ───────────────────────────────────────────────────
  const copyPathAction = () => navigator.clipboard.writeText(item.path)

  // ── Open With submenu ─────────────────────────────────────────────────────
  const openWithSubmenu = [
    { key: 'open-default', label: 'Default Application', action: () => fsOpenWithSystem(item.path) },
  ]

  // ── Extract submenu (archives only) ──────────────────────────────────────
  const extractSubmenu = isArchive && !inArchive ? [
    { key: 'extract-here',   label: 'Extract Here',         action: () => doDecompress(singleItem, false) },
    { key: 'extract-folder', label: 'Extract to Folder…',   action: () => doDecompress(singleItem, true)  },
  ] : []

  // ── Build item list ───────────────────────────────────────────────────────
  const items = [
    // Open section
    { key: 'open', label: isApp ? 'Open Application' : 'Open', action: () => handleOpenFromTab(item) },
    ...(!multi ? [{ key: 'open-with', label: 'Open With…', submenu: openWithSubmenu }] : []),
    ...((!multi && (isDir || isApp)) ? [{ key: 'terminal', label: 'Open in Terminal', action: () => fsOpenTerminal(singleItem.path) }] : []),
    ...((!multi && (isArchive || isApp)) ? [{ key: 'browse', label: 'Browse Contents', action: () => openArchiveInTab(singleItem) }] : []),
    ...(extractSubmenu.length ? [{ key: 'extract', label: 'Extract', submenu: extractSubmenu }] : []),

    // Edit section
    { separator: true },
    { key: 'duplicate', label: 'Duplicate', action: () => {
      const ops = targets.map(t => {
        const sep = t.path.includes('\\') ? '\\' : '/'
        const dir = t.path.split(sep).slice(0, -1).join(sep)
        return enqueue({ label: `Duplicate "${t.name}"`, kind: 'copy', params: { paths: [t.path], dest_dir: dir } })
      })
      Promise.all(ops)
        .then(() => refreshAllDirs())
        .catch(e => { status.value.left = `Error: ${e?.message ?? e}`; setTimeout(() => { status.value.left = 'Ready' }, 2000) })
    }},
    ...(!inArchive && !multi ? [{ key: 'copypath', label: 'Copy Path', action: copyPathAction }] : []),

    // Actions section
    { separator: true },
    ...(!inArchive && compressSubmenu.length ? [{ key: 'compress', label: 'Compress', submenu: compressSubmenu }] : []),
    ...(!inArchive ? [{ key: 'rename', label: 'Rename', action: () => triggerInlineRename() }] : []),
    ...(!inArchive ? [{ key: 'delete', label: isShift ? 'Delete Permanently' : 'Delete', action: () => isShift ? doDelete(targets) : doTrash(targets) }] : []),
  ]

  contextMenu.value = { visible: true, x: event.clientX, y: event.clientY, quickActions, items }
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
.bp-action-btn,
.panel-action-btn {
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
.bp-action-btn:hover,
.panel-action-btn:hover { opacity: 1; background: rgba(255,255,255,0.08); }

/* ── Maximize layout overrides ────────────────────────────────────────────── */
.workbench-content.right-maximized .sidebar,
.workbench-content.right-maximized .editor-column,
.workbench-content.right-maximized .resize-handle { display: none !important; }
.workbench-content.right-maximized .rightpane {
  flex: 1 !important;
  min-width: 0 !important;
  border-left: none !important;
}

.workbench-content.left-maximized .editor-column,
.workbench-content.left-maximized .rightpane,
.workbench-content.left-maximized .resize-handle { display: none !important; }
.workbench-content.left-maximized .sidebar {
  display: flex !important;
  flex: 1 !important;
  min-width: 0 !important;
  width: auto !important;
}

.editor-column.bottom-maximized .editor-area,
.editor-column.bottom-maximized .resize-handle { display: none !important; }
.editor-column.bottom-maximized .bottompane {
  flex: 1 !important;
  min-height: 0 !important;
  height: auto !important;
}

/* Resize handles */
.resize-handle { flex-shrink: 0; background: transparent; transition: background 0.15s; z-index: 10; --resize-handle-size: 2px; }
.resize-handle:hover, .resize-handle:active { background: var(--accent); opacity: 0.4; }
.resize-handle--col { width: var(--resize-handle-size); cursor: col-resize; }
.resize-handle--row { height: var(--resize-handle-size); cursor: row-resize; }

/* Editor area hosts the recursive group grid (see GridView / EditorGroup). */
.editor-area > * { flex: 1; min-width: 0; min-height: 0; }

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
.status-bar-item--clipboard { color: color-mix(in srgb, var(--accent, #007acc) 90%, var(--text)); }
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
