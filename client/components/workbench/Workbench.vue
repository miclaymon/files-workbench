<template>
  <div class="vscode-shell">

    <!-- Titlebar -->
    <TitleBar :menus="titleMenus" @open-command-palette="openCommandPalette" />

    <!-- Main area -->
    <div class="main">

      <!-- Activity Bar -->
      <ActivityBar
        :activePrimaryView="activePrimaryView"
        :settingsMenuItems="settingsMenuItems"
        @toggle-view="togglePrimaryView"
      />

      <!-- Sidebar + Editor split -->
      <div class="workbench-content" :class="{ 'left-maximized': leftPaneMaximized, 'right-maximized': rightPaneMaximized }">

        <!-- Primary side bar (Explorer / Search) -->
        <PrimarySideBar
          :visible="sidebarVisible"
          v-model:width="sidebarWidth"
          :views="primarySidebarViews"
          v-model:activeView="activePrimaryView"
          v-model:viewSections="primaryViewSections"
          @transfer="handleViewTransfer"
          @section-move="handleSectionMove"
          @view-reabsorb="handleViewReabsorb"
        />

        <!-- Editor column (editor + bottom panel) -->
        <div class="editor-column" :class="{ 'bottom-maximized': bottomPaneMaximized }">

          <!-- Editor area: recursive grid of editor groups -->
          <div class="editor-area">
            <Editor
              :viewRoot="viewRoot"
              :activeGroupId="activeGroupId"
              :maximizedGroupId="maximizedGroupId"
              :prefs="prefs"
              :registerGroup="registerGroup"
              @select="handleSelectFromDirectory"
              @open="handleOpenFromTab"
              @navigate="navigateInCurrentTab"
              @contextmenu="showItemContextMenu"
              @background-contextmenu="showBackgroundContextMenu"
              @right-drag-drop="showRightDragDropMenu"
              @rename="handleRename"
              @stats="onGroupStats"
              @update:layout="handleLayoutChange"
              @tab-contextmenu="handleTabContextMenu"
            />
          </div>

          <!-- Bottom panel -->
          <BottomPanel
            v-model:visible="bottompaneVisible"
            v-model:height="bottompaneHeight"
            :views="bottomPanelViews"
            v-model="bottomPanel"
            v-model:mergedSlots="bottomPanelMerges"
            v-model:viewSections="panelViewSections"
            :maximized="bottomPaneMaximized"
            @transfer="handleViewTransfer"
            @merge="handleViewMerge"
            @unmerge="handleViewUnmerge"
            @section-move="handleSectionMove"
            @section-to-tab="handleSectionToTab"
            @view-reabsorb="handleViewReabsorb"
            @toggle-maximize="toggleBottomPaneMaximize"
          />

        </div>

        <!-- Secondary side bar (right) -->
        <SecondarySideBar
          v-model:visible="rightpaneVisible"
          v-model:width="rightpaneWidth"
          :views="rightPanelViews"
          v-model="rightPanel"
          v-model:mergedSlots="rightPanelMerges"
          v-model:viewSections="secondaryViewSections"
          :maximized="rightPaneMaximized"
          @transfer="handleViewTransfer"
          @merge="handleViewMerge"
          @unmerge="handleViewUnmerge"
          @section-move="handleSectionMove"
          @section-to-tab="handleSectionToTab"
          @view-reabsorb="handleViewReabsorb"
          @toggle-maximize="toggleRightPaneMaximize"
        />

      </div>
    </div>

    <!-- Status bar -->
    <StatusBar
      v-show="statusbarVisible"
      :activeTab="activeTab"
      :dirStats="dirStats"
      :selectedItems="selectedItems"
      :clipboard="clipboard"
      :statusText="status.left"
      :serverConnected="serverConnected"
      :statusRight="statusRight"
    />

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

    <!-- New file / folder modal -->
    <div v-if="newItemPrompt" class="modal-overlay" @click.self="cancelNewItem">
      <div class="modal-dialog">
        <div class="modal-title">{{ newItemPrompt.type === 'file' ? 'New File' : 'New Folder' }}</div>
        <div class="modal-body">
          <p class="modal-paths">{{ newItemPrompt.dirPath }}</p>
          <label class="modal-label">{{ newItemPrompt.type === 'file' ? 'File name' : 'Folder name' }}</label>
          <input
            ref="newItemInputRef"
            v-model="newItemName"
            type="text"
            class="modal-input"
            :placeholder="newItemPrompt.type === 'file' ? 'filename.txt' : 'folder name'"
            @keydown.enter="confirmNewItem"
            @keydown.esc="cancelNewItem"
          />
          <div v-if="newItemError" class="modal-error">{{ newItemError }}</div>
        </div>
        <div class="modal-actions">
          <button class="modal-btn" @click="cancelNewItem">Cancel</button>
          <button class="modal-btn modal-btn--primary" :disabled="!newItemName.trim() || newItemCreating" @click="confirmNewItem">
            {{ newItemCreating ? 'Creating…' : 'Create' }}
          </button>
        </div>
      </div>
    </div>

    <!-- Command palette -->
    <CommandPalette
      :visible="commandPaletteOpen"
      :commands="allCommands"
      @close="commandPaletteOpen = false"
    />

    <!-- Settings modal -->
    <SettingsModal
      :visible="settingsModalOpen"
      :prefs="prefs"
      @close="settingsModalOpen = false"
      @save="savePreferences"
    />

    <!-- Keyboard shortcuts modal -->
    <KeyboardShortcutsModal
      :visible="keyboardShortcutsModalOpen"
      @close="keyboardShortcutsModalOpen = false"
    />

  </div>
