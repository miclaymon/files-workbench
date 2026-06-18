<template>
  <div class="app-history">
    <button class="no-drag hist-btn" title="Back" :disabled="!canBack" @click="$emit('back')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiArrowLeft" /></svg>
    </button>
    <button class="no-drag hist-btn" title="Forward" :disabled="!canForward" @click="$emit('forward')">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiArrowRight" /></svg>
    </button>
  </div>
</template>

<script setup>
import { mdiArrowLeft, mdiArrowRight } from '@mdi/js'

// Global app navigation history (back/forward across views and locations) — a
// distinct concept from a DirectoryTab's per-tab navigation history and from
// the file-operation undo/redo stack. Placeholder for now: the backing history
// model is not wired yet, so both buttons stay disabled until `canBack` /
// `canForward` are provided.
defineProps({
  canBack:    { type: Boolean, default: false },
  canForward: { type: Boolean, default: false },
})
defineEmits(['back', 'forward'])
</script>

<style scoped>
.app-history { display: flex; align-items: center; gap: 2px; }
.hist-btn {
  display: grid;
  place-items: center;
  width: 26px;
  height: 26px;
  background: none;
  border: none;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;
}
.hist-btn:hover:not(:disabled) { background: rgba(255,255,255,0.06); color: var(--text); }
.hist-btn:disabled { opacity: 0.3; cursor: default; }
.no-drag { -webkit-app-region: no-drag; }
</style>
