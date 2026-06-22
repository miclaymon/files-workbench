<template>
  <div class="statusbar">
    <div class="status-left">
      <component :is="v.component" v-for="v in leftViews" :key="v.id" />
    </div>
    <span class="spacer" />
    <component :is="v.component" v-for="v in rightViews" :key="v.id" />
  </div>
</template>

<script setup>
// Activity-driven status bar. Instead of hardcoding widgets, it renders the
// status views contributed by activities (see useViewRegistry / activities/*),
// ordered into a left and a right region. Each widget injects the activity host
// (`viewCtx`) for its data and self-gates, so the bar has no props of its own.
import { getStatusViews } from '~/composables/useViewRegistry.js'

const leftViews  = getStatusViews('left')
const rightViews = getStatusViews('right')
</script>

<style scoped>
.statusbar {
  background: var(--accent);
  color: white;
  display: flex;
  align-items: center;
  padding: 0 10px;
  font-size: 12px;
  gap: 8px;
}
.spacer { flex: 1; }
.status-left { display: flex; align-items: center; gap: 2px; min-width: 0; overflow: hidden; }
</style>
