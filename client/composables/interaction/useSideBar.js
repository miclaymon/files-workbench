import { ref, computed, onMounted, onUnmounted, unref } from 'vue'

// Shared logic for the resizable workspace panes (primary/secondary side bars
// and the bottom panel). Two concerns:
//
//   1. Orientation — a ResizeObserver measures the pane and derives whether
//      merged views inside it should stack as columns (a tall pane) or rows (a
//      wide pane). This makes the split direction adapt to the pane's actual
//      shape/placement instead of being hard-coded, which is what lets the same
//      component work as a side bar (tall → 'col') or a bottom panel (wide →
//      'row'), and is forward-compatible with repositioning panels. Zero-sized
//      (hidden) measurements are ignored so a hidden pane keeps its last real
//      orientation rather than flipping to the square-tie default.
//
//   2. Resize — a mousedown drag loop that reports each new size through an
//      `onUpdate` callback, leaving persistence to the owner (Workbench binds
//      the value back to the workspace-backed size ref via v-model).
export function useSideBar(paneRef, { initialOrientation = 'col' } = {}) {
  const orientation = ref(initialOrientation)  // 'row' (wide) | 'col' (tall)
  let ro = null

  onMounted(() => {
    const el = unref(paneRef)
    if (!el || typeof ResizeObserver === 'undefined') return
    ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) orientation.value = width >= height ? 'row' : 'col'
    })
    ro.observe(el)
  })
  onUnmounted(() => { ro?.disconnect(); ro = null })

  // The `dropDirection` prop ViewContainer / SplitViewArea expect: 'row' | 'col'.
  const dropDirection = computed(() => orientation.value)

  function startResize(event, { axis = 'x', sign = 1, min = 60, current = 0, onUpdate } = {}) {
    event.preventDefault()
    const startPos = axis === 'x' ? event.clientX : event.clientY
    const startSize = current
    const onMove = (e) => {
      const pos = axis === 'x' ? e.clientX : e.clientY
      onUpdate?.(Math.max(min, startSize + (pos - startPos) * sign))
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
    }
    document.body.style.cursor = axis === 'x' ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }

  return { orientation, dropDirection, startResize }
}
