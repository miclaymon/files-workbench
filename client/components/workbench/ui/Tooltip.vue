<template>
  <div class="tooltip-wrapper" @mouseenter="show" @mouseleave="hide">
    <slot />
    <FloatingMenu
      :visible="visible"
      type="tooltip"
      :content="content"
      :relative-to-cursor="!usePosition"
      :x="usePosition ? position.x : cursorPos.x"
      :y="usePosition ? position.y : cursorPos.y"
      :max-width="maxWidth"
    />
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import FloatingMenu from './FloatingMenu.vue'

const props = defineProps({
  content: { type: String, required: true },
  maxWidth: { type: Number, default: 200 },
  delay: { type: Number, default: 500 },
  x: { type: Number, default: null },
  y: { type: Number, default: null }
})

const visible = ref(false)
const cursorPos = ref({ x: 0, y: 0 })
const position = ref({ x: 0, y: 0 })
const usePosition = ref(false)
let timer = null

watch(() => [props.x, props.y], ([nx, ny]) => {
  if (nx !== null && ny !== null) {
    position.value = { x: nx, y: ny }
    usePosition.value = true
    show()
  } else {
    usePosition.value = false
  }
})

function show(event) {
  clearTimeout(timer)
  if (!usePosition.value && event) cursorPos.value = { x: event.clientX, y: event.clientY }
  timer = setTimeout(() => { visible.value = true }, props.delay)
}

function hide() {
  clearTimeout(timer)
  timer = null
  visible.value = false
}

defineExpose({ show, hide })
</script>

<style scoped>
.tooltip-wrapper { display: inline-block; }
</style>
