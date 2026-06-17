<template>
  <button
    v-for="a in actions"
    :key="a.id"
    class="view-action-btn"
    :title="a.title"
    @click.stop="ctx && a.run(ctx)"
  >
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path :d="a.icon" /></svg>
  </button>
</template>

<script setup>
import { inject } from 'vue'

// Renders a list of context-action buttons against the shared viewCtx. Used in
// the tab strip (standalone view), a SplitViewHeading (merged view), and a
// SplitSectionHeading. `@click.stop` keeps a click from toggling the accordion.
// Callers pass the resolved action list so a headerless section's actions can be
// merged into the view's own (see promotion in ViewContainer / SplitView).
defineProps({ actions: { type: Array, default: () => [] } })
const ctx = inject('viewCtx', null)
</script>

<style scoped>
.view-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 18px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.7;
}
.view-action-btn:hover { opacity: 1; color: var(--text); }
</style>
