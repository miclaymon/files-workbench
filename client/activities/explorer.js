import { markRaw, ref, computed, watch } from 'vue'
import { mdiFileTree, mdiEye, mdiEyeOff, mdiFolderMultiple, mdiFileDocumentMultiple, mdiRefresh, mdiFilePlusOutline, mdiFolderPlusOutline, mdiCollapseAll, mdiExpandAll } from '@mdi/js'

import ExplorerPanel        from '../components/workbench/explorer/ExplorerPanel.vue'
import OpenEditorsView      from '../components/workbench/explorer/OpenEditorsView.vue'
import DirectoryTab         from '../components/workbench/editor/DirectoryTab.vue'
import ExplorerStatusWidget from '../components/workbench/shell/status/ExplorerStatusWidget.vue'

import { useSelection } from '../composables/workbench/useSelection.js'
import { createEmitter } from '../composables/activity/useEmitter.js'

const ACTIVITY_NAME = "Explorer";
const ACTIVITY_ID = 'explorer';
const ACTIVITY_ICON = mdiFileTree;
const IS_FIRST_PARTY = true;

const VIEWS = {
  PANELS: [

  ],
  EDITORS: [

  ],
  STATUS: [

  ],
}

// ── Explorer activity ───────────────────────────────────────────────────────
//
// Owns the file/directory selection context. Its API is the canonical source of
// "what is selected" for collaborating activities: Preview and Details read it
// through `host.selection` (which resolves to the active activity's selection
// capability), and any activity can subscribe to `selection-change`.
//
// Surfaces contributed:
//   tabViews    directory   — the navigable directory view (DirectoryTab)
//   panelViews  explorer    — the sidebar tree, owning the Places + Open Editors sections
//   statusViews dirStats, selection, clipboard — left-aligned status widgets
//
// The selection state itself is produced by the existing `useSelection` slice;
// this module wraps it as a queryable + subscribable activity API so the wiring
// is identical to before but the ownership is now explicit and modular.
export default {
  id: ACTIVITY_ID,
  label: ACTIVITY_NAME,
  icon: ACTIVITY_ICON,
  builtin: IS_FIRST_PARTY,

  setup({ editor, services, log }) {
    // Directory stats for the active directory tab — owned here (Explorer's
    // context) rather than in the status bar, and published over the API so the
    // status widget and any other activity can read it. useSelection resets it
    // when the active tab isn't a directory.
    const dirStats = ref({ count: 0, totalSize: 0 })

    const sel = useSelection({
      editor,
      statusbar: { ...services.statusbar, dirStats },
      log,
      fsStat: services.fsStat,
      fsOpenWithSystem: services.fsOpenWithSystem,
      isArchiveItem: services.isArchiveItem,
      uuid: services.uuid,
    })

    const emitter = createEmitter()

    // The `selection` capability: a plain, reactive snapshot other activities read
    // without reaching into our refs. Resolved by the host for the active tab.
    const selection = computed(() => ({
      selectedItems:   sel.selectedItems.value,
      focusedItem:     sel.focusedItem.value,
      selectedPath:    sel.selectedPath.value,
      details:         sel.selectedDetails.value,
    }))

    // Notify subscribers when the selection changes. A shallow signature keeps us
    // from emitting on identical re-assignments.
    watch(
      () => [
        sel.selectedPath.value,
        sel.focusedItem.value?.path ?? null,
        sel.selectedItems.value.length,
      ].join('|'),
      () => emitter.emit('selection-change', selection.value),
    )

    return {
      // The activity API surface (queried/subscribed by other activities).
      selection,
      getSelection: () => selection.value,
      dirStats,
      setDirStats: (s) => { dirStats.value = s },
      on:   emitter.on,
      once: emitter.once,
      emit: emitter.emit,
      capabilities: { selection: true },

      // The raw selection slice (consumed by Workbench's own file-op / menu /
      // keyboard slices, which mutate selection directly). Spread last so its
      // names are available to existing consumers unchanged.
      ...sel,
    }
  },

  statusViews: {
    explorerStatus: { region: 'left', order: 0, component: markRaw(ExplorerStatusWidget) },
  },

  tabViews: {
    directory: {
      kind: 'dir',
      label: 'Directory',
      icon: mdiFolderMultiple,
      component: markRaw(DirectoryTab),
      // Editor tab views bind per-instance state: props receive (tab, ctx) where
      // `tab` is the leaf tab object and `ctx` carries shared editor context
      // (prefs, excluded categories). Events flow up via the host's listeners
      // (forwarded by TabContentHost), so no `on` map is needed here.
      props: (tab, ctx) => ({
        path:               tab.path,
        excludedCategories: ctx.excludedCategories,
        selectedPath:       tab.selectedPath ?? '',
        selectedItems:      tab.selectedItems ?? [],
        focusedItem:        tab.focusedItem ?? null,
        prefs:              ctx.prefs.explorer,
      }),
    },
  },

  panelViews: {
    explorer: {
      label: 'Explorer',
      icon: mdiFileTree,
      sections: ['places', 'openEditors'],
    },
  },

  sections: {
    places: {
      label: 'Places',
      icon: mdiFolderMultiple,
      homeView: 'explorer',
      component: markRaw(ExplorerPanel),
      expose: 'explorerPanelRef',
      actions: [
        { id: 'newFile',   title: 'New File',   icon: mdiFilePlusOutline,   run: ctx => ctx.showNewFileModal?.() },
        { id: 'newFolder', title: 'New Folder', icon: mdiFolderPlusOutline, run: ctx => ctx.showNewFolderModal?.() },
        { id: 'refresh',   title: 'Refresh',    icon: mdiRefresh,           run: ctx => ctx.refreshExplorer?.() },
        {
          id:    'toggleHidden',
          icon:  ctx => ctx.prefs.explorer.showHiddenFiles ? mdiEyeOff : mdiEye,
          title: ctx => ctx.prefs.explorer.showHiddenFiles ? 'Hide hidden items' : 'Show hidden items',
          run:   ctx => { ctx.prefs.explorer.showHiddenFiles = !ctx.prefs.explorer.showHiddenFiles },
        },
        {
          id:    'collapseExpand',
          icon:  ctx => ctx.explorerContext?.value?.expandedNodes?.length > 0 ? mdiCollapseAll : mdiExpandAll,
          title: ctx => ctx.explorerContext?.value?.expandedNodes?.length > 0 ? 'Collapse All' : 'Expand All',
          run:   ctx => {
            if (ctx.explorerContext?.value?.expandedNodes?.length > 0) ctx.collapseAllExplorer?.()
            else ctx.expandRootsExplorer?.()
          },
        },
      ],
      props: ctx => ({
        selectedPath:       ctx.explorerTreeFocus?.value?.path ?? '',
        showCheckboxes:     ctx.prefs.explorer.alwaysShowCheckboxes,
        showFiles:          ctx.prefs.explorer.showFiles ?? false,
        showHiddenFiles:    ctx.prefs.explorer.showHiddenFiles ?? false,
        isTreeView:         true,
        excludedCategories: ctx.prefs.excludedCategories,
        indentScale:        ctx.prefs.explorer.indentScale ?? 1.0,
        explorerState:      ctx.explorerContext.value,
      }),
      on: ctx => ({
        select:         (...a) => ctx.handleExplorerSelect?.(...a),
        dblclick:       (...a) => ctx.handleDoubleClick?.(...a),
        contextmenu:    (...a) => ctx.showItemContextMenu?.(...a),
        rename:         (...a) => ctx.handleRename?.(...a),
        move:           ({ items, destPath }) => ctx.doMove?.(items, destPath),
        'state-change': (...a) => ctx.updateExplorerContext?.(...a),
      }),
    },

    openEditors: {
      label: 'Open Editors',
      icon: mdiFileDocumentMultiple,
      homeView: 'explorer',
      component: markRaw(OpenEditorsView),
      props: ctx => ({
        editorRoot:    ctx.editorRoot.value,
        activeGroupId: ctx.activeGroupId.value,
      }),
    },
  },
}