</template>

<script setup>
import { nextTick, onMounted, onUnmounted, provide, ref } from 'vue'
import { useWorkspaces, uuidv4 } from '~/composables/useWorkspaces.js'
import CommandPalette from './ui/CommandPalette.vue'
import SettingsModal from './ui/SettingsModal.vue'
import KeyboardShortcutsModal from './ui/KeyboardShortcutsModal.vue'
import { useEditorGrid } from '~/composables/workbench/useEditorGrid.js'
import { useStatusBar } from '~/composables/workbench/useStatusBar.js'
import { useSelection } from '~/composables/workbench/useSelection.js'
import { useArchive } from '~/composables/workbench/useArchive.js'
import { useFileOperations } from '~/composables/workbench/useFileOperations.js'
import { useFileContextMenus } from '~/composables/workbench/useFileContextMenus.js'
import { useAppMenus } from '~/composables/workbench/useAppMenus.js'
import { useViewLayout } from '~/composables/workbench/useViewLayout.js'
import { useWorkbenchKeyboard } from '~/composables/workbench/useWorkbenchKeyboard.js'
import { usePreferences } from '~/composables/usePreferences.js'
import { useDebugLog } from '~/composables/useDebugLog.js'
import { useFileOpsQueue } from '~/composables/useFileOpsQueue.js'
import { useActionHistory } from '~/composables/useActionHistory.js'
import { fsStat, fsOpenWithSystem, fsOpenTerminal, fsCreateFile, fsCreateDir } from '~/lib/fs-api.js'

function uuid() { return uuidv4() }

// Status bar — server-ping lifecycle, transient status line, and dir stats.
const { serverConnected, dirStats, status, statusRight, formatBytes, flashStatus } = useStatusBar()

// Persisted workspace state — a single instance shared across slices. The editor
// + view-content context pull a few methods directly; the rest is consumed by the
// view-layout slice below.
const workspaces = useWorkspaces()
const { getInitialEditor, saveEditor, explorerContext, updateExplorerContext } = workspaces

// Debug log
const debugLog = useDebugLog()
const { log } = debugLog

