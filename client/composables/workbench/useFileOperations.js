import { ref, nextTick } from 'vue'

// ── File operations slice ─────────────────────────────────────────────────────
// Create / rename / trash / delete / compress / extract / paste / move / undo /
// redo, plus the clipboard, the elevation dialog, and the missing-tool install
// prompt. Consumes the editor grid (refresh + active tab), selection (clear +
// rename reconciliation), the status bar, and the ops queue / history.
export function useFileOperations({ editor, selection, statusbar, enqueue, history, log, explorerPanelRef }) {
  const { refreshAllDirs, forEachGroup, activeTab } = editor
  const { selectedItems, focusedItem, updateSelectionAfterRename, updateSelectionAfterBatchRename } = selection
  const { flashStatus } = statusbar

  // Clipboard
  const clipboard = ref({ mode: 'Copy', count: 0, items: [] })

  // Elevation dialog state
  const elevationPasswordRef = ref(null)
  const elevationPrompt = ref(null)  // { op, paths, password-based method, message, onConfirm }
  const elevationPassword = ref('')
  const elevationError = ref('')

  // Install-tool prompt state
  const installPrompt = ref(null)  // { tool, message, installApt, ... }

  async function createNewFolder() {
    const name = prompt('Enter folder name:')
    if (!name) return
    const dir = activeTab.value?.kind === 'dir' ? activeTab.value.path : '/'
    const sep = dir.includes('\\') ? '\\' : '/'
    try {
      await enqueue({ label: `Create folder "${name}"`, kind: 'create_dir', params: { path: dir + sep + name } })
      refreshAllDirs()
    } catch (e) {
      flashStatus(`Error: ${e?.message ?? e}`, 2000)
    }
  }

  async function createNewFile() {
    const name = prompt('Enter file name:')
    if (!name) return
    const dir = activeTab.value?.kind === 'dir' ? activeTab.value.path : '/'
    const sep = dir.includes('\\') ? '\\' : '/'
    try {
      await enqueue({ label: `Create file "${name}"`, kind: 'create_file', params: { path: dir + sep + name } })
      refreshAllDirs()
    } catch (e) {
      flashStatus(`Error: ${e?.message ?? e}`, 2000)
    }
  }

  // Rename — receives { path: string, newName: string } from tree or directory view.
  // { items } form (F2 on multi-select) is ignored for now — single rename only.
  async function handleRename({ path, newName }) {
    if (!path || !newName) return
    const oldName = path.split(/[/\\]/).filter(Boolean).pop()
    if (newName === oldName) return
    const label = `Rename "${oldName}" → "${newName}"`

    // Compute expected new path for optimistic update
    const sep = path.includes('\\') ? '\\' : '/'
    const dir = path.slice(0, path.lastIndexOf(sep))
    const optimisticPath = dir + sep + newName

    // Apply immediately — user sees the change before the server responds
    forEachGroup(r => r.renameItem?.(path, newName, optimisticPath))
    updateSelectionAfterRename(path, newName, optimisticPath)

    try {
      const result = await enqueue({ label, kind: 'rename', params: { path, new_name: newName } })

      // If the server returned a slightly different path (e.g. case normalization), reconcile
      if (result.path !== optimisticPath) {
        const serverName = result.path.split(/[/\\]/).pop()
        forEachGroup(r => r.renameItem?.(optimisticPath, serverName, result.path))
        updateSelectionAfterRename(optimisticPath, serverName, result.path)
      }

      history.push({
        label,
        undo: () => enqueue({ label: `Undo ${label}`, kind: 'rename', params: { path: result.path, new_name: oldName } }),
        redo: () => enqueue({ label: `Redo ${label}`, kind: 'rename', params: { path, new_name: newName } }),
      })
      explorerPanelRef.value?.refresh()
    } catch (e) {
      // Roll back the optimistic update
      forEachGroup(r => r.renameItem?.(optimisticPath, oldName, path))
      updateSelectionAfterRename(optimisticPath, oldName, path)
      flashStatus(`Rename failed: ${e?.message ?? e}`, 2500)
    }
  }

  // Batch rename — receives [{ path, newName }] from find-replace-all.
  // Applies one optimistic update for all items, fires all server calls in parallel.
  async function handleRenameBatch(renames) {
    if (!renames?.length) return
    const sep = renames[0].path.includes('\\') ? '\\' : '/'

    // Build the rename map with computed new paths
    const ops = renames.map(({ path, newName }) => {
      const dir = path.slice(0, path.lastIndexOf(sep))
      return { oldPath: path, newName, newPath: dir + sep + newName, oldName: path.split(/[/\\]/).pop() }
    })

    const renameMap = new Map(ops.map(o => [o.oldPath, o]))

    // Single optimistic update — unchanged items keep same object reference
    forEachGroup(r => r.batchRenameItems?.(ops))
    updateSelectionAfterBatchRename(renameMap)

    // Fire all server renames in parallel; collect results and failures
    const results = await Promise.allSettled(
      ops.map(o => enqueue({ label: `Rename "${o.oldName}" → "${o.newName}"`, kind: 'rename', params: { path: o.oldPath, new_name: o.newName } }))
    )

    const failed = []
    for (let i = 0; i < ops.length; i++) {
      const o = ops[i]
      const res = results[i]
      if (res.status === 'fulfilled') {
        // Reconcile if server returned a different path (e.g. case normalization)
        const serverPath = res.value?.path
        if (serverPath && serverPath !== o.newPath) {
          const serverName = serverPath.split(/[/\\]/).pop()
          forEachGroup(r => r.renameItem?.(o.newPath, serverName, serverPath))
          updateSelectionAfterRename(o.newPath, serverName, serverPath)
        }
      } else {
        failed.push(o)
      }
    }

    // Roll back only the failed items
    if (failed.length) {
      const rollbackOps = failed.map(o => ({ oldPath: o.newPath, newName: o.oldName, newPath: o.oldPath }))
      forEachGroup(r => r.batchRenameItems?.(rollbackOps))
      const rollbackMap = new Map(failed.map(o => [o.newPath, { newName: o.oldName, newPath: o.oldPath }]))
      updateSelectionAfterBatchRename(rollbackMap)
      flashStatus(`${failed.length} rename${failed.length > 1 ? 's' : ''} failed`, 2500)
    }

    // All server ops have settled — clear thumbnailPath so every item's thumbnail uses its
    // final, now-existing path: newPath for successes, the rolled-back oldPath for failures.
    const finalPaths = ops.map((o, i) => results[i].status === 'fulfilled' ? o.newPath : o.oldPath)
    forEachGroup(r => r.clearOptimisticThumbnails?.(finalPaths))

    explorerPanelRef.value?.refresh()
  }

  async function doTrash(items) {
    if (!items.length) return
    const paths = items.map(i => i.path)
    const label = items.length === 1 ? `Trash "${items[0].name}"` : `Trash ${items.length} items`
    try {
      const result = await enqueue({ label, kind: 'trash', params: { paths } })
      if (result?.requiresElevation) {
        showElevationPrompt({
          op: 'trash', paths: result.elevationPaths, method: result.elevationMethod,
          message: `Moving ${result.elevationPaths.length === 1 ? `"${result.elevationPaths[0].split(/[/\\]/).pop()}"` : `${result.elevationPaths.length} items`} to trash requires administrator permission.`,
          onConfirm: async (password) => {
            await enqueue({ label: label + ' (elevated)', kind: 'trash_elevated', params: { paths, password } })
            afterDelete()
          }
        })
        return
      }
      afterDelete()
    } catch (e) {
      flashStatus(`Trash failed: ${e?.message ?? e}`, 2500)
    }
  }

  async function doDelete(items) {
    if (!items.length) return
    const names = items.length === 1 ? `"${items[0].name}"` : `${items.length} items`
    if (!confirm(`Permanently delete ${names}? This cannot be undone.`)) return
    const paths = items.map(i => i.path)
    const label = `Permanently delete ${names}`
    try {
      const result = await enqueue({ label, kind: 'delete', params: { paths } })
      if (result?.requiresElevation) {
        showElevationPrompt({
          op: 'delete', paths: result.elevationPaths, method: result.elevationMethod,
          message: `Permanently deleting ${result.elevationPaths.length === 1 ? `"${result.elevationPaths[0].split(/[/\\]/).pop()}"` : `${result.elevationPaths.length} items`} requires administrator permission.`,
          onConfirm: async (password) => {
            await enqueue({ label: label + ' (elevated)', kind: 'delete_elevated', params: { paths, password } })
            afterDelete()
          }
        })
        return
      }
      afterDelete()
    } catch (e) {
      flashStatus(`Delete failed: ${e?.message ?? e}`, 2500)
    }
  }

  function afterDelete() {
    refreshAllDirs()
    explorerPanelRef.value?.refresh()
    selectedItems.value = []
    focusedItem.value = null
  }

  // ── elevation dialog ──────────────────────────────────────────────────────────

  function showElevationPrompt({ op, paths, method, message, onConfirm }) {
    elevationPassword.value = ''
    elevationError.value = ''
    elevationPrompt.value = { op, paths, method, message, onConfirm }
    nextTick(() => elevationPasswordRef.value?.focus())
  }

  function cancelElevation() {
    elevationPrompt.value = null
    elevationPassword.value = ''
    elevationError.value = ''
  }

  async function confirmElevation() {
    if (!elevationPrompt.value) return
    const { onConfirm, method } = elevationPrompt.value
    const password = method === 'sudo_password' ? elevationPassword.value : ''
    if (method === 'sudo_password' && !password) {
      elevationError.value = 'Please enter your password.'
      return
    }
    elevationError.value = ''
    try {
      await onConfirm(password)
      cancelElevation()
    } catch (e) {
      const msg = e?.message ?? String(e)
      if (msg.includes('incorrect password') || msg.includes('Incorrect password')) {
        elevationError.value = 'Incorrect password. Try again.'
        elevationPassword.value = ''
        nextTick(() => elevationPasswordRef.value?.focus())
      } else {
        flashStatus(`Elevated operation failed: ${msg}`, 3000)
        cancelElevation()
      }
    }
  }

  // ── archive operations ────────────────────────────────────────────────────────

  async function doCompress(items, format) {
    if (!items.length) return
    const destDir = items[0].path.split(/[/\\]/).slice(0, -1).join('/')  || '/'
    const extMap = { zip: '.zip', tar: '.tar', 'tar.gz': '.tar.gz', '7z': '.7z' }
    const ext = extMap[format] ?? '.zip'
    const baseName = items.length === 1 ? items[0].name : 'Archive'
    const defaultName = baseName + ext
    const name = prompt(`Archive name:`, defaultName)
    if (!name) return
    const dest = destDir + '/' + name
    const paths = items.map(i => i.path)
    const label = `Compress to ${name}`
    try {
      await enqueue({ label, kind: 'compress', params: { paths, format, dest } })
      refreshAllDirs()
      log('ops-queue', 'Compressed', { dest, format, count: paths.length, sources: paths })
    } catch (e) {
      flashStatus(`Compress failed: ${e?.message ?? e}`, 2500)
    }
  }

  async function doDecompress(item, toNewFolder = false) {
    if (!item) return
    const srcDir = item.path.split(/[/\\]/).slice(0, -1).join('/') || '/'
    let destDir = srcDir
    if (toNewFolder) {
      // Strip known archive extension(s) to make folder name
      let folderName = item.name
      for (const ext of ['.tar.gz', '.tar.bz2', '.tar.xz', '.tgz', '.tbz2', '.txz', '.zip', '.7z', '.rar', '.tar', '.gz']) {
        if (folderName.toLowerCase().endsWith(ext)) { folderName = folderName.slice(0, -ext.length); break }
      }
      destDir = srcDir + '/' + folderName
    }
    const label = `Extract "${item.name}"`
    try {
      const result = await enqueue({ label, kind: 'decompress', params: { path: item.path, dest_dir: destDir } })
      if (result?.missingTool) {
        installPrompt.value = {
          tool: result.tool,
          message: `Extracting "${item.name}" requires ${result.tool}, which is not installed.`,
          installApt: result.installApt,
          installDnf: result.installDnf,
          installPac: result.installPac,
          installBrew: result.installBrew,
        }
        return
      }
      refreshAllDirs()
      log('ops-queue', 'Extracted', { source: item.path, dest: destDir, toNewFolder })
    } catch (e) {
      flashStatus(`Extract failed: ${e?.message ?? e}`, 2500)
    }
  }

  async function doPaste() {
    const cb = clipboard.value
    if (!cb.count) return
    const destDir = activeTab.value?.kind === 'dir' ? activeTab.value.path : null
    if (!destDir) return
    const paths = cb.items.map(i => i.path)
    const label = `${cb.mode} ${cb.count} item(s) into "${destDir.split(/[/\\]/).filter(Boolean).pop()}"`
    try {
      let result
      if (cb.mode === 'Cut') {
        result = await enqueue({ label, kind: 'move', params: { paths, dest_dir: destDir } })
        const movedPaths = result.moved.map(m => m.path)
        const oldPaths   = result.moved.map(m => m.old_path)
        const undoDestDir = oldPaths[0] ? oldPaths[0].split(/[/\\]/).slice(0, -1).join('/') : destDir
        history.push({
          label,
          undo: () => enqueue({ label: `Undo ${label}`, kind: 'move', params: { paths: movedPaths, dest_dir: undoDestDir } }),
          redo: () => enqueue({ label: `Redo ${label}`, kind: 'move', params: { paths: oldPaths, dest_dir: destDir } }),
        })
        clipboard.value = { mode: 'Copy', count: 0, items: [] }
      } else {
        result = await enqueue({ label, kind: 'copy', params: { paths, dest_dir: destDir } })
        const copiedPaths = result.copied.map(c => c.path)
        history.push({
          label,
          undo: () => enqueue({ label: `Undo ${label}`, kind: 'delete', params: { paths: copiedPaths } }),
          redo: () => enqueue({ label: `Redo ${label}`, kind: 'copy', params: { paths, dest_dir: destDir } }),
        })
      }
      const destName = destDir.split(/[/\\]/).filter(Boolean).pop() || destDir
      log('clipboard', `Paste (${cb.mode}) → ${destName}`, {
        _type: 'item-table',
        items: cb.items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
      })
      refreshAllDirs()
    } catch (e) {
      flashStatus(`Paste failed: ${e?.message ?? e}`, 2500)
    }
  }

  async function doMove(items, destDir) {
    if (!items.length || !destDir) return
    const paths = items.map(i => i.path)
    const label = `Move ${items.length === 1 ? `"${items[0].name}"` : `${items.length} items`} → "${destDir.split(/[/\\]/).filter(Boolean).pop()}"`
    try {
      const result = await enqueue({ label, kind: 'move', params: { paths, dest_dir: destDir } })
      const movedPaths = result.moved.map(m => m.path)
      const srcDir = paths[0].split(/[/\\]/).slice(0, -1).join('/')
      history.push({
        label,
        undo: () => enqueue({ label: `Undo ${label}`, kind: 'move', params: { paths: movedPaths, dest_dir: srcDir } }),
        redo: () => enqueue({ label: `Redo ${label}`, kind: 'move', params: { paths, dest_dir: destDir } }),
      })
      refreshAllDirs()
      selectedItems.value = []
      focusedItem.value = null
    } catch (e) {
      flashStatus(`Move failed: ${e?.message ?? e}`, 2500)
    }
  }

  async function doUndo() {
    try { await history.undo(); refreshAllDirs() }
    catch (e) { flashStatus(`Undo failed: ${e?.message ?? e}`, 2500) }
  }

  async function doRedo() {
    try { await history.redo(); refreshAllDirs() }
    catch (e) { flashStatus(`Redo failed: ${e?.message ?? e}`, 2500) }
  }

  // ── Clipboard ──────────────────────────────────────────────────────────────
  function copyToClipboard(items) {
    clipboard.value = { mode: 'Copy', count: items.length, items: [...items] }
    log('clipboard', `Copy  ${items.length} item${items.length === 1 ? '' : 's'}`, {
      _type: 'item-table',
      items: items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
    })
  }
  function cutToClipboard(items) {
    clipboard.value = { mode: 'Cut', count: items.length, items: [...items] }
    log('clipboard', `Cut  ${items.length} item${items.length === 1 ? '' : 's'}`, {
      _type: 'item-table',
      items: items.map(i => ({ name: i.name, kind: i.kind, size: i.size, path: i.path, thumbnail: i.thumbnail ?? null })),
    })
  }

  return {
    // clipboard
    clipboard, copyToClipboard, cutToClipboard,
    // create / mutate
    createNewFolder, createNewFile, handleRename, handleRenameBatch,
    doTrash, doDelete, doCompress, doDecompress, doPaste, doMove, doUndo, doRedo,
    // elevation dialog (bound by the modal in Workbench)
    elevationPasswordRef, elevationPrompt, elevationPassword, elevationError,
    cancelElevation, confirmElevation,
    // install prompt
    installPrompt,
  }
}
