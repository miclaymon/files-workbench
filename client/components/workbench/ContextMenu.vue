<template>
  <div
    v-if="visible"
    class="context-menu-wrapper"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
    @mouseleave="onMouseLeave"
    @mouseenter="onMouseEnter"
  >
    <div ref="menuEl" class="context-menu">
      <div v-if="quickActions.length" class="context-quick-actions">
        <button
          v-for="qa in quickActions"
          :key="qa.key"
          :title="qa.label"
          class="context-quick-btn"
          @click="qa.action"
        >{{ qa.icon }}</button>
      </div>
      <div
        v-for="item in menuItems"
        :key="item.key"
        class="context-menu-item"
        :class="{ separator: item.separator, 'has-submenu': item.submenu }"
        @click="item.action"
        @mouseenter="item.submenu && (showSubmenu = item.key)"
        @mouseleave="item.submenu && (showSubmenu = null)"
      >
        <span v-if="!item.separator">{{ item.label }}</span>
        <span v-if="item.submenu" class="submenu-caret">▶</span>
        <div v-if="item.submenu && showSubmenu === item.key" class="context-submenu">
          <div
            v-for="sub in item.submenu"
            :key="sub.key"
            class="context-menu-item"
            @click.stop="sub.action"
          >{{ sub.label }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'

const props = defineProps({
  items: { type: Array, required: true },
  quickActions: { type: Array, default: () => [] },
  x: { type: Number, required: true },
  y: { type: Number, required: true },
  visible: { type: Boolean, required: true }
})

const emit = defineEmits(['close'])

const menuEl = ref(null)
const showSubmenu = ref(null)
let closeTimer = null

const menuItems = computed(() => props.items.map(item => ({
  ...item,
  key: item.key || crypto.randomUUID()
})))

function close() { emit('close') }

function onMouseLeave() { closeTimer = setTimeout(close, 300) }
function onMouseEnter() { clearTimeout(closeTimer); closeTimer = null }

function onClickOutside(e) {
  if (menuEl.value && !menuEl.value.closest('.context-menu-wrapper').contains(e.target)) close()
}

onMounted(() => document.addEventListener('click', onClickOutside))
onUnmounted(() => { document.removeEventListener('click', onClickOutside); clearTimeout(closeTimer) })
</script>

<style scoped>
.context-menu-wrapper { position: fixed; padding: 1.5rem; z-index: 1000; }

.context-menu {
  background: #252526;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 160px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}

.context-quick-actions {
  display: flex;
  gap: 4px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 4px;
}

.context-quick-btn {
  background: transparent;
  border: none;
  width: 24px;
  height: 24px;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text);
}
.context-quick-btn:hover { background: rgba(255,255,255,0.05); }

.context-menu-item { padding: 6px 12px; font-size: 13px; cursor: pointer; position: relative; }
.context-menu-item:hover { background: rgba(255,255,255,0.05); }
.context-menu-item.separator { height: 1px; background: var(--border); margin: 4px 0; cursor: default; }
.context-menu-item.has-submenu { display: flex; align-items: center; justify-content: space-between; }

.submenu-caret { margin-left: 8px; font-size: 10px; }

.context-submenu {
  position: absolute;
  left: 100%;
  top: 0;
  background: #252526;
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 4px 0;
  min-width: 140px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35);
}
</style>
