import { markRaw } from 'vue'
import { mdiFileTree, mdiEye, mdiEyeOff, mdiInformation, mdiMessage, mdiBug, mdiFolderMultiple, mdiFileDocumentMultiple, mdiNotificationClearAll, mdiRefresh, mdiImage, mdiViewGrid, mdiFilePlusOutline, mdiFolderPlusOutline, mdiCollapseAll, mdiExpandAll } from '@mdi/js'

import ExplorerPanel   from '../components/workbench/explorer/ExplorerPanel.vue'
import OpenEditorsView from '../components/workbench/explorer/OpenEditorsView.vue'
import PreviewPanel    from '../components/workbench/views/PreviewPanel.vue'
import DebugPanel      from '../components/workbench/views/DebugPanel.vue'
import ChatPanel       from '../components/workbench/views/ChatPanel.vue'

import DetailsSectionInfo        from '../components/workbench/views/details/DetailsSectionInfo.vue'
import DetailsSectionMetadata    from '../components/workbench/views/details/DetailsSectionMetadata.vue'
import DetailsSectionEXIF        from '../components/workbench/views/details/DetailsSectionEXIF.vue'
import DetailsSectionXMP         from '../components/workbench/views/details/DetailsSectionXMP.vue'
import DetailsSectionIPTC        from '../components/workbench/views/details/DetailsSectionIPTC.vue'
import DetailsSectionRaw         from '../components/workbench/views/details/DetailsSectionRaw.vue'
import DetailsSectionPermissions from '../components/workbench/views/details/DetailsSectionPermissions.vue'
import DetailsSectionChecksums   from '../components/workbench/views/details/DetailsSectionChecksums.vue'

// ── View / section content registry ────────────────────────────────────────────
//
// Single source of truth mapping a view/section id to the component that renders
// it, the props it needs (derived from a shared `ctx` provided by Workbench), and
// the DOM events it emits. Rendering content by id — rather than through
// container-scoped named slots — lets any view or section render in any
// container, which is what cross-context section drag (a section "adopted" into a
// different View's area) requires.
//
// Entry shape:
//   label      display name (also the default heading/tab label)
//   icon       MDI path string
//   component  the Vue component (markRaw'd — no need for reactivity)
//   homeView   for sections: the View this section natively belongs to
//   sections   for Views that own sections: ordered section ids
//   props(ctx) → object of props bound to the component
//   on(ctx)    → object of event listeners
//   expose     name of a Workbench ref to populate with the mounted instance
const REGISTRY = {
  // ── Views that own sections ──
  explorer: {
    label: 'Explorer',
    icon: mdiFileTree,
    sections: ['places', 'openEditors'],
  },

  // ── Explorer's sections ──
  places: {
    label: 'Places',
    icon: mdiFolderMultiple,
    homeView: 'explorer',
    component: markRaw(ExplorerPanel),
    expose: 'explorerPanelRef',
    // Section-header actions (shown on hover/focus in the SplitSectionHeading).
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
      select:         ctx.handleExplorerSelect,
      dblclick:       ctx.handleDoubleClick,
      contextmenu:    ctx.showItemContextMenu,
      rename:         ctx.handleRename,
      move:           ({ items, destPath }) => ctx.doMove(items, destPath),
      'state-change': ctx.updateExplorerContext,
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

  // ── Preview view with sections ──
  preview: {
    label: 'Preview',
    icon: mdiEye,
    sections: ['previewMain'],
    // Doesn't accept docked sections from other views — the preview area is
    // intentionally single-purpose.
    acceptsSections: false,
  },
  previewMain: {
    label: 'Preview',
    homeView: 'preview',
    component: markRaw(PreviewPanel),
    alwaysShowHeading: true,
    actions: [
      {
        id: 'toggleMode',
        icon:  ctx => ctx.previewMode?.value === 'single' ? mdiViewGrid : mdiImage,
        title: ctx => ctx.previewMode?.value === 'single' ? 'Switch to multi-item preview' : 'Switch to single-item preview',
        run:   ctx => { if (ctx.previewMode) ctx.previewMode.value = ctx.previewMode.value === 'single' ? 'multi' : 'single' },
      },
    ],
    props: ctx => ({
      selectedItems:  ctx.selectedItems.value,
      focusedItem:    ctx.focusedItem.value,
      mode:           ctx.previewMode?.value ?? 'multi',
      editorFontSize: ctx.prefs.preview?.editorFontSize ?? 13,
    }),
  },

  // ── Details view with sections ──
  details: {
    label: 'Details',
    icon: mdiInformation,
    sections: ['detailsInfo', 'detailsMetadata', 'detailsExif', 'detailsXmp', 'detailsIptc', 'detailsRaw', 'detailsPermissions', 'detailsChecksums'],
  },

  detailsInfo: {
    label: 'Details',
    homeView: 'details',
    component: markRaw(DetailsSectionInfo),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
      selectedItem: ctx.focusedItem.value ?? ctx.selectedItems.value[0] ?? null,
      details:      ctx.selectedDetails.value,
    }),
    on: ctx => ({
      rename: ctx.handleRename,
    }),
  },
  detailsMetadata: {
    label: 'Metadata',
    homeView: 'details',
    component: markRaw(DetailsSectionMetadata),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
    }),
  },
  detailsExif: {
    label: 'Metadata: EXIF',
    homeView: 'details',
    component: markRaw(DetailsSectionEXIF),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
    }),
  },
  detailsXmp: {
    label: 'Metadata: XMP',
    homeView: 'details',
    component: markRaw(DetailsSectionXMP),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
    }),
  },
  detailsIptc: {
    label: 'Metadata: IPTC',
    homeView: 'details',
    component: markRaw(DetailsSectionIPTC),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
    }),
  },
  detailsRaw: {
    label: 'Metadata: RAW',
    homeView: 'details',
    component: markRaw(DetailsSectionRaw),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
    }),
  },
  detailsPermissions: {
    label: 'Permissions',
    homeView: 'details',
    component: markRaw(DetailsSectionPermissions),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
      details:      ctx.selectedDetails.value,
    }),
  },
  detailsChecksums: {
    label: 'Checksums',
    homeView: 'details',
    component: markRaw(DetailsSectionChecksums),
    props: ctx => ({
      selectedPath: ctx.selectedPath.value,
      details:      ctx.selectedDetails.value,
    }),
  },
  chat: {
    label: 'Chat',
    icon: mdiMessage,
    component: markRaw(ChatPanel),
    acceptsSections: false,
  },
  debug: {
    label: 'Debug',
    icon: mdiBug,
    component: markRaw(DebugPanel),
    // Context actions: shown in the tab strip while Debug is standalone, and in
    // its SplitViewHeading once merged with other views. `run` receives ctx.
    actions: [
      { id: 'clear', title: 'Clear', icon: mdiNotificationClearAll, run: ctx => ctx.debugLog.clear() },
    ],
  },
}

