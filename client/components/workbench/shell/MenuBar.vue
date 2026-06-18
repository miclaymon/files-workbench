<template>
  <div class="menubar">
    <button
      v-for="m in menus"
      :key="m.key"
      :ref="el => setBtn(m.key, el)"
      class="no-drag titlebar-menu-btn"
      @click.stop="openMenu(m.key)"
    >{{ m.label }}</button>

    <FloatingMenu
      v-for="m in menus"
      :key="m.key + '-menu'"
      :visible="openKey === m.key"
      type="menu"
      :items="m.items"
      :x="pos.x"
      :y="pos.y"
      @close="onClose(m.key)"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import FloatingMenu from '../ui/FloatingMenu.vue'

// The File / Edit / View menu strip. Each menu is `{ key, label, items }`; the
// items arrays stay computed in Workbench and flow through unchanged. Only one
// menu is open at a time, positioned below its button.
defineProps({
  menus: { type: Array, default: () => [] },  // [{ key, label, items }]
})

const btns    = {}
const openKey = ref(null)
const pos     = ref({ x: 0, y: 0 })

function setBtn(key, el) { if (el) btns[key] = el; else delete btns[key] }

// Delay matches the original: lets the previous menu's outside-click close
// settle before the next one positions and opens.
function openMenu(key) {
  setTimeout(() => {
    const el = btns[key]
    if (el) {
      const rect = el.getBoundingClientRect()
      pos.value = { x: rect.left, y: rect.bottom + 2 }
    }
    openKey.value = key
  }, 50)
}

function onClose(key) { if (openKey.value === key) openKey.value = null }
</script>

<style scoped>
.menubar { display: flex; gap: 8px; align-items: center; }
.titlebar-menu-btn { font-size: 12px; color: var(--text-muted); padding: 2px 6px; border-radius: 3px; }
.titlebar-menu-btn:hover { background: rgba(255,255,255,0.06); color: var(--text); }
.no-drag { -webkit-app-region: no-drag; }
</style>
