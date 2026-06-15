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

// ─── Default workspace factory ───────────────────────────────────────────────

function createDefaultWorkspace({ name = 'Default' } = {}) {
  const now     = new Date().toISOString()
  const homeId  = uuidv4()
  const groupId = uuidv4()
  return {
    uuid: uuidv7(),
    name,
    version: 2,
    dateCreated:  now,
    dateModified: now,
    dateAccessed: now,
    dateDeleted:  null,
    layout: {
      panel: {
        left: {
          isOpen: true,
          width: 240,
          activeActivityId: 'explorer',
          activities: [
            {
              id: 'explorer',
              name: 'Explorer',
              context: { childrenByPath: {}, expandedNodes: [], selectedNodes: [] },
            },
          ],
        },
        right: {
          isOpen: true,
          width: 380,
          activeActivityId: 'preview',
          activities: [
            { id: 'preview', name: 'Preview', context: {} },
            { id: 'details', name: 'Details', context: {} },
            { id: 'chat',    name: 'Chat',    context: {} },
          ],
        },
        bottom: {
          isOpen: false,
          height: 150,
        },
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
      ws.layout.panel.left.isOpen          = s.sidebarVisible   ?? true
      ws.layout.panel.left.width           = s.sidebarWidth     ?? 240
      ws.layout.panel.left.activeActivityId  = s.activeActivity ?? 'explorer'
      ws.layout.panel.right.width          = s.rightpaneWidth   ?? 380
      ws.layout.panel.right.activeActivityId = s.rightPanel     ?? 'preview'
      ws.layout.panel.bottom.height        = s.bottompaneHeight ?? 150
    }
  } catch {}
  try {
    const t = JSON.parse(localStorage.getItem(OLD_TREE_KEY) ?? 'null')
    if (t) {
      const act = ws.layout.panel.left.activities.find(a => a.id === 'explorer')
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
function migrateWorkspace(ws) {
  if (!ws || !ws.layout) return ws
  const editor = ws.layout.editor ?? {}
  if (!editor.root) {
    const groupId = uuidv4()
    // Old `isPinned` meant "not preview"; sticky-pin is a fresh v2 concept, so clear it.
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

  // ── Layout: left (sidebar) ──────────────────────────────────────────────

  const sidebarVisible = computed({
    get: () => activeWorkspace.value?.layout.panel.left.isOpen ?? true,
    set: v  => mutate(ws => { ws.layout.panel.left.isOpen = v }),
  })
  const sidebarWidth = computed({
    get: () => activeWorkspace.value?.layout.panel.left.width ?? 240,
    set: v  => mutate(ws => { ws.layout.panel.left.width = v }),
  })
  const activeActivity = computed({
    get: () => activeWorkspace.value?.layout.panel.left.activeActivityId ?? 'explorer',
    set: v  => mutate(ws => { ws.layout.panel.left.activeActivityId = v }),
  })

  // ── Layout: right panel ─────────────────────────────────────────────────

  const rightpaneWidth = computed({
    get: () => activeWorkspace.value?.layout.panel.right.width ?? 380,
    set: v  => mutate(ws => { ws.layout.panel.right.width = v }),
  })
  const rightPanel = computed({
    get: () => activeWorkspace.value?.layout.panel.right.activeActivityId ?? 'preview',
    set: v  => mutate(ws => { ws.layout.panel.right.activeActivityId = v }),
  })

  // Ordered activity IDs for the right panel (without icons — merged in Workbench.vue)
  const rightPanelActivityIds = computed({
    get: () => (activeWorkspace.value?.layout.panel.right.activities ?? []).map(a => a.id),
    set: ids => mutate(ws => {
      const current = ws.layout.panel.right.activities
      const byId    = Object.fromEntries(current.map(a => [a.id, a]))
      ws.layout.panel.right.activities = ids.map(id => byId[id] ?? { id, name: id, context: {} })
    }),
  })

  // ── Layout: bottom panel ────────────────────────────────────────────────

  const bottompaneHeight = computed({
    get: () => activeWorkspace.value?.layout.panel.bottom.height ?? 150,
    set: v  => mutate(ws => { ws.layout.panel.bottom.height = v }),
  })

  // ── Explorer tree context ────────────────────────────────────────────────

  function _explorerAct(ws) {
    return ws.layout.panel.left.activities?.find(a => a.id === 'explorer')
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
    // Backward-compatible with useWorkbenchState
    sidebarVisible,
    sidebarWidth,
    activeActivity,
    rightpaneWidth,
    rightPanel,
    bottompaneHeight,
    // Extended
    rightPanelActivityIds,
    explorerContext,
    updateExplorerContext,
    getInitialEditor,
    saveEditor,
    // Workspace management
    createWorkspace,
    switchWorkspace,
    deleteWorkspace,
    renameWorkspace,
  }
}
