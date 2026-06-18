<template>
  <div class="titlebar">
    <div class="left">
      <strong class="brand">Files</strong>
      <MenuBar :menus="menus" />
    </div>

    <div class="center">
      <AppHistory @back="$emit('history-back')" @forward="$emit('history-forward')" />
      <CommandCenter @open="$emit('open-command-palette')" />
    </div>

    <div class="right">
      <template v-if="isElectron">
        <!-- TODO: use better icons (svg) that work well for Linux/Windows -->
        <button class="no-drag winbtn" title="Minimize" @click="windowMinimize">—</button>
        <button class="no-drag winbtn" title="Maximize" @click="windowToggleMaximize">□</button>
        <button class="no-drag winbtn close" title="Close" @click="windowClose">×</button>
      </template>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import MenuBar from './MenuBar.vue'
import AppHistory from './AppHistory.vue'
import CommandCenter from './CommandCenter.vue'

// The application title bar: brand + MenuBar on the left, AppHistory +
// CommandCenter centered, window controls (Electron only) on the right. The
// whole bar is the Electron window-drag region; interactive children opt out
// via `.no-drag`.
defineProps({
  menus: { type: Array, default: () => [] },  // forwarded to MenuBar: [{ key, label, items }]
})
defineEmits(['open-command-palette', 'history-back', 'history-forward'])

const isElectron = computed(() => !!window.electron)

function windowMinimize() { window.electron?.window?.minimize?.() }
function windowToggleMaximize() { window.electron?.window?.toggleMaximize?.() }
function windowClose() { window.electron?.window?.close?.() }
</script>

<style scoped>
.titlebar {
  display: grid;
  grid-template-columns: 1fr minmax(280px, 600px) 1fr;
  align-items: center;
  padding: 0 10px;
  background: #2a2a2a;
  border-bottom: 1px solid var(--border);
  -webkit-app-region: drag;
}
.titlebar .left   { display: flex; gap: 8px; align-items: center; min-width: 0; }
.titlebar .center { justify-self: stretch; display: flex; justify-content: center; align-items: center; gap: 8px; }
.titlebar .right  { justify-self: end; display: flex; }

.brand { font-size: 13px; }

.no-drag { -webkit-app-region: no-drag; }

.winbtn {
  width: 46px;
  height: var(--titlebar-height);
  display: grid;
  place-items: center;
  font-size: 16px;
  color: var(--text-muted);
}
.winbtn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.winbtn.close:hover { background: #c42b1c; color: white; }
</style>
