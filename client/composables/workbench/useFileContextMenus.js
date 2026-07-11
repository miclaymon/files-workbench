import { ref } from 'vue'
import { mdiContentCopy, mdiContentCut, mdiPencilOutline, mdiTrashCanOutline, mdiInformationOutline } from '@mdi/js'

// ── File context-menu slice ───────────────────────────────────────────────────
// Builds the cursor-positioned ContextMenu item lists for editor tabs, the
// directory background, right-drag drops, and individual items. The base items are
// built here directly — these are the editor / Explorer "owner" menus, so they
// keep full control of their own options — and any activity/plugin may append
// items to a menu through the app-level contribution API (host.facade.menus),
// keyed by a menu id, with the right-clicked target passed as the invocation ctx.
export function useFileContextMenus({ host, editor, selection, fileOps, archive, enqueue, statusbar, fsOpenWithSystem, fsOpenTerminal, uuid }) {
  const {
    activeTab, editorController, closeOtherTabs, splitWithTab,
    findTabByPath, focusTab, addTabToActiveGroup, triggerInlineRename, refreshAllDirs,
  } = editor
  const { selectedItems, handleOpenFromTab } = selection
  const {
    createNewFolder, createNewFile, doPaste, clipboard, doMove,
    doCompress, doDecompress, copyToClipboard, cutToClipboard, doTrash, doDelete, doPin,
  } = fileOps
  const { isArchiveItem, archiveCaps } = archive
  const { flashStatus } = statusbar
  const { menus, commands } = host.facade

  const contextMenu = ref({ visible: false, x: 0, y: 0, items: [], quickActions: [] })

  function hideContextMenu() { contextMenu.value.visible = false }

  // Resolve a contributed descriptor: `{ command }` refs pull label / enabled from
  // the registry; literal items pass through. Returns null for a missing command.
  function resolveContribItem(it) {
    if (!it || it.separator || it.submenu) return it
    if (it.command) {
      const cmd = commands.get(it.command)
      if (!cmd) return null
      return {
        key:      it.command,
        label:    it.label ?? cmd.title,
        icon:     it.icon ?? cmd.icon,
        action:   () => commands.execute(it.command),
        disabled: it.disabled ?? !commands.isEnabled(it.command),
      }
    }
    return it
  }

  // Append items contributed to `menuId` (by any activity/plugin) after the base
  // items, separated. `ctx` carries the invocation target so a contribution can
  // build target-specific items and gate itself with when().
  function withContributions(menuId, baseItems, ctx) {
    const resolved = menus.items(menuId, ctx).map(resolveContribItem).filter(Boolean)
    return resolved.length ? [...baseItems, { separator: true }, ...resolved] : baseItems
  }

  function handleTabContextMenu({ event, tab, groupId }) {
    const items = [
      { key: 'close',       label: 'Close',        action: () => editorController.closeTab(groupId, tab.id) },
      { key: 'closeOthers', label: 'Close Others', action: () => closeOtherTabs(groupId, tab.id) },
      { separator: true },
      { key: 'pin', label: tab.pinned ? 'Unpin' : 'Pin', action: () => editorController.togglePin(groupId, tab.id) },
      { separator: true },
      { key: 'splitRight', label: 'Split Right', action: () => splitWithTab(groupId, tab.id, 'right') },
      { key: 'splitDown',  label: 'Split Down',  action: () => splitWithTab(groupId, tab.id, 'bottom') },
      { separator: true },
      { key: 'copypath', label: 'Copy Path', action: () => navigator.clipboard.writeText(tab.path ?? ''), disabled: !tab.path },
    ]
    contextMenu.value = {
      visible: true, x: event.clientX, y: event.clientY, quickActions: [],
      items: withContributions('editor/tab', items, { host, tab, groupId }),
    }
  }

  function openArchiveInTab(item) {
    const virtualPath = item.path + '::'
    const existing = findTabByPath(virtualPath)
    if (existing) { focusTab(existing.groupId, existing.tab.id); return }
    const title = item.name || item.path.split(/[/\\]/).filter(Boolean).pop()
    addTabToActiveGroup({ id: uuid(), kind: 'dir', mode: 'normal', pinned: false, title, path: virtualPath, selectedItems: [], focusedItem: null, selectedPath: '' })
  }

  function showBackgroundContextMenu(event) {
    const inArchive = activeTab.value?.path?.includes('::')
    const curDir = activeTab.value?.kind === 'dir' ? activeTab.value.path : null

    const items = inArchive ? [] : [
      { key: 'newfolder', label: 'New Folder', action: createNewFolder },
      { key: 'newfile',   label: 'New File',   action: createNewFile   },
      ...(curDir ? [{ key: 'terminal', label: 'Open in Terminal', action: () => fsOpenTerminal(curDir) }] : []),
      { separator: true },
      { key: 'paste', label: 'Paste', action: doPaste, disabled: clipboard.value.count === 0 },
    ]
    contextMenu.value = {
      visible: true, x: event.clientX, y: event.clientY, quickActions: [],
      items: withContributions('directory/background', items, { host, dir: curDir, inArchive }),
    }
  }

  function showRightDragDropMenu({ items, dropPath, x, y }) {
    if (!items?.length) return

    // Determine effective destination: dropped dir item or current tab dir
    const destDir = (() => {
      if (dropPath) {
        const hit = items.find(i => i.path === dropPath)
        if (!hit || hit.kind === 'dir') return dropPath
      }
      return activeTab.value?.kind === 'dir' ? activeTab.value.path : null
    })()

    if (!destDir) return

    const label = destDir.split(/[/\\]/).filter(Boolean).pop() || destDir
    const allArchives = items.every(i => i.kind === 'archive' || isArchiveItem(i))

    const menuItems = [
      { key: 'move-here', label: `Move Here "${label}"`, action: () => doMove(items, destDir) },
      { key: 'copy-here', label: `Copy Here "${label}"`, action: () => {
        const paths = items.map(i => i.path)
        enqueue({ label: `Copy ${items.length} item(s) to "${label}"`, kind: 'copy', params: { paths, dest_dir: destDir } })
          .then(() => refreshAllDirs())
          .catch(e => { flashStatus(`Error: ${e?.message ?? e}`, 2000) })
      }},
      { key: 'link-here', label: 'Create Symlink Here', disabled: true },
      { separator: true },
      ...(allArchives
        ? [{ key: 'extract-here', label: 'Extract Here', action: () => { for (const arch of items) doDecompress(arch, false) } }]
        : [{ key: 'compress-here', label: 'Compress to Archive Here', action: () => doCompress(items, 'zip') }]
      ),
      { separator: true },
      { key: 'cancel', label: 'Cancel', action: () => {} },
    ]

    contextMenu.value = {
      visible: true, x, y, quickActions: [],
      items: withContributions('directory/right-drag', menuItems, { host, items, destDir }),
    }
  }

  function showItemContextMenu({ event, item } = {}) {
    // Ignore payloads that aren't a directory-item right-click. A tab whose component
    // doesn't emit the structured { event, item } (e.g. the Preview tab) lets the raw
    // native `contextmenu` fall through here; without this guard `event.shiftKey` throws.
    if (!event || !item) return
    const targets = selectedItems.value.some(s => s.path === item.path)
      ? selectedItems.value
      : [item]

    const inArchive = activeTab.value?.path?.includes('::')
    const isShift   = event.shiftKey

    const singleItem = targets.length === 1 ? targets[0] : null
    const isArchive  = singleItem?.kind === 'archive' || (singleItem?.kind === 'file' && isArchiveItem(singleItem))
    const isApp      = singleItem?.kind === 'app'
    const isDir      = singleItem?.kind === 'dir'
    const multi      = targets.length > 1
    const allPinned  = targets.every(t => t.pinned)

    // ── Quick action buttons (SVG icons) ──────────────────────────────────────
    const quickActions = inArchive ? [] : [
      { key: 'copy',   icon: mdiContentCopy,    label: 'Copy',   action: () => copyToClipboard(targets) },
      { key: 'cut',    icon: mdiContentCut,     label: 'Cut',    action: () => cutToClipboard(targets)  },
      { key: 'rename', icon: mdiPencilOutline,   label: 'Rename', action: () => triggerInlineRename() },
      { key: 'trash',  icon: mdiTrashCanOutline, label: isShift ? 'Delete Permanently' : 'Move to Trash', action: () => isShift ? doDelete(targets) : doTrash(targets) },
      ...(!multi ? [{ key: 'info', icon: mdiInformationOutline, label: 'Info', action: () => {} }] : []),
    ]

    // ── Compress submenu ──────────────────────────────────────────────────────
    const compressSubmenu = inArchive ? [] : [
      { key: 'c-zip',   label: 'ZIP',    action: () => doCompress(targets, 'zip') },
      { key: 'c-targz', label: 'TAR.GZ', action: () => doCompress(targets, 'tar.gz') },
      ...(archiveCaps.value?.seven_zip?.available ? [{ key: 'c-7z', label: '7-Zip', action: () => doCompress(targets, '7z') }] : []),
    ]

    // ── "Copy path" submenu ───────────────────────────────────────────────────
    const copyPathAction = () => navigator.clipboard.writeText(item.path)

    // ── Open With submenu ─────────────────────────────────────────────────────
    const openWithSubmenu = [
      { key: 'open-default', label: 'Default Application', action: () => fsOpenWithSystem(item.path) },
    ]

    // ── Extract submenu (archives only) ──────────────────────────────────────
    const extractSubmenu = isArchive && !inArchive ? [
      { key: 'extract-here',   label: 'Extract Here',         action: () => doDecompress(singleItem, false) },
      { key: 'extract-folder', label: 'Extract to Folder…',   action: () => doDecompress(singleItem, true)  },
    ] : []

    // ── Build item list ───────────────────────────────────────────────────────
    const items = [
      // Open section
      { key: 'open', label: isApp ? 'Open Application' : 'Open', action: () => handleOpenFromTab(item) },
      ...(!multi ? [{ key: 'open-with', label: 'Open With…', submenu: openWithSubmenu }] : []),
      ...((!multi && (isDir || isApp)) ? [{ key: 'terminal', label: 'Open in Terminal', action: () => fsOpenTerminal(singleItem.path) }] : []),
      ...((!multi && (isArchive || isApp)) ? [{ key: 'browse', label: 'Browse Contents', action: () => openArchiveInTab(singleItem) }] : []),
      ...(extractSubmenu.length ? [{ key: 'extract', label: 'Extract', submenu: extractSubmenu }] : []),

      // Edit section
      { separator: true },
      { key: 'duplicate', label: 'Duplicate', action: () => {
        const ops = targets.map(t => {
          const sep = t.path.includes('\\') ? '\\' : '/'
          const dir = t.path.split(sep).slice(0, -1).join(sep)
          return enqueue({ label: `Duplicate "${t.name}"`, kind: 'copy', params: { paths: [t.path], dest_dir: dir } })
        })
        Promise.all(ops)
          .then(() => refreshAllDirs())
          .catch(e => { flashStatus(`Error: ${e?.message ?? e}`, 2000) })
      }},
      ...(!inArchive && !multi ? [{ key: 'copypath', label: 'Copy Path', action: copyPathAction }] : []),

      // Actions section
      { separator: true },
      ...(!inArchive ? [{ key: 'pin', label: allPinned ? 'Unpin' : 'Pin', action: () => doPin(targets, !allPinned) }] : []),
      ...(!inArchive && compressSubmenu.length ? [{ key: 'compress', label: 'Compress', submenu: compressSubmenu }] : []),
      ...(!inArchive ? [{ key: 'rename', label: 'Rename', action: () => triggerInlineRename() }] : []),
      ...(!inArchive ? [{ key: 'delete', label: isShift ? 'Delete Permanently' : 'Delete', action: () => isShift ? doDelete(targets) : doTrash(targets) }] : []),
    ]

    contextMenu.value = {
      visible: true, x: event.clientX, y: event.clientY, quickActions,
      items: withContributions('directory/item', items, { host, item, targets, single: singleItem, multi, inArchive }),
    }
  }

  return {
    contextMenu, hideContextMenu,
    handleTabContextMenu, showBackgroundContextMenu, showRightDragDropMenu, showItemContextMenu,
  }
}