// File operations queue + undo/redo
const { enqueue } = useFileOpsQueue()
const history = useActionHistory()

// Archive detection + host capabilities (loaded once at startup by the slice).
const { archiveCaps, isArchiveItem } = useArchive()

// Preferences
const { prefs, save: savePrefs } = usePreferences()

// View layout: container view lists, merge groups (stacked views), per-view
// section state, every drag-driven layout mutation, and the workbenchChrome
// context-menu actions provided to each ViewContainer.
const viewLayout = useViewLayout({ workspaces, prefs, savePrefs })
const {
  sidebarVisible, sidebarWidth, activePrimaryView,
  rightpaneVisible, rightpaneWidth, rightPanel,
  bottompaneVisible, bottompaneHeight, bottomPanel,
  primarySidebarViews, primaryViewSections, secondaryViewSections, panelViewSections,
  rightPanelViews, bottomPanelViews, rightPanelMerges, bottomPanelMerges,
  PANEL_VIEW_REGISTRY,
  isViewVisible, hideView, showView, recoverMissingViews, togglePrimaryView,
  handleViewTransfer, handleViewMerge, handleViewUnmerge,
  handleSectionMove, handleSectionToTab, handleViewReabsorb,
  workbenchChrome,
} = viewLayout
provide('workbenchChrome', workbenchChrome)

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

function handleLayoutChange(layout) {
  prefs.explorer.layout = layout
  log('layout', 'Layout changed', layout)
}

// Editor model — a recursive grid of editor groups (see useEditorGrid.js).
const explorerPanelRef = ref(null)
const editor = useEditorGrid({ log, getInitialEditor, saveEditor })
// Only what Workbench's own template / keyboard / menus touch directly; the rest
// of the editor API reaches the slices through the `editor` object passed below.
const {
  editorRoot, activeGroupId, maximizedGroupId, viewRoot, activeTab,
  registerGroup, editorController,
} = editor

provide('editorController', editorController)

// Selection state + explorer/directory/open/navigate handlers. Consumes the
// editor grid one-directionally (per-tab selection); editor never reads these.
const {
  selectedPath, selectedItems, focusedItem, selectedDetails,
  updateSelectionAfterRename,
  handleExplorerSelect, handleSelectFromDirectory, handleDoubleClick,
  navigateInCurrentTab, handleOpenFromTab,
} = useSelection({
  editor,
  statusbar: { status, dirStats, formatBytes, flashStatus },
  log, fsStat, fsOpenWithSystem, isArchiveItem, uuid,
})

// File operations: create/rename/trash/delete/compress/paste/move/undo + clipboard,
// elevation dialog, and the missing-tool install prompt.
const fileOps = useFileOperations({
  editor,
  selection: { selectedItems, focusedItem, updateSelectionAfterRename },
  statusbar: { flashStatus },
  enqueue, history, log, explorerPanelRef,
})
// Most file ops reach the menu/context-menu/keyboard slices via the `fileOps`
// object; Workbench's own template + viewCtx use only these directly.
const {
  clipboard, handleRename, doMove,
  elevationPasswordRef, elevationPrompt, elevationPassword, elevationError,
  cancelElevation, confirmElevation,
  installPrompt,
} = fileOps

// Cursor-positioned context menus (editor tab / directory background / right-drag / item).
const {
  contextMenu, hideContextMenu,
  handleTabContextMenu, showBackgroundContextMenu, showRightDragDropMenu, showItemContextMenu,
} = useFileContextMenus({
  editor,
  selection: { selectedItems, handleOpenFromTab },
  fileOps,
  archive: { isArchiveItem, archiveCaps },
  enqueue, statusbar: { flashStatus },
  fsOpenWithSystem, fsOpenTerminal, uuid,
})

// ── View content context ─────────────────────────────────────────────────────
// Shared bag of state + handlers that the view registry binds into each panel
// component (see useViewRegistry.js / ViewContentHost.vue). Provided once here so
// any view/section renders identically in any container; the handlers are sourced
// from the selection / file-ops / context-menu slices instantiated above.
const previewMode = ref('multi')

