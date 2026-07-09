<template>
  <teleport to="body">
    <transition :name="`peek-${placement}`">
      <div
        v-if="active"
        class="peek-popup"
        :class="`peek-popup--${placement}`"
        :style="popupStyle"
      >
        <component :is="active.component" v-bind="active.props" />
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { usePeek } from '~/composables/usePeek.js'
import { calcPopupPosition } from '~/lib/popup-position.js'

// Renders the active peek entry (see usePeek.js) as a positioned popup near its
// trigger rect, teleported to <body>. Mounted once by Workbench. Fixed card size so
// positioning is deterministic; pointer-events:none so it never steals focus — a peek
// is a transient glance driven by the caller (e.g. hold-Space in the directory view).
const CARD_W = 560
const CARD_H = 460

const { active } = usePeek()

const resolved  = ref({ left: -9999, top: -9999 })
const placement = ref('above')

const popupStyle = computed(() => ({ left: `${resolved.value.left}px`, top: `${resolved.value.top}px` }))

watch(active, (v) => {
  if (!v?.triggerRect) { placement.value = 'above'; return }
  const pos = calcPopupPosition(v.triggerRect, CARD_W, CARD_H)
  resolved.value  = { left: pos.left, top: pos.top }
  placement.value = pos.placement
}, { immediate: true })
</script>

<style scoped>
.peek-popup {
  position: fixed;
  z-index: 9100;
  width:  min(560px, 85vw);
  height: min(460px, 82vh);
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 2px 10px rgba(0, 0, 0, 0.4);
  background: var(--editor-background, #1e1e1e);
  pointer-events: none;   /* transient glance — never steals focus/scroll */
  display: flex;
  flex-direction: column;
}
.peek-popup :deep(> *) { flex: 1; min-height: 0; }

/* Grow the peek out of the edge nearest the trigger (see calcPopupPosition). */
.peek-popup--above { transform-origin: center bottom; }
.peek-popup--below { transform-origin: center top;    }
.peek-popup--right { transform-origin: left center;   }
.peek-popup--left  { transform-origin: right center;  }

.peek-above-enter-active, .peek-below-enter-active,
.peek-right-enter-active, .peek-left-enter-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.peek-above-leave-active, .peek-below-leave-active,
.peek-right-leave-active, .peek-left-leave-active { transition: opacity 0.08s ease, transform 0.08s ease; }
.peek-above-enter-from, .peek-above-leave-to,
.peek-below-enter-from, .peek-below-leave-to,
.peek-right-enter-from, .peek-right-leave-to,
.peek-left-enter-from,  .peek-left-leave-to { opacity: 0; transform: scale(0.9); }
</style>
