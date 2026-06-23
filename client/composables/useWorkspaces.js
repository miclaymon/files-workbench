import { ref, computed } from 'vue'

const STORAGE_KEY     = 'files-workbench.workspaces'
const OLD_STATE_KEY   = 'workbench-state'
const OLD_TREE_KEY    = 'workbench-explorer-tree'

// ─── UUID generators ────────────────────────────────────────────────────────

function uuidv7() {
  const now = Date.now()
  const bytes = new Uint8Array(16)
  // 48-bit timestamp (big-endian)
  bytes[0] = (now / 0x10000000000) & 0xff
  bytes[1] = (now / 0x100000000)   & 0xff
  bytes[2] = (now >>> 24)           & 0xff
  bytes[3] = (now >>> 16)           & 0xff
  bytes[4] = (now >>> 8)            & 0xff
  bytes[5] =  now                   & 0xff
  crypto.getRandomValues(bytes.subarray(6))
  bytes[6] = (bytes[6] & 0x0f) | 0x70  // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80  // variant
  const h = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

function uuidv4() {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const h = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20)}`
}

export { uuidv4 }

// ─── Default section layouts ─────────────────────────────────────────────────

const DEFAULT_SECTIONS = {
  explorer: [
    { id: 'places',      title: 'Places',       homeViewId: 'explorer', collapsed: false, size: 4, locked: true, alwaysShowHeading: true },
    { id: 'openEditors', title: 'Open Editors', homeViewId: 'explorer', collapsed: true,  size: 1 },
  ],
  preview: [
    { id: 'previewMain', title: 'Preview', homeViewId: 'preview', collapsed: false, size: 1, locked: true, alwaysShowHeading: true },
  ],
  details: [
    { id: 'detailsInfo',     title: 'Details',  homeViewId: 'details', collapsed: false, size: 4, locked: true },
    { id: 'detailsMetadata', title: 'Metadata', homeViewId: 'details', collapsed: true,  size: 1 },
    { id: 'detailsExif',     title: 'EXIF',           homeViewId: 'details', collapsed: true,  size: 1 },
    { id: 'detailsXmp',      title: 'XMP',            homeViewId: 'details', collapsed: true,  size: 1 },
    { id: 'detailsIptc',     title: 'Metadata: IPTC', homeViewId: 'details', collapsed: true,  size: 1 },
    { id: 'detailsRaw',      title: 'RAW',            homeViewId: 'details', collapsed: true,  size: 1 },
    // Permissions and Checksums are intentionally absent — they appear as ghosts
    // in the "More Actions…" menu and must be opted in by the user.
  ],
}

// The container each defaulted view's sections belong to. Used to scope the
// default-section backfill: a view's sections must seed ONLY into its own
// container's backing state, never into every container (which would make each
// container claim it owns that view — see getViewSections). A view the user has
// dragged elsewhere persists its own viewSections entry, which takes precedence.
const DEFAULT_VIEW_CONTAINER = {
  explorer: 'primarySidebar',
  preview:  'secondarySidebar',
  details:  'secondarySidebar',
}

// ─── Default workspace factory ───────────────────────────────────────────────

function createDefaultWorkspace({ name = 'Default' } = {}) {
  const now     = new Date().toISOString()
  const homeId  = uuidv4()
  const groupId = uuidv4()
  return {
    uuid: uuidv7(),
    name,
    version: 5,
    dateCreated:  now,
    dateModified: now,
    dateAccessed: now,
    dateDeleted:  null,
    layout: {
      primarySidebar: {
        isOpen: true,
        width: 240,
        activeViewContainerId: 'explorer',
        // Per-view section lists (the SplitSectionArea level). Keyed by view id;
        // each section carries its home ("biological") View.
        viewSections: {
          explorer: DEFAULT_SECTIONS.explorer.map(s => ({ ...s, instanceId: uuidv4() })),
        },
        views: [
          {
            id: 'explorer',
            name: 'Explorer',
            context: { childrenByPath: {}, expandedNodes: [], selectedNodes: [] },
          },
        ],
      },
      secondarySidebar: {
        isOpen: true,
        width: 380,
        activeViewContainerId: 'preview',
        viewContainerOrder: ['preview', 'details', 'chat'],
        viewSections: {},
        mergeGroups: {},
      },
      panel: {
        isOpen: true,
        height: 150,
        activeViewContainerId: 'debug',
        viewContainerOrder: ['debug'],
        viewSections: {},
        mergeGroups: {},
        hiddenViews: [],
      },
      editor: {
        root: {
          type: 'leaf',
          id: groupId,
          activeTabId: homeId,
          tabs: [
            {
              id: homeId,
              type: 'Home',
              title: 'Home',
              subtitle: null,
              timestampAdded:   now,
              timestampViewed:  now,
              timestampUpdated: now,
              isPinned: false,
              isPeeked: false,
              context: {},
            },
          ],
        },
        activeGroupId: groupId,
      },
      context: {},
    },
  }
}

// ─── Migration from v1 keys ──────────────────────────────────────────────────

function migrateFromOldKeys() {
  const ws = createDefaultWorkspace({ name: 'Default' })
  try {
    const s = JSON.parse(localStorage.getItem(OLD_STATE_KEY) ?? 'null')
    if (s) {
      ws.layout.primarySidebar.isOpen               = s.sidebarVisible   ?? true
      ws.layout.primarySidebar.width                = s.sidebarWidth     ?? 240
      ws.layout.primarySidebar.activeViewContainerId = s.activeActivity  ?? 'explorer'
      ws.layout.secondarySidebar.width              = s.rightpaneWidth   ?? 380
      ws.layout.secondarySidebar.activeViewContainerId = s.rightPanel    ?? 'preview'
      ws.layout.panel.height                        = s.bottompaneHeight ?? 150
    }
  } catch {}
  try {
    const t = JSON.parse(localStorage.getItem(OLD_TREE_KEY) ?? 'null')
    if (t) {
      const view = ws.layout.primarySidebar.views.find(v => v.id === 'explorer')
      if (view) {
        view.context.childrenByPath = t.childrenByPath ?? {}
        view.context.expandedNodes  = t.expanded       ?? []
      }
    }
  } catch {}
  return ws
}

// ─── Load/save ───────────────────────────────────────────────────────────────

function loadWorkspaces() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed.map(migrateWorkspace)
    }
  } catch {}
  return [migrateFromOldKeys()]
}

// Upgrade an older persisted workspace to the current schema.
// v1 → v2: a flat `editor.tabs` list becomes a single-group editor grid.
// v2 → v3: panel.left/right/bottom renamed to primarySidebar/secondarySidebar/panel.
// v3 → v4: "activity" terminology renamed to "view" (Activity Bar stays a
// distinct concept; what we called activities are views hosted in a ViewContainer).
function migrateWorkspace(ws) {
  if (!ws || !ws.layout) return ws

  // v1 → v2
  const editor = ws.layout.editor ?? {}
  if (!editor.root) {
    const groupId = uuidv4()
    const tabs = (editor.tabs ?? []).map(t => ({ ...t, isPinned: false }))
    if (!tabs.length) {
      const now = new Date().toISOString()
      const homeId = uuidv4()
      tabs.push({
        id: homeId, type: 'Home', title: 'Home', subtitle: null,
        timestampAdded: now, timestampViewed: now, timestampUpdated: now,
        isPinned: false, isPeeked: false, context: {},
      })
      editor.activeTabId = homeId
    }
    ws.layout.editor = {
      root: { type: 'leaf', id: groupId, activeTabId: editor.activeTabId ?? tabs[0]?.id ?? null, tabs },
      activeGroupId: groupId,
    }
    ws.version = 2
  }

  // v2 → v3: rename panel areas to VS Code naming
  if (!ws.layout.primarySidebar) {
    const oldPanel = ws.layout.panel ?? {}
    const left   = oldPanel.left   ?? {}
    const right  = oldPanel.right  ?? {}
    const bottom = oldPanel.bottom ?? {}

    ws.layout.primarySidebar = {
      isOpen: left.isOpen ?? true,
      width:  left.width  ?? 240,
      activeViewContainerId: left.activeActivityId ?? 'explorer',
      sectionState: {
        explorer: { sections: DEFAULT_SECTIONS.explorer.map(s => ({ ...s, instanceId: uuidv4() })) },
      },
      views: left.views ?? left.activities ?? [
        { id: 'explorer', name: 'Explorer', context: { childrenByPath: {}, expandedNodes: [], selectedNodes: [] } },
      ],
    }

    ws.layout.secondarySidebar = {
      isOpen: right.isOpen ?? true,
      width:  right.width  ?? 380,
      activeViewContainerId: right.activeActivityId ?? 'preview',
      viewContainerOrder: (right.activities ?? [
        { id: 'preview' }, { id: 'details' }, { id: 'chat' },
      ]).map(a => a.id),
      sectionState: [
        { id: 'preview', collapsed: false, size: 2 },
        { id: 'details', collapsed: true,  size: 1 },
        { id: 'chat',    collapsed: true,  size: 1 },
      ],
      mergeGroups: {},
    }

    ws.layout.panel = {
      isOpen: bottom.isOpen ?? true,
      height: bottom.height ?? 150,
      activeViewContainerId: 'debug',
      viewContainerOrder: ['debug'],
      sectionState: [{ id: 'debug', collapsed: false, size: 1 }],
      mergeGroups: {},
      hiddenViews: [],
    }

    ws.version = 3
  }

  // v3 → v4: rename persisted "activity" fields to "view" terminology
  if (ws.version === 3) {
    if (ws.layout.primarySidebar && !ws.layout.primarySidebar.views) {
      ws.layout.primarySidebar.views = ws.layout.primarySidebar.activities ?? []
      delete ws.layout.primarySidebar.activities
    }
    if (ws.layout.panel && !ws.layout.panel.hiddenViews) {
      ws.layout.panel.hiddenViews = ws.layout.panel.hiddenActivities ?? []
      delete ws.layout.panel.hiddenActivities
    }
    ws.version = 4
  }

  // v4 → v5: unify section storage into a per-container `viewSections` map keyed
  // by view id (the SplitSectionArea level). The primary sidebar's explorer
  // sections move out of `sectionState.explorer.sections`; movable containers
  // start empty (per-view sections only appear once a section is adopted in).
  if (ws.version === 4) {
    const ps = ws.layout.primarySidebar
    if (ps && !ps.viewSections) {
      const stored = ps.sectionState?.explorer?.sections
      ps.viewSections = {
        explorer: (Array.isArray(stored) && stored.length ? stored : DEFAULT_SECTIONS.explorer).map(s => ({ ...s, instanceId: s.instanceId || uuidv4() })),
      }
      delete ps.sectionState
    }
    for (const cid of ['secondarySidebar', 'panel']) {
      if (ws.layout[cid] && !ws.layout[cid].viewSections) {
        ws.layout[cid].viewSections = {}
        delete ws.layout[cid].sectionState   // legacy, unused
      }
    }
    ws.version = 5
  }

  // v3 patch: panel.isOpen was false by default before hide/show UI existed.
  // Since users never had a way to hide the panel, any false value is from the
  // old default — reset to true so the panel stays visible after the upgrade.
  if (ws.version === 3 && ws.layout.panel?.isOpen === false) {
    ws.layout.panel.isOpen = true
  }

  // Backfill the per-container viewSections map for any container missing it.
  for (const cid of ['primarySidebar', 'secondarySidebar', 'panel']) {
    if (ws.layout[cid] && !ws.layout[cid].viewSections) {
      ws.layout[cid].viewSections = cid === 'primarySidebar'
        ? { explorer: DEFAULT_SECTIONS.explorer.map(s => ({ ...s, instanceId: uuidv4() })) }
        : {}
    }
  }
  if (ws.layout.secondarySidebar && !ws.layout.secondarySidebar.mergeGroups) {
    ws.layout.secondarySidebar.mergeGroups = {}
  }
  if (ws.layout.panel && !ws.layout.panel.mergeGroups) {
    ws.layout.panel.mergeGroups = {}
  }
  if (ws.layout.panel && !ws.layout.panel.viewContainerOrder) {
    ws.layout.panel.viewContainerOrder = [ws.layout.panel.activeViewContainerId ?? 'debug']
  }
  if (ws.layout.panel && !ws.layout.panel.hiddenViews) {
    ws.layout.panel.hiddenViews = []
  }

  return ws
}

// ─── Tab serialisation ───────────────────────────────────────────────────────

export function wsTabToRuntime(tab) {
  return {
    id:            tab.id,
    kind:          tab.type === 'Home' ? 'home' : tab.type === 'Directory' ? 'dir' : (tab.type ?? 'home').toLowerCase(),
    title:         tab.title ?? '',
    path:          tab.context?.path         ?? '',
    selectedPath:  tab.context?.selectedPath ?? '',
    mode:          tab.isPeeked ? 'peek' : 'normal',
    pinned:        !!tab.isPinned,
    selectedItems: tab.context?.selectedItems ?? [],
    focusedItem:   tab.context?.focusedItem   ?? null,
  }
}

export function runtimeTabToWs(tab, existing = null) {
  const now = new Date().toISOString()
  const typeMap = { home: 'Home', dir: 'Directory', preferences: 'Preferences' }
  return {
    id:               tab.id,
    type:             typeMap[tab.kind] ?? 'Home',
    title:            tab.title ?? '',
    subtitle:         null,
    timestampAdded:   existing?.timestampAdded   ?? now,
    timestampViewed:  now,
    timestampUpdated: now,
    isPinned:         !!tab.pinned,
    isPeeked:         tab.mode === 'peek',
    isActive:         false,
    context: {
      path:          tab.path          ?? '',
      selectedPath:  tab.selectedPath  ?? '',
      selectedItems: tab.selectedItems ?? [],
      focusedItem:   tab.focusedItem   ?? null,
    },
  }
}

// ─── Editor grid serialisation (persisted ⇄ runtime) ──────────────────────────

export function wsGridToRuntime(node) {
  if (!node) return null
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      id: node.id,
      activeTabId: node.activeTabId ?? node.tabs?.[0]?.id ?? null,
      tabs: (node.tabs ?? []).map(wsTabToRuntime),
      tabPreviews: node.tabPreviews !== false,
      locked: node.locked ?? false,
    }
  }
  return {
    type: 'branch',
    id: node.id,
    direction: node.direction === 'column' ? 'column' : 'row',
    sizes: Array.isArray(node.sizes) ? [...node.sizes] : (node.children ?? []).map(() => 1),
    children: (node.children ?? []).map(wsGridToRuntime),
  }
}

function collectWsTabs(node, acc = {}) {
  if (!node) return acc
  if (node.type === 'leaf') (node.tabs ?? []).forEach(t => { acc[t.id] = t })
  else (node.children ?? []).forEach(c => collectWsTabs(c, acc))
  return acc
}

export function runtimeGridToWs(node, prevById = {}) {
  if (!node) return null
  if (node.type === 'leaf') {
    return {
      type: 'leaf',
      id: node.id,
      activeTabId: node.activeTabId ?? node.tabs?.[0]?.id ?? null,
      tabs: (node.tabs ?? []).map(t => runtimeTabToWs(t, prevById[t.id])),
      tabPreviews: node.tabPreviews !== false,
      locked: node.locked ?? false,
    }
  }
  return {
    type: 'branch',
    id: node.id,
    direction: node.direction === 'column' ? 'column' : 'row',
    sizes: Array.isArray(node.sizes) ? [...node.sizes] : (node.children ?? []).map(() => 1),
    children: (node.children ?? []).map(c => runtimeGridToWs(c, prevById)),
  }
}

// ─── Composable ──────────────────────────────────────────────────────────────

export function useWorkspaces() {
  const workspaces = ref(loadWorkspaces())

  // Restore most-recently-accessed workspace
  const sorted = [...workspaces.value].sort(
    (a, b) => (b.dateAccessed > a.dateAccessed ? 1 : -1)
  )
  const activeWorkspaceId = ref(sorted[0]?.uuid ?? workspaces.value[0]?.uuid ?? null)

  const activeWorkspace = computed(() =>
    workspaces.value.find(w => w.uuid === activeWorkspaceId.value) ?? workspaces.value[0]
  )

  let saveTimer = null
  function scheduleSave() {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(workspaces.value)) } catch {}
    }, 500)
  }

  function mutate(fn) {
    if (!activeWorkspace.value) return
    fn(activeWorkspace.value)
    scheduleSave()
  }

  // ── Layout: primary sidebar ─────────────────────────────────────────────

  const sidebarVisible = computed({
    get: () => activeWorkspace.value?.layout.primarySidebar?.isOpen ?? true,
    set: v  => mutate(ws => { ws.layout.primarySidebar.isOpen = v }),
  })
  const sidebarWidth = computed({
    get: () => activeWorkspace.value?.layout.primarySidebar?.width ?? 240,
    set: v  => mutate(ws => { ws.layout.primarySidebar.width = v }),
  })
  const activePrimaryView = computed({
    get: () => activeWorkspace.value?.layout.primarySidebar?.activeViewContainerId ?? 'explorer',
    set: v  => mutate(ws => { ws.layout.primarySidebar.activeViewContainerId = v }),
  })

  // ── Layout: secondary sidebar ────────────────────────────────────────────

  const rightpaneVisible = computed({
    get: () => activeWorkspace.value?.layout.secondarySidebar?.isOpen ?? true,
    set: v  => mutate(ws => { ws.layout.secondarySidebar.isOpen = v }),
  })
  const rightpaneWidth = computed({
    get: () => activeWorkspace.value?.layout.secondarySidebar?.width ?? 380,
    set: v  => mutate(ws => { ws.layout.secondarySidebar.width = v }),
  })
  const rightPanel = computed({
    get: () => activeWorkspace.value?.layout.secondarySidebar?.activeViewContainerId ?? 'preview',
    set: v  => mutate(ws => { ws.layout.secondarySidebar.activeViewContainerId = v }),
  })

  // Ordered view container IDs for the secondary sidebar
  const rightPanelViewIds = computed({
    get: () => activeWorkspace.value?.layout.secondarySidebar?.viewContainerOrder ?? ['preview', 'details', 'chat'],
    set: ids => mutate(ws => { ws.layout.secondarySidebar.viewContainerOrder = ids }),
  })

  // Merge groups for the secondary sidebar (persisted)
  const secondarySidebarMergeGroups = computed({
    get: () => activeWorkspace.value?.layout.secondarySidebar?.mergeGroups ?? {},
    set: v  => mutate(ws => { ws.layout.secondarySidebar.mergeGroups = v }),
  })

  // ── Layout: bottom panel ────────────────────────────────────────────────

  const bottompaneVisible = computed({
    get: () => activeWorkspace.value?.layout.panel?.isOpen ?? true,
    set: v  => mutate(ws => { ws.layout.panel.isOpen = v }),
  })
  const bottompaneHeight = computed({
    get: () => activeWorkspace.value?.layout.panel?.height ?? 150,
    set: v  => mutate(ws => { ws.layout.panel.height = v }),
  })

  const bottomPanel = computed({
    get: () => activeWorkspace.value?.layout.panel?.activeViewContainerId ?? 'debug',
    set: v  => mutate(ws => { ws.layout.panel.activeViewContainerId = v }),
  })
  const bottomPanelViewIds = computed({
    get: () => activeWorkspace.value?.layout.panel?.viewContainerOrder ?? ['debug'],
    set: ids => mutate(ws => { ws.layout.panel.viewContainerOrder = ids }),
  })

  const hiddenViews = computed({
    get: () => activeWorkspace.value?.layout.panel?.hiddenViews ?? [],
    set: v  => mutate(ws => { ws.layout.panel.hiddenViews = v }),
  })

  // Merge groups for the bottom panel (persisted)
  const panelMergeGroups = computed({
    get: () => activeWorkspace.value?.layout.panel?.mergeGroups ?? {},
    set: v  => mutate(ws => { ws.layout.panel.mergeGroups = v }),
  })

  // ── Per-view section state (unified across all containers) ────────────────
  //
  // viewSections[containerId] = { [viewId]: Section[] }
  // Section = { id, homeViewId, collapsed, size, title?, locked? }
  // A view absent from the map renders a single implicit self-section (its own
  // content, no section heading). Sections only get an explicit entry once a
  // view owns >1 section (Explorer) or has adopted a foreign section (P4).

  // The home ("biological") View of a section: explicit if set, else 'explorer'
  // for the explorer container, else the view's own id (an implicit self-section).
  function _homeOf(viewId, s) {
    if (s.homeViewId) return s.homeViewId
    return viewId === 'explorer' ? 'explorer' : s.id
  }

  function _normalizeSections(viewId, sections) {
    const out = sections.map(s => {
      // Rename 'folders' → 'places' for any data written before that rename.
      const r = s.id === 'folders'
        ? { ...s, id: 'places', title: s.title === 'Folders' ? 'Places' : s.title }
        : { ...s }
      r.homeViewId = _homeOf(viewId, r)
      if (!r.instanceId) r.instanceId = uuidv4()
      return r
    })
    // Explorer invariant: Places stays locked (essential — can't be hidden or
    // pulled out of Explorer). Its position is no longer forced; the user may
    // reorder it within the Explorer section area, and that order persists.
    if (viewId === 'explorer') {
      for (const s of out) {
        const def = DEFAULT_SECTIONS.explorer.find(d => d.id === s.id)
        if (def?.locked) s.locked = true
        if (def?.alwaysShowHeading) s.alwaysShowHeading = true
      }
    }
    return out
  }

  // The view ids actually present in a container: its standalone tabs plus any
  // merged sub-views. Used to tell a genuinely-adopted/merged foreign view from
  // phantom section-state left behind by the old backfill-everywhere bug.
  function _viewsPresentIn(layout) {
    const merges = layout?.mergeGroups ?? {}
    return new Set([
      ...(layout?.viewContainerOrder ?? []),
      ...(layout?.views ?? []).map(v => v.id),
      ...Object.keys(merges),
      ...Object.values(merges).flat().map(sv => sv?.id).filter(Boolean),
    ])
  }

  function getViewSections(containerId) {
    const layout = activeWorkspace.value?.layout[containerId]
    const stored = layout?.viewSections ?? {}
    const present = _viewsPresentIn(layout)
    const out = {}
    for (const [viewId, sections] of Object.entries(stored)) {
      if (!Array.isArray(sections) || !sections.length) continue
      // Drop phantom section-state a foreign container accumulated from the old
      // backfill-everywhere bug: a *defaulted* view (explorer/preview/details)
      // whose home container isn't this one and that isn't actually present here.
      // Plugin views and genuine adoptions (present in the container) are kept.
      if (DEFAULT_SECTIONS[viewId]
          && DEFAULT_VIEW_CONTAINER[viewId] !== containerId
          && !present.has(viewId)) continue
      out[viewId] = _normalizeSections(viewId, sections)
    }
    // The primary sidebar always has Explorer's sections.
    if (containerId === 'primarySidebar' && !out.explorer) {
      out.explorer = DEFAULT_SECTIONS.explorer.map(s => ({ ...s }))
    }
    // Backfill a view's declared default sections — but ONLY into the container
    // that view belongs to (handles a view added after workspace creation without
    // a version bump). Seeding into every container would pollute each container's
    // backing section-state with foreign views, so a section dropped anywhere
    // looks like a duplicate of one "already" in the destination and the
    // section-adoption drop is rejected. See DEFAULT_VIEW_CONTAINER.
    for (const [viewId, defaults] of Object.entries(DEFAULT_SECTIONS)) {
      if (DEFAULT_VIEW_CONTAINER[viewId] === containerId && !out[viewId]) {
        out[viewId] = defaults.map(s => ({ ...s, instanceId: `${s.id}-default` }))
      }
    }
    return out
  }

  function saveViewSections(containerId, map) {
    mutate(ws => {
      ws.layout[containerId] ??= {}
      ws.layout[containerId].viewSections = Object.fromEntries(
        Object.entries(map).map(([viewId, sections]) => [viewId, sections.map(s => ({ ...s }))])
      )
    })
  }

  // ── Explorer tree context ────────────────────────────────────────────────

  function _explorerView(ws) {
    return ws.layout.primarySidebar?.views?.find(v => v.id === 'explorer')
  }

  const explorerContext = computed(() => {
    const ws = activeWorkspace.value
    if (!ws) return { childrenByPath: {}, expandedNodes: [], selectedNodes: [] }
    return _explorerView(ws)?.context ?? { childrenByPath: {}, expandedNodes: [], selectedNodes: [] }
  })

  function updateExplorerContext(ctx) {
    mutate(ws => {
      const view = _explorerView(ws)
      if (view) view.context = { ...view.context, ...ctx }
    })
  }

  // ── Tabs ─────────────────────────────────────────────────────────────────

  function getInitialEditor() {
    const editor = activeWorkspace.value?.layout.editor
    if (!editor?.root) {
      const tabId = uuidv4()
      const leaf = {
        type: 'leaf', id: uuidv4(), activeTabId: tabId,
        tabs: [{ id: tabId, kind: 'home', title: 'Home', mode: 'normal', pinned: false, selectedItems: [], focusedItem: null, selectedPath: '', path: '' }],
      }
      return { root: leaf, activeGroupId: leaf.id }
    }
    return { root: wsGridToRuntime(editor.root), activeGroupId: editor.activeGroupId ?? editor.root.id }
  }

  function saveEditor(root, activeGroupId) {
    mutate(ws => {
      const prevById = collectWsTabs(ws.layout.editor?.root)
      ws.layout.editor = { root: runtimeGridToWs(root, prevById), activeGroupId }
    })
  }

  // ── Workspace CRUD ───────────────────────────────────────────────────────

  function createWorkspace(name = 'New Workspace') {
    const ws = createDefaultWorkspace({ name })
    workspaces.value.push(ws)
    scheduleSave()
    return ws.uuid
  }

  function switchWorkspace(uuid) {
    const ws = workspaces.value.find(w => w.uuid === uuid)
    if (!ws) return false
    if (activeWorkspace.value) activeWorkspace.value.dateModified = new Date().toISOString()
    ws.dateAccessed      = new Date().toISOString()
    activeWorkspaceId.value = uuid
    scheduleSave()
    return true
  }

  function deleteWorkspace(uuid) {
    if (workspaces.value.length <= 1) return false
    const idx = workspaces.value.findIndex(w => w.uuid === uuid)
    if (idx === -1) return false
    workspaces.value.splice(idx, 1)
    if (activeWorkspaceId.value === uuid) activeWorkspaceId.value = workspaces.value[0].uuid
    scheduleSave()
    return true
  }

  function renameWorkspace(uuid, name) {
    const ws = workspaces.value.find(w => w.uuid === uuid)
    if (!ws) return
    ws.name         = name
    ws.dateModified = new Date().toISOString()
    scheduleSave()
  }

  return {
    workspaces,
    activeWorkspaceId,
    activeWorkspace,
    // Layout: primary sidebar
    sidebarVisible,
    sidebarWidth,
    activePrimaryView,
    // Layout: secondary sidebar
    rightpaneVisible,
    rightpaneWidth,
    rightPanel,
    rightPanelViewIds,
    secondarySidebarMergeGroups,
    // Layout: bottom panel
    bottompaneVisible,
    bottompaneHeight,
    bottomPanel,
    bottomPanelViewIds,
    hiddenViews,
    panelMergeGroups,
    // Per-view section state (unified across all containers)
    getViewSections,
    saveViewSections,
    // Explorer
    explorerContext,
    updateExplorerContext,
    // Editor grid
    getInitialEditor,
    saveEditor,
    // Workspace management
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    renameWorkspace,
  }
}
