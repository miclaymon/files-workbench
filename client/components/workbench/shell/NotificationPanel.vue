<template>
  <teleport to="body">
    <transition name="ntf-pop">
      <div v-if="visible" ref="panelRef" class="ntf-panel" role="dialog" aria-label="Notifications">
        <header class="ntf-panel-head">
          <h3 class="ntf-panel-title">Notifications</h3>
          <div class="ntf-panel-tools">
            <button class="ntf-tool" :disabled="!notifications.length" @click="$emit('clear')">Clear</button>
            <button class="ntf-tool ntf-tool--icon" title="Dismiss (Esc)" @click="$emit('close')">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M19 6.4 17.6 5 12 10.6 6.4 5 5 6.4 10.6 12 5 17.6 6.4 19 12 13.4 17.6 19 19 17.6 13.4 12z" /></svg>
            </button>
          </div>
        </header>

        <div class="ntf-panel-body">
          <div v-if="!notifications.length" class="ntf-panel-empty">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="currentColor"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
            <span>You're all caught up</span>
          </div>
          <NotificationItem
            v-for="n in notifications"
            :key="n.id"
            :notification="n"
            @dismiss="$emit('dismiss', n.id)"
          />
        </div>
      </div>
    </transition>
  </teleport>
</template>

<script setup>
import NotificationItem from './NotificationItem.vue'
import { ref, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible:       { type: Boolean, default: false },
  notifications: { type: Array,   default: () => [] },
})
const emit = defineEmits(['close', 'clear', 'dismiss'])

const panelRef = ref(null)

// Close on outside click — but ignore the status-bar bell, which owns the toggle.
function onDocMouseDown(e) {
  if (!props.visible) return
  if (panelRef.value?.contains(e.target)) return
  if (e.target.closest?.('.sb-notif-btn')) return
  emit('close')
}
function onKey(e) { if (e.key === 'Escape' && props.visible) emit('close') }

onMounted(() => {
  document.addEventListener('mousedown', onDocMouseDown)
  document.addEventListener('keydown', onKey)
})
onUnmounted(() => {
  document.removeEventListener('mousedown', onDocMouseDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<style scoped>
.ntf-panel {
  position: fixed;
  right: 8px;
  bottom: calc(var(--statusbar-height, 22px) + 8px);
  z-index: 99998;
  width: 360px;
  max-width: calc(100vw - 16px);
  max-height: min(480px, 60vh);
  display: flex;
  flex-direction: column;
  background: var(--dropdown-background, #252526);
  border: 1px solid var(--border);
  border-radius: 8px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.45);
  overflow: hidden;
}

.ntf-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 8px 8px 12px;
  border-bottom: 1px solid var(--border);
  flex-shrink: 0;
}
.ntf-panel-title { margin: 0; font-size: 13px; font-weight: 600; color: var(--text); }
.ntf-panel-tools { display: flex; align-items: center; gap: 4px; }

.ntf-tool {
  font: inherit;
  font-size: 12px;
  padding: 3px 8px;
  border: none;
  background: transparent;
  border-radius: 4px;
  color: var(--text-muted);
  cursor: pointer;

  &:hover:not(:disabled) { background: var(--hover-background, rgba(255,255,255,0.08)); color: var(--text); }
  &:disabled { opacity: 0.4; cursor: default; }
  &--icon { display: flex; padding: 4px; }
}

.ntf-panel-body { overflow-y: auto; flex: 1; }

.ntf-panel-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 36px 16px;
  color: var(--text-muted);
  font-size: 12px;

  svg { opacity: 0.4; }
}

.ntf-pop-enter-active, .ntf-pop-leave-active { transition: opacity 0.14s, transform 0.14s; }
.ntf-pop-enter-from, .ntf-pop-leave-to { opacity: 0; transform: translateY(8px); }
</style>