// ── New file / folder modal ───────────────────────────────────────────────────

const newItemPrompt    = ref(null)  // { type: 'file'|'folder', dirPath }
const newItemName      = ref('')
const newItemInputRef  = ref(null)
const newItemError     = ref('')
const newItemCreating  = ref(false)

async function _openNewItemModal(type) {
  const dirPath = _explorerTargetDir()
  if (!dirPath) return
  newItemPrompt.value   = { type, dirPath }
  newItemName.value     = ''
  newItemError.value    = ''
  newItemCreating.value = false
  await nextTick()
  newItemInputRef.value?.focus()
}

function cancelNewItem() {
  newItemPrompt.value = null
}

async function confirmNewItem() {
  const name = newItemName.value.trim()
  if (!name || newItemCreating.value) return
  const { type, dirPath } = newItemPrompt.value
  newItemError.value    = ''
  newItemCreating.value = true
  try {
    const newPath = `${dirPath}/${name}`
    if (type === 'file') await fsCreateFile(newPath)
    else                 await fsCreateDir(newPath)
    newItemPrompt.value = null
    explorerPanelRef.value?.reloadDir(dirPath)
  } catch (err) {
    newItemError.value    = err?.message ?? 'Failed to create'
    newItemCreating.value = false
    await nextTick()
    newItemInputRef.value?.focus()
  }
}

// ─────────────────────────────────────────────────────────────────────────────

// Tracks the last item clicked in the Explorer tree (path + kind).
const explorerTreeFocus = ref(null)

function handleExplorerSelectAndTrack(payload) {
  const path = typeof payload === 'string' ? payload : payload?.path
  const kind = payload?.kind ?? 'file'
  if (path) explorerTreeFocus.value = { path, kind }
  return handleExplorerSelect(payload)
}

// Returns the directory to target for New File / New Folder in the Explorer tree.
// Uses the last tree-clicked node: directories map to themselves, files to their parent.
function _explorerTargetDir() {
  const focus = explorerTreeFocus.value
  if (focus) {
    if (focus.kind === 'directory' || focus.kind === 'dir' || focus.kind === 'drive' || focus.kind === 'root') {
      return focus.path
    }
    const idx = focus.path.lastIndexOf('/')
    return idx > 0 ? focus.path.substring(0, idx) : focus.path
  }
  // Fallback: parent of the currently open editor path
  const sp = selectedPath.value
  if (!sp) return null
  const idx = sp.lastIndexOf('/')
  return idx > 0 ? sp.substring(0, idx) : sp
}

const viewCtx = {
  // reactive state (refs / computeds — registry reads .value)
  selectedPath, selectedItems, focusedItem, selectedDetails,
  editorRoot, activeGroupId,
  explorerContext,
  explorerTreeFocus,
  previewMode,
  prefs,            // reactive object (no .value)
  debugLog,
  // handlers
  handleExplorerSelect: handleExplorerSelectAndTrack, handleDoubleClick, showItemContextMenu,
  handleRename, doMove, updateExplorerContext,
  // imperative ref forwarding (e.g. explorerPanelRef.refresh())
  setRef(name, el) { if (name === 'explorerPanelRef') explorerPanelRef.value = el },
  refreshExplorer:     () => explorerPanelRef.value?.refresh(),
  reloadExplorerDir:   (dir) => explorerPanelRef.value?.reloadDir(dir),
  showNewFileModal:    () => _openNewItemModal('file'),
  showNewFolderModal:  () => _openNewItemModal('folder'),
  collapseAllExplorer: () => explorerPanelRef.value?.collapseAll(),
  expandRootsExplorer: () => explorerPanelRef.value?.expandRoots(),
}
provide('viewCtx', viewCtx)

