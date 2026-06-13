import { ref } from 'vue'

/**
 * Right-click drag — tracks right mouse button for both context menus and drag-to-drop.
 *
 * The native `contextmenu` event fires on mousedown on Linux/X11, which would show the
 * menu before the user has a chance to start dragging. This composable suppresses the
 * native contextmenu event immediately on right mousedown and calls the appropriate
 * callback on mouseup instead:
 *   - No movement → onRightClick({ item, event })
 *   - Movement beyond threshold → onDrop({ items, dropPath, x, y })
 *
 * Options:
 *   onRightClick({ item, event })  — right-click without drag; `event` is the mouseup event.
 *   onDrop({ items, dropPath, x, y }) — right-drag released; dropPath is the [data-path]
 *                                       under the cursor, or null for the current directory.
 *   onActivate(item)               — called when drag threshold is crossed; should return
 *                                    the full array of items being dragged.
 */
export function useRightClickDrag({ onDrop = null, onRightClick = null, onActivate = null } = {}) {
  const isDragging    = ref(false)
  const draggingPath  = ref(null)
  const draggingItems = ref([])

  function onRightMouseDown(e, item) {
    if (e.button !== 2) return
    if (e.target.closest('input, button, a, label')) return

    const startX   = e.clientX
    const startY   = e.clientY
    let moved       = false
    let ghost       = null
    let activeItems = [item]
    const sourceEl  = e.currentTarget

    // Suppress the native contextmenu for the entire right-button press so it
    // can never fire before mouseup (works on Linux/X11 where contextmenu fires
    // on mousedown). We decide what to show ourselves on mouseup.
    function onContextMenu(ctxE) {
      ctxE.preventDefault()
      ctxE.stopPropagation()
    }
    window.addEventListener('contextmenu', onContextMenu, { capture: true })

    function onMouseMove(moveE) {
      const dx = moveE.clientX - startX
      const dy = moveE.clientY - startY
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return

      if (!moved) {
        moved = true
        activeItems = onActivate ? (onActivate(item) ?? [item]) : [item]
        isDragging.value    = true
        draggingPath.value  = item.path
        draggingItems.value = activeItems

        if (sourceEl) {
          const rect = sourceEl.getBoundingClientRect()
          ghost = sourceEl.cloneNode(true)
          Object.assign(ghost.style, {
            position:       'fixed',
            left:            rect.left + 'px',
            top:             rect.top  + 'px',
            width:           rect.width  + 'px',
            height:          rect.height + 'px',
            margin:          '0',
            pointerEvents:   'none',
            zIndex:          '9999',
            opacity:         '0.72',
            transform:       'scale(1.04)',
            transformOrigin: 'top left',
            boxShadow:       '0 6px 20px rgba(0,0,0,0.5)',
            borderRadius:    getComputedStyle(sourceEl).borderRadius,
            outline:         '2px dashed var(--accent, #007acc)',
            outlineOffset:   '2px',
          })
          document.body.appendChild(ghost)
        }
      }

      if (ghost) {
        const w = sourceEl ? sourceEl.getBoundingClientRect().width  / 2 : 40
        const h = sourceEl ? sourceEl.getBoundingClientRect().height / 2 : 20
        ghost.style.left = (moveE.clientX - w) + 'px'
        ghost.style.top  = (moveE.clientY - h) + 'px'
      }
    }

    function onMouseUp(upE) {
      if (upE.button !== 2) return

      if (moved) {
        // Right-drag drop — find element under cursor
        if (ghost) ghost.style.display = 'none'
        const dropEl  = document.elementFromPoint(upE.clientX, upE.clientY)
        if (ghost) ghost.style.display = ''
        const dropPath = dropEl?.closest('[data-path]')?.dataset?.path ?? null
        onDrop?.({ items: activeItems, dropPath, x: upE.clientX, y: upE.clientY })
      } else {
        // Plain right-click — show context menu now that mouseup has confirmed no drag
        onRightClick?.({ item, event: upE })
      }

      cleanup()
    }

    function cleanup() {
      if (ghost) { ghost.remove(); ghost = null }
      isDragging.value    = false
      draggingPath.value  = null
      draggingItems.value = []
      moved = false
      window.removeEventListener('mousemove',   onMouseMove)
      window.removeEventListener('mouseup',     onMouseUp)
      window.removeEventListener('contextmenu', onContextMenu, { capture: true })
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
  }

  return { isDragging, draggingPath, draggingItems, onRightMouseDown }
}
