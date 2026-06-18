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
