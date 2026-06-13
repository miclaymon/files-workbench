<template>
  <!-- Main menu panel -->
  <teleport to="body">
    <div
      v-if="visible"
      ref="menuEl"
      class="cm"
      :style="menuStyle"
      @click.stop
      @contextmenu.prevent
      @mouseenter="clearHideTimer"
      @mouseleave="startHideTimer"
    >
      <!-- Quick action icon buttons -->
      <div v-if="quickActions?.length" class="cm-quick">
        <button
          v-for="qa in quickActions"
          :key="qa.key"
          class="cm-quick-btn"
          :class="{ 'cm-quick-btn--disabled': qa.disabled }"
          :title="qa.label"
          @click.stop="!qa.disabled && qa.action?.()"
        >
          <svg v-if="isMdiPath(qa.icon)" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path :d="qa.icon" />
          </svg>
          <span v-else class="cm-quick-fallback">{{ qa.icon }}</span>
        </button>
      </div>

      <!-- Menu items -->
      <div class="cm-body">
        <template v-for="(item, idx) in items" :key="item.key ?? idx">
          <div v-if="item.separator" class="cm-sep" />
          <div
            v-else
            class="cm-item"
            :class="{
              'cm-item--disabled': item.disabled,
              'cm-item--sub-open': activeSubmenuKey === (item.key ?? idx),
            }"
            @mouseenter="onItemEnter(item, idx, $event)"
            @mouseleave="onItemLeave(item)"
          >
            <!-- Icon gutter -->
            <span class="cm-item-icon">
              <svg v-if="isMdiPath(item.icon)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path :d="item.icon" />
              </svg>
              <span v-else-if="item.icon">{{ item.icon }}</span>
            </span>

            <!-- Label — fires action on click -->
            <span
              class="cm-item-label"
              @click="onLabelClick(item)"
            >{{ item.label }}</span>

            <!-- Keyboard shortcut hint -->
            <span v-if="item.shortcut && !item.submenu?.length" class="cm-item-shortcut">{{ item.shortcut }}</span>

            <!-- Submenu chevron button — separate click area -->
            <button
              v-if="item.submenu?.length"
              class="cm-item-sub-btn"
              title="More options"
              @click.stop="onSubBtnClick(item, idx, $event)"
              @mouseenter.stop="openSubmenuAt(item, idx, $event.currentTarget)"
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8.59 16.58L13.17 12 8.59 7.41 10 6l6 6-6 6z"/>
              </svg>
            </button>
          </div>
        </template>
      </div>
    </div>
  </teleport>

  <!-- Submenu panel — separate teleport to avoid clipping -->
  <teleport to="body">
    <div
      v-if="activeSubmenu && visible"
      ref="submenuEl"
      class="cm cm--sub"
      :style="submenuStyle"
      @click.stop
      @contextmenu.prevent
      @mouseenter="clearHideTimer"
      @mouseleave="startHideTimer"
    >
      <div class="cm-body">
        <template v-for="(sub, idx) in activeSubmenu.items" :key="sub.key ?? idx">
          <div v-if="sub.separator" class="cm-sep" />
          <div
            v-else
            class="cm-item"
            :class="{ 'cm-item--disabled': sub.disabled }"
            @click="onSubItemClick(sub)"
          >
            <span class="cm-item-icon">
              <svg v-if="isMdiPath(sub.icon)" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path :d="sub.icon" />
              </svg>
              <span v-else-if="sub.icon">{{ sub.icon }}</span>
            </span>
            <span class="cm-item-label">{{ sub.label }}</span>
          </div>
        </template>
      </div>
    </div>
  </teleport>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'

const props = defineProps({
  visible:      { type: Boolean, default: false },
  items:        { type: Array,   default: () => [] },
  quickActions: { type: Array,   default: () => [] },
  x:            { type: Number,  default: 0 },
  y:            { type: Number,  default: 0 },
})

const emit = defineEmits(['close'])

const menuEl    = ref(null)
const submenuEl = ref(null)

// Submenu state
const activeSubmenu    = ref(null)   // { items, x, y }
const activeSubmenuKey = ref(null)   // item.key ?? idx of the parent

// Timers
let hideTimer    = null
let submenuTimer = null

// ── Viewport-clamped position ─────────────────────────────────────────────
const menuPos = ref({ x: 0, y: 0 })

// Watch for x/y changes and clamp after render
import { watch } from 'vue'
watch(() => [props.x, props.y, props.visible], async ([x, y, vis]) => {
  if (!vis) return
  menuPos.value = { x, y }  // set initial (may overflow)
  await nextTick()
  if (!menuEl.value) return
  const rect = menuEl.value.getBoundingClientRect()
  menuPos.value = {
    x: Math.max(4, Math.min(x, window.innerWidth  - rect.width  - 4)),
    y: Math.max(4, Math.min(y, window.innerHeight - rect.height - 4)),
  }
}, { immediate: true })

const menuStyle = computed(() => ({
  left: menuPos.value.x + 'px',
  top:  menuPos.value.y + 'px',
}))

const submenuStyle = computed(() => {
  if (!activeSubmenu.value) return {}
  return { left: activeSubmenu.value.x + 'px', top: activeSubmenu.value.y + 'px' }
})

// ── Helpers ───────────────────────────────────────────────────────────────
function isMdiPath(icon) {
  return typeof icon === 'string' && icon.startsWith('M')
}

// ── Hide timer ────────────────────────────────────────────────────────────
function clearHideTimer() { clearTimeout(hideTimer) }
function startHideTimer() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(close, 600)
}

