<template>
  <div
    class="split-view-panel"
    :class="{ 'is-resizing': isResizing, 'has-handle': showHandle }"
    :style="panelStyle"
  >
    <div class="panel-content">
      <slot />
    </div>
    <div
      v-if="showHandle && !isLast && resizable"
      class="resize-handle"
      :class="{ horizontal, vertical }"
      @mousedown="handleMouseDown"
    >
      <div class="handle-gutter" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  defaultSize: { type: Number, default: null },
  minSize: { type: Number, default: 10 },
  maxSize: { type: Number, default: 90 },
  resizable: { type: Boolean, default: true },
  showHandle: { type: Boolean, default: true }
})

const splitView = inject('splitView', null)

const panel = ref({ size: props.defaultSize ?? 20, minSize: props.minSize, maxSize: props.maxSize })
const panelIndex = ref(-1)
const isFirst = ref(false)
const isLast = ref(false)

const horizontal = computed(() => splitView?.horizontal?.value ?? false)
const vertical = computed(() => splitView?.vertical?.value ?? false)
const isResizing = computed(() => splitView?.isResizing?.value ?? false)

const panelStyle = computed(() => ({
  flexBasis: `${panel.value.size}%`,
  flexGrow: 1,
  flexShrink: 0,
  overflow: 'hidden',
  position: 'relative'
}))

function handleMouseDown(event) {
  if (!props.resizable || !splitView || panelIndex.value < 0) return
  const containerElement = event.target.closest('.split-view')
  if (!containerElement) return
  splitView.handleResizeStart({
    panelIndex: panelIndex.value,
    startX: event.clientX,
    startY: event.clientY,
    containerRect: containerElement.getBoundingClientRect()
  }, event)
}

function registerWithSplitView() {
  if (splitView?.registerPanel && panelIndex.value === -1) {
    const existingPanels = splitView.panels?.value ?? []
    panelIndex.value = existingPanels.length
    isFirst.value = panelIndex.value === 0
    splitView.registerPanel(panel.value)
    watch(() => splitView.panels?.value?.length, (len) => {
      isLast.value = panelIndex.value === (len ?? 1) - 1
    }, { immediate: true })
  }
}

onMounted(() => registerWithSplitView())
onUnmounted(() => {
  if (splitView?.unregisterPanel && panelIndex.value >= 0) {
    splitView.unregisterPanel(panel.value)
  }
})
</script>

<style scoped>
.split-view-panel { position: relative; overflow: hidden; }
.panel-content { width: 100%; height: 100%; overflow: hidden; }

.resize-handle {
  position: absolute;
  z-index: 10;
  transition: background-color 0.2s ease;
}
.resize-handle.horizontal {
  top: 0; right: 0; bottom: 0; width: 8px; cursor: col-resize;
}
.resize-handle.vertical {
  left: 0; right: 0; bottom: 0; height: 8px; cursor: row-resize;
}

.handle-gutter { width: 100%; height: 100%; background: transparent; transition: background-color 0.2s ease; }
.resize-handle:hover .handle-gutter { background: var(--accent, #007acc); opacity: 0.5; }

.split-view-panel.is-resizing { user-select: none; }
</style>
