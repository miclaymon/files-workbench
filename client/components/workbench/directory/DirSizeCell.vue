<template>
  <!-- Self-contained size cell: reads its directory's async size from the shared
       `dirSizes` map so only this cell re-renders when that one entry resolves —
       the item object itself never changes, so the row (icon/thumbnail/selection)
       is untouched. Files use their inline size from the listing. -->
  <span v-if="isDir && entry?.loading" class="dsz-shimmer" />
  <template v-else>{{ display }}</template>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  item:     { type: Object, required: true },
  dirSizes: { type: Object, default: () => ({}) },
})

const isDir = computed(() => props.item.kind === 'dir')
// Reading dirSizes[path] tracks only this key — other cells aren't disturbed.
const entry = computed(() => (isDir.value ? props.dirSizes[props.item.path] : null))

const display = computed(() => {
  if (isDir.value) {
    const sz = entry.value?.size
    return sz != null ? formatBytes(sz) : '—'
  }
  return props.item.size != null ? formatBytes(props.item.size) : '—'
})

function formatBytes(bytes) {
  if (!bytes) return '—'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  let i = 0, b = bytes
  while (b >= 1024 && i < units.length - 1) { b /= 1024; i++ }
  return `${b.toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}
</script>

<style scoped>
.dsz-shimmer {
  display: inline-block;
  width: 38px;
  height: 9px;
  border-radius: 3px;
  background: linear-gradient(90deg, #2e2e2e 25%, #3e3e3e 50%, #2e2e2e 75%);
  background-size: 200% 100%;
  animation: dsz-shimmer 1.4s ease-in-out infinite;
  vertical-align: middle;
  opacity: 0.7;
}

@keyframes dsz-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}
</style>