// App menus (File/Edit/View + Settings), command palette, and modal open-state.
const {
  titleMenus, settingsMenuItems, allCommands,
  commandPaletteOpen, settingsModalOpen, keyboardShortcutsModalOpen,
  openCommandPalette, openSettingsModal, savePreferences,
} = useAppMenus({
  fileOps,
  selection: { selectedItems },
  editor,
  history, prefs, savePrefs,
  statusbar: { flashStatus },
  explorerPanelRef,
  appearance: { zenMode, centeredLayout, sidebarVisible, rightpaneVisible, statusbarVisible, bottompaneVisible },
  views: { registry: PANEL_VIEW_REGISTRY, isViewVisible, hideView, showView },
})

// Global keyboard shortcuts (self-manages its own keydown listener).
useWorkbenchKeyboard({ editor, fileOps, selection: { selectedItems }, openCommandPalette, openSettingsModal })

function onSashResizeEnd() {
  log('editor-layout', 'Resized editor groups', {})
}

onMounted(async () => {
  recoverMissingViews()
  window.addEventListener('editor:sash-resize-end', onSashResizeEnd)

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
  window.removeEventListener('editor:sash-resize-end', onSashResizeEnd)
})

// Editor-group directory stats bubble up to the status bar.
function onGroupStats({ groupId, stats }) {
  if (groupId === activeGroupId.value) dirStats.value = stats
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

/* Main area */
.main { display: flex; min-height: 0; overflow: hidden; }

/* Workbench content: sidebar + editor */
.workbench-content { display: flex; flex: 1; min-width: 0; min-height: 0; overflow: hidden; }

/* Editor column (editor area + bottom panel) */
.editor-column { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }

/* Editor area — hosts the recursive group grid (see Editor / GridView / EditorGroup). */
.editor-area { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }
.editor-area > * { flex: 1; min-width: 0; min-height: 0; }

/* ── Maximize layout overrides ────────────────────────────────────────────────
   The panes (.sidebar / .rightpane / .bottompane) and their resize handles now
   live inside the PrimarySideBar / SecondarySideBar / BottomPanel child
   components, so :deep() reaches them from the maximize classes Workbench
   toggles on .workbench-content / .editor-column. */

.workbench-content {
  &.right-maximized {
    .editor-column           { display: none !important; }
    :deep(.sidebar),
    :deep(.resize-handle)    { display: none !important; }
    :deep(.rightpane)        { flex: 1 !important; min-width: 0 !important; border-left: none !important; }
  }
  &.left-maximized {
    .editor-column           { display: none !important; }
    :deep(.rightpane),
    :deep(.resize-handle)    { display: none !important; }
    :deep(.sidebar)          { display: flex !important; flex: 1 !important; min-width: 0 !important; width: auto !important; }
  }
}

.editor-column {
  &.bottom-maximized {
    .editor-area             { display: none !important; }
    :deep(.resize-handle)    { display: none !important; }
    :deep(.bottompane)       { flex: 1 !important; min-height: 0 !important; height: auto !important; }
  }
}

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

  p { margin: 0; line-height: 1.5; }
}

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

  &:focus { border-color: var(--accent, #0078d4); }
}

.modal-hint  { color: var(--text-muted, #888); font-size: 12px; }
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

  &:hover { background: var(--surface-hover, #4c4c4c); }
  &.modal-btn--primary {
    background: var(--accent, #0078d4);
    border-color: var(--accent, #0078d4);
    color: #fff;
    &:hover { background: var(--accent-hover, #1c8be4); border-color: var(--accent-hover, #1c8be4); }
  }
}

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

  .install-cmd-label {
    font-size: 10px;
    font-weight: 600;
    color: var(--text-muted, #888);
    min-width: 44px;
    text-transform: uppercase;
  }

  code {
    font-family: monospace;
    font-size: 11px;
    color: var(--text, #ccc);
    user-select: text;
  }
}
</style>
