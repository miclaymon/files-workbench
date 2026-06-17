<template>
  <div
    class="sash"
    :class="[`sash--${direction}`, { active }]"
    @mousedown.prevent="$emit('resize-start', $event)"
  />
</template>

<script setup>
defineProps({
  direction: { type: String, default: 'row' },  // parent branch direction
  active:    { type: Boolean, default: false },
})
defineEmits(['resize-start'])
</script>

<style scoped>
/* 1px line along the branch's main axis; cross-axis stretches to fill. */
.sash {
  flex: 0 0 1px;
  background: var(--border);
  position: relative;
  z-index: 5;
  transition: background 0.12s;
}
.sash--row    { cursor: col-resize; }
.sash--column { cursor: row-resize; }

/* Invisible widened hit area so the thin line is easy to grab. */
.sash::after { content: ''; position: absolute; }
.sash--row::after    { top: 0; bottom: 0; left: -3px; right: -3px; }
.sash--column::after { left: 0; right: 0; top: -3px; bottom: -3px; }

.sash:hover, .sash.active { background: var(--accent); }
</style>
