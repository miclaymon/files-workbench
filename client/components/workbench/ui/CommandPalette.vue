<template>
  <Teleport to="body">
    <Transition name="cp">
      <div v-if="visible" class="cp-backdrop" @mousedown.self="$emit('close')">
        <div class="cp-dialog" role="dialog" aria-label="Command Palette">

          <div class="cp-input-row">
            <svg class="cp-search-icon" viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
              <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              class="cp-input"
              placeholder="Type a command..."
              autocomplete="off"
              spellcheck="false"
              @keydown="onKeyDown"
            />
            <span v-if="!query" class="cp-hint">Ctrl+Shift+P</span>
          </div>

          <div v-if="results.length > 0" ref="resultsRef" class="cp-results">
            <div
              v-for="(cmd, i) in results"
              :key="cmd.key + '-' + i"
              class="cp-item"
              :class="{ 'cp-item--active': i === activeIdx }"
              @mousedown.prevent="run(cmd)"
              @mousemove="activeIdx = i"
            >
              <span class="cp-item-label">
                <span v-if="cmd.checkable" class="cp-item-check">
                  <svg v-if="cmd.checked" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                    <path d="M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z" />
                  </svg>
                </span>
                <span class="cp-item-text">{{ cmd.label }}</span>
              </span>
              <span v-if="cmd.category" class="cp-item-category">{{ cmd.category }}</span>
            </div>
          </div>
          <div v-else-if="query.trim()" class="cp-empty">
            No commands matching "{{ query }}"
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  visible:  { type: Boolean, required: true },
  commands: { type: Array,   default: () => [] },
})
const emit = defineEmits(['close'])

const query      = ref('')
const activeIdx  = ref(0)
const inputRef   = ref(null)
const resultsRef = ref(null)

// ── Focus / reset on open ────────────────────────────────────────────────────

watch(() => props.visible, async (v) => {
  if (v) {
    query.value     = ''
    activeIdx.value = 0
    await nextTick()
    inputRef.value?.focus()
  }
})

// ── Filtering / scoring ───────────────────────────────────────────────────────

function score(cmd, q) {
  if (!q) return 1
  const label    = cmd.label.toLowerCase()
  const category = (cmd.category ?? '').toLowerCase()
  const full     = category ? `${category} ${label}` : label

  if (label === q) return 100
  if (label.startsWith(q)) return 80
  if (label.includes(q)) return 60 + (60 - label.indexOf(q))
  if (full.includes(q)) return 30

  // sequential character match
  let pos = 0
  let consecutive = 0
  let lastPos = -1
  for (const ch of q) {
    const found = full.indexOf(ch, pos)
    if (found < 0) return 0
    if (found === lastPos + 1) consecutive++
    lastPos = found
    pos = found + 1
  }
  return 5 + consecutive
}

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  return props.commands
    .map(cmd => ({ cmd, s: score(cmd, q) }))
    .filter(({ s }) => s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, 50)
    .map(({ cmd }) => cmd)
})

// Keep activeIdx in bounds when results change
watch(results, () => {
  activeIdx.value = 0
})

// Scroll active item into view
watch(activeIdx, async (i) => {
  await nextTick()
  resultsRef.value?.children[i]?.scrollIntoView({ block: 'nearest' })
})

// ── Keyboard navigation ───────────────────────────────────────────────────────

function onKeyDown(e) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close'); return }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIdx.value = Math.min(activeIdx.value + 1, results.value.length - 1)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIdx.value = Math.max(activeIdx.value - 1, 0)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = results.value[activeIdx.value]
    if (cmd) run(cmd)
    return
  }
}

function run(cmd) {
  emit('close')
  // Defer action so the palette is gone before any side-effects run
  setTimeout(() => cmd.action?.(), 16)
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

.cp-search-icon {
  color: var(--text-muted, #8c8c8c);
  flex-shrink: 0;
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
}
.cp-input::placeholder { color: var(--text-muted, #666); }

.cp-hint {
  font-size: 11px;
  color: var(--text-muted, #666);
  flex-shrink: 0;
  font-family: monospace;
}

/* ── Results list ──────────────────────────────────────────────────────────── */
.cp-results {
  overflow-y: auto;
  max-height: 380px;
  padding: 4px 0;
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
}
.cp-item--active { background: var(--accent, #094771); }

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

.cp-item-category {
  font-size: 11px;
  color: var(--text-muted, #8c8c8c);
  white-space: nowrap;
  flex-shrink: 0;
}

.cp-empty {
  padding: 16px 14px;
  font-size: 13px;
  color: var(--text-muted, #666);
}

/* ── Transition ────────────────────────────────────────────────────────────── */
.cp-enter-active, .cp-leave-active { transition: opacity 0.1s, transform 0.1s; }
.cp-enter-from, .cp-leave-to { opacity: 0; transform: translateY(-6px); }
.cp-enter-to, .cp-leave-from { opacity: 1; transform: translateY(0); }
</style>
