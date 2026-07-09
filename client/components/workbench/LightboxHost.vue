<template>
  <teleport to="body">
    <transition name="lightbox-fade">
      <div v-if="active" class="lightbox-overlay" @click.self="close">
        <button class="lightbox-close" title="Close (Esc)" @click="close">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
        </button>
        <div class="lightbox-content">
          <component :is="active.component" v-bind="active.props" />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { watch, onBeforeUnmount } from 'vue'
import { mdiClose } from '@mdi/js'
import { useLightbox } from '~/composables/useLightbox.js'

// Renders the active lightbox entry (see useLightbox.js) as a near-fullscreen
// overlay teleported to <body>. Mounted once by Workbench. Closes on the close
// button, a backdrop click (@click.self — clicks on the content don't bubble to
// close), or Escape (window listener, attached only while open).
const { active, close } = useLightbox()

function onKey(e) { if (e.key === 'Escape') close() }

watch(active, (v) => {
  if (v) window.addEventListener('keydown', onKey)
  else window.removeEventListener('keydown', onKey)
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<style scoped>
.lightbox-overlay {
  position: fixed;
  inset: 0;
  z-index: 12000;   /* above modals/menus */
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.88);
  backdrop-filter: blur(4px);
}

.lightbox-content {
  width: 92vw;
  height: 92vh;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.lightbox-close {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 36px;
  height: 36px;
  display: grid;
  place-items: center;
  border: none;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s;
}
.lightbox-close:hover { background: rgba(255, 255, 255, 0.2); }

.lightbox-fade-enter-active,
.lightbox-fade-leave-active { transition: opacity 0.18s ease; }
.lightbox-fade-enter-from,
.lightbox-fade-leave-to { opacity: 0; }
</style>
