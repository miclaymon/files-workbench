import { markRaw } from 'vue'
import { mdiFileTree, mdiEye, mdiInformation, mdiMessage, mdiBug, mdiFolderMultiple, mdiFileDocumentMultiple, mdiNotificationClearAll, mdiRefresh } from '@mdi/js'

import ExplorerPanel   from '../components/workbench/explorer/ExplorerPanel.vue'
import OpenEditorsView from '../components/workbench/explorer/OpenEditorsView.vue'
import PreviewPanel    from '../components/workbench/views/PreviewPanel.vue'
import DetailsPanel    from '../components/workbench/views/DetailsPanel.vue'
import DebugPanel      from '../components/workbench/views/DebugPanel.vue'
import ChatPanel       from '../components/workbench/views/ChatPanel.vue'

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
      { id: 'refresh', title: 'Refresh', icon: mdiRefresh, run: ctx => ctx.refreshExplorer?.() },
    ],
    props: ctx => ({
      selectedPath:       ctx.selectedPath.value,
      showCheckboxes:     ctx.prefs.explorer.alwaysShowCheckboxes,
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

  // ── Standalone panel views (no sections) ──
  preview: {
    label: 'Preview',
    icon: mdiEye,
    component: markRaw(PreviewPanel),
    // Single-section only: never accepts a docked section; its lone section is
    // unnamed and headerless, so view + section actions live in the tab strip.
    acceptsSections: false,
    props: ctx => ({
      selectedItems:  ctx.selectedItems.value,
      editorFontSize: ctx.prefs.preview?.editorFontSize ?? 13,
    }),
  },
  details: {
    label: 'Details',
    icon: mdiInformation,
    component: markRaw(DetailsPanel),
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

// The action buttons shown at a View's level (tab strip / SplitViewHeading): the
// View's own actions, plus — when the View is down to a single *named* section
// whose header is therefore hidden — that section's actions, promoted up so they
// stay reachable. A self-section (id === viewId) adds nothing extra.
export function resolveViewActions(viewId, sections) {
  const acts = [...(getViewEntry(viewId)?.actions ?? [])]
  if (Array.isArray(sections) && sections.length === 1 && sections[0].id !== viewId) {
    acts.push(...(getViewEntry(sections[0].id)?.actions ?? []))
  }
  return acts
}

export function useViewRegistry() {
  return { registry: REGISTRY, getViewEntry }
}
