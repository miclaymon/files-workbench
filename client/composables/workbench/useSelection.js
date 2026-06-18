import { ref, watch } from 'vue'

// ── Selection slice ───────────────────────────────────────────────────────────
// The current file/directory selection plus the explorer/directory/open/navigate
// handlers. Selection is per-tab, so this slice consumes the editor grid (tab CRUD
// + `activeTab`) one-directionally: it restores selection when the active tab
// changes and persists it back onto the tab. The editor grid never reads these
// refs, which keeps the dependency acyclic.
export function useSelection({ editor, statusbar, log, fsStat, fsOpenWithSystem, isArchiveItem, uuid }) {
  const { activeTab, findTabByPath, focusTab, flashTab, openPeekTabForDir, addTabToActiveGroup } = editor
  const { status, dirStats, formatBytes, flashStatus } = statusbar

  const selectedPath    = ref('')
  const selectedItems   = ref([])
  const focusedItem     = ref(null)
  const selectedDetails = ref(null)

  // Restore per-tab selection when the active group/tab changes; reset dir stats off-dir.
  watch(activeTab, async (tab) => {
    if (tab?.kind === 'dir') {
      selectedItems.value = tab.selectedItems ?? []
      focusedItem.value   = tab.focusedItem ?? null
      selectedPath.value  = tab.selectedPath ?? tab.path ?? ''
    } else {
      dirStats.value = { count: 0, totalSize: 0 }
      selectedItems.value = []
      focusedItem.value   = null
      selectedPath.value  = ''
    }
    selectedDetails.value = null
    if (selectedPath.value) { try { selectedDetails.value = await fsStat(selectedPath.value) } catch { selectedDetails.value = null } }
  })

  function updateSelectionAfterRename(oldPath, newName, newPath) {
    selectedItems.value = selectedItems.value.map(item =>
      item.path === oldPath ? { ...item, name: newName, path: newPath } : item
    )
    if (focusedItem.value?.path === oldPath) {
      focusedItem.value = { ...focusedItem.value, name: newName, path: newPath }
    }
  }

  async function handleExplorerSelect(payload) {
    const path = typeof payload === 'string' ? payload : payload?.path
    if (!path) return
    log('select', 'Explorer selected', { path, name: path.split(/[/\\]/).filter(Boolean).pop() ?? path })
    selectedPath.value = path
    const kind = payload?.kind
    if (kind === 'directory' || kind === 'dir' || kind === 'drive' || kind === 'root') {
      selectedItems.value = []
      focusedItem.value = null
      const existing = findTabByPath(path)
      if (existing) { focusTab(existing.groupId, existing.tab.id); flashTab(existing.tab.id) }
      else await openPeekTabForDir(path)
    }
    try { selectedDetails.value = await fsStat(path) } catch { selectedDetails.value = null }
  }

  async function handleSelectFromDirectory(payload) {
    if (payload?.selectedItems?.length > 0) {
      const count     = payload.selectedItems.length
      const totalSize = payload.selectedItems.reduce((s, i) => s + (i.size ?? 0), 0)
      log('select', `${count} item${count === 1 ? '' : 's'} | ${formatBytes(totalSize)}`, {
        _type: 'item-table',
        items: payload.selectedItems.map(i => ({
          name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null,
        })),
      })
    }
    if (payload?.mode === 'open' && payload?.item?.kind === 'file') {
      try {
        await fsOpenWithSystem(payload.item.path)
        flashStatus(`Opened ${payload.item.name}`, 1500)
      } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
      return
    }
    if (payload && Array.isArray(payload.selectedItems)) {
      selectedItems.value = payload.selectedItems
      focusedItem.value = payload.focusedItem ?? null
      const path = payload.focusedItem?.path ?? payload.selectedItems[0]?.path
      if (path) selectedPath.value = path
      if (activeTab.value) {
        activeTab.value.selectedItems = payload.selectedItems
        activeTab.value.focusedItem = payload.focusedItem ?? null
        activeTab.value.selectedPath = path ?? ''
      }
    }
    try { selectedDetails.value = selectedPath.value ? await fsStat(selectedPath.value) : null } catch { selectedDetails.value = null }
  }

  async function handleDoubleClick(payload) {
    // macOS .app bundles: launch with OS, don't navigate inside
    if (payload.kind === 'app') {
      try { await fsOpenWithSystem(payload.path) } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
      return
    }

    // Archive files: open as virtual directory
    if (payload.kind === 'archive' || (payload.kind === 'file' && isArchiveItem(payload))) {
      const virtualPath = payload.path + '::'
      const existing = findTabByPath(virtualPath)
      if (existing) { focusTab(existing.groupId, existing.tab.id); existing.tab.mode = 'normal'; return }
      const title = payload.name || payload.path.split(/[/\\]/).filter(Boolean).pop()
      await addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' })
      return
    }

    if (payload.kind !== 'directory' && payload.kind !== 'dir' && payload.kind !== 'drive' && payload.kind !== 'root') return
    const existing = findTabByPath(payload.path)
    if (existing) { focusTab(existing.groupId, existing.tab.id); existing.tab.mode = 'normal'; return }
    const title = payload.path.split(/[/\\]/).filter(Boolean).pop() || payload.path
    await addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: payload.path, selectedItems: [], focusedItem: null, selectedPath: '' })
  }

  function navigateInCurrentTab(path) {
    const active = activeTab.value
    if (!active || active.kind !== 'dir') return
    if (active.mode === 'peek') active.mode = 'normal'
    log('nav', 'Navigate', { from: active.path, to: path })
    active.path = path
    if (path.includes('::')) {
      const [archivePath, innerPath] = path.split('::')
      const innerSegs = innerPath.split('/').filter(Boolean)
      active.title = innerSegs.length > 0
        ? innerSegs[innerSegs.length - 1]
        : (archivePath.split(/[/\\]/).filter(Boolean).pop() || archivePath)
    } else {
      active.title = path.split(/[/\\]/).filter(Boolean).pop() || path
    }
    selectedPath.value = path
    selectedItems.value = []
    focusedItem.value = null
    active.selectedItems = []
    active.focusedItem = null
    active.selectedPath = path
  }

  async function handleOpenFromTab(item) {
    selectedPath.value = item.path
    selectedItems.value = [item]
    focusedItem.value = item
    if (item.kind !== 'file') return
    try {
      await fsOpenWithSystem(item.path)
      flashStatus(`Opened ${item.name}`, 1500)
    } catch (e) { status.value.left = `Error: ${e?.message ?? e}` }
  }

  return {
    selectedPath, selectedItems, focusedItem, selectedDetails,
    updateSelectionAfterRename,
    handleExplorerSelect, handleSelectFromDirectory, handleDoubleClick,
    navigateInCurrentTab, handleOpenFromTab,
  }
}
