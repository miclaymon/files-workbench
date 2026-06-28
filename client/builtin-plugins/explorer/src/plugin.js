import { markRaw, ref, computed, watch } from 'vue'
import {
  mdiFileTree, mdiEye, mdiEyeOff, mdiFolder, mdiFolderMultiple, mdiFileDocumentMultiple,
  mdiRefresh, mdiFilePlusOutline, mdiFolderPlusOutline, mdiCollapseAll, mdiExpandAll,
} from '@mdi/js'

import ExplorerPanel   from '~/components/workbench/explorer/ExplorerPanel.vue'
import OpenEditorsView from '~/components/workbench/explorer/OpenEditorsView.vue'
import DirectoryTab         from '~/components/workbench/editor/DirectoryTab.vue'
import ExplorerStatusWidget from '~/components/workbench/shell/status/ExplorerStatusWidget.vue'

import { useSelection } from '~/composables/workbench/useSelection.js'
import { createEmitter } from '~/composables/activity/useEmitter.js'

// Explorer plugin entry. The most central first-party plugin: it owns the
// file/directory selection context and contributes the core file-browsing
// surfaces — all through the same plugin host + permission-scoped api the other
// plugins use (no longer compiled into ACTIVITIES).
//
// Privileged first-party: its activity `setup` receives the internal wiring every
// activity setup gets (editor grid, app services, log), because it wraps the
// useSelection slice and publishes the `selection` capability that Preview /
// Details / status widgets read through host.selection. Workbench pulls the same
// selection refs/handlers out of host.api('explorer') exactly as before — which is
// why the plugin must load before those slices are built (see Workbench.vue).
//
// Surfaces:
//   tabView    directory   — the navigable directory editor (kind 'dir')
//   panelView  explorer    — the PrimarySideBar tree, owning Places + Open Editors
//   sections   places, openEditors
//   statusView explorerStatus — left-aligned dir-stats/selection widget
export function activate(api) {
  const { Activity, EditorView, PanelView, ViewSection, StatusView } = api

  // The activity API surface — identical to the former Explorer activity's setup,
  // wrapping useSelection and publishing the selection capability. Receives the
  // host's internal wiring (editor/services/log) via instantiateActivity.
  function setup({ editor, services, log }) {
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
  }

  const activity = new Activity({ id: api.manifest.id, label: 'Explorer', icon: mdiFileTree, builtin: true, setup })
    .addView(new EditorView({
      id: 'directory',
      kind: 'dir',
      label: 'Directory',
      icon: mdiFolder,   // shown on directory editor tabs (resolved by kind)
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
    }))
    .addView(new PanelView({
      id: 'explorer',
      label: 'Explorer',
      icon: mdiFileTree,
      location: 'PrimarySideBar',
      sections: ['places', 'openEditors'],
    }))
    .addView(new ViewSection({
      id: 'places',
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
          // The Places tree owns its hidden-item visibility (persisted per workspace
          // in explorerContext), independent of the global showHiddenFiles pref.
          icon:  ctx => ctx.explorerContext?.value?.showHidden ? mdiEyeOff : mdiEye,
          title: ctx => ctx.explorerContext?.value?.showHidden ? 'Hide hidden items' : 'Show hidden items',
          run:   ctx => ctx.toggleExplorerHidden?.(),
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
    }))
    .addView(new ViewSection({
      id: 'openEditors',
      label: 'Open Editors',
      icon: mdiFileDocumentMultiple,
      homeView: 'explorer',
      component: markRaw(OpenEditorsView),
      props: ctx => ({
        editorRoot:    ctx.editorRoot.value,
        activeGroupId: ctx.activeGroupId.value,
      }),
    }))
    .addView(new StatusView({ id: 'explorerStatus', region: 'left', order: 0, component: markRaw(ExplorerStatusWidget) }))

  return api.activities.register(activity)
}

export function deactivate() {}
