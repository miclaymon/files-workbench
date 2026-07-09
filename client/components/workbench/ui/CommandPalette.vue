<template>
  <Teleport to="body">
    <Transition name="cp">
      <div v-if="visible" class="cp-backdrop" @mousedown.self="$emit('close')">
        <div class="cp-dialog" role="dialog" aria-label="Command Palette">

          <div class="cp-input-row">
            <span v-if="mode.prefix" class="cp-mode" :title="`${mode.name} mode`">{{ mode.name }}</span>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              :placeholder="mode.placeholder"
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeyDown"
            />
          </div>

          <div v-if="flatItems.length > 0" ref="resultsRef" class="cp-results">
            <template v-for="group in groups" :key="group.label ?? 'main'">
              <div v-if="group.label" class="cp-group-label">{{ group.label }}</div>
              <div
                v-for="item in group.items"
                :key="item.key"
                class="cp-item"
                :class="{ 'cp-item--active': indexOf(item) === activeIdx }"
                @mousedown.prevent="run(item)"
                @mousemove="activeIdx = indexOf(item)"
              >
                <span class="cp-item-label">
                  <span v-if="item.checkable" class="cp-item-check">
                    <svg v-if="item.checked" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                      <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
                    </svg>
                  </span>
                  <span class="cp-item-text">{{ item.label }}</span>
                  <span v-if="item.tag" class="cp-item-tag">{{ item.tag }}</span>
                </span>
                <span class="cp-item-meta">
                  <span v-if="item.category" class="cp-item-category">{{ item.category }}</span>
                  <span v-if="item.keys?.length" class="cp-item-keys">
                    <kbd v-for="(k, ki) in item.keys" :key="ki" class="cp-key">{{ k }}</kbd>
                  </span>
                </span>
              </div>
            </template>
          </div>
          <div v-else class="cp-empty">
            {{ term ? mode.empty : mode.placeholder }}
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

// The palette is mode-driven: a leading prefix character selects a mode (`>`
// commands, `?` the mode list); typing with no known prefix falls to the default
// (no-prefix) "Go to File" mode. Each mode supplies its own items; the palette
// scores/filters them against the remaining term. Only the commands mode is wired
// today — Go to File is a registered stub that renders its own empty state, so it
// drops in later without touching this component.
//
// `showModes` (set when opened from the title-bar command center) surfaces the
// list of available modes above the default mode's results, as a discovery aid;
// the same list is reachable any time by typing `?`.
const props = defineProps({
  visible:       { type: Boolean, required: true },
  modes:         { type: Array,   default: () => [] },
  initialPrefix: { type: String,  default: '>' },
  showModes:     { type: Boolean, default: false },
})
const emit = defineEmits(['close'])

const query      = ref('')
const activeIdx  = ref(0)
const inputRef   = ref(null)
const resultsRef = ref(null)

// ── Recently-used (commands mode) ─────────────────────────────────────────────
const RECENT_KEY = 'wb.palette.recent.commands'
const recent = ref(loadRecent())

function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') } catch { return [] }
}
function pushRecent(key) {
  recent.value = [key, ...recent.value.filter(k => k !== key)].slice(0, 8)
  try { localStorage.setItem(RECENT_KEY, JSON.stringify(recent.value)) } catch { /* private mode */ }
}

// ── Focus / reset on open ────────────────────────────────────────────────────
watch(() => props.visible, async (v) => {
  if (v) {
    query.value     = props.initialPrefix ?? ''
    activeIdx.value = 0
    await nextTick()
    focusInput()
  }
})

function focusInput() {
  const el = inputRef.value
  el?.focus()
  el?.setSelectionRange(query.value.length, query.value.length)
}

// ── Mode resolution ───────────────────────────────────────────────────────────
const FALLBACK_MODE = { name: '', prefix: '', placeholder: 'Type to search…', empty: 'No results', items: () => [] }
const MORE_MODE = { name: 'More', prefix: '?', placeholder: 'Select what to search…', empty: 'No matching modes', items: () => [] }

const defaultMode = computed(() => props.modes.find(m => !m.prefix) ?? props.modes[0] ?? FALLBACK_MODE)

const mode = computed(() => {
  const first = query.value.charAt(0)
  if (first === '?') return MORE_MODE
  const byPrefix = props.modes.find(m => m.prefix && m.prefix === first)
  return byPrefix ?? defaultMode.value
})
const term = computed(() => {
  const q = query.value
  return (mode.value.prefix && q.charAt(0) === mode.value.prefix ? q.slice(1) : q).trim()
})

// The selectable list of modes (shown in the home view and `?` More mode). Each
// entry switches the palette into that mode without closing it.
const modeListItems = computed(() => {
  const entries = props.modes
    .filter(m => m.listable !== false)
    .map(m => ({
      key:      'mode:' + (m.prefix || 'default'),
      label:    m.name,
      category: m.prefix || '',
      keys:     m.keys ?? [],
      keepOpen: true,
      run:      () => { query.value = m.prefix ?? ''; activeIdx.value = 0; focusInput() },
    }))
  entries.push({
    key: 'mode:more', label: 'More', category: '?', keys: [], keepOpen: true,
    run: () => { query.value = '?'; activeIdx.value = 0; focusInput() },
  })
  return entries
})

