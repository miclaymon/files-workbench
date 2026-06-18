import { ref } from 'vue'
import { mdiFile, mdiFolder, mdiLinkVariant } from '@mdi/js'

/**
 * Custom drag for explorer tree items.
 *
 * Module-level refs are shared across all TreeItem instances so every item
 * can react to the current drag/drop-over state without prop drilling.
 *
 * Valid drop targets: nodes with type === 'directory' (not root, drive, or file).
 * The dragging node itself is not a valid target.
 */
const draggingNode = ref(null)
const dragOverNode = ref(null)
const isDragging = ref(false)
const wasDragging = ref(false)

function iconPath(type) {
  if (type === 'directory') return mdiFolder
  if (type === 'symlink' || type === 'shortcut') return mdiLinkVariant
  return mdiFile
}

function createGhost(node) {
  const el = document.createElement('div')
  Object.assign(el.style, {
    position: 'fixed',
    left: '-9999px',
    top: '-9999px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'var(--surface, #252526)',
    border: '1px solid var(--border, #404040)',
    borderRadius: '4px',
    padding: '5px 10px',
    fontSize: '13px',
    color: 'var(--text, #cccccc)',
    pointerEvents: 'none',
    zIndex: '9999',
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    maxWidth: '240px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    opacity: '0.92',
  })

  const NS = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(NS, 'svg')
  svg.setAttribute('width', '14')
  svg.setAttribute('height', '14')
  svg.setAttribute('viewBox', '0 0 24 24')
  svg.setAttribute('fill', '#9e9e9e')
  svg.style.flexShrink = '0'
  const path = document.createElementNS(NS, 'path')
  path.setAttribute('d', iconPath(node.type))
  svg.appendChild(path)
  el.appendChild(svg)

  const span = document.createElement('span')
  span.style.overflow = 'hidden'
  span.style.textOverflow = 'ellipsis'
  span.textContent = node.name
  el.appendChild(span)

  return el
}

// Module-level drop callback so all TreeItem instances can share it.
// Registered once by ExplorerTree; fires when a drag is released over a valid target.
let _onDropCallback = null

export function useTreeDrag({ delay = 200, onDrop } = {}) {
  if (onDrop) _onDropCallback = onDrop

  function isValidDropTarget(node) {
    return node.type === 'directory'
  }

  function onMouseDown(e, node) {
    if (e.button !== 0) return
    // Don't intercept expand toggle, inputs, links
    if (e.target.closest('.expand-icon, .expand-spacer, input, a, label')) return

    let ghost = null
    let rafId = null
    let activated = false

    const dragTimer = setTimeout(() => {
      activated = true
      draggingNode.value = node
      isDragging.value = true
    }, delay)

    function onMouseMove(moveE) {
      if (!activated) return
      if (!ghost) {
        ghost = createGhost(node)
        document.body.appendChild(ghost)
      }
      if (rafId) cancelAnimationFrame(rafId)
      const x = moveE.clientX
      const y = moveE.clientY
      rafId = requestAnimationFrame(() => {
        if (ghost) {
          ghost.style.left = (x + 14) + 'px'
          ghost.style.top = (y + 10) + 'px'
        }
      })
    }

    function cleanup() {
      clearTimeout(dragTimer)
      if (rafId) cancelAnimationFrame(rafId)
      if (ghost) { ghost.remove(); ghost = null }
      const hadDrag = isDragging.value
      const dropTarget = dragOverNode.value
      const dragSource = draggingNode.value
      draggingNode.value = null
      dragOverNode.value = null
      isDragging.value = false
      activated = false
      window.removeEventListener('mousemove', onMouseMove)
      if (hadDrag) {
        wasDragging.value = true
        setTimeout(() => { wasDragging.value = false }, 0)
        // Fire the drop callback if released over a valid target
        if (dropTarget && dragSource && dropTarget.path !== dragSource.path && _onDropCallback) {
          _onDropCallback({ dragged: dragSource, target: dropTarget })
        }
      }
    }

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', cleanup, { once: true })
  }

  function onNodeMouseEnter(node) {
    if (!isDragging.value) return
    if (!isValidDropTarget(node)) return
    if (node.path === draggingNode.value?.path) return
    dragOverNode.value = node
  }

  function onNodeMouseLeave(node) {
    if (dragOverNode.value?.path === node.path) {
      dragOverNode.value = null
    }
  }

  return {
    draggingNode,
    dragOverNode,
    isDragging,
    wasDragging,
    isValidDropTarget,
    onMouseDown,
    onNodeMouseEnter,
    onNodeMouseLeave,
  }
}
