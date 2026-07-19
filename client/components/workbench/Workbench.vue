<template>
  <div class="vscode-shell">

    <!-- Titlebar -->
    <TitleBar
      :menus="titleMenus"
      @open-command-palette="showCommandPalette('', true)"
      @toggle-primary-sidebar="sidebarVisible = !sidebarVisible"
      @toggle-panel="bottompaneVisible = !bottompaneVisible"
      @toggle-secondary-sidebar="rightpaneVisible = !rightpaneVisible"
    />

    <!-- Main area -->
    <div class="main">

      <!-- Activity Bar -->
      <ActivityBar
        :views="primarySidebarViews"
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
              @rename-batch="handleRenameBatch"
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

    <!-- Status bar (activity-driven; each widget reads the host via viewCtx) -->
    <StatusBar v-show="statusbarVisible" />

    <!-- Notification center -->
    <NotificationPanel
      :visible="notificationsVisible"
      :notifications="notifications"
      @close="notificationsVisible = false"
      @clear="clearNotifications"
      @dismiss="dismissNotification"
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
      :modes="paletteModes"
      :initial-prefix="palettePrefix"
      :show-modes="paletteHome"
      @close="commandPaletteOpen = false"
    />

    <!-- Modal surfaces (Settings, Keyboard Shortcuts, …) — the active registered
         ModalView rendered in the shared ModalEditor chrome -->
    <ModalHost :host="host" />

    <!-- Near-fullscreen lightbox overlay (opened via facade.lightbox) -->
    <LightboxHost />
    <PeekHost />

  </div>
</template>

<script setup>
import ActivityBar from './shell/ActivityBar.vue'
import BottomPanel from './shell/BottomPanel.vue'
import ContextMenu from './ui/ContextMenu.vue'
import Editor from './editor/Editor.vue'
import NotificationPanel from './shell/NotificationPanel.vue'
import PrimarySideBar from './shell/PrimarySideBar.vue'
import SecondarySideBar from './shell/SecondarySideBar.vue'
import StatusBar from './shell/StatusBar.vue'
import TitleBar from './shell/TitleBar.vue'
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import { useWorkspaces, uuidv4 } from '~/composables/useWorkspaces.js'
import CommandPalette from './ui/CommandPalette.vue'
import ModalHost from './ui/ModalHost.vue'
import LightboxHost from './LightboxHost.vue'
import PeekHost from './PeekHost.vue'
import { useEditorGrid } from '~/composables/workbench/useEditorGrid.js'
import { useStatusBar } from '~/composables/workbench/useStatusBar.js'
import { useNotifications } from '~/composables/workbench/useNotifications.js'
import { useActivityHost } from '~/composables/activity/useActivityHost.js'
import { formatChord } from '~/composables/activity/useKeybindingRegistry.js'
import { createPluginHost } from '~/composables/plugins/usePluginHost.js'
import { EXPLORER_PLUGIN, OPTIONAL_PLUGIN_LOADERS } from '~/builtin-plugins/index.js'
import { installFwSdk } from '~/plugin-sdk/client/index.js'
import { hardenIntrinsics } from '~/plugin-sdk/client/harden.js'
import { loadRuntimePlugins } from '~/composables/plugins/useRuntimePlugins.js'
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
import { collectLeaves } from '~/composables/useLayoutGrid.js'
import { fsStat, fsOpenWithSystem, fsOpenTerminal, fsCreateFile, fsCreateDir } from '~/lib/fs-api.js'

function uuid() { return uuidv4() }

// Status bar — server-ping lifecycle, transient status line, and dir stats.
const { serverConnected, dirStats, status, statusRight, formatBytes, flashStatus } = useStatusBar()

// Notification center — shared singleton; producers push via `notify`.
const {
  notifications, hasUnread, activeJob, notify, startJob,
  dismiss: dismissNotification, clear: clearNotifications, markAllRead,
} = useNotifications()
const notificationsVisible = ref(false)
function toggleNotifications() {
  notificationsVisible.value = !notificationsVisible.value
  if (notificationsVisible.value) markAllRead()
}
// Anything arriving while the panel is open counts as seen.
watch(notifications, () => { if (notificationsVisible.value) markAllRead() })

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

