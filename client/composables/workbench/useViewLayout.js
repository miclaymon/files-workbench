import { ref, computed, watch } from 'vue'
import { mdiMessage, mdiEye, mdiInformation, mdiBug, mdiFileTree } from '@mdi/js'
import { getViewEntry, viewAllowsDuplicateSections } from '~/composables/useViewRegistry.js'

// ── View layout slice ─────────────────────────────────────────────────────────
// The whole panel/sidebar layout engine: per-container view-id lists, merge groups
// (stacked views), per-view section state (the SplitSectionArea level), and every
// drag-driven mutation — tab transfer, view merge/unmerge, and cross-context
// section adoption. Also owns the `workbenchChrome` object provided to every
// ViewContainer for the tab/header/section context menus. Consumes the persisted
// `workspaces` state (so Workbench keeps the single useWorkspaces instance) plus
// preferences for the tab-icon toggle.
export function useViewLayout({ workspaces, prefs, savePrefs }) {
  const {
    sidebarVisible, sidebarWidth, activePrimaryView,
    rightpaneVisible, rightpaneWidth, rightPanel, rightPanelViewIds,
    secondarySidebarMergeGroups,
    bottompaneVisible, bottompaneHeight,
    bottomPanel, bottomPanelViewIds,
    hiddenViews,
    panelMergeGroups,
    getViewSections, saveViewSections,
  } = workspaces

  // Primary sidebar view container definitions
  const primarySidebarViews = [{ id: 'explorer', icon: mdiFileTree, label: 'Explorer' }]

  // Per-view section state for each container (the SplitSectionArea level). The
  // primary sidebar's Explorer view owns Places + Open Editors; the movable
  // containers start empty (a view gains an entry only once it owns >1 section or
  // adopts a foreign one). Persisted via signature watches.
  const primaryViewSections   = ref(getViewSections('primarySidebar'))
  const secondaryViewSections = ref(getViewSections('secondarySidebar'))
  const panelViewSections     = ref(getViewSections('panel'))
  watch(() => JSON.stringify(primaryViewSections.value),   () => saveViewSections('primarySidebar',   primaryViewSections.value))
  watch(() => JSON.stringify(secondaryViewSections.value), () => saveViewSections('secondarySidebar', secondaryViewSections.value))
  watch(() => JSON.stringify(panelViewSections.value),     () => saveViewSections('panel',             panelViewSections.value))

  // Icon registry for well-known panel views
  // `shortcut` strings are display-only hints in the header context menu; the
  // actual keybindings aren't wired yet.
  const PANEL_VIEW_REGISTRY = {
    preview: { icon: mdiEye,         label: 'Preview', shortcut: 'Alt+P'       },
    details: { icon: mdiInformation, label: 'Details', shortcut: 'Alt+Shift+P' },
    chat:    { icon: mdiMessage,     label: 'Chat',    shortcut: 'Ctrl+Alt+I'  },
    debug:   { icon: mdiBug,         label: 'Debug'                            },
  }

  // Tab descriptor for a view id. Falls back to the content registry so a view
  // "floated" out of its home container (e.g. an Explorer tab created by docking
  // Open Editors into the panel) still gets its proper icon/label.
  function _viewTab(id) {
    return {
      id,
      icon:  PANEL_VIEW_REGISTRY[id]?.icon  ?? getViewEntry(id)?.icon,
      label: PANEL_VIEW_REGISTRY[id]?.label ?? getViewEntry(id)?.label ?? id,
    }
  }

  // Bottom panel
  const bottomPanelViews = computed(() => bottomPanelViewIds.value.map(_viewTab))

  const rightPanelViews = computed({
    get: () => rightPanelViewIds.value.map(_viewTab),
    set: list => { rightPanelViewIds.value = list.map(v => v.id) },
  })

  // ── Merge state: which tab slots hold multiple stacked views ──────────────────
  // Initialised from workspace; persisted via signature watches below.
  const rightPanelMerges = ref(secondarySidebarMergeGroups.value)
  const bottomPanelMerges = ref(panelMergeGroups.value)
  const _rightMergeSig = computed(() => JSON.stringify(rightPanelMerges.value))
  watch(_rightMergeSig, () => { secondarySidebarMergeGroups.value = rightPanelMerges.value })
  const _botMergeSig = computed(() => JSON.stringify(bottomPanelMerges.value))
  watch(_botMergeSig, () => { panelMergeGroups.value = bottomPanelMerges.value })

  // Default container for each known view (used when restoring a lost view)
  const VIEW_DEFAULT_CONTAINER = {
    preview: 'secondarySidebar',
    details: 'secondarySidebar',
    chat:    'secondarySidebar',
    debug:   'panel',
  }

  // Returns true if the view is visible in any container or merge group.
  function isViewVisible(id) {
    if (rightPanelViewIds.value.includes(id)) return true
    if (bottomPanelViewIds.value.includes(id)) return true
    const inMerges = (merges) => Object.values(merges).some(g => g.some(sv => sv.id === id))
    return inMerges(rightPanelMerges.value) || inMerges(bottomPanelMerges.value)
  }

  // Adds a missing view back to a container (preferred, else its default) and makes it visible.
  function addView(id, preferredCid) {
    if (isViewVisible(id)) return
    hiddenViews.value = hiddenViews.value.filter(h => h !== id)
    const cid = preferredCid ?? VIEW_DEFAULT_CONTAINER[id] ?? 'secondarySidebar'
    if (cid === 'panel') {
      bottomPanelViewIds.value = [...bottomPanelViewIds.value, id]
      bottomPanel.value = id
      bottompaneVisible.value = true
    } else {
      rightPanelViewIds.value = [...rightPanelViewIds.value, id]
      rightPanel.value = id
      rightpaneVisible.value = true
    }
  }

  // On startup: restore any known views that got lost (e.g. from an un-persisted merge).
  // Skips views the user has intentionally hidden via the Views menu.
  function recoverMissingViews() {
    for (const id of Object.keys(PANEL_VIEW_REGISTRY)) {
      if (!isViewVisible(id) && !hiddenViews.value.includes(id)) addView(id)
    }
  }

  // ── Container helpers ─────────────────────────────────────────────────────────

  const MOVABLE_CONTAINERS = new Set(['secondarySidebar', 'panel'])

  function getContainerIds(cid) {
    if (cid === 'secondarySidebar') return [...rightPanelViewIds.value]
    if (cid === 'panel')            return [...bottomPanelViewIds.value]
    return []
  }
  function setContainerIds(cid, ids) {
    if (cid === 'secondarySidebar') rightPanelViewIds.value = ids
    if (cid === 'panel')            bottomPanelViewIds.value = ids
  }
  function getContainerMerges(cid) {
    if (cid === 'secondarySidebar') return rightPanelMerges.value
    if (cid === 'panel')            return bottomPanelMerges.value
    return {}
  }
  function setContainerMerges(cid, merges) {
    if (cid === 'secondarySidebar') rightPanelMerges.value = merges
    if (cid === 'panel')            bottomPanelMerges.value = merges
  }
  function getActiveTab(cid) {
    if (cid === 'secondarySidebar') return rightPanel.value
    if (cid === 'panel')            return bottomPanel.value
    return ''
  }
  function setActiveTab(cid, id) {
    if (cid === 'secondarySidebar') rightPanel.value = id
    if (cid === 'panel')            bottomPanel.value = id
  }

  // ── Transfer: tab drag-to-reorder and cross-container ────────────────────────

  function handleViewTransfer({ fromContainerId, toContainerId, viewId, toIndex }) {
    if (!MOVABLE_CONTAINERS.has(fromContainerId) || !MOVABLE_CONTAINERS.has(toContainerId)) return

    if (fromContainerId === toContainerId) {
      // Reorder within the same container
      const list = getContainerIds(fromContainerId)
      const fromIdx = list.indexOf(viewId)
      if (fromIdx < 0) return
      list.splice(fromIdx, 1)
      const adjustedIdx = toIndex > fromIdx ? toIndex - 1 : toIndex
      list.splice(adjustedIdx, 0, viewId)
      setContainerIds(fromContainerId, list)
      // Merge group travels with the tab (already keyed by viewId, nothing to move)
    } else {
      // Cross-container: remove from source, insert in target
      const srcList = getContainerIds(fromContainerId).filter(id => id !== viewId)
      const dstList = getContainerIds(toContainerId)
      dstList.splice(toIndex, 0, viewId)
      setContainerIds(fromContainerId, srcList)
      setContainerIds(toContainerId, dstList)

      // If this view was the primary of a merge group, move the group too
      const fromMerges = getContainerMerges(fromContainerId)
      if (fromMerges[viewId]) {
        const { [viewId]: group, ...restFromMerges } = fromMerges
        setContainerMerges(fromContainerId, restFromMerges)
        setContainerMerges(toContainerId, { ...getContainerMerges(toContainerId), [viewId]: group })
      }

      // Move viewSections for the tab and all merged views so content renders correctly in the destination
      const srcVS = _viewSectionsRef(fromContainerId)
      const dstVS = _viewSectionsRef(toContainerId)
      if (srcVS && dstVS) {
        const allViewIds = [viewId]
        const movedGroup = getContainerMerges(toContainerId)[viewId]
        if (movedGroup) allViewIds.push(...movedGroup.map(v => v.id).filter(id => id !== viewId))
        const srcVSMap = { ...srcVS.value }
        const migratedSections = {}
        for (const vid of allViewIds) {
          if (srcVSMap[vid] !== undefined) { migratedSections[vid] = srcVSMap[vid]; delete srcVSMap[vid] }
        }
        if (Object.keys(migratedSections).length) {
          srcVS.value = srcVSMap
          dstVS.value = { ...dstVS.value, ...migratedSections }
        }
      }

      // Update active tabs
      if (getActiveTab(fromContainerId) === viewId) setActiveTab(fromContainerId, srcList[0] ?? '')
      setActiveTab(toContainerId, viewId)
    }
  }

  // ── Merge: drop on content area → stack as sections inside target tab slot ────

  function handleViewMerge({ toContainerId, toViewId, fromContainerId, viewId, zone }) {
    if (!MOVABLE_CONTAINERS.has(fromContainerId)) return
    if (!MOVABLE_CONTAINERS.has(toContainerId)) return
    if (viewId === toViewId && fromContainerId === toContainerId) return

    // Remove viewId from source container's tab list
    const srcList = getContainerIds(fromContainerId).filter(id => id !== viewId)
    setContainerIds(fromContainerId, srcList)

    // Add to target view's merge group
    const toMerges = getContainerMerges(toContainerId)
    const existing = toMerges[toViewId] ?? [
      { id: toViewId, title: PANEL_VIEW_REGISTRY[toViewId]?.label ?? toViewId, collapsed: false, size: 1 },
    ]
    const newEntry = { id: viewId, title: PANEL_VIEW_REGISTRY[viewId]?.label ?? viewId, collapsed: false, size: 1 }
    const newGroup = zone === 'before' ? [newEntry, ...existing] : [...existing, newEntry]
    setContainerMerges(toContainerId, { ...toMerges, [toViewId]: newGroup })

    // Move viewSections when the merged view crosses containers
    if (fromContainerId !== toContainerId) {
      const srcVS = _viewSectionsRef(fromContainerId)
      const dstVS = _viewSectionsRef(toContainerId)
      if (srcVS && dstVS && srcVS.value[viewId] !== undefined) {
        const srcVSMap = { ...srcVS.value }
        const sections = srcVSMap[viewId]
        delete srcVSMap[viewId]
        srcVS.value = srcVSMap
        dstVS.value = { ...dstVS.value, [viewId]: sections }
      }
    }

    // Update active tabs
    if (getActiveTab(fromContainerId) === viewId) setActiveTab(fromContainerId, srcList[0] ?? '')
    setActiveTab(toContainerId, toViewId)
  }

  // ── Unmerge: section header dragged back to tab bar ───────────────────────────

  function handleViewUnmerge({ fromViewId, fromContainerId, extractViewId, toContainerId, toIndex }) {
    if (!MOVABLE_CONTAINERS.has(fromContainerId)) return

    // Remove from the merge group
    const fromMerges = getContainerMerges(fromContainerId)
    const currentGroup = fromMerges[fromViewId] ?? []
    const newGroup = currentGroup.filter(sv => sv.id !== extractViewId)

    if (extractViewId === fromViewId && newGroup.length > 0) {
      // The slot's own original view was extracted, but other sections
      // remain — re-key the slot to the next section so the tab strip label
      // reflects what's actually displayed, instead of the now-departed view.
      const newPrimaryId = newGroup[0].id
      const { [fromViewId]: _, ...restMerges } = fromMerges
      setContainerMerges(fromContainerId, newGroup.length > 1
        ? { ...restMerges, [newPrimaryId]: newGroup }
        : restMerges)

      const slotList = getContainerIds(fromContainerId).map(id => id === fromViewId ? newPrimaryId : id)
      setContainerIds(fromContainerId, slotList)
      if (getActiveTab(fromContainerId) === fromViewId) setActiveTab(fromContainerId, newPrimaryId)
    } else if (newGroup.length <= 1) {
      // Only one (or zero) views left → dissolve the merge group entirely
      const { [fromViewId]: _, ...rest } = fromMerges
      setContainerMerges(fromContainerId, rest)
    } else {
      setContainerMerges(fromContainerId, { ...fromMerges, [fromViewId]: newGroup })
    }

    // Insert extracted view as a standalone tab
    const targetCid = MOVABLE_CONTAINERS.has(toContainerId) ? toContainerId : fromContainerId
    const dstList = getContainerIds(targetCid)
    if (!dstList.includes(extractViewId)) dstList.splice(toIndex, 0, extractViewId)
    setContainerIds(targetCid, dstList)
    setActiveTab(targetCid, extractViewId)

    // Move viewSections if the extracted view lands in a different container
    if (targetCid !== fromContainerId) {
      const srcVS = _viewSectionsRef(fromContainerId)
      const dstVS = _viewSectionsRef(targetCid)
      if (srcVS && dstVS && srcVS.value[extractViewId] !== undefined) {
        const srcVSMap = { ...srcVS.value }
        const sections = srcVSMap[extractViewId]
        delete srcVSMap[extractViewId]
        srcVS.value = srcVSMap
        dstVS.value = { ...dstVS.value, [extractViewId]: sections }
      }
    }
  }

  // ── Section adoption ──────────────────────────────────────────────────────────
  // A SplitSection dragged out of its View travels *with* its biological parent
  // View: the parent materialises as its own SplitView (when dropped on another
  // View's body — like merging a tab) or as a standalone tab (when dropped on the
  // tab strip). A section always lives under a View whose id is its homeViewId, so
  // the parent groups all of one home's relocated sections; once it holds >1 the
  // section headings appear, otherwise the parent SplitView heading reads
  // "Parent: Section".

  function _viewSectionsRef(containerId) {
    if (containerId === 'primarySidebar')   return primaryViewSections
    if (containerId === 'secondarySidebar') return secondaryViewSections
    if (containerId === 'panel')            return panelViewSections
    return null
  }

  // The tab slot (its key id) currently showing `viewId` in a movable container,
  // whether `viewId` is a standalone tab or a member of a merge group.
  function _findSlotKey(containerId, viewId) {
    const merges = getContainerMerges(containerId)
    for (const [key, group] of Object.entries(merges)) {
      if (group.some(sv => sv.id === viewId)) return key
    }
    if (getContainerIds(containerId).includes(viewId)) return viewId
    return null
  }

  // Remove a View from its slot entirely (used when a floated parent loses its last
  // section). Mirrors unmerge bookkeeping but discards the View rather than re-tabbing it.
  function _removeViewFromSlot(containerId, viewId) {
    const merges = { ...getContainerMerges(containerId) }
    const ids = [...getContainerIds(containerId)]
    let touched = false

    for (const [key, group] of Object.entries(merges)) {
      if (!group.some(sv => sv.id === viewId)) continue
      const newGroup = group.filter(sv => sv.id !== viewId)
      if (key === viewId) {
        // The slot's own primary is leaving → re-key to the next member, or drop the slot.
        delete merges[key]
        const slotIdx = ids.indexOf(key)
        if (newGroup.length >= 1) {
          const newKey = newGroup[0].id
          if (newGroup.length > 1) merges[newKey] = newGroup
          if (slotIdx >= 0) ids[slotIdx] = newKey
          if (getActiveTab(containerId) === key) setActiveTab(containerId, newKey)
        } else {
          if (slotIdx >= 0) ids.splice(slotIdx, 1)
          if (getActiveTab(containerId) === key) setActiveTab(containerId, ids[0] ?? '')
        }
      } else {
        // A non-primary member leaves → keep the group, or dissolve to a standalone primary.
        if (newGroup.length > 1) merges[key] = newGroup
        else delete merges[key]
      }
      touched = true
      break
    }

    if (!touched) {
      // Standalone tab (no merge group) → remove the tab.
      const slotIdx = ids.indexOf(viewId)
      if (slotIdx >= 0) {
        ids.splice(slotIdx, 1)
        if (getActiveTab(containerId) === viewId) setActiveTab(containerId, ids[0] ?? '')
        touched = true
      }
    }

    if (touched) {
      setContainerMerges(containerId, merges)
      setContainerIds(containerId, ids)
    }
  }

  // Pull a section's list back into the source map, de-materialising a now-empty
  // floated parent (movable containers only — the primary sidebar's Explorer stays).
  function _removeFromSourceParent(srcMap, containerId, viewId, list) {
    if (list.length === 0 && MOVABLE_CONTAINERS.has(containerId)) {
      delete srcMap[viewId]
      _removeViewFromSlot(containerId, viewId)
    } else {
      srcMap[viewId] = list
    }
  }

  // Add `parentId` as a SplitView next to `anchorViewId`'s slot (merging it in),
  // unless it's already shown somewhere in the container.
  function _materializeParentSplitView(containerId, anchorViewId, parentId) {
    const merges = { ...getContainerMerges(containerId) }
    if (Object.values(merges).some(g => g.some(sv => sv.id === parentId))) return
    if (getContainerIds(containerId).includes(parentId)) return

    const slotKey = _findSlotKey(containerId, anchorViewId)
    if (!slotKey) return
    const entry = { id: parentId, collapsed: false, size: 1 }
    merges[slotKey] = merges[slotKey]
      ? [...merges[slotKey], entry]
      : [{ id: slotKey, collapsed: false, size: 1 }, entry]
    setContainerMerges(containerId, merges)
  }

  // Alerts and returns true when dropping `sectionId` into `parentId` would create
  // a disallowed same-view duplicate (the parent already holds that section).
  function _blockDuplicateDrop(destList, parentId, sectionId) {
    if (!Array.isArray(destList) || !destList.some(s => s.id === sectionId)) return false
    if (viewAllowsDuplicateSections(parentId)) return false
    const what  = getViewEntry(sectionId)?.label ?? sectionId
    const where = getViewEntry(parentId)?.label ?? parentId
    window.alert(`"${what}" is already in "${where}".`)
    return true
  }

  // Drop on a View's body → adopt the section, surfacing its biological parent as a
  // SplitView in that slot.
  function handleSectionMove({ sectionId, fromViewId, fromContainerId, homeViewId, toViewId, toContainerId, toIndex }) {
    if (fromContainerId === toContainerId && fromViewId === toViewId) return  // same area → reordered locally
    const srcRef = _viewSectionsRef(fromContainerId)
    const dstRef = _viewSectionsRef(toContainerId)
    if (!srcRef || !dstRef) return

    const parentId = homeViewId || fromViewId
    // Block a disallowed duplicate, unless the section is merely re-positioning
    // within its own parent's list (same container + same parent = same list).
    const withinSameParent = fromContainerId === toContainerId && fromViewId === parentId
    if (!withinSameParent && _blockDuplicateDrop(dstRef.value[parentId], parentId, sectionId)) return
    const sameContainer = fromContainerId === toContainerId
    const srcMap = { ...srcRef.value }
    const dstMap = sameContainer ? srcMap : { ...dstRef.value }

    // Pull the section out of its source parent.
    const srcList = [...(srcMap[fromViewId] ?? [])]
    const idx = srcList.findIndex(s => s.id === sectionId)
    if (idx < 0) return
    const [moved] = srcList.splice(idx, 1)
    _removeFromSourceParent(srcMap, fromContainerId, fromViewId, srcList)

    // Add it under its biological parent in the destination.
    const dstList = [...(dstMap[parentId] ?? [])]
    if (!dstList.some(s => s.id === moved.id) || viewAllowsDuplicateSections(parentId)) {
      const at = (toViewId === parentId && toIndex >= 0) ? Math.min(toIndex, dstList.length) : dstList.length
      dstList.splice(at, 0, moved)
    }
    dstMap[parentId] = dstList

    srcRef.value = srcMap
    if (!sameContainer) dstRef.value = dstMap

    // Surface the biological parent as its own SplitView in the target slot.
    if (MOVABLE_CONTAINERS.has(toContainerId) && parentId !== toViewId) {
      _materializeParentSplitView(toContainerId, toViewId, parentId)
    }
  }

  // Drop on the tab strip → the section's biological parent becomes a standalone tab.
  function handleSectionToTab({ sectionId, fromViewId, fromContainerId, homeViewId, toContainerId, toIndex }) {
    if (!MOVABLE_CONTAINERS.has(toContainerId)) return
    const srcRef = _viewSectionsRef(fromContainerId)
    const dstRef = _viewSectionsRef(toContainerId)
    if (!srcRef || !dstRef) return

    const parentId = homeViewId || fromViewId
    const withinSameParent = fromContainerId === toContainerId && fromViewId === parentId
    if (!withinSameParent && _blockDuplicateDrop(dstRef.value[parentId], parentId, sectionId)) return
    const sameContainer = fromContainerId === toContainerId
    const srcMap = { ...srcRef.value }
    const dstMap = sameContainer ? srcMap : { ...dstRef.value }

    const srcList = [...(srcMap[fromViewId] ?? [])]
    const idx = srcList.findIndex(s => s.id === sectionId)
    if (idx < 0) return
    const [moved] = srcList.splice(idx, 1)
    _removeFromSourceParent(srcMap, fromContainerId, fromViewId, srcList)

    const dstList = [...(dstMap[parentId] ?? [])]
    if (!dstList.some(s => s.id === moved.id) || viewAllowsDuplicateSections(parentId)) dstList.push(moved)
    dstMap[parentId] = dstList

    srcRef.value = srcMap
    if (!sameContainer) dstRef.value = dstMap

    // Ensure the parent is shown as a tab (create it if it isn't anywhere yet).
    const existingKey = _findSlotKey(toContainerId, parentId)
    if (existingKey) {
      setActiveTab(toContainerId, existingKey)
    } else {
      const ids = [...getContainerIds(toContainerId)]
      const at = (toIndex != null && toIndex >= 0) ? Math.min(toIndex, ids.length) : ids.length
      ids.splice(at, 0, parentId)
      setContainerIds(toContainerId, ids)
      setActiveTab(toContainerId, parentId)
    }
  }

  // Drop a *floated* View (a parent surfaced elsewhere, e.g. an "Explorer" tab in
  // the panel) back onto the same View in another container — fold its sections
  // home and discard the floated copy.
  function handleViewReabsorb({ fromContainerId, toContainerId, viewId }) {
    if (fromContainerId === toContainerId) return
    const srcRef = _viewSectionsRef(fromContainerId)
    const dstRef = _viewSectionsRef(toContainerId)
    if (!srcRef || !dstRef) return

    const moving = [...(srcRef.value[viewId] ?? [])]
    if (!moving.length) return

    // If every section in the floated view is already in the destination (the user
    // toggled them back manually), there's nothing to absorb. Leave the floated tab
    // intact rather than silently discarding it.
    const dstExisting = dstRef.value[viewId] ?? []
    const newSections = moving.filter(s => !dstExisting.some(d => d.id === s.id))
    if (!newSections.length && !viewAllowsDuplicateSections(viewId)) return

    const srcMap = { ...srcRef.value }
    delete srcMap[viewId]
    if (MOVABLE_CONTAINERS.has(fromContainerId)) _removeViewFromSlot(fromContainerId, viewId)

    const dstMap = { ...dstRef.value }
    const dstList = [...(dstMap[viewId] ?? [])]
    for (const s of moving) {
      if (!dstList.some(d => d.id === s.id) || viewAllowsDuplicateSections(viewId)) dstList.push(s)
    }
    dstMap[viewId] = dstList

    srcRef.value = srcMap
    dstRef.value = dstMap
  }

  function togglePrimaryView(name) {
    if (activePrimaryView.value === name && sidebarVisible.value) {
      sidebarVisible.value = false
    } else {
      activePrimaryView.value = name
      sidebarVisible.value = true
    }
  }

  // ── Chrome: tab / header / section context-menu actions ───────────────────────
  // Exposed to every ViewContainer via provide/inject so the three container
  // wrappers don't each need to thread these props/events through. Drives the
  // tab, header, and section context menus plus the "More actions…" dropdown.

  // Remembers the area a tab was last shown in, so re-showing a hidden view returns
  // it home. Runtime-only — hiddenViews persists; remembering the exact area is
  // best-effort and falls back to the view's default container.
  const viewLastContainer = ref({})
  // Badge visibility is a placeholder until views/sections carry badges; tracked so
  // the "Hide Badge" toggles check/uncheck correctly within a session.
  const hiddenTabBadges = ref(new Set())

  // All view ids currently shown in a container (top-level tabs + merged sub-views).
  function _visibleViewIdsIn(cid) {
    const out = new Set(getContainerIds(cid))
    for (const grp of Object.values(getContainerMerges(cid))) for (const sv of grp) out.add(sv.id)
    return [...out]
  }

  // The container a (possibly hidden) view belongs to: remembered area, else default.
  function _homeContainerOf(id) {
    return viewLastContainer.value[id] ?? VIEW_DEFAULT_CONTAINER[id] ?? 'secondarySidebar'
  }

  // Strip a view id from every movable container's tab list + merge groups.
  function _removeViewEverywhere(id) {
    rightPanelViewIds.value  = rightPanelViewIds.value.filter(v => v !== id)
    bottomPanelViewIds.value = bottomPanelViewIds.value.filter(v => v !== id)
    const strip = (merges) => Object.fromEntries(Object.entries(merges).map(([k, arr]) => [k, arr.filter(sv => sv.id !== id)]))
    rightPanelMerges.value  = strip(rightPanelMerges.value)
    bottomPanelMerges.value = strip(bottomPanelMerges.value)
  }

  // Hide a view: remember its area, remove it from the UI, mark intentionally hidden.
  function hideView(id, fromContainerId) {
    if (fromContainerId) viewLastContainer.value = { ...viewLastContainer.value, [id]: fromContainerId }
    _removeViewEverywhere(id)
    if (rightPanel.value === id) rightPanel.value = rightPanelViewIds.value[0] ?? ''
    if (bottomPanel.value === id) bottomPanel.value = bottomPanelViewIds.value[0] ?? ''
    hiddenViews.value = [...hiddenViews.value.filter(h => h !== id), id]
  }

  // Show a previously hidden view, returning it to its remembered/default area.
  function showView(id) {
    addView(id, _homeContainerOf(id))
  }

  function toggleViewVisibility(id, fromContainerId) {
    if (isViewVisible(id)) hideView(id, fromContainerId)
    else showView(id)
  }

  // Move a top-level view tab to another movable container (Secondary Side Bar / Bottom Panel).
  function moveViewToContainer(viewId, fromContainerId, toContainerId) {
    if (fromContainerId === toContainerId || !MOVABLE_CONTAINERS.has(toContainerId)) return
    handleViewTransfer({ fromContainerId, toContainerId, viewId, toIndex: getContainerIds(toContainerId).length })
  }

  // Views (visible + hidden) that belong to a container, for its header toggle menu.
  function viewsForContainer(cid) {
    const visible = _visibleViewIdsIn(cid)
    const hidden  = hiddenViews.value.filter(id => _homeContainerOf(id) === cid && !visible.includes(id))
    return [...visible, ...hidden].map(id => ({
      id,
      label:    _viewTab(id).label,
      shortcut: PANEL_VIEW_REGISTRY[id]?.shortcut,
      visible:  visible.includes(id),
    }))
  }

  const CONTAINER_LABELS = {
    primarySidebar:   'Primary Side Bar',
    secondarySidebar: 'Secondary Side Bar',
    panel:            'Bottom Panel',
  }
  // Real move targets (Primary Side Bar deferred — not a movable container yet).
  function moveTargetsFor(cid) {
    return ['secondarySidebar', 'panel'].filter(c => c !== cid).map(c => ({ id: c, label: CONTAINER_LABELS[c] }))
  }

  function hideContainer(cid) {
    if (cid === 'secondarySidebar') rightpaneVisible.value = false
    if (cid === 'panel')            bottompaneVisible.value = false
  }

  const workbenchChrome = {
    showTabIcons: computed(() => prefs.workbench?.showTabIcons !== false),
    toggleTabIcons: () => {
      if (!prefs.workbench) prefs.workbench = {}
      prefs.workbench.showTabIcons = !(prefs.workbench.showTabIcons !== false)
      savePrefs({ workbench: { showTabIcons: prefs.workbench.showTabIcons } })
    },
    isViewVisible,
    toggleViewVisibility,
    hideView,
    moveViewToContainer,
    viewsForContainer,
    moveTargetsFor,
    hideContainer,
    containerLabel: (cid) => CONTAINER_LABELS[cid] ?? cid,
    // Badge placeholder (no badges are rendered yet).
    isTabBadgeHidden: (id) => hiddenTabBadges.value.has(id),
    toggleTabBadge: (id) => {
      const s = new Set(hiddenTabBadges.value)
      if (s.has(id)) s.delete(id); else s.add(id)
      hiddenTabBadges.value = s
    },
  }

  return {
    // workspace refs re-exposed for the template
    sidebarVisible, sidebarWidth, activePrimaryView,
    rightpaneVisible, rightpaneWidth, rightPanel,
    bottompaneVisible, bottompaneHeight, bottomPanel,
    // view lists + section/merge state
    primarySidebarViews, primaryViewSections, secondaryViewSections, panelViewSections,
    rightPanelViews, bottomPanelViews, rightPanelMerges, bottomPanelMerges,
    PANEL_VIEW_REGISTRY,
    // visibility + handlers
    isViewVisible, hideView, showView, recoverMissingViews, togglePrimaryView,
    handleViewTransfer, handleViewMerge, handleViewUnmerge,
    handleSectionMove, handleSectionToTab, handleViewReabsorb,
    // chrome
    workbenchChrome,
  }
}
