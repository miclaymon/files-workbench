<template>
  <teleport to="body">
    <div
      v-if="visible"
      ref="menuRef"
      class="floating-menu"
      :class="[`floating-menu--${type}`, { 'floating-menu--relative-to-cursor': relativeToCursor }]"
      :style="menuStyle"
      @mouseenter="onMouseEnter"
      @mouseleave="onMouseLeave"
    >
      <div class="floating-menu__content" :class="`floating-menu__content--${type}`">
        <template v-if="type === 'tooltip'">
          <div class="tooltip-content">{{ content }}</div>
        </template>

        <template v-else-if="type === 'popover'">
          <div class="popover-content">
            <slot>{{ content }}</slot>
          </div>
          <div v-if="showCloseButton" class="popover-close" @click="close">✕</div>
        </template>

        <template v-else-if="type === 'menu'">
          <div class="menu-content">
            <template v-for="(item, index) in items" :key="index">
              <div v-if="item.separator" class="menu-separator" />
              <div
                v-else
                class="menu-item"
                :class="{
                  'menu-item--disabled': item.disabled,
                  'menu-item--has-submenu': item.submenu?.length
                }"
                @click="item.disabled ? null : onItemClick(item)"
                @mouseenter="item.submenu ? showSubmenu(item, $event) : hideSubmenu()"
              >
                <span v-if="item.type === 'toggle'" class="menu-item__check">
                  <svg v-if="item.checked?.()" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
                  </svg>
                </span>
                <span v-if="item.icon" class="menu-item__icon">
                  <svg v-if="typeof item.icon === 'string' && item.icon.startsWith('M')" :width="16" :height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path :d="item.icon" />
                  </svg>
                  <span v-else>{{ item.icon }}</span>
                </span>
                <span class="menu-item__label">{{ typeof item.label === 'object' ? item.label.value : item.label }}</span>
                <span v-if="item.shortcut" class="menu-item__shortcut">{{ item.shortcut }}</span>
                <span v-if="item.submenu" class="menu-item__submenu-arrow">▶</span>
              </div>
            </template>
          </div>
        </template>
      </div>

      <div
        v-if="activeSubmenu?.items.length"
        class="floating-menu floating-menu--submenu"
        :style="submenuStyle"
        @mouseenter="onSubmenuMouseEnter"
        @mouseleave="onSubmenuMouseLeave"
      >
        <div class="menu-content">
          <template v-for="(item, index) in activeSubmenu.items" :key="index">
            <div v-if="item.separator" class="menu-separator" />
            <div
              v-else
              class="menu-item"
              :class="{ 'menu-item--disabled': item.disabled }"
              @click="item.disabled ? null : onItemClick(item)"
            >
              <span v-if="item.type === 'toggle'" class="menu-item__check">
                <svg v-if="item.checked?.()" viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
                  <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
                </svg>
              </span>
              <span v-if="item.icon" class="menu-item__icon">
                <svg v-if="typeof item.icon === 'string' && item.icon.startsWith('M')" :width="16" :height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path :d="item.icon" />
                </svg>
                <span v-else>{{ item.icon }}</span>
              </span>
              <span class="menu-item__label">{{ item.label }}</span>
              <span v-if="item.shortcut" class="menu-item__shortcut">{{ item.shortcut }}</span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'

const props = defineProps({
  visible: { type: Boolean, default: false },
  type: { type: String, default: 'menu', validator: (v) => ['tooltip', 'popover', 'menu'].includes(v) },
  content: { type: String, default: '' },
  items: { type: Array, default: () => [] },
  x: { type: Number, default: 0 },
  y: { type: Number, default: 0 },
  relativeToCursor: { type: Boolean, default: false },
  showCloseButton: { type: Boolean, default: false },
  hoverDelay: { type: Number, default: 300 },
  hideDelay: { type: Number, default: 10000 },
  maxWidth: { type: Number, default: 300 }
})

const emit = defineEmits(['close', 'item-click'])

const menuRef = ref(null)
const activeSubmenu = ref(null)
const submenuPosition = ref({ x: 0, y: 0 })

let hideTimer = null
let submenuHideTimer = null

const menuStyle = computed(() => ({
  left: props.relativeToCursor ? `${props.x + 10}px` : `${props.x}px`,
  top: props.relativeToCursor ? `${props.y + 10}px` : `${props.y}px`,
  maxWidth: `${props.maxWidth}px`
}))

