<template>
  <div class="layout-controls">
    <button title="Customize Layout">
      <!-- TODO: mdiSpaceDashboard — opens layout palette -->
    </button>
    <button aria-label="Toggle Primary Side Bar" @click="$emit('toggle-primary-sidebar')">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button aria-label="Toggle Panel" @click="$emit('toggle-panel')">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M3 15H21M7.8 3H16.2C17.8802 3 18.7202 3 19.362 3.32698C19.9265 3.6146 20.3854 4.07354 20.673 4.63803C21 5.27976 21 6.11984 21 7.8V16.2C21 17.8802 21 18.7202 20.673 19.362C20.3854 19.9265 19.9265 20.3854 19.362 20.673C18.7202 21 17.8802 21 16.2 21H7.8C6.11984 21 5.27976 21 4.63803 20.673C4.07354 20.3854 3.6146 19.9265 3.32698 19.362C3 18.7202 3 17.8802 3 16.2V7.8C3 6.11984 3 5.27976 3.32698 4.63803C3.6146 4.07354 4.07354 3.6146 4.63803 3.32698C5.27976 3 6.11984 3 7.8 3Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
    <button aria-label="Toggle Secondary Side Bar" @click="$emit('toggle-secondary-sidebar')">
      <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect width="18" height="18" rx="3" transform="matrix(-1 0 0 1 21 3)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        <line x1="1" y1="-1" x2="17" y2="-1" transform="matrix(4.37114e-08 1 1 -4.37114e-08 16 3)" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
      </svg>
    </button>
  </div>
</template>

<script setup>
defineEmits(['toggle-primary-sidebar', 'toggle-panel', 'toggle-secondary-sidebar'])
</script>

<style scoped>
.layout-controls {
  -webkit-app-region: no-drag;
  display: flex;
  flex-flow: row nowrap;
  gap: 4px;
  align-items: center;
  height: 100%;

  button {
    cursor: pointer;
    color: var(--text-muted);
    border-radius: 0.25rem;
    &:hover {
      background: rgba(255,255,255,0.06);
      color: var(--text);
    }
    svg {
      display: block;
      width: 28px;
      height: 28px;
      padding: 4px;
      aspect-ratio: 1 / 1;
    }
  }
}
</style>
