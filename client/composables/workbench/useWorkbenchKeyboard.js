import { onMounted, onUnmounted } from 'vue'
import { collectLeaves } from '~/composables/useLayoutGrid.js'

// ── Global keyboard shortcuts ─────────────────────────────────────────────────
// Window-level keydown handling for the workbench: command palette, settings,
// undo/redo, clipboard, editor split/close/focus, and trash/delete. Self-manages
// its listener lifecycle and pulls its actions from the relevant slices.
export function useWorkbenchKeyboard({ editor, fileOps, selection, openCommandPalette, openSettingsModal }) {
  const { editorController, activeTab, activeGroupId, editorRoot } = editor
  const { doUndo, doRedo, copyToClipboard, cutToClipboard, doPaste, doDelete, doTrash } = fileOps
  const { selectedItems } = selection

  function focusGroupByIndex(i) {
    const leaf = collectLeaves(editorRoot.value)[i]
    if (leaf) editorController.setActiveGroup(leaf.id)
  }

  function onKeyDown(e) {
    // Shortcuts that fire even from inputs
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'P') {
      e.preventDefault(); openCommandPalette(); return
    }
    if ((e.ctrlKey || e.metaKey) && e.key === ',') {
      e.preventDefault(); openSettingsModal(); return
    }

    // Skip other shortcuts when typing in an input, textarea, or contenteditable
    const tag = e.target?.tagName
    if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return

    if (e.ctrlKey || e.metaKey) {
      if (e.key === 'z') { e.preventDefault(); doUndo(); return }
      if (e.key === 'y') { e.preventDefault(); doRedo(); return }
      if (e.key === 'c') { e.preventDefault(); copyToClipboard(selectedItems.value); return }
      if (e.key === 'x') { e.preventDefault(); cutToClipboard(selectedItems.value); return }
      if (e.key === 'v') { e.preventDefault(); doPaste(); return }
      if (e.key === '\\') { e.preventDefault(); editorController.splitActiveGroup('right'); return }
      if ((e.key === 'w' || e.key === 'W') && activeTab.value) { e.preventDefault(); editorController.closeTab(activeGroupId.value, activeTab.value.id); return }
      if (e.key >= '1' && e.key <= '9') { e.preventDefault(); focusGroupByIndex(Number(e.key) - 1); return }
    }
    if (e.key === 'Delete') {
      e.preventDefault()
      if (e.shiftKey) doDelete(selectedItems.value)
      else doTrash(selectedItems.value)
    }
  }

  onMounted(() => window.addEventListener('keydown', onKeyDown))
  onUnmounted(() => window.removeEventListener('keydown', onKeyDown))
}
