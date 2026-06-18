/**
 * Debounces click/double-click so single-click logic doesn't fire on double-clicks.
 *
 * Usage: call handleClick(itemPath, singleFn, doubleFn) from @click.
 * Remove @dblclick from the element — this composable detects doubles itself.
 * Modifier-key clicks (ctrl/meta/shift) bypass the delay and fire immediately.
 */
export function useClickDebounce({ delay = 220 } = {}) {
  let timer = null
  let pendingPath = null
  let pendingFn = null

  function handleClick(itemPath, singleFn, doubleFn, { e } = {}) {
    // Modifier clicks are unambiguous — fire immediately, cancel any pending
    if (e && (e.ctrlKey || e.metaKey || e.shiftKey)) {
      if (timer) { clearTimeout(timer); pendingFn?.(); timer = null; pendingPath = null; pendingFn = null }
      singleFn()
      return
    }

    if (timer && pendingPath === itemPath) {
      // Second click on same item within delay → double-click
      clearTimeout(timer)
      timer = null; pendingPath = null; pendingFn = null
      doubleFn()
    } else {
      // Fire any pending single-click for a different item immediately
      if (timer) { clearTimeout(timer); pendingFn?.(); timer = null }
      pendingPath = itemPath
      pendingFn = singleFn
      timer = setTimeout(() => {
        timer = null; pendingPath = null
        pendingFn?.(); pendingFn = null
      }, delay)
    }
  }

  function cancel() {
    if (timer) { clearTimeout(timer); timer = null; pendingPath = null; pendingFn = null }
  }

  return { handleClick, cancel }
}
