<template>
  <div v-if="showWindowControls" class="window-controls" :class="platformClass">
    <button class="winbtn" title="Minimize" @click="windowMinimize">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiWindowMinimize" /></svg>
    </button>
    <button class="winbtn" :title="isMaximized ? 'Restore' : 'Maximize'" @click="windowToggleMaximize">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="isMaximized ? mdiWindowRestore : mdiWindowMaximize" /></svg>
    </button>
    <button class="winbtn close" title="Close" @click="windowClose">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiWindowClose" /></svg>
    </button>
  </div>
</template>

<script setup>
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { mdiWindowMinimize, mdiWindowMaximize, mdiWindowRestore, mdiWindowClose } from '@mdi/js'

const platform = computed(() => window.electron?.platform ?? null)
// Normalize Electron's platform string to a CSS-friendly class name.
const platformClass = computed(() => {
  if (!platform.value || platform.value === 'darwin') return null
  return platform.value === 'win32' ? 'windows' : platform.value  // 'windows' | 'linux'
})
const showWindowControls = computed(() => !!window.electron && platform.value !== 'darwin')

const isMaximized = ref(false)
let offMaximize

onMounted(async () => {
  if (!showWindowControls.value) return
  isMaximized.value = await window.electron.window.isMaximized()
  offMaximize = window.electron.window.onMaximizeChange(v => { isMaximized.value = v })
})
onBeforeUnmount(() => offMaximize?.())

function windowMinimize()             { window.electron?.window?.minimize?.() }
async function windowToggleMaximize() { isMaximized.value = await window.electron?.window?.toggleMaximize?.() }
function windowClose()                { window.electron?.window?.close?.() }
</script>

<style scoped>
.window-controls {
  -webkit-app-region: no-drag;
  display: flex;
  flex-flow: row nowrap;
  gap: 0;
  align-items: center;
  height: 100%;
}

.winbtn {
  width: 46px;
  height: 100%;
  display: grid;
  place-items: center;
  color: var(--text-muted);
  &:hover {
    background: rgba(255,255,255,0.06);
    color: var(--text);
  }
  /* &.close:hover {
    background: #c42b1c;
    color: white;
  } */
}

/* Size winbtns to fill the titlebar height via the named container on .titlebar. */
@container titlebar (min-width: 0px) {
  .winbtn {
    aspect-ratio: 1 / 1;
    height: calc(100cqh - (4px * 2));
    width: auto;
  }
}

.window-controls.linux {
  gap: 4px;
  margin-inline-end: 4px;
  .winbtn { border-radius: 100%; }
}
</style>
