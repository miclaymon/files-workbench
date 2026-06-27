<template>
  <div class="activitybar">
    <div class="activitybar-top">
      <a
        v-for="view in views"
        :key="view.id"
        href="javascript:void(0)"
        class="activitybar-icon"
        :class="{ active: activePrimaryView === view.id }"
        :title="view.label"
        @click="$emit('toggle-view', view.id)"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="view.icon" /></svg>
      </a>
    </div>
    <div class="activitybar-bottom">
      <a ref="settingsButton" href="javascript:void(0)" class="activitybar-icon" title="Settings" @click.stop="openSettingsMenu">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiCog" /></svg>
      </a>
    </div>
    <FloatingMenu :visible="settingsMenuOpen" type="menu" :items="settingsMenuItems" :x="settingsMenuPos.x" :y="settingsMenuPos.y" @close="settingsMenuOpen = false" />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { mdiCog } from '@mdi/js'
import FloatingMenu from '../ui/FloatingMenu.vue'

// The icon-only Activity Bar that switches the primary sidebar view. Entries are
// the registry's primary-side-bar panels (`views`), so a plugin contributing a
// PrimarySideBar activity appears here automatically. The switch is delegated
// upward (`toggle-view`); the Settings gear owns its own dropdown locally.
defineProps({
  views:             { type: Array,  default: () => [] },
  activePrimaryView: { type: String, default: 'explorer' },
  settingsMenuItems: { type: Array,  default: () => [] },
})
defineEmits(['toggle-view'])

const settingsButton  = ref(null)
const settingsMenuOpen = ref(false)
const settingsMenuPos  = ref({ x: 0, y: 0 })

// Delay matches the original: lets any open-menu outside-click close handler
// settle before this menu positions and opens.
function openSettingsMenu() {
  setTimeout(() => {
    const el = settingsButton.value
    if (el) {
      const rect = el.getBoundingClientRect()
      settingsMenuPos.value = { x: rect.right + 4, y: rect.top }
    }
    settingsMenuOpen.value = true
  }, 50)
}
</script>

<style scoped>
.activitybar {
  width: var(--activitybar-width);
  flex-shrink: 0;
  background: #333333;
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  padding: 0;
  .activitybar-top, .activitybar-bottom {
    display: flex;
    flex-direction: column;
  }
  .activitybar-icon {
    width: 100%;
    height: 44px;
    display: grid;
    place-items: center;
    color: rgba(255,255,255,0.4);
    text-decoration: none;
    transition: color 0.1s;
    &:hover { color: rgba(255,255,255,0.8); }
    &.active {
      color: white;
      border-left: 2px solid var(--accent);
      background: rgba(255,255,255,0.04);
    }
  }
}
</style>
