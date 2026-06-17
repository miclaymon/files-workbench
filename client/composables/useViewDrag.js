import { ref } from 'vue'

// ── Shared view/section drag state ──────────────────────────────────────────
// Module-level singleton so every container, SplitViewArea and SplitSectionArea
// observes the same in-flight drag (needed so a drop overlay in one container
// can react to a drag that started in another).
export const DRAG_MIME         = 'application/wb-view-tab'
export const SECTION_DRAG_MIME = 'application/wb-split-section'

const _activeDrag        = ref(null)  // { viewId, fromContainerId } | null — View/tab drag
const _activeSectionDrag = ref(null)  // { sectionId, fromViewId, fromContainerId } | null — SplitSection drag

if (typeof document !== 'undefined') {
  document.addEventListener('dragend', () => {
    _activeDrag.value = null
    _activeSectionDrag.value = null
  }, { capture: true })
}

export function useViewDrag() {
  return {
    activeDrag: _activeDrag,
    activeSectionDrag: _activeSectionDrag,
    DRAG_MIME,
    SECTION_DRAG_MIME,
  }
}
