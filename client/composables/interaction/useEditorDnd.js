import { reactive } from 'vue'

export const TAB_MIME = 'application/x-editor-tab'

// Shared drag state for editor tabs — one drag at a time per window, so a single
// module-scoped reactive object is the source of truth all editor groups read.
const dragState = reactive({
  active: false,
  sourceGroupId: null,
  tabId: null,
  pinned: false,   // whether the dragged tab is pinned (constrains where it can drop)
})

export function useEditorDnd() {
  function startTabDrag(event, { groupId, tabId, pinned = false }) {
    dragState.active = true
    dragState.sourceGroupId = groupId
    dragState.tabId = tabId
    dragState.pinned = pinned
    try {
      event.dataTransfer.setData(TAB_MIME, JSON.stringify({ groupId, tabId }))
      event.dataTransfer.effectAllowed = 'move'
    } catch { /* dataTransfer unavailable in some synthetic events */ }
  }

  function endTabDrag() {
    dragState.active = false
    dragState.sourceGroupId = null
    dragState.tabId = null
    dragState.pinned = false
  }

  return { dragState, startTabDrag, endTabDrag }
}

// Which zone of `rect` the pointer sits in. `edge` is the fraction of the box (per
// side) that counts as an edge band; anything deeper is the center.
// Returns 'left' | 'right' | 'top' | 'bottom' | 'center'.
export function dropRegion(rect, x, y, edge = 0.22) {
  if (!rect.width || !rect.height) return 'center'
  const left = (x - rect.left) / rect.width
  const right = 1 - left
  const top = (y - rect.top) / rect.height
  const bottom = 1 - top
  const min = Math.min(left, right, top, bottom)
  if (min > edge) return 'center'
  if (min === left) return 'left'
  if (min === right) return 'right'
  if (min === top) return 'top'
  return 'bottom'
}

// Map an edge region to the side a new split should appear on. 'center' → null.
export function regionToSide(region) {
  return region === 'center' ? null : region
}
