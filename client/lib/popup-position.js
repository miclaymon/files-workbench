// Minimum distance from any viewport edge before clamping kicks in.
const SAFE = 12

// Triggers narrower than this are treated as list/details row thumbnails and get a
// side popup instead of an above/below one.
const SMALL_THUMB_PX = 48

// Position a popup near a trigger rect, clamped to the viewport.
//   - Small triggers (list/details ~18–24px): slide out to the right, centred on the
//     trigger (or left when there isn't room).
//   - Larger triggers (grid/gallery): rise above the trigger, centred horizontally
//     (or drop below when there isn't room).
// Returns { left, top, placement: 'above' | 'below' | 'right' | 'left' }.
export function calcPopupPosition(rect, popW, popH) {
  if (!rect) return { left: -9999, top: -9999, placement: 'above' }

  const vw = window.innerWidth
  const vh = window.innerHeight
  const pw = Math.min(popW, vw * 0.85)
  const ph = Math.min(popH, vh * 0.82)

  if (rect.width < SMALL_THUMB_PX) {
    // List / details / nested layout — popup to the right, vertically centred.
    const GAP = 12
    let left = rect.right + GAP
    let top  = Math.round(rect.top + rect.height / 2 - ph / 2)
    top = Math.max(SAFE, Math.min(top, vh - ph - SAFE))
    if (left + pw > vw - SAFE) {
      // No room on the right — flip to the left of the trigger.
      left = Math.max(SAFE, rect.left - pw - GAP)
      return { left: Math.round(left), top, placement: 'left' }
    }
    return { left: Math.round(left), top, placement: 'right' }
  }

  // Grid / gallery / mosaic — popup above, horizontally centred.
  const GAP = 10
  let left = Math.round(rect.left + rect.width / 2 - pw / 2)
  let top  = rect.top - ph - GAP
  left = Math.max(SAFE, Math.min(left, vw - pw - SAFE))
  if (top < SAFE) {
    // No room above — flip below, clamped so the bottom stays in the viewport.
    const belowTop = rect.bottom + GAP
    return { left, top: Math.round(Math.max(SAFE, Math.min(belowTop, vh - ph - SAFE))), placement: 'below' }
  }
  return { left, top: Math.round(top), placement: 'above' }
}
