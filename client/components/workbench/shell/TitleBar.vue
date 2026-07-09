<template>
  <div class="titlebar" :class="titlebarClass">
    <div class="titlebar-left">
      <strong class="brand">Files</strong>
      <MenuBar :menus="menus" />
    </div>

    <div class="titlebar-center">
      <AppHistory @back="$emit('history-back')" @forward="$emit('history-forward')" />
      <CommandCenter @open="$emit('open-command-palette')" />
    </div>

    <div class="titlebar-right">
      <TitleBarLayoutControls
        @toggle-primary-sidebar="$emit('toggle-primary-sidebar')"
        @toggle-panel="$emit('toggle-panel')"
        @toggle-secondary-sidebar="$emit('toggle-secondary-sidebar')"
      />
      <TitleBarWindowControls />
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MenuBar from './MenuBar.vue'
import AppHistory from './AppHistory.vue'
import CommandCenter from './CommandCenter.vue'
import TitleBarLayoutControls from './TitleBarLayoutControls.vue'
import TitleBarWindowControls from './TitleBarWindowControls.vue'

// The application title bar: brand + MenuBar on the left, AppHistory +
// CommandCenter centered, window controls (Electron, non-macOS) on the right.
// The whole bar is the Electron window-drag region; interactive children opt
// out via `-webkit-app-region: no-drag` in their own styles.
defineProps({
  menus: { type: Array, default: () => [] },  // forwarded to MenuBar: [{ key, label, items }]
})
defineEmits([
  'open-command-palette',
  'history-back',
  'history-forward',
  'toggle-primary-sidebar',
  'toggle-panel',
  'toggle-secondary-sidebar'
])

// Single computed that maps Electron's platform string to a CSS class.
// 'darwin' → 'is-mac' (native traffic lights; left-pad the title bar)
// 'win32'  → 'windows'
// 'linux'  → 'linux'
// null     → null (browser, no class)
const titlebarClass = computed(() => {
  const p = window.electron?.platform
  if (!p) return null
  if (p === 'darwin') return 'is-mac'
  return p === 'win32' ? 'windows' : p
})
</script>

<style scoped>
.titlebar {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 600px) 1fr;
  grid-template-areas: "left center right";
  grid-template-rows: minmax(auto, var(--titlebar-height));
  align-items: center;
  height: var(--titlebar-height);
  max-height: var(--titlebar-height);
  max-block-size: var(--titlebar-height);
  padding: 0 10px;
  background: #2a2a2a;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
  position: relative;
  container: titlebar / size;
}
/* Leave room for the native macOS traffic-light buttons (top-left). */
.titlebar.is-mac .titlebar-left { padding-left: 70px; }

.titlebar .titlebar-left,
.titlebar .titlebar-center,
.titlebar .titlebar-right {
  display: flex;
  flex-flow: row nowrap;
  align-items: center;
  min-width: 0;
  gap: 8px;
  position: relative;
  flex: 1 0 25%;
}
.titlebar .titlebar-left {
  gap: 8px;
  min-width: 0;
  container: titlebar-left / inline-size;
}
.titlebar .titlebar-center {
  justify-self: stretch;
  justify-content: center;
  gap: 8px;
  container: titlebar-center / inline-size;
}
/* justify-self:stretch (default) keeps the full 1fr track width; flex
   justify-content pushes children to the right. Negative margin keeps
   window controls flush with the corner past the bar's padding. */
.titlebar .titlebar-right {
  justify-content: flex-end;
  margin-right: -10px;
  gap: 4px;
}

.brand { font-size: 13px; }
</style>