const submenuStyle = computed(() => ({
  left: `${submenuPosition.value.x}px`,
  top: `${submenuPosition.value.y}px`
}))

function onMouseEnter() {
  clearTimeout(hideTimer)
}

function onMouseLeave() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => { if (!submenuHideTimer) close() }, props.hideDelay)
}

function onSubmenuMouseEnter() {
  clearTimeout(submenuHideTimer)
}

function onSubmenuMouseLeave() {
  clearTimeout(submenuHideTimer)
  submenuHideTimer = setTimeout(hideSubmenu, props.hideDelay)
}

function showSubmenu(item, event) {
  if (!item.submenu?.length) return

  const menuItem = event.currentTarget
  const menuItemRect = menuItem.getBoundingClientRect()
  const menuRect = menuRef.value.getBoundingClientRect()

  const arrowEl = menuItem.querySelector('.menu-item__submenu-arrow')
  const arrowRect = arrowEl?.getBoundingClientRect()

  const relX = arrowRect ? arrowRect.right - menuRect.left : menuItemRect.right - menuRect.left
  const relY = menuItemRect.top - menuRect.top

  let x = props.x + relX - 40
  let y = props.y + relY

  if (x + 200 > window.innerWidth) x = props.x + (arrowRect ? arrowRect.left - menuRect.left : menuItemRect.left - menuRect.left) - 200 - 40
  if (y + 300 > window.innerHeight) y = Math.max(10, window.innerHeight - 310)

  submenuPosition.value = { x, y }
  activeSubmenu.value = { parentItem: item, items: item.submenu }
  clearTimeout(submenuHideTimer)
}

function hideSubmenu() {
  activeSubmenu.value = null
  clearTimeout(submenuHideTimer)
}

function onItemClick(item) {
  if (item.disabled) return
  item.action?.()
  emit('item-click', item)
  if (props.type === 'menu' && !item.submenu) close()
}

function close() {
  clearTimeout(hideTimer)
  clearTimeout(submenuHideTimer)
  hideSubmenu()
  emit('close')
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.visible) close()
}

function handleClickOutside(e) {
  if (props.visible && menuRef.value && !menuRef.value.contains(e.target)) close()
}

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('keydown', handleKeyDown)
  document.removeEventListener('click', handleClickOutside)
  clearTimeout(hideTimer)
  clearTimeout(submenuHideTimer)
})
</script>

<style scoped>
.floating-menu {
  position: fixed !important;
  z-index: 99999 !important;
  background: var(--dropdown-background, #252526);
  border: 1px solid var(--border, #3e3e42);
  border-radius: 6px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  padding: 4px 0;
  min-width: 140px;
  max-width: 300px;
  font-size: 13px;
  color: var(--text, #cccccc);
  clip: auto !important;
  clip-path: none !important;
  overflow: visible !important;
}

.floating-menu--tooltip {
  background: var(--tooltip-background, #1e1e1e);
  padding: 6px 10px;
  font-size: 12px;
  max-width: 200px;
  pointer-events: none;
}

.floating-menu--popover { padding: 12px; max-width: 400px; }

.floating-menu--submenu {
  position: fixed !important;
  z-index: 100000 !important;
}

.tooltip-content { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

.popover-close {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  color: var(--text-muted);
}
.popover-close:hover { background: var(--hover-background); }

.menu-content { display: flex; flex-direction: column; }

.menu-item {
  display: flex;
  align-items: center;
  padding: 6px 12px;
  cursor: pointer;
  white-space: nowrap;
  min-height: 24px;
}
.menu-item:hover:not(.menu-item--disabled) { background: var(--hover-background, #2a2d2e); }
.menu-item--disabled { color: var(--text-disabled, #5a5a5a); cursor: not-allowed; }

.menu-item__check {
  width: 16px;
  height: 16px;
  margin-right: 4px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
}
.menu-item__icon { margin-right: 8px; width: 16px; text-align: center; flex-shrink: 0; }
.menu-item__label { flex: 1; overflow: hidden; text-overflow: ellipsis; }
.menu-item__shortcut { margin-left: 12px; color: var(--text-muted); font-size: 11px; flex-shrink: 0; }
.menu-item__submenu-arrow { margin-left: 8px; font-size: 10px; color: var(--text-muted); flex-shrink: 0; }

.menu-separator { height: 1px; background: var(--border, #3e3e42); margin: 4px 0; }
</style>
