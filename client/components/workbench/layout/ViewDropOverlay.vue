<template>
  <div
    class="vdo-root"
    :class="direction === 'row' ? 'vdo-root--row' : 'vdo-root--col'"
    @dragover.prevent="onOver"
    @dragleave="onLeave"
    @drop.prevent="onDrop"
  >
    <div class="vdo-zone" :class="{ 'vdo-zone--hot': zone === 'before' }" />
    <div class="vdo-zone" :class="{ 'vdo-zone--hot': zone === 'after' }" />
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  direction: { type: String, default: 'col' },  // 'col' = top/bottom, 'row' = left/right
})
const emit = defineEmits(['drop'])

const zone = ref(null)

function pick(e) {
  const rect = e.currentTarget.getBoundingClientRect()
  if (props.direction === 'row') {
    return e.clientX < rect.left + rect.width / 2 ? 'before' : 'after'
  }
  return e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
}

function onOver(e)  { zone.value = pick(e) }
function onLeave(e) { if (!e.currentTarget.contains(e.relatedTarget)) zone.value = null }
function onDrop(e)  { const z = zone.value; zone.value = null; if (z) emit('drop', { zone: z }) }
</script>

<style scoped>
.vdo-root {
  position: absolute;
  inset: 0;
  display: flex;
  z-index: 50;
  pointer-events: all;
}
.vdo-root--col { flex-direction: column; }
.vdo-root--row { flex-direction: row; }
.vdo-zone {
  flex: 1;
  transition: background 0.1s;
}
.vdo-zone--hot {
  background: color-mix(in srgb, var(--accent, #0078d4) 22%, transparent);
  outline: 2px solid var(--accent, #0078d4);
  outline-offset: -2px;
}
</style>
