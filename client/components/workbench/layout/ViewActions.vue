<template>
  <template v-for="(group, gi) in renderGroups" :key="gi">
    <span v-if="gi > 0" class="va-sep" aria-hidden="true" />
    <button
      v-for="a in group"
      :key="a.id"
      :ref="el => setBtnRef(a.id, el)"
      class="view-action-btn"
      :class="{ 'is-disabled': isDisabled(a), 'is-open': openMenuId === a.id }"
      :disabled="isDisabled(a)"
      :title="typeof a.title === 'function' ? a.title(ctx) : a.title"
      @click.stop="onClick(a)"
    >
      <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
        <path :d="typeof a.icon === 'function' ? a.icon(ctx) : a.icon" />
      </svg>
    </button>
  </template>

  <FloatingMenu
    :visible="!!openMenuId"
    type="menu"
    :items="openMenuItems"
    :x="menuPos.x"
    :y="menuPos.y"
    @close="openMenuId = null"
  />
</template>

<script setup>
import { computed, inject, ref } from 'vue'
import FloatingMenu from '~/components/workbench/ui/FloatingMenu.vue'

// Renders context-action buttons against the shared viewCtx, in the tab strip, a
// SplitViewHeading, or a SplitSectionHeading. Pass `actions` for a single flat
// group, or `groups` (array of arrays) to render several hierarchy groups inline
// with a separator between them (e.g. bubbled section actions | view actions).
// Empty groups are dropped so no stray separators appear. `@click.stop` keeps a
// click from toggling the accordion.
//
// An action is either a button (`run(ctx)`) or a dropdown (`menu(ctx)` → an array
// of FloatingMenu items, e.g. the Debug panel's per-level filter toggles). A
// dropdown action's button toggles an anchored FloatingMenu; toggle items mark
// themselves `keepOpen` so several can be flipped without the menu closing.
const props = defineProps({
  actions: { type: Array, default: () => [] },
  groups:  { type: Array, default: null },
})
const ctx = inject('viewCtx', null)

const renderGroups = computed(() =>
  (props.groups ?? [props.actions]).filter(g => Array.isArray(g) && g.length)
)

// An action's `disabled` may be a boolean or a predicate(ctx) for reactive state
// (e.g. Preview's "Open in Editor Tab" is disabled in multi-item mode).
function isDisabled(a) {
  return typeof a.disabled === 'function' ? !!a.disabled(ctx) : !!a.disabled
}

// ── Dropdown actions ───────────────────────────────────────────────────────────
const btnRefs = new Map()                 // action id → button element (for anchoring)
const openMenuId = ref(null)              // id of the action whose menu is open
const menuPos = ref({ x: 0, y: 0 })
const MENU_WIDTH = 200

function setBtnRef(id, el) { if (el) btnRefs.set(id, el); else btnRefs.delete(id) }

// Items recompute each render so toggle checks/labels stay live while the menu is
// open (FloatingMenu also re-reads each item's checked() reactively).
const openMenuItems = computed(() => {
  if (!openMenuId.value) return []
  const a = renderGroups.value.flat().find(x => x.id === openMenuId.value)
  return a?.menu ? (a.menu(ctx) ?? []) : []
})

function onClick(a) {
  if (isDisabled(a)) return
  if (typeof a.menu === 'function') {
    if (openMenuId.value === a.id) { openMenuId.value = null; return }   // toggle closed
    const rect = btnRefs.get(a.id)?.getBoundingClientRect()
    if (rect) menuPos.value = { x: Math.max(8, rect.right - MENU_WIDTH), y: rect.bottom + 2 }
    openMenuId.value = a.id
    return
  }
  if (ctx) a.run?.(ctx)
}
</script>

<style scoped>
.view-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 18px;
  background: none;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  opacity: 0.7;
}
.view-action-btn:hover,
.view-action-btn.is-open { opacity: 1; color: var(--text); }
.view-action-btn.is-disabled {
  opacity: 0.3;
  cursor: default;
  pointer-events: none;
}

/* Divider between button hierarchy groups (section | view | panel). */
.va-sep {
  width: 1px;
  align-self: center;
  height: 14px;
  margin: 0 4px;
  background: var(--border);
  flex-shrink: 0;
}
</style>
