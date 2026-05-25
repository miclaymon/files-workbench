import { ref } from 'vue'

export function useDragAndDrop(options = {}) {
  const { onDragStart, onDragEnd, onDrop, dragLeaveSelector } = options

  const draggedItem = ref(null)
  const dragOverItem = ref(null)

  function handleDragStart(event, item) {
    draggedItem.value = item
    onDragStart?.(event, item)
  }

  function handleDragEnd(event) {
    draggedItem.value = null
    dragOverItem.value = null
    onDragEnd?.(event)
  }

  function handleDragOver(event, item) {
    event.preventDefault()
    dragOverItem.value = item
  }

  function handleDragLeave(event) {
    if (dragLeaveSelector) {
      const related = event.relatedTarget
      if (!related || !related.closest?.(dragLeaveSelector)) {
        dragOverItem.value = null
      }
    } else {
      dragOverItem.value = null
    }
  }

  function handleDrop(event, item) {
    event.preventDefault()
    if (draggedItem.value && onDrop) {
      onDrop(event, draggedItem.value, item)
    }
    draggedItem.value = null
    dragOverItem.value = null
  }

  return { draggedItem, dragOverItem, handleDragStart, handleDragEnd, handleDragOver, handleDragLeave, handleDrop }
}