// Activity host: instantiates each activity's runtime API and brokers
// collaboration between them. Built before the file-op / menu / keyboard slices
// because they consume the Explorer activity's selection API. The same object is
// later provided as `viewCtx` so registry-bound view/section content reads
// app-level state and other activities' APIs through it.
const host = useActivityHost({
  editor,
  prefs,
  services: {
    statusbar: { status, dirStats, formatBytes, flashStatus },
    fsStat, fsOpenWithSystem, isArchiveItem, uuid,
  },
  log,
})

// First-party plugins, loaded through the plugin host (the same path third-party
// archives will use). They contribute their activity/panel/editor/status surfaces
// purely through the permission-scoped public API — nothing compiled in. Loaded
// here (right after the host) rather than later because Explorer is now one of
// them and owns the selection API the file-op / menu / keyboard slices below
// consume synchronously — it must be registered before host.requireApi('explorer').
// Publish the SDK global before any runtime plugin is imported — its externalized
// `vue` / `@fw/sdk` bindings resolve to globalThis.__FW_SDK at load, so plugins share
// the host's single Vue instance and live models/components.
installFwSdk()
// Defense-in-depth: freeze shared intrinsic prototypes before any plugin runs, so a
// plugin can't poison prototypes the app shares. Off by default (compat risk with libs
// that patch prototypes) — see plugin-sdk/client/harden.js. Not a sandbox.
const frozen = hardenIntrinsics()
if (frozen) log('plugins', `intrinsic hardening on (${frozen.length} prototypes frozen)`, null, 'info')

const pluginHost = createPluginHost({ host, log })
pluginHost.load(EXPLORER_PLUGIN.manifest, EXPLORER_PLUGIN.module)
// Optional plugins load asynchronously (dynamic import per plugin). An import
// failure or activate() error in any one is isolated — it logs and skips that
// plugin without affecting peers or the host. Fire-and-forget: Vue reactivity
// propagates each plugin's registrations as they resolve.
pluginHost.loadAllAsync(OPTIONAL_PLUGIN_LOADERS)
// Runtime (unbundled) plugins from /plugins/<id>/: fetched, hash-verified, and
// dynamic-imported through the same host. Fire-and-forget + isolated like the above;
// prod verifies pinned hashes strictly, dev warns. (This is the path first-party and
// third-party plugins share — e.g. Chat now loads here rather than being compiled in.)
loadRuntimePlugins({ pluginHost, log, strict: !import.meta.dev })
if (import.meta.dev) window.__plugins = pluginHost
// The Plugins manager modal reaches the host to load/unload/inspect plugins live.
provide('pluginHost', pluginHost)

// Selection now lives in the Explorer activity (a first-party plugin). Pull the
// same refs/handlers the rest of the app consumes (file ops, context menus,
// keyboard) from its API — selection ownership moved, but the consuming wiring is
// unchanged.
const explorerApi = host.requireApi('explorer')
const {
  selectedPath, selectedItems, focusedItem, selectedDetails,
  updateSelectionAfterRename, updateSelectionAfterBatchRename,
  handleExplorerSelect, handleSelectFromDirectory, handleDoubleClick,
  navigateInCurrentTab, handleOpenFromTab,
} = explorerApi

// File operations: create/rename/trash/delete/compress/paste/move/undo + clipboard,
// elevation dialog, and the missing-tool install prompt.
const fileOps = useFileOperations({
  editor,
  selection: { selectedItems, focusedItem, updateSelectionAfterRename, updateSelectionAfterBatchRename },
  statusbar: { flashStatus },
  notifications: { notify, startJob },
  enqueue, history, log, explorerPanelRef,
})
// Most file ops reach the menu/context-menu/keyboard slices via the `fileOps`
// object; Workbench's own template + viewCtx use only these directly.
const {
  clipboard, handleRename, handleRenameBatch, doMove,
  elevationPasswordRef, elevationPrompt, elevationPassword, elevationError,
  cancelElevation, confirmElevation,
  installPrompt,
} = fileOps

// Cursor-positioned context menus (editor tab / directory background / right-drag / item).
const {
  contextMenu, hideContextMenu,
  handleTabContextMenu, showBackgroundContextMenu, showRightDragDropMenu, showItemContextMenu,
} = useFileContextMenus({
  host,
  editor,
  selection: { selectedItems, handleOpenFromTab },
  fileOps,
  archive: { isArchiveItem, archiveCaps },
  enqueue, statusbar: { flashStatus },
  fsOpenWithSystem, fsOpenTerminal, uuid,
})

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

