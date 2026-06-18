<template>
  <template v-for="(group, gi) in renderGroups" :key="gi">
    <span v-if="gi > 0" class="va-sep" aria-hidden="true" />
    <button
      v-for="a in group"
      :key="a.id"
      class="view-action-btn"
      :title="a.title"
      @click.stop="ctx && a.run(ctx)"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor"><path :d="a.icon" /></svg>
    </button>
  </template>
</template>

<script setup>
import { computed, inject } from 'vue'

// Renders context-action buttons against the shared viewCtx, in the tab strip, a
// SplitViewHeading, or a SplitSectionHeading. Pass `actions` for a single flat
// group, or `groups` (array of arrays) to render several hierarchy groups inline
// with a separator between them (e.g. bubbled section actions | view actions).
// Empty groups are dropped so no stray separators appear. `@click.stop` keeps a
// click from toggling the accordion.
const props = defineProps({
  actions: { type: Array, default: () => [] },
  groups:  { type: Array, default: null },
})
const ctx = inject('viewCtx', null)

const renderGroups = computed(() =>
  (props.groups ?? [props.actions]).filter(g => Array.isArray(g) && g.length)
)
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

/* Divider between button hierarchy groups (section | view | panel). */
.va-sep {
  width: 1px;
  align-self: center;
  height: 14px;
  margin: 0 4px;
  background: var(--border);
  flex-shrink: 0;
}
</style>
