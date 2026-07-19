<template>
  <Teleport to="body">
    <Transition :name="`hp-${placement}`">
      <div
        v-if="item && triggerRect"
        ref="popupEl"
        class="hp-popup"
        :class="`hp-popup--${placement}`"
        :style="popupStyle"
      >
        <video
          v-if="isVideo"
          :src="mediaSrc"
          autoplay
          loop
          muted
          playsinline
          class="hp-media"
          @loadedmetadata="reposition"
        />
        <img
          v-else
          :src="mediaSrc"
          class="hp-media"
          draggable="false"
          @load="reposition"
        />
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { MEDIA_BASE } from '~/lib/api-config.js'
import { calcPopupPosition } from '@workbench/vue'

const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg','m2ts'])

// Popup size caps
const MAX_W = 520
const MAX_H = 420

const props = defineProps({
  item:        { type: Object, default: null },
  // DOMRect-like snapshot of the thumbnail element (not the whole row)
  triggerRect: { type: Object, default: null },
})

const popupEl   = ref(null)
const resolved  = ref({ left: -9999, top: -9999 })
const placement = ref('above')  // 'above' | 'below' | 'right' | 'left'

const isVideo = computed(() =>
  VIDEO_EXTS.has(props.item?.name?.split('.').pop()?.toLowerCase() ?? '')
)

const mediaSrc = computed(() =>
  props.item ? `${MEDIA_BASE}/preview?path=${encodeURIComponent(props.item.path)}` : ''
)

function reposition() {
  const el = popupEl.value
  if (!el || !props.triggerRect) return
  const { width, height } = el.getBoundingClientRect()
  const pos = calcPopupPosition(props.triggerRect, width || MAX_W, height || MAX_H)
  resolved.value  = { left: pos.left, top: pos.top }
  placement.value = pos.placement
}

const popupStyle = computed(() => ({
  left: `${resolved.value.left}px`,
  top:  `${resolved.value.top}px`,
}))

// Estimate position immediately when triggerRect appears, refine after media loads
watch(() => props.triggerRect, async (r) => {
  if (!r) { placement.value = 'above'; return }
  const pos = calcPopupPosition(r, MAX_W, MAX_H)
  resolved.value  = { left: pos.left, top: pos.top }
  placement.value = pos.placement
  await nextTick()
  reposition()
}, { immediate: true })
</script>

<style scoped>
.hp-popup {
  position: fixed;
  z-index: 9100;
  max-width:  min(520px, 85vw);
  max-height: min(420px, 82vh);
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.65), 0 2px 10px rgba(0, 0, 0, 0.4);
  background: #111;
  pointer-events: none;
}

.hp-media {
  display: block;
  width: auto;
  height: auto;
  max-width:  min(520px, 85vw);
  max-height: min(420px, 82vh);
  object-fit: contain;
}

/*
  Transform-origin: each placement class anchors the scale animation at the
  edge nearest the thumbnail so the popup appears to grow out of the thumbnail.
*/
.hp-popup--above { transform-origin: center bottom; }
.hp-popup--below { transform-origin: center top;    }
.hp-popup--right { transform-origin: left center;   }
.hp-popup--left  { transform-origin: right center;  }

/* Per-placement transitions share timing but the initial transform scales from
   the thumbnail-adjacent edge (implicit via transform-origin above). */
.hp-above-enter-active,
.hp-below-enter-active,
.hp-right-enter-active,
.hp-left-enter-active  { transition: opacity 0.15s ease, transform 0.15s ease; }

.hp-above-leave-active,
.hp-below-leave-active,
.hp-right-leave-active,
.hp-left-leave-active  { transition: opacity 0.08s ease, transform 0.08s ease; }

.hp-above-enter-from, .hp-above-leave-to,
.hp-below-enter-from, .hp-below-leave-to,
.hp-right-enter-from, .hp-right-leave-to,
.hp-left-enter-from,  .hp-left-leave-to  { opacity: 0; transform: scale(0.88); }
</style>