export function getViewEntry(id) {
  return REGISTRY[id] ?? null
}

// Whether other Views' sections may be docked into this View (default true).
export function viewAcceptsSections(viewId) {
  return getViewEntry(viewId)?.acceptsSections !== false
}

// Whether a View may hold the same section id more than once (default false). When
// false, dropping a section a View already has is blocked; when true, the section
// can appear twice. (Rendering true duplicates correctly needs per-instance keys —
// not yet wired — so this stays opt-in and unset.)
export function viewAllowsDuplicateSections(viewId) {
  return getViewEntry(viewId)?.allowDuplicateSections === true
}

// ── Action buttons & heading visibility ────────────────────────────────────────
// Buttons cascade by hierarchy: a section's buttons live in its section heading
// when shown, else bubble to the view heading, else to the tab strip; a view's
// buttons live in its view heading when shown, else the tab strip. Each level
// renders the groups it holds inline, separated, with panel actions last.

// A View's own action buttons (e.g. Debug's Clear).
export function viewActions(viewId) {
  return getViewEntry(viewId)?.actions ?? []
}

// A named section's own action buttons (e.g. Places' Refresh).
export function sectionActions(sectionId) {
  return getViewEntry(sectionId)?.actions ?? []
}

// Whether a section's heading is rendered: when its View has more than one
// section, or the section opts in via `alwaysShowHeading` (e.g. Places, so its
// heading — and Refresh button — stay put even when it's Explorer's only section).
export function sectionHeadingShown(sections, section) {
  return (Array.isArray(sections) && sections.length > 1) || !!section?.alwaysShowHeading
}

// Section actions that must bubble up because their own heading is hidden. A
// self-section (id === viewId) contributes nothing — it's the View's own content,
// represented by viewActions. Named sections whose heading shows keep their
// buttons there.
export function bubbledSectionActions(viewId, sections) {
  const out = []
  for (const s of (sections ?? [])) {
    if (s.id === viewId) continue
    if (sectionHeadingShown(sections, s)) continue
    out.push(...sectionActions(s.id))
  }
  return out
}

// ── Semantic DOM ID helpers ────────────────────────────────────────────────────
// Used to stamp data-view-id / data-section-id / data-section-instance-uuid
// attributes onto rendered elements for automation and DevTools inspection.

function _cap(str) { return str.charAt(0).toUpperCase() + str.slice(1) }

// e.g. 'explorer' → 'Workbench:Explorer'
export function viewDataId(viewId) {
  return `Workbench:${_cap(viewId)}`
}

// e.g. ('openEditors', 'explorer') → 'Workbench:Explorer.OpenEditors'
//      ('debug', 'debug')          → 'Workbench:Debug'  (self-section)
export function sectionDataId(sectionId, homeViewId) {
  const home = homeViewId ?? sectionId
  if (sectionId === home) return `Workbench:${_cap(sectionId)}`
  return `Workbench:${_cap(home)}.${_cap(sectionId)}`
}

export function useViewRegistry() {
  return { registry: REGISTRY, getViewEntry }
}
