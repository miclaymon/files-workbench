<template>
  <Teleport to="body">
    <Transition name="me">
      <div v-if="visible" class="me-backdrop" @mousedown.self="$emit('close')">
        <div
          class="me-dialog"
          :class="{ 'me-dialog--max': maximized }"
          :style="maximized ? null : { width, height }"
          role="dialog"
          :aria-label="title"
        >

          <!-- Titlebar: icon + title (left), context + permanent actions (right) -->
          <div class="me-titlebar">
            <div class="me-title">
              <svg v-if="icon" class="me-title-icon" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path :d="icon" />
              </svg>
              <span class="me-title-text">{{ title }}</span>
            </div>

            <div class="me-actions">
              <!-- Context-specific actions contributed by the modal -->
              <button
                v-for="a in actions"
                :key="a.key"
                class="me-action"
                :disabled="a.disabled"
                :title="a.title"
                @click="a.run?.()"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="a.icon" /></svg>
              </button>

              <span v-if="actions.length" class="me-sep" />

              <!-- Permanent modal-editor actions -->
              <button
                class="me-action"
                title="Open in Main Window — open this as an editor tab"
                @click="$emit('open-in-window')"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiOpenInNew" /></svg>
              </button>
              <button
                class="me-action"
                :title="maximized ? 'Restore' : 'Maximize'"
                @click="maximized = !maximized"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="maximized ? mdiArrowCollapse : mdiArrowExpand" /></svg>
              </button>
              <button class="me-action" title="Close (Esc)" @click="$emit('close')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
              </button>
            </div>
          </div>

          <div class="me-body">
            <slot />
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from 'vue'
import { mdiClose, mdiArrowExpand, mdiArrowCollapse, mdiOpenInNew } from '@mdi/js'

// Reusable chrome for modal "editors" — a titlebar (icon + title on the left,
// context actions then the permanent Open-in-Window / Maximize / Close trio on
// the right) wrapping arbitrary body content. The eventual modal activity-surface
// type (2a) will register its content here; for now modals adopt it directly.
//
// `actions` are context-specific buttons (each { key, icon, title, disabled?, run })
// rendered left of the permanent trio. Open-in-Window emits `open-in-window` for
// the host to promote this modal to an editor tab.
const props = defineProps({
  visible: { type: Boolean, required: true },
  title:   { type: String,  default: '' },
  icon:    { type: String,  default: '' },
  actions: { type: Array,   default: () => [] },
  width:   { type: String,  default: 'min(860px, 90vw)' },
  height:  { type: String,  default: 'min(640px, 88vh)' },
})
const emit = defineEmits(['close', 'open-in-window'])

const maximized = ref(false)

// Reset size state each time the modal opens; close on Escape (capture phase so a
// focused input that stops propagation in the bubble phase can't swallow it).
watch(() => props.visible, (v) => {
  if (v) {
    maximized.value = false
    window.addEventListener('keydown', onKey, true)
  } else {
    window.removeEventListener('keydown', onKey, true)
  }
})
onBeforeUnmount(() => window.removeEventListener('keydown', onKey, true))

function onKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
}
</script>

<style scoped>
.me-backdrop {
  position: fixed;
  inset: 0;
  z-index: 8000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

.me-dialog {
  background: var(--sidebar-bg, #252526);
  border: 1px solid var(--border, #454545);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  &.me-dialog--max {
    width: calc(100vw - 16px);
    height: calc(100vh - 16px);
  }
}

/* ── Titlebar ──────────────────────────────────────────────────────────────── */
.me-titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid var(--border, #454545);
  flex-shrink: 0;
}

.me-title {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.me-title-icon { color: var(--text-muted, #8c8c8c); flex-shrink: 0; }

.me-title-text {
  font-size: 13px;
  color: var(--text, #ccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.me-actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.me-action {
  background: none;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;

  &:hover:not(:disabled) { color: var(--text, #ccc); background: var(--hover, rgba(255, 255, 255, 0.07)); }
  &:disabled { opacity: 0.4; cursor: default; }
}

.me-sep {
  width: 1px;
  height: 16px;
  background: var(--border, #454545);
  margin: 0 4px;
}

/* ── Body ──────────────────────────────────────────────────────────────────── */
.me-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* ── Transition ────────────────────────────────────────────────────────────── */
.me-enter-active, .me-leave-active { transition: opacity 0.12s, transform 0.12s; }
.me-enter-from, .me-leave-to { opacity: 0; transform: scale(0.97); }
</style>
