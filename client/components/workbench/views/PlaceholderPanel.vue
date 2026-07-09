<template>
  <div class="placeholder">
    <svg v-if="icon" class="placeholder-icon" viewBox="0 0 24 24" width="36" height="36" fill="currentColor">
      <path :d="icon" />
    </svg>
    <div v-if="title" class="placeholder-title">{{ title }}</div>
    <div class="placeholder-note">{{ note }}</div>
  </div>
</template>

<script setup>
// Generic placeholder body for activities that are registered but not yet built
// out (Chat, Search, Storage, Converter, …). The owning panel's header already
// shows the activity label; this just fills the body with a "coming soon" note.
defineProps({
  title: { type: String, default: '' },
  note:  { type: String, default: 'Coming soon.' },
  icon:  { type: String, default: '' },
})
</script>

<style scoped>
.placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 100%;
  padding: 24px;
  color: var(--text-muted);
  text-align: center;
  user-select: none;
}
.placeholder-icon  { opacity: 0.35; }
.placeholder-title { font-size: 14px; font-weight: 600; color: var(--text); }
.placeholder-note  { font-size: 12px; opacity: 0.7; line-height: 1.5; }
</style>
