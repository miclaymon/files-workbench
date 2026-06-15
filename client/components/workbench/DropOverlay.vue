<template>
  <div class="drop-overlay" :class="`drop-overlay--${region}`" />
</template>

<script setup>
defineProps({
  region: { type: String, default: 'center' },  // left|right|top|bottom|center
})
</script>

<style scoped>
.drop-overlay {
  position: absolute;
  z-index: 50;
  pointer-events: none;
  background: color-mix(in srgb, var(--accent) 28%, transparent);
  border: 1px solid var(--accent);
  transition: inset 0.08s, width 0.08s, height 0.08s;
}
.drop-overlay--center { inset: 0; }
.drop-overlay--left   { left: 0;  top: 0; bottom: 0; width: 50%; }
.drop-overlay--right  { right: 0; top: 0; bottom: 0; width: 50%; }
.drop-overlay--top    { left: 0; right: 0; top: 0;    height: 50%; }
.drop-overlay--bottom { left: 0; right: 0; bottom: 0; height: 50%; }
</style>
