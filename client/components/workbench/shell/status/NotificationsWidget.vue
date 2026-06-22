<template>
  <button
    class="sb-notif-btn"
    :class="{ 'sb-notif-btn--active': open }"
    title="Notifications"
    @click="toggle"
  >
    <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor"><path d="M12 22a2 2 0 0 0 2-2h-4a2 2 0 0 0 2 2zm6-6v-5a6 6 0 0 0-5-5.9V4a1 1 0 1 0-2 0v1.1A6 6 0 0 0 6 11v5l-2 2v1h16v-1l-2-2z" /></svg>
    <span v-if="unread" class="sb-notif-dot" />
  </button>
</template>

<script setup>
// Core activity's notification-center toggle + unread dot. Always shown.
import { computed, inject } from 'vue'

const ctx = inject('viewCtx', null)
const open   = computed(() => ctx?.notificationsOpen?.value ?? false)
const unread = computed(() => ctx?.hasUnread?.value ?? false)
function toggle() { ctx?.toggleNotifications?.() }
</script>

<style scoped>
.sb-notif-btn {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 18px;
  margin-left: 2px;
  padding: 0;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: white;
  cursor: pointer;
  flex-shrink: 0;
  opacity: 0.85;

  &:hover, &--active { background: rgba(255, 255, 255, 0.18); opacity: 1; }
}
.sb-notif-dot {
  position: absolute;
  top: 1px;
  right: 2px;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #ffc107;
  border: 1.5px solid var(--accent);
}
</style>
