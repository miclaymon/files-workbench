import { ref } from 'vue'

const HEADER_PX   = 22
const MIN_BODY_PX = 40

// ── Resizable stack engine ──────────────────────────────────────────────────
//
// Shared by SplitViewArea (sashes between SplitViews) and SplitSectionArea
// (sashes between SplitSections). Items are `{ collapsed, size }` objects that
// are mutated *in place* during a drag (matching the existing ViewContainer
// behaviour); the owner persists on `onCommit`.
//
//   direction 'col' → vertical stack; items have headers and may collapse.
//   direction 'row' → horizontal stack; no headers, no collapse.
export function useStackResize() {
  const activeSash = ref(-1)   // index of the item on the lower/right side of the active sash

  function prevExpandedIdx(items, i) {
    for (let j = i - 1; j >= 0; j--) {
      if (!items[j].collapsed) return j
    }
    return -1
  }

  // A sash sits before item i when i is expanded and has an expanded sibling above it.
  function needsSash(items, i) {
    return !items[i].collapsed && prevExpandedIdx(items, i) >= 0
  }

  function wrapStyle(item, direction) {
    if (direction === 'row') return { flex: `${item.size} 1 0`, minWidth: '80px', overflow: 'hidden' }
    if (item.collapsed)      return { flex: '0 0 22px', overflow: 'hidden' }
    return { flex: `${item.size} 1 0`, minHeight: '60px', overflow: 'hidden' }
  }

  function startResize({ containerEl, items, direction, aIdx, bIdx, event, onCommit }) {
    if (!containerEl || aIdx < 0 || bIdx < 0) return
    const isRow = direction === 'row'

    const totalPx         = isRow ? containerEl.clientWidth : containerEl.clientHeight
    const totalHeaderPx   = isRow ? 0 : items.length * HEADER_PX
    const availableBodyPx = totalPx - totalHeaderPx
    if (availableBodyPx <= 0) return

    const expanded    = isRow ? items : items.filter(it => !it.collapsed)
    const totalWeight = expanded.reduce((sum, it) => sum + it.size, 0)
    if (!totalWeight) return

    const pxPerWeight = availableBodyPx / totalWeight
    const minWeight   = MIN_BODY_PX / pxPerWeight
    const startPos    = isRow ? event.clientX : event.clientY
    const startA      = items[aIdx].size
    const sum         = startA + items[bIdx].size

    activeSash.value = bIdx
    document.body.style.cursor     = isRow ? 'col-resize' : 'row-resize'
    document.body.style.userSelect = 'none'

    const onMove = (e) => {
      const delta = ((isRow ? e.clientX : e.clientY) - startPos) / pxPerWeight
      const na = Math.max(minWeight, Math.min(sum - minWeight, startA + delta))
      items[aIdx].size = na
      items[bIdx].size = sum - na
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup',   onUp)
      document.body.style.removeProperty('cursor')
      document.body.style.removeProperty('user-select')
      activeSash.value = -1
      onCommit?.()
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup',   onUp)
  }

  return { activeSash, prevExpandedIdx, needsSash, wrapStyle, startResize }
}
