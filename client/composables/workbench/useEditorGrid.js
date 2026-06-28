import { ref, computed, watch, nextTick } from 'vue'
import { createLeaf, findLeaf, firstLeaf, collectLeaves, leafCount, insertLeafBeside, removeLeaf, applyPreset } from '~/composables/useLayoutGrid.js'
import { uuidv4 } from '~/composables/useWorkspaces.js'

// ── Editor grid slice ─────────────────────────────────────────────────────────
// Owns the recursive grid of editor groups (see useLayoutGrid.js): the model,
// every structural mutation, the imperative group-ref registry, persistence, and
// the `editorController` provided to EditorGroup children. Pure tab-grid mechanics
// — it deliberately does NOT read or write the global selection refs (selection is
// per-tab and lives in useSelection, which consumes this slice one-directionally).
export function useEditorGrid({ log, getInitialEditor, saveEditor }) {
  function uuid() { return uuidv4() }

  const _initialEditor = getInitialEditor()
  const editorRoot    = ref(_initialEditor.root)
  const activeGroupId = ref(_initialEditor.activeGroupId ?? firstLeaf(_initialEditor.root)?.id ?? null)

  const maximizedGroupId = ref(null)
  // When a group is maximized, show only that leaf (GridView handles a leaf root fine).
  const viewRoot = computed(() =>
    maximizedGroupId.value ? (findLeaf(editorRoot.value, maximizedGroupId.value) ?? editorRoot.value) : editorRoot.value
  )

  const activeGroup = computed(() => findLeaf(editorRoot.value, activeGroupId.value) ?? firstLeaf(editorRoot.value))
  const activeTabs  = computed(() => activeGroup.value?.tabs ?? [])
  const activeTab   = computed(() => activeTabs.value.find(t => t.id === activeGroup.value?.activeTabId) ?? activeTabs.value[0] ?? null)

  // EditorGroup component instances, keyed by group id, for imperative refresh/rename.
  const groupRefs = {}
  function registerGroup(id, el) { if (el) groupRefs[id] = el; else delete groupRefs[id] }
  function activeGroupEl() { return groupRefs[activeGroupId.value] }
  function forEachGroup(fn) { Object.values(groupRefs).forEach(r => { try { fn(r) } catch {} }) }
  function refreshAllDirs() { forEachGroup(r => r?.refresh?.()) }

  // Persist the editor grid. A cheap signature avoids deep-watching big selection arrays.
  function gridSignature(node) {
    if (!node) return ''
    if (node.type === 'leaf') {
      return 'L' + node.id + '#' + node.activeTabId
        + ':tp' + (node.tabPreviews !== false ? 1 : 0)
        + ':lk' + (node.locked ? 1 : 0)
        + '[' + node.tabs.map(t =>
          `${t.id}:${t.kind}:${t.title}:${t.path ?? ''}:${t.mode}:${t.pinned ? 1 : 0}:`
          + (t.selectedItems ?? []).map(i => i.path ?? i.name).join(',')
          + `:${t.focusedItem?.path ?? ''}`
        ).join('|') + ']'
    }
    return 'B' + node.direction + '(' + node.sizes.map(s => Math.round(s * 100) / 100).join(',') + ')'
      + node.children.map(gridSignature).join('~')
  }
  const _editorSignature = computed(() => gridSignature(editorRoot.value) + '||' + activeGroupId.value)
  watch(_editorSignature, () => saveEditor(editorRoot.value, activeGroupId.value))

  // ── Editor grid controller (provided to EditorGroup children) ─────────────────

  function reorderForPin(g) {
    const pinned = g.tabs.filter(t => t.pinned)
    const rest   = g.tabs.filter(t => !t.pinned)
    g.tabs.splice(0, g.tabs.length, ...pinned, ...rest)
  }

  function removeTabFrom(leaf, tabId) {
    const i = leaf.tabs.findIndex(t => t.id === tabId)
    if (i < 0) return
    leaf.tabs.splice(i, 1)
    if (leaf.activeTabId === tabId) leaf.activeTabId = leaf.tabs[Math.max(0, i - 1)]?.id ?? leaf.tabs[0]?.id ?? null
  }

  function cleanupEmpty(groupId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (g && g.tabs.length === 0 && leafCount(editorRoot.value) > 1) {
      editorRoot.value = removeLeaf(editorRoot.value, groupId)
      if (!findLeaf(editorRoot.value, activeGroupId.value)) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
    }
  }

  function closeTabImpl(groupId, tabId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    const idx = g.tabs.findIndex(t => t.id === tabId)
    if (idx === -1) return
    if (g.tabs.length === 1) {
      if (leafCount(editorRoot.value) === 1) return          // always keep one group + tab
      editorRoot.value = removeLeaf(editorRoot.value, groupId)
      if (activeGroupId.value === groupId) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
      return
    }
    g.tabs.splice(idx, 1)
    if (g.activeTabId === tabId) g.activeTabId = g.tabs[Math.max(0, idx - 1)]?.id ?? null
  }

  function dropTabImpl({ sourceGroupId, tabId, targetGroupId, region, side, beforeTabId }) {
    const source = findLeaf(editorRoot.value, sourceGroupId)
    const target = findLeaf(editorRoot.value, targetGroupId)
    if (!source || !target) return
    const tab = source.tabs.find(t => t.id === tabId)
    if (!tab) return

    if (region === 'center') {
      if (sourceGroupId === targetGroupId) {
        const from = source.tabs.findIndex(t => t.id === tabId)
        source.tabs.splice(from, 1)
        let to = beforeTabId ? source.tabs.findIndex(t => t.id === beforeTabId) : source.tabs.length
        if (to < 0) to = source.tabs.length
        source.tabs.splice(to, 0, tab)
      } else {
        removeTabFrom(source, tabId)
        let to = beforeTabId ? target.tabs.findIndex(t => t.id === beforeTabId) : target.tabs.length
        if (to < 0) to = target.tabs.length
        target.tabs.splice(to, 0, tab)
      }
      target.activeTabId = tab.id
      activeGroupId.value = targetGroupId
      if (sourceGroupId !== targetGroupId) cleanupEmpty(sourceGroupId)
      return
    }

    // edge → new group beside the target on `side`
    if (sourceGroupId === targetGroupId && source.tabs.length === 1) return  // no-op split of a lone tab
    removeTabFrom(source, tabId)
    const newLeaf = createLeaf({ tabs: [tab], activeTabId: tab.id })
    editorRoot.value = insertLeafBeside(editorRoot.value, targetGroupId, side, newLeaf)
    activeGroupId.value = newLeaf.id
    cleanupEmpty(sourceGroupId)
  }

  function splitActiveGroupImpl(side) {
    const g = activeGroup.value
    if (!g) return
    const src = g.tabs.find(t => t.id === g.activeTabId) ?? g.tabs[0]
    const clone = src
      ? { ...src, id: uuid(), mode: 'normal', pinned: false, selectedItems: [...(src.selectedItems ?? [])] }
      : { id: uuid(), kind: 'home', title: 'Home', mode: 'normal', pinned: false, selectedItems: [], focusedItem: null, selectedPath: '', path: '' }
    const newLeaf = createLeaf({ tabs: [clone], activeTabId: clone.id })
    editorRoot.value = insertLeafBeside(editorRoot.value, g.id, side, newLeaf)
    activeGroupId.value = newLeaf.id
    log('editor-layout', `Split ${side}`, { tab: src?.title ?? '(home)', side })
  }

  function splitWithTab(groupId, tabId, side) {
    const g = findLeaf(editorRoot.value, groupId)
    const src = g?.tabs.find(t => t.id === tabId)
    if (!src) return
    const clone = { ...src, id: uuid(), mode: 'normal', pinned: false, selectedItems: [...(src.selectedItems ?? [])] }
    const newLeaf = createLeaf({ tabs: [clone], activeTabId: clone.id })
    editorRoot.value = insertLeafBeside(editorRoot.value, groupId, side, newLeaf)
    activeGroupId.value = newLeaf.id
  }

  function closeOtherTabs(groupId, keepId) {
    const g = findLeaf(editorRoot.value, groupId)
    const keep = g?.tabs.find(t => t.id === keepId)
    if (!keep) return
    g.tabs.splice(0, g.tabs.length, keep)
    g.activeTabId = keepId
  }

  function applyLayoutPreset(name) {
    editorRoot.value = applyPreset(editorRoot.value, name)
    if (!findLeaf(editorRoot.value, activeGroupId.value)) activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
    maximizedGroupId.value = null
    log('editor-layout', `Applied layout: ${name}`, { preset: name })
  }

  const editorController = {
    setActiveGroup(groupId) { if (findLeaf(editorRoot.value, groupId)) activeGroupId.value = groupId },
    activateTab(groupId, tabId) {
      const g = findLeaf(editorRoot.value, groupId)
      if (!g) return
      activeGroupId.value = groupId
      g.activeTabId = tabId
      const t = g.tabs.find(x => x.id === tabId)
      if (t) log('tab', 'Tab activated', { title: t.title, path: t.path ?? null, kind: t.kind })
    },
    promoteTab(groupId, tabId) {
      const g = findLeaf(editorRoot.value, groupId)
      if (!g) return
      const t = g.tabs.find(x => x.id === tabId)
      if (t && t.mode === 'peek') t.mode = 'normal'
      activeGroupId.value = groupId
      g.activeTabId = tabId
    },
    togglePin(groupId, tabId) {
      const g = findLeaf(editorRoot.value, groupId)
      const t = g?.tabs.find(x => x.id === tabId)
      if (!t) return
      t.pinned = !t.pinned
      if (t.pinned) t.mode = 'normal'
      reorderForPin(g)
    },
    closeTab: closeTabImpl,
    dropTab: dropTabImpl,
    splitActiveGroup: splitActiveGroupImpl,
    applyLayoutPreset,
    closeAllTabs(groupId) {
      const g = findLeaf(editorRoot.value, groupId)
      if (!g || g.tabs.length === 0) return
      if (leafCount(editorRoot.value) > 1) {
        editorRoot.value = removeLeaf(editorRoot.value, groupId)
        if (activeGroupId.value === groupId || !findLeaf(editorRoot.value, activeGroupId.value)) {
          activeGroupId.value = firstLeaf(editorRoot.value)?.id ?? null
        }
      } else {
        const first = g.tabs[0]
        g.tabs.splice(0, g.tabs.length, first)
        g.activeTabId = first.id
      }
      log('editor-layout', 'Closed all tabs in group', { groupId })
    },
    toggleTabPreviews(groupId) {
      const g = findLeaf(editorRoot.value, groupId)
      if (!g) return
      g.tabPreviews = g.tabPreviews === false ? true : false
      log('editor-layout', `Tab previews ${g.tabPreviews ? 'enabled' : 'disabled'}`, { groupId })
    },
    maximizeGroup(groupId) {
      const wasMaximized = maximizedGroupId.value === groupId
      maximizedGroupId.value = wasMaximized ? null : groupId
      log('editor-layout', wasMaximized ? 'Restored group' : 'Maximized group', { groupId })
    },
    toggleLockGroup(groupId) {
      const g = findLeaf(editorRoot.value, groupId)
      if (!g) return
      g.locked = !g.locked
      log('editor-layout', `Group ${g.locked ? 'locked' : 'unlocked'}`, { groupId })
    },
  }

  // ── Tab helpers (operate on the editor grid) ──────────────────────────────────

  function findTabByPath(path) {
    for (const leaf of collectLeaves(editorRoot.value)) {
      const tab = leaf.tabs.find(t => t.path === path)
      if (tab) return { groupId: leaf.id, tab }
    }
    return null
  }

  function findTabByKind(kind) {
    return findTab(t => t.kind === kind)
  }

  // Generic tab search across all groups: returns { groupId, tab } for the first
  // tab matching `predicate(tab)`, or null. The kind/path finders delegate here;
  // openTab uses it for kind+params identity matching.
  function findTab(predicate) {
    for (const leaf of collectLeaves(editorRoot.value)) {
      const tab = leaf.tabs.find(predicate)
      if (tab) return { groupId: leaf.id, tab }
    }
    return null
  }

  function focusTab(groupId, tabId) {
    const g = findLeaf(editorRoot.value, groupId)
    if (!g) return
    activeGroupId.value = groupId
    g.activeTabId = tabId
  }

  async function addTabToActiveGroup(tab, { activate = true } = {}) {
    const g = activeGroup.value
    if (!g || g.locked) return
    g.tabs.push(tab)
    if (activate) { await nextTick(); g.activeTabId = tab.id }
  }

  async function openPeekTabForDir(path) {
    const g = activeGroup.value
    if (!g || g.locked) return
    const title = path.split(/[/\\]/).filter(Boolean).pop() || path
    const usePeek = g.tabPreviews !== false
    const tab = { id: uuid(), kind: 'dir', mode: usePeek ? 'peek' : 'normal', pinned: false, title, path, selectedItems: [], focusedItem: null, selectedPath: '' }
    if (usePeek) {
      const peekIdx = g.tabs.findIndex(t => t.kind === 'dir' && t.mode === 'peek')
      if (peekIdx >= 0) g.tabs.splice(peekIdx, 1, tab)
      else g.tabs.push(tab)
    } else {
      g.tabs.push(tab)
    }
    await nextTick()
    g.activeTabId = tab.id
  }

  function flashTab(tabId) {
    const el = document.querySelector(`[data-tab-id="${tabId}"]`)
    if (!el) return
    el.classList.add('flash')
    setTimeout(() => el.classList.remove('flash'), 600)
  }

  function triggerInlineRename() {
    const el = activeGroupEl()?.getDirectoryTab?.()?.$el
    el?.dispatchEvent(new KeyboardEvent('keydown', { key: 'F2', bubbles: true }))
  }

  return {
    // state
    editorRoot, activeGroupId, maximizedGroupId, viewRoot,
    activeGroup, activeTabs, activeTab,
    // group refs / imperative
    registerGroup, forEachGroup, refreshAllDirs,
    // controller
    editorController,
    // tab helpers
    findTabByPath, findTabByKind, findTab, focusTab, addTabToActiveGroup, openPeekTabForDir, flashTab,
    splitWithTab, closeOtherTabs, triggerInlineRename,
  }
}