// Finish wiring the activity host: assign the explorer/file-op/menu handlers and
// the Workbench-local context (explorer tree focus, new-item modals, imperative
// ref forwarding) that registry-bound content reaches through `ctx`. These are
// late-bound here because they come from slices instantiated above. The host is
// then provided as `viewCtx` so ViewContentHost binds content against it.
Object.assign(host, {
  explorerContext,
  explorerTreeFocus,
  // app-level status state read by the status-bar widgets (status views)
  status, serverConnected, statusRight, formatBytes,
  clipboard, activeJob, hasUnread,
  notificationsOpen: notificationsVisible, toggleNotifications,
  // handlers (sourced from the selection / file-ops / context-menu slices)
  handleExplorerSelect: handleExplorerSelectAndTrack, handleDoubleClick, showItemContextMenu,
  handleRename, doMove, updateExplorerContext,
  // imperative ref forwarding (e.g. explorerPanelRef.refresh())
  setRef(name, el) {
    if (name === 'explorerPanelRef') explorerPanelRef.value = el
  },
  refreshExplorer:     () => explorerPanelRef.value?.refresh(),
  reloadExplorerDir:   (dir) => explorerPanelRef.value?.reloadDir(dir),
  showNewFileModal:    () => _openNewItemModal('file'),
  showNewFolderModal:  () => _openNewItemModal('folder'),
  collapseAllExplorer: () => explorerPanelRef.value?.collapseAll(),
  expandRootsExplorer: () => explorerPanelRef.value?.expandRoots(),
  toggleExplorerHidden: () => explorerPanelRef.value?.toggleHidden(),
})
provide('viewCtx', host)

// App menus (File/Edit/View + Settings), command palette, and modal open-state.
const {
  titleMenus, settingsMenuItems,
  commandPaletteOpen,
  openCommandPalette, openSettingsModal, openKeyboardShortcuts, openPluginsManager, savePreferences,
} = useAppMenus({
  host,
  history,
  views: { registry: PANEL_VIEW_REGISTRY, isViewVisible, hideView, showView },
  savePrefs,
  statusbar: { flashStatus },
  explorerPanelRef,
})

// The Settings modal binds `save` to this through the host (see Workbench.js modal
// def → on: ctx => ({ save: ctx.savePreferences })).
host.savePreferences = savePreferences

// The palette opens into a mode by prefilling its prefix: '>' for commands
// (Ctrl+Shift+P), '' for Go to File quick-open (Ctrl+P). `home` (title-bar
// command center) opens Go to File with the mode list surfaced for discovery.
const palettePrefix = ref('>')
const paletteHome   = ref(false)
function showCommandPalette(prefix = '>', home = false) {
  palettePrefix.value = prefix
  paletteHome.value   = home
  openCommandPalette()
}

