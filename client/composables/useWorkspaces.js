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
    { id: 'openEditors', title: 'Open Editors', collapsed: true,  size: 1 },
    { id: 'places',      title: 'Places',        collapsed: false, size: 4 },
  ],
}

// ─── Default workspace factory ───────────────────────────────────────────────

function createDefaultWorkspace({ name = 'Default' } = {}) {
  const now     = new Date().toISOString()
  const homeId  = uuidv4()
  const groupId = uuidv4()
  return {
    uuid: uuidv7(),
    name,
    version: 3,
    dateCreated:  now,
    dateModified: now,
    dateAccessed: now,
    dateDeleted:  null,
    layout: {
      primarySidebar: {
        isOpen: true,
        width: 240,
        activeViewContainerId: 'explorer',
        sectionState: {
          explorer: { sections: DEFAULT_SECTIONS.explorer.map(s => ({ ...s })) },
        },
        activities: [
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
        sectionState: [
          { id: 'preview', collapsed: false, size: 2 },
          { id: 'details', collapsed: true,  size: 1 },
          { id: 'chat',    collapsed: true,  size: 1 },
        ],
        mergeGroups: {},
      },
      panel: {
        isOpen: true,
        height: 150,
        activeViewContainerId: 'debug',
        viewContainerOrder: ['debug'],
        sectionState: [{ id: 'debug', collapsed: false, size: 1 }],
        mergeGroups: {},
        hiddenActivities: [],
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
      const act = ws.layout.primarySidebar.activities.find(a => a.id === 'explorer')
      if (act) {
        act.context.childrenByPath = t.childrenByPath ?? {}
        act.context.expandedNodes  = t.expanded       ?? []
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
        explorer: { sections: DEFAULT_SECTIONS.explorer.map(s => ({ ...s })) },
      },
      activities: left.activities ?? [
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
      hiddenActivities: [],
    }

    ws.version = 3
  }

  // v3 patch: panel.isOpen was false by default before hide/show UI existed.
  // Since users never had a way to hide the panel, any false value is from the
  // old default — reset to true so the panel stays visible after the upgrade.
  if (ws.version === 3 && ws.layout.panel?.isOpen === false) {
    ws.layout.panel.isOpen = true
  }

  // v3 patch: backfill sectionState for secondarySidebar/panel if missing
  // (workspaces created before accordion-sections support was added).
  if (ws.layout.secondarySidebar && !ws.layout.secondarySidebar.sectionState) {
    const order = ws.layout.secondarySidebar.viewContainerOrder ?? ['preview', 'details', 'chat']
    ws.layout.secondarySidebar.sectionState = order.map((id, i) => ({ id, collapsed: i > 0, size: i === 0 ? 2 : 1 }))
  }
  if (ws.layout.panel && !ws.layout.panel.sectionState) {
    ws.layout.panel.sectionState = [{ id: 'debug', collapsed: false, size: 1 }]
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
  if (ws.layout.panel && !ws.layout.panel.hiddenActivities) {
    ws.layout.panel.hiddenActivities = []
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
  const rightPanelActivityIds = computed({
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
  const bottomPanelActivityIds = computed({
    get: () => activeWorkspace.value?.layout.panel?.viewContainerOrder ?? ['debug'],
    set: ids => mutate(ws => { ws.layout.panel.viewContainerOrder = ids }),
  })

  const hiddenActivities = computed({
    get: () => activeWorkspace.value?.layout.panel?.hiddenActivities ?? [],
    set: v  => mutate(ws => { ws.layout.panel.hiddenActivities = v }),
  })

  // Merge groups for the bottom panel (persisted)
  const panelMergeGroups = computed({
    get: () => activeWorkspace.value?.layout.panel?.mergeGroups ?? {},
    set: v  => mutate(ws => { ws.layout.panel.mergeGroups = v }),
  })

  // ── Primary sidebar section state ────────────────────────────────────────

  function getSectionState(viewContainerId) {
    const stored = activeWorkspace.value?.layout.primarySidebar?.sectionState?.[viewContainerId]?.sections
    if (Array.isArray(stored) && stored.length > 0) {
      // Rename 'folders' → 'places' for any data written before this rename
      return stored.map(s => s.id === 'folders'
        ? { ...s, id: 'places', title: s.title === 'Folders' ? 'Places' : s.title }
        : { ...s })
    }
    return (DEFAULT_SECTIONS[viewContainerId] ?? []).map(s => ({ ...s }))
  }

  function saveSectionState(viewContainerId, sections) {
    mutate(ws => {
      ws.layout.primarySidebar.sectionState ??= {}
      ws.layout.primarySidebar.sectionState[viewContainerId] = { sections: sections.map(s => ({ ...s })) }
    })
  }

  // ── Secondary sidebar section state ─────────────────────────────────────

  function getSecondarySidebarSections(activityIds) {
    const stored = activeWorkspace.value?.layout.secondarySidebar?.sectionState ?? []
    return activityIds.map(id => {
      const found = stored.find(s => s.id === id)
      return found ? { ...found } : { id, collapsed: true, size: 1 }
    })
  }

  function saveSecondarySidebarSections(sections) {
    mutate(ws => {
      ws.layout.secondarySidebar.sectionState = sections.map(({ id, collapsed, size }) => ({ id, collapsed, size }))
    })
  }

  // ── Bottom panel section state ───────────────────────────────────────────

  function getPanelSections(activityIds) {
    const stored = activeWorkspace.value?.layout.panel?.sectionState ?? []
    return activityIds.map(id => {
      const found = stored.find(s => s.id === id)
      return found ? { ...found } : { id, collapsed: true, size: 1 }
    })
  }

  function savePanelSections(sections) {
    mutate(ws => {
      ws.layout.panel.sectionState = sections.map(({ id, collapsed, size }) => ({ id, collapsed, size }))
    })
  }

  // ── Explorer tree context ────────────────────────────────────────────────

  function _explorerAct(ws) {
    return ws.layout.primarySidebar?.activities?.find(a => a.id === 'explorer')
  }

  const explorerContext = computed(() => {
    const ws = activeWorkspace.value
    if (!ws) return { childrenByPath: {}, expandedNodes: [], selectedNodes: [] }
    return _explorerAct(ws)?.context ?? { childrenByPath: {}, expandedNodes: [], selectedNodes: [] }
  })

  function updateExplorerContext(ctx) {
    mutate(ws => {
      const act = _explorerAct(ws)
      if (act) act.context = { ...act.context, ...ctx }
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
    rightPanelActivityIds,
    secondarySidebarMergeGroups,
    // Layout: bottom panel
    bottompaneVisible,
    bottompaneHeight,
    bottomPanel,
    bottomPanelActivityIds,
    hiddenActivities,
    panelMergeGroups,
    // Section state — primary sidebar
    getSectionState,
    saveSectionState,
    // Section state — secondary sidebar
    getSecondarySidebarSections,
    saveSecondarySidebarSections,
    // Section state — bottom panel
    getPanelSections,
    savePanelSections,
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
