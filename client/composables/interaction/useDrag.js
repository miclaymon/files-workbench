import { ref } from 'vue'

/**
 * Custom drag with ghost element.
 *
 * Options:
 *   delay       — ms before drag activates (default 200)
 *   onActivate  — called when drag activates; receives the mousedown item;
 *                 should return the full array of items being dragged.
 *                 If not provided, [item] is used.
 *
 * Usage:
 *   const { draggingPath, draggingItems, wasDragging, onMouseDown } = useDrag({
 *     onActivate: (item) => { ... return allSelectedItems }
 *   })
 *   <div @mousedown="(e) => onMouseDown(e, item)" :class="{ dragging: draggingPath === item.path }">
 */
export function useDrag({ delay = 200, onActivate = null } = {}) {
  const draggingPath = ref(null)
  const draggingItems = ref([])
  const wasDragging = ref(false)

  function onMouseDown(e, item) {
    if (e.button !== 0) return
    if (e.target.closest('input, button, a, label')) return

    const sourceEl = e.currentTarget
    let ghost = null
    let ghostOffsetX = 0
    let ghostOffsetY = 0
    let rafId = null
    let activated = false
    let activeItems = [item]

    const dragTimer = setTimeout(() => {
      activated = true
      activeItems = onActivate ? (onActivate(item) ?? [item]) : [item]
    }, delay)

    function onMouseMove(moveE) {
      if (!activated) return

      if (!ghost) {
        const rect = sourceEl.getBoundingClientRect()
        ghostOffsetX = e.clientX - rect.left
        ghostOffsetY = e.clientY - rect.top

        ghost = sourceEl.cloneNode(true)
        Object.assign(ghost.style, {
          position: 'fixed',
          left: rect.left + 'px',
          top: rect.top + 'px',
          width: rect.width + 'px',
          height: rect.height + 'px',
          margin: '0',
          pointerEvents: 'none',
          zIndex: '9999',
          opacity: '0.85',
          transform: 'scale(1.04)',
          transformOrigin: 'top left',
          boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          borderRadius: getComputedStyle(sourceEl).borderRadius,
          transition: 'box-shadow 0.1s',
          overflow: 'visible',
        })

        if (activeItems.length > 1) {
          const badge = document.createElement('div')
          const count = activeItems.length > 99 ? '99+' : String(activeItems.length)
          Object.assign(badge.style, {
            position: 'absolute',
            top: '-7px',
            right: '-7px',
            background: 'var(--accent, #007acc)',
            color: '#fff',
            borderRadius: '50%',
            width: '18px',
            height: '18px',
            fontSize: '11px',
            fontWeight: '700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            lineHeight: '1',
            boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
            pointerEvents: 'none',
          })
          badge.textContent = count
          ghost.appendChild(badge)
        }

        document.body.appendChild(ghost)
        draggingPath.value = item.path
        draggingItems.value = activeItems
      }

      if (rafId) cancelAnimationFrame(rafId)
      const x = moveE.clientX
      const y = moveE.clientY
      rafId = requestAnimationFrame(() => {
        if (ghost) {
          ghost.style.left = (x - ghostOffsetX) + 'px'
          ghost.style.top = (y - ghostOffsetY) + 'px'
        }
      })
    }

    function cleanup() {
      clearTimeout(dragTimer)
      if (rafId) cancelAnimationFrame(rafId)
      if (ghost) { ghost.remove(); ghost = null }
      const hadDrag = draggingPath.value !== null
      draggingPath.value = null
      draggingItems.value = []
      activated = false
      window.removeEventListener('mousemove', onMouseMove)

      if (hadDrag) {
        wasDragging.value = true
        setTimeout(() => { wasDragging.value = false }, 0)
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', cleanup, { once: true })
  }

  return { draggingPath, draggingItems, wasDragging, onMouseDown }
}