// ── App command catalog ─────────────────────────────────────────────────────
// The app-level commands as the single source of truth for invokable behaviour;
// menus, keybindings, and the command palette reference these by id. They close
// over Workbench's slice handlers (the composition root is the one place all of
// editor / file-ops / appearance / palette are in scope); activities register
// their own commands in setup() instead.
for (const cmd of [
  // Editor layout
  { id: 'editor.splitUp',    title: 'Split Editor Up',    category: 'Editor', run: () => editorController.splitActiveGroup('top') },
  { id: 'editor.splitDown',  title: 'Split Editor Down',  category: 'Editor', run: () => editorController.splitActiveGroup('bottom') },
  { id: 'editor.splitLeft',  title: 'Split Editor Left',  category: 'Editor', run: () => editorController.splitActiveGroup('left') },
  { id: 'editor.splitRight', title: 'Split Editor Right', category: 'Editor', run: () => editorController.splitActiveGroup('right') },
  { id: 'editor.layoutSingle',       title: 'Single Column Layout', category: 'Editor', run: () => editorController.applyLayoutPreset('single') },
  { id: 'editor.layoutTwoColumns',   title: 'Two Columns Layout',   category: 'Editor', run: () => editorController.applyLayoutPreset('twoColumns') },
  { id: 'editor.layoutTwoRows',      title: 'Two Rows Layout',      category: 'Editor', run: () => editorController.applyLayoutPreset('twoRows') },
  { id: 'editor.layoutThreeColumns', title: 'Three Columns Layout', category: 'Editor', run: () => editorController.applyLayoutPreset('threeColumns') },
  { id: 'editor.layoutGrid',         title: 'Grid Layout (2×2)',    category: 'Editor', run: () => editorController.applyLayoutPreset('grid') },
  { id: 'editor.closeActiveTab', title: 'Close Tab', category: 'Editor', when: () => !!activeTab.value, run: () => editorController.closeTab(activeGroupId.value, activeTab.value.id) },
  // Bound to Ctrl+1…9; not a palette entry (it needs a group-index argument).
  { id: 'editor.focusGroup', title: 'Focus Editor Group by Index', category: 'Editor', palette: false, run: (ctx, index) => { const leaf = collectLeaves(editorRoot.value)[index]; if (leaf) editorController.setActiveGroup(leaf.id) } },

  // Edit — clipboard / history (gated by when())
  { id: 'edit.undo',  title: 'Undo',  category: 'Edit', when: () => history.canUndo.value,         run: () => fileOps.doUndo() },
  { id: 'edit.redo',  title: 'Redo',  category: 'Edit', when: () => history.canRedo.value,         run: () => fileOps.doRedo() },
  { id: 'edit.copy',  title: 'Copy',  category: 'Edit', when: () => selectedItems.value.length > 0, run: () => fileOps.copyToClipboard(selectedItems.value) },
  { id: 'edit.cut',   title: 'Cut',   category: 'Edit', when: () => selectedItems.value.length > 0, run: () => fileOps.cutToClipboard(selectedItems.value) },
  { id: 'edit.paste', title: 'Paste', category: 'Edit', when: () => clipboard.value.count > 0,      run: () => fileOps.doPaste() },

  // File
  { id: 'file.newFolder', title: 'New Folder',         category: 'File', run: () => fileOps.createNewFolder() },
  { id: 'file.newFile',   title: 'New File',           category: 'File', run: () => fileOps.createNewFile() },
  { id: 'file.trash',     title: 'Move to Trash',      category: 'File', when: () => selectedItems.value.length > 0, run: () => fileOps.doTrash(selectedItems.value) },
  { id: 'file.delete',    title: 'Delete Permanently', category: 'File', when: () => selectedItems.value.length > 0, run: () => fileOps.doDelete(selectedItems.value) },

  // View toggles — toggled() drives the check state shown in menus and palette.
  { id: 'view.togglePrimarySidebar',   title: 'Toggle Primary Side Bar',   category: 'View', toggled: () => sidebarVisible.value,    run: () => { sidebarVisible.value    = !sidebarVisible.value } },
  { id: 'view.toggleSecondarySidebar', title: 'Toggle Secondary Side Bar', category: 'View', toggled: () => rightpaneVisible.value,  run: () => { rightpaneVisible.value  = !rightpaneVisible.value } },
  { id: 'view.toggleStatusBar',        title: 'Toggle Status Bar',         category: 'View', toggled: () => statusbarVisible.value,  run: () => { statusbarVisible.value  = !statusbarVisible.value } },
  { id: 'view.togglePanel',            title: 'Toggle Panel',              category: 'View', toggled: () => bottompaneVisible.value, run: () => { bottompaneVisible.value = !bottompaneVisible.value } },
  { id: 'view.toggleZenMode',          title: 'Toggle Zen Mode',           category: 'View', toggled: () => zenMode.value,          run: () => { zenMode.value          = !zenMode.value } },
  { id: 'view.toggleCenteredLayout',   title: 'Toggle Centered Layout',    category: 'View', toggled: () => centeredLayout.value,   run: () => { centeredLayout.value   = !centeredLayout.value } },
  { id: 'view.toggleFullScreen',       title: 'Toggle Full Screen',        category: 'View', toggled: () => !!document.fullscreenElement, run: () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() } },
  { id: 'view.toggleAlwaysShowCheckboxes', title: 'Always Show Checkboxes', category: 'View', toggled: () => prefs.explorer.alwaysShowCheckboxes, run: () => { prefs.explorer.alwaysShowCheckboxes = !prefs.explorer.alwaysShowCheckboxes } },

  // Workbench
  { id: 'workbench.openCommandPalette',    title: 'Show Command Palette',    category: 'Workbench',   run: () => showCommandPalette('>') },
  { id: 'workbench.openQuickOpen',         title: 'Go to File…',             category: 'Workbench',   run: () => showCommandPalette('') },
  { id: 'workbench.openSettings',          title: 'Open Settings',           category: 'Preferences', run: () => openSettingsModal() },
  { id: 'workbench.openKeyboardShortcuts', title: 'Open Keyboard Shortcuts', category: 'Preferences', run: () => openKeyboardShortcuts() },
  { id: 'plugins.manage',                  title: 'Manage Plugins',          category: 'Preferences', run: () => openPluginsManager() },
]) host.facade.commands.register(cmd)

