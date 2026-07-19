<template>
  <div v-if="isBranch(node)" ref="containerRef" class="grid-branch" :class="`grid-branch--${node.direction}`">
    <template v-for="(child, i) in node.children" :key="child.id">
      <Sash
        v-if="i > 0"
        :direction="node.direction"
        :active="activeSash === i"
        @resize-start="onSashDown(i, $event)"
      />
      <div class="grid-cell" :style="cellStyle(i)">
        <GridView v-if="isBranch(child)" :node="child">
          <template #leaf="slotProps"><slot name="leaf" v-bind="slotProps" /></template>
        </GridView>
        <slot v-else name="leaf" :node="child" />
      </div>
    </template>
  </div>
  <slot v-else name="leaf" :node="node" />
</template>

<script setup>
import Sash from '../layout/Sash.vue'
import { ref } from 'vue'
import { isBranch } from '~/composables/useLayoutGrid.js'

defineOptions({ name: 'GridView' })

const props = defineProps({
  node: { type: Object, required: true },  // a branch node
})

const MIN_PX = 80

const containerRef = ref(null)
const activeSash = ref(-1)

function cellStyle(i) {
  return { flex: `${props.node.sizes[i] ?? 1} 1 0`, minWidth: 0, minHeight: 0, overflow: 'hidden', display: 'flex' }
}

// Resize the two children adjacent to the sash at `gap` (between child gap-1 and gap).
function onSashDown(gap, event) {
  const a = gap - 1, b = gap
  const el = containerRef.value
  if (!el) return
  const horizontal = props.node.direction === 'row'
  const totalPx = horizontal ? el.clientWidth : el.clientHeight
  const totalWeight = props.node.sizes.reduce((s, n) => s + n, 0)
  if (!totalPx) return
  const ratio = totalWeight / totalPx          // weight units per pixel
  const minWeight = MIN_PX * ratio
  const startPos = horizontal ? event.clientX : event.clientY
  const startA = props.node.sizes[a]
  const sum = startA + props.node.sizes[b]

  activeSash.value = gap
  document.body.style.cursor = horizontal ? 'col-resize' : 'row-resize'
  document.body.style.userSelect = 'none'

  const onMove = (e) => {
    const pos = horizontal ? e.clientX : e.clientY
    let na = startA + (pos - startPos) * ratio
    na = Math.max(minWeight, Math.min(sum - minWeight, na))
    props.node.sizes[a] = na
    props.node.sizes[b] = sum - na
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    document.body.style.removeProperty('cursor')
    document.body.style.removeProperty('user-select')
    activeSash.value = -1
    window.dispatchEvent(new CustomEvent('editor:sash-resize-end'))
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}
</script>

<style scoped>
.grid-branch { flex: 1; display: flex; min-width: 0; min-height: 0; overflow: hidden; }
.grid-branch--row    { flex-direction: row; }
.grid-branch--column { flex-direction: column; }
.grid-cell { position: relative; }
</style>
