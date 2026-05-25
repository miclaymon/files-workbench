<template>
  <div class="split-view" :style="containerStyle">
    <slot />
  </div>
</template>

<script setup>
import { ref, computed, provide, onUnmounted } from 'vue'

const props = defineProps({
  direction: { type: String, default: 'horizontal', validator: (v) => ['horizontal', 'vertical'].includes(v) },
  defaultSizes: { type: Array, default: () => [] },
  minSizes: { type: Array, default: () => [] },
  maxSizes: { type: Array, default: () => [] }
})

const emit = defineEmits(['resize'])

const horizontal = computed(() => props.direction === 'horizontal')
const vertical = computed(() => props.direction === 'vertical')

const panels = ref([])
const activeHandle = ref(null)
const isResizing = ref(false)

const containerStyle = computed(() => ({
  flexDirection: horizontal.value ? 'row' : 'column'
}))

function registerPanel(panel) {
  panels.value.push(panel)
  const idx = panels.value.length - 1
  if (props.defaultSizes[idx] !== undefined) panel.size = props.defaultSizes[idx]
}

function unregisterPanel(panel) {
  const idx = panels.value.indexOf(panel)
  if (idx > -1) panels.value.splice(idx, 1)
}

function handleResizeStart(handle, event) {
  event.preventDefault()
  activeHandle.value = handle
  isResizing.value = true
  document.addEventListener('mousemove', handleMouseMove)
  document.addEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = horizontal.value ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'
}

function handleMouseMove(event) {
  if (!activeHandle.value || !isResizing.value) return

  const { panelIndex, containerRect } = activeHandle.value
  const panel = panels.value[panelIndex]
  const nextPanel = panels.value[panelIndex + 1]
  if (!panel || !nextPanel) return

  const delta = horizontal.value
    ? event.clientX - activeHandle.value.startX
    : event.clientY - activeHandle.value.startY

  const containerSize = horizontal.value ? containerRect.width : containerRect.height
  const deltaPercent = (delta / containerSize) * 100

  const minSize = props.minSizes[panelIndex] ?? 10
  const maxSize = props.maxSizes[panelIndex] ?? 90
  const nextMinSize = props.minSizes[panelIndex + 1] ?? 10
  const nextMaxSize = props.maxSizes[panelIndex + 1] ?? 90

  panel.size = Math.max(minSize, Math.min(maxSize, panel.size + deltaPercent))
  nextPanel.size = Math.max(nextMinSize, Math.min(nextMaxSize, nextPanel.size - deltaPercent))

  if (horizontal.value) activeHandle.value.startX = event.clientX
  else activeHandle.value.startY = event.clientY

  emit('resize', { panelIndex, sizes: panels.value.map(p => p.size) })
}

function handleMouseUp() {
  isResizing.value = false
  activeHandle.value = null
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
  document.body.style.cursor = ''
  document.body.style.userSelect = ''
}

onUnmounted(() => {
  document.removeEventListener('mousemove', handleMouseMove)
  document.removeEventListener('mouseup', handleMouseUp)
})

provide('splitView', { registerPanel, unregisterPanel, handleResizeStart, horizontal, vertical, isResizing, panels })
</script>

<style scoped>
.split-view {
  width: 100%;
  height: 100%;
  display: flex;
  overflow: hidden;
}
</style>