// ── Submenu ───────────────────────────────────────────────────────────────
function openSubmenuAt(item, idx, triggerEl) {
  clearTimeout(submenuTimer)
  if (!item.submenu?.length) return
  const key = item.key ?? idx
  if (activeSubmenuKey.value === key) return

  // Position submenu to the right of the menu panel
  const menuRect = menuEl.value?.getBoundingClientRect()
  const triggerRect = triggerEl?.getBoundingClientRect()
  const subW = 200  // estimated submenu width

  let sx = (menuRect?.right ?? menuPos.value.x + 220) - 2
  let sy = triggerRect?.top ?? menuPos.value.y

  if (sx + subW > window.innerWidth) {
    sx = (menuRect?.left ?? menuPos.value.x) - subW + 2
  }
  sy = Math.max(4, Math.min(sy, window.innerHeight - 300))

  activeSubmenuKey.value = key
  activeSubmenu.value = { items: item.submenu, x: sx, y: sy }
}

function scheduleSubmenu(item, idx, triggerEl) {
  clearTimeout(submenuTimer)
  submenuTimer = setTimeout(() => openSubmenuAt(item, idx, triggerEl), 180)
}

function closeSubmenu() {
  clearTimeout(submenuTimer)
  activeSubmenu.value = null
  activeSubmenuKey.value = null
}

// ── Item interaction ──────────────────────────────────────────────────────
function onItemEnter(item, idx, e) {
  clearHideTimer()
  if (item.submenu?.length) {
    // Use the sub-button as anchor if it exists, else the row element
    const subBtn = e.currentTarget.querySelector('.cm-item-sub-btn') ?? e.currentTarget
    scheduleSubmenu(item, idx, subBtn)
  } else {
    closeSubmenu()
  }
}

function onItemLeave(item) {
  if (!item.submenu?.length) return
  clearTimeout(submenuTimer)
}

function onLabelClick(item) {
  if (item.disabled) return
  if (item.action) {
    item.action()
    close()
  }
  // If no action but has submenu: do nothing (use chevron)
}

function onSubBtnClick(item, idx, e) {
  if (item.disabled) return
  const btn = e.currentTarget ?? e.target
  openSubmenuAt(item, idx, btn)
}

function onSubItemClick(sub) {
  if (sub.disabled) return
  sub.action?.()
  close()
}

// ── Close ─────────────────────────────────────────────────────────────────
function close() {
  clearTimeout(hideTimer)
  clearTimeout(submenuTimer)
  closeSubmenu()
  emit('close')
}

// ── Click-outside / Escape ────────────────────────────────────────────────
function handleClickOutside(e) {
  if (!props.visible) return
  const inMenu    = menuEl.value?.contains(e.target)
  const inSubmenu = submenuEl.value?.contains(e.target)
  if (!inMenu && !inSubmenu) close()
}

function handleKeyDown(e) {
  if (e.key === 'Escape' && props.visible) close()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside, { capture: true })
  document.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside, { capture: true })
  document.removeEventListener('keydown', handleKeyDown)
  clearTimeout(hideTimer)
  clearTimeout(submenuTimer)
})
</script>

<style scoped>
/* ── Menu panel ──────────────────────────────────────────────────────────── */
.cm {
  position: fixed;
  z-index: 99999;
  background: var(--dropdown-background, #1e1e1e);
  border: 1px solid var(--border, #3c3c3c);
  border-radius: 6px;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.5);
  min-width: 188px;
  max-width: 260px;
  padding: 3px 0;
  font-size: 13px;
  color: var(--text, #cccccc);
  user-select: none;
}

.cm--sub {
  z-index: 100000;
  min-width: 176px;
}

/* ── Quick action row ────────────────────────────────────────────────────── */
.cm-quick {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 6px 5px;
  border-bottom: 1px solid var(--border, #3c3c3c);
  margin-bottom: 2px;
}

.cm-quick-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 5px;
  background: transparent;
  border: none;
  color: var(--text-muted, #9d9d9d);
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
}
.cm-quick-btn:hover:not(.cm-quick-btn--disabled) {
  background: var(--hover-background, rgba(255,255,255,0.08));
  color: var(--text, #cccccc);
}
.cm-quick-btn--disabled {
  color: var(--text-disabled, #555);
  cursor: not-allowed;
}
.cm-quick-fallback { font-size: 15px; line-height: 1; }

/* ── Separator ───────────────────────────────────────────────────────────── */
.cm-sep {
  height: 1px;
  background: var(--border, #3c3c3c);
  margin: 2px 0;
  opacity: 0.6;
}

/* ── Menu item ───────────────────────────────────────────────────────────── */
.cm-body { display: flex; flex-direction: column; }

.cm-item {
  display: flex;
  align-items: center;
  gap: 0;
  padding: 0 6px 0 0;
  min-height: 26px;
  cursor: pointer;
  white-space: nowrap;
  position: relative;
}
.cm-item:hover:not(.cm-item--disabled),
.cm-item--sub-open:not(.cm-item--disabled) {
  background: var(--hover-background, rgba(255,255,255,0.07));
}
.cm-item--disabled { color: var(--text-disabled, #555); cursor: not-allowed; }
.cm-item--disabled .cm-item-label { cursor: not-allowed; }

.cm-item-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  flex-shrink: 0;
  color: var(--text-muted, #9d9d9d);
}

.cm-item-label {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  padding: 4px 4px 4px 0;
  line-height: 1.4;
}

.cm-item-shortcut {
  margin-left: 12px;
  color: var(--text-disabled, #666);
  font-size: 11px;
  flex-shrink: 0;
}

/* Submenu chevron button — separate click target from the label */
.cm-item-sub-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 4px;
  background: transparent;
  border: none;
  color: var(--text-disabled, #666);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  margin-right: 2px;
}
.cm-item-sub-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: var(--text, #ccc);
}
</style>