// ── Default keybindings ───────────────────────────────────────────────────────
// Chords → command ids. The dispatcher (useWorkbenchKeyboard) resolves keydowns
// against these; activities and plugins contribute their own through the facade.
for (const binding of [
  { key: 'ctrl+shift+p', command: 'workbench.openCommandPalette', allowInInput: true },
  { key: 'ctrl+p',       command: 'workbench.openQuickOpen',      allowInInput: true },
  { key: 'ctrl+,',       command: 'workbench.openSettings',       allowInInput: true },
  { key: 'ctrl+z', command: 'edit.undo' },
  { key: 'ctrl+y', command: 'edit.redo' },
  { key: 'ctrl+c', command: 'edit.copy' },
  { key: 'ctrl+x', command: 'edit.cut' },
  { key: 'ctrl+v', command: 'edit.paste' },
  { key: 'ctrl+\\', command: 'editor.splitRight' },
  { key: 'ctrl+w',  command: 'editor.closeActiveTab' },
  { key: 'delete',       command: 'file.trash' },
  { key: 'shift+delete', command: 'file.delete' },
  ...Array.from({ length: 9 }, (_, i) => ({ key: `ctrl+${i + 1}`, command: 'editor.focusGroup', args: [i] })),
]) host.facade.keybindings.register(binding)

// Dev-only: expose the activity host for console inspection of the new
// command / contribution surfaces (e.g. __wb.facade.commands.list()).
if (import.meta.dev) window.__wb = host

// Command-palette items for the `>` commands mode — enabled commands (minus
// arg-only ones), annotated with their bound chord, sorted by category then
// title. Derived live from the registries so contributed commands/keybindings
// appear automatically.
const paletteCommandItems = computed(() =>
  host.facade.commands.list()
    .filter(c => c.palette !== false && host.facade.commands.isEnabled(c.id))
    .sort((a, b) => (a.category ?? '').localeCompare(b.category ?? '') || a.title.localeCompare(b.title))
    .map(c => {
      const binds = host.facade.keybindings.forCommand(c.id)
      return {
        key:       c.id,
        label:     c.title,
        category:  c.category ?? '',
        keys:      binds.length ? formatChord(binds[0].chord) : [],
        checkable: !!c.toggled,
        checked:   !!c.toggled?.(host),
        run:       () => host.facade.commands.execute(c.id),
      }
    })
)

// Palette modes, selected by a leading prefix. Only `>` (Show and Run Commands)
// is wired; Go to File is a stub that renders its own empty state until file
// search lands — the prefix architecture is in place so it drops in without UI
// changes. `keys`/`listable` feed the mode list shown in the home view and `?`.
const paletteModes = [
  { prefix: '',  name: 'Go to File',            placeholder: 'Search files by name', empty: 'File search is not available yet', listable: true, keys: ['Ctrl', 'P'],          items: () => [] },
  { prefix: '>', name: 'Show and Run Commands', placeholder: 'Type a command name…', empty: 'No matching commands', recents: true, listable: true, keys: ['Ctrl', 'Shift', 'P'], items: () => paletteCommandItems.value },
]

// Global keyboard shortcuts: a generic chord → command dispatcher.
useWorkbenchKeyboard({ host })

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

// Editor-group directory stats bubble up to the Explorer activity (which owns
// dir stats and publishes them over its API to the status widget).
function onGroupStats({ groupId, stats }) {
  if (groupId === activeGroupId.value) explorerApi.setDirStats(stats)
}

</script>

<style scoped>
/* Shell grid */
.vscode-shell {
  height: 100vh;
  display: grid;
  grid-template-rows: var(--titlebar-height) 1fr var(--statusbar-height);
  overflow: hidden;
  border-radius: 4px;
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
