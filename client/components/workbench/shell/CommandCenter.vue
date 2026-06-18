<template>
  <div class="omnibar no-drag" @click="$emit('open')">{{ placeholder }}</div>
</template>

<script setup>
// The center "command center" / omnibar in the title bar. Clicking it opens the
// command palette. Later this can also surface the active document title.
defineProps({
  placeholder: { type: String, default: 'Search files, commands…' },
})
defineEmits(['open'])
</script>

<style scoped>
.omnibar {
  width: min(600px, 60vw);
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: #1f1f1f;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 10px;
  color: var(--text-muted);
  font-size: 12px;
  cursor: pointer;
}
.omnibar:hover { border-color: var(--accent); }
.no-drag { -webkit-app-region: no-drag; }
</style>