// ── Filtering / scoring ───────────────────────────────────────────────────────
function score(item, q) {
  if (!q) return 1
  const label    = item.label.toLowerCase()
  const category = (item.category ?? '').toLowerCase()
  const full     = category ? `${category} ${label}` : label

  if (label === q) return 100
  if (label.startsWith(q)) return 80
  if (label.includes(q)) return 60 + (60 - label.indexOf(q))
  if (full.includes(q)) return 30

  // sequential character match
  let pos = 0, consecutive = 0, lastPos = -1
  for (const ch of q) {
    const found = full.indexOf(ch, pos)
    if (found < 0) return 0
    if (found === lastPos + 1) consecutive++
    lastPos = found
    pos = found + 1
  }
  return 5 + consecutive
}

function filtered(items, q) {
  return items
    .map(item => ({ item, s: score(item, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 50)
    .map(({ item }) => item)
}

// Grouped result list. `?` lists the modes; the home view surfaces that list
// above the default mode's results; a recents-enabled mode with an empty term
// splits into "recently used" + "other commands" (matching VS Code).
const groups = computed(() => {
  const m = mode.value
  const q = term.value.toLowerCase()

  if (m === MORE_MODE) {
    return [{ label: null, items: filtered(modeListItems.value, q) }]
  }

  const out = []
  if (props.showModes && !q && m === defaultMode.value) {
    out.push({ label: null, items: modeListItems.value })
  }

  const items = m.items?.(term.value) ?? []
  if (m.recents && !q) {
    const byKey = new Map(items.map(it => [it.key, it]))
    const recents = recent.value.map(k => byKey.get(k)).filter(Boolean)
    const recentSet = new Set(recents.map(it => it.key))
    const others = items.filter(it => !recentSet.has(it.key))
    if (recents.length) out.push({ label: 'recently used', items: recents })
    out.push({ label: recents.length ? 'other commands' : null, items: others.slice(0, 50) })
  } else {
    out.push({ label: out.length ? 'recently opened' : null, items: filtered(items, q) })
  }
  return out
})

const flatItems = computed(() => groups.value.flatMap(g => g.items))
function indexOf(item) { return flatItems.value.indexOf(item) }

// Keep activeIdx in bounds when results change
watch(flatItems, () => { activeIdx.value = 0 })

// Scroll active item into view
watch(activeIdx, async (i) => {
  await nextTick()
  resultsRef.value?.querySelectorAll('.cp-item')[i]?.scrollIntoView({ block: 'nearest' })
})

// ── Keyboard navigation ───────────────────────────────────────────────────────
function onKeyDown(e) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, flatItems.value.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const item = flatItems.value[activeIdx.value]
    if (item) run(item)
  }
}

function run(item) {
  // Mode-list entries switch the palette's mode in place rather than closing it.
  if (item.keepOpen) { item.run?.(); return }
  emit('close')
  if (mode.value.recents) pushRecent(item.key)
  // Defer action so the palette is gone before any side-effects run
  setTimeout(() => (item.run ?? item.action)?.(), 16)
}
</script>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────────────────── */
.cp-backdrop {
  position: fixed;
  inset: 0;
  z-index: 9000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding-top: 12vh;
}

/* ── Dialog ────────────────────────────────────────────────────────────────── */
.cp-dialog {
  width: 100%;
  max-width: 620px;
  background: var(--sidebar-bg, #252526);
  border: 1px solid var(--border, #454545);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.55);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Input row ─────────────────────────────────────────────────────────────── */
.cp-input-row {
  display: flex;
  align-items: center;
  padding: 0 10px;
  border-bottom: 1px solid var(--border, #454545);
  gap: 8px;
  height: 38px;
  flex-shrink: 0;
}

.cp-mode {
  font-size: 11px;
  color: var(--text-muted, #8c8c8c);
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border-subtle, #555);
  border-radius: 3px;
  padding: 1px 6px;
  flex-shrink: 0;
  white-space: nowrap;
}

.cp-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  padding: 0;
  min-width: 0;

  &::placeholder { color: var(--text-muted, #666); }
}

/* ── Results list ──────────────────────────────────────────────────────────── */
.cp-results {
  overflow-y: auto;
  max-height: 380px;
  padding: 4px 0;
}

.cp-group-label {
  font-size: 11px;
  color: var(--text-muted, #8c8c8c);
  padding: 6px 12px 2px;
  user-select: none;
}

.cp-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 0 12px;
  height: 30px;
  cursor: pointer;
  user-select: none;

  &.cp-item--active { background: var(--accent, #094771); }

  .cp-item-label {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }

  .cp-item-check {
    width: 14px;
    height: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    color: var(--text, #ccc);
  }

  .cp-item-text {
    font-size: 13px;
    color: var(--text, #ccc);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cp-item-tag {
    font-size: 11px;
    color: var(--text-muted, #8c8c8c);
    flex-shrink: 0;
  }

  .cp-item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }

  .cp-item-category {
    font-size: 11px;
    color: var(--text-muted, #8c8c8c);
    white-space: nowrap;
  }

  .cp-item-keys {
    display: flex;
    align-items: center;
    gap: 2px;
  }
}

.cp-key {
  display: inline-block;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border-subtle, #555);
  border-bottom-width: 2px;
  border-radius: 3px;
  color: var(--text, #ccc);
  line-height: 1.4;
}

.cp-empty {
  padding: 16px 14px;
  font-size: 13px;
  color: var(--text-muted, #666);
}

/* ── Transition ────────────────────────────────────────────────────────────── */
.cp-enter-active,
.cp-leave-active { transition: opacity 0.1s, transform 0.1s; }
.cp-enter-from,
.cp-leave-to { opacity: 0; transform: translateY(-6px); }
.cp-enter-to,
.cp-leave-from { opacity: 1; transform: translateY(0); }
</style>
