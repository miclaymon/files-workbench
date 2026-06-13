import { ref, computed } from 'vue'
import { useDebugLog } from './useDebugLog.js'

// Module-level stacks so history is global to the app.
const _undoStack = ref([]) // { label, undo: async fn, redo: async fn }
const _redoStack = ref([])

export function useActionHistory() {
  const { log } = useDebugLog()

  const canUndo = computed(() => _undoStack.value.length > 0)
  const canRedo = computed(() => _redoStack.value.length > 0)
  const undoLabel = computed(() => _undoStack.value.at(-1)?.label ?? '')
  const redoLabel = computed(() => _redoStack.value.at(-1)?.label ?? '')

  /**
   * Push a reversible action onto the undo stack.
   * Clears the redo stack (new action breaks redo chain).
   *
   * @param {object} entry
   * @param {string}           entry.label - Human-readable name shown in menus/debug
   * @param {() => Promise<*>} entry.undo  - Async function that reverses the action
   * @param {() => Promise<*>} entry.redo  - Async function that re-applies the action
   */
  function push(entry) {
    _undoStack.value.push(entry)
    _redoStack.value = []
    log('history', 'Pushed', entry.label)
  }

  async function undo() {
    if (!canUndo.value) return
    const entry = _undoStack.value.pop()
    log('history', 'Undo', entry.label)
    try {
      await entry.undo()
      _redoStack.value.push(entry)
    } catch (err) {
      log('history', `Undo failed: ${err?.message ?? err}`, entry.label)
      // Re-push so it stays undoable (user can retry)
      _undoStack.value.push(entry)
      throw err
    }
  }

  async function redo() {
    if (!canRedo.value) return
    const entry = _redoStack.value.pop()
    log('history', 'Redo', entry.label)
    try {
      await entry.redo()
      _undoStack.value.push(entry)
    } catch (err) {
      log('history', `Redo failed: ${err?.message ?? err}`, entry.label)
      _redoStack.value.push(entry)
      throw err
    }
  }

  function clear() {
    _undoStack.value = []
    _redoStack.value = []
  }

  return { canUndo, canRedo, undoLabel, redoLabel, push, undo, redo, clear }
}
