<template>
  <div class="ks-root">
    <!-- Top search bar -->
    <div class="ks-search-row">
      <svg class="ks-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
        <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
      </svg>
      <input
        ref="searchRef"
        v-model="searchQuery"
        class="ks-search-input"
        placeholder="Search keybindings"
        autocomplete="off"
        spellcheck="false"
        @keydown.stop
      />
      <button v-if="searchQuery" class="ks-search-clear" @click="searchQuery = ''">✕</button>
    </div>

    <!-- Table header -->
    <div class="ks-table-head">
      <div class="ks-col-command">Command</div>
      <div class="ks-col-keybinding">Keybinding</div>
      <div class="ks-col-when">When</div>
      <div class="ks-col-source">Source</div>
    </div>

    <!-- Rows -->
    <div class="ks-table-body" @keydown.stop>
      <div v-if="filteredGroups.length === 0" class="ks-no-results">
        No keybindings found for "{{ searchQuery }}"
      </div>

      <template v-for="(group, gi) in filteredGroups" :key="gi">
        <div class="ks-group-header">{{ group.label }}</div>
        <div
          v-for="(sc, i) in group.shortcuts"
          :key="i"
          class="ks-row"
          :class="{ 'ks-row--alt': i % 2 === 1 }"
        >
          <div class="ks-col-command">{{ sc.command }}</div>
          <div class="ks-col-keybinding">
            <span v-for="(chord, ci) in sc.keys" :key="ci" class="ks-key-group">
              <kbd v-for="(k, ki) in chord" :key="ki" class="ks-key">{{ k }}</kbd>
              <span v-if="ci < sc.keys.length - 1" class="ks-chord-sep">then</span>
            </span>
            <span v-if="sc.keys.length === 0" class="ks-unbound">—</span>
          </div>
          <div class="ks-col-when ks-when-text">{{ sc.when ?? '' }}</div>
          <div class="ks-col-source ks-source-text">{{ sc.source ?? 'Built-in' }}</div>
        </div>
      </template>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, nextTick, inject } from 'vue'
import { formatChord } from '~/composables/activity/useKeybindingRegistry.js'

// Read-only viewer over the live command + keybinding registries. Every command
// is listed (grouped by its category); a command with multiple bindings produces
// one row per binding (e.g. Focus Editor Group → Ctrl+1…9), an unbound command a
// single row with no keybinding — mirroring VS Code's full keybindings list.
// Works in both presentations of the same EditorView: ModalHost binds `host` in;
// as a promoted editor tab it isn't bound, so we fall back to `viewCtx` (the host).
const props = defineProps({
  host: { type: Object, default: null },
})
// Honor the `host` prop only when it really is the host (ModalHost binds it). In a
// promoted tab, TabContentHost's props hook passes the tab object instead, so fall
// back to the injected host.
const ctx = (props.host?.facade ? props.host : null) ?? inject('viewCtx', null)

const searchRef  = ref(null)
const searchQuery = ref('')

onMounted(async () => {
  await nextTick()
  searchRef.value?.focus()
})

// ── Live rows from the registries ─────────────────────────────────────────────
// One row per (command × binding); `keys` is an array of chords, each chord an
// array of display tokens. `when` flags conditionally-enabled commands (our
// predicate `when()` can't be stringified, so we show a generic marker).
const rows = computed(() => {
  const { commands, keybindings } = ctx.facade
  const out = []
  for (const cmd of commands.list()) {
    const binds = keybindings.forCommand(cmd.id)
    const base = {
      command:  cmd.title,
      category: cmd.category || 'Other',
      when:     cmd.when ? 'contextual' : '',
      source:   'Built-in',
    }
    if (binds.length) {
      for (const b of binds) out.push({ ...base, keys: [formatChord(b.chord)] })
    } else {
      out.push({ ...base, keys: [] })
    }
  }
  return out
})

function matches(sc, q) {
  return sc.command.toLowerCase().includes(q) ||
    sc.keys.flat().join(' ').toLowerCase().includes(q) ||
    sc.category.toLowerCase().includes(q)
}

// Group rows by category, filtered by the search query; groups sorted
// alphabetically and rows within a group by command title.
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const byCategory = new Map()
  for (const sc of rows.value) {
    if (q && !matches(sc, q)) continue
    if (!byCategory.has(sc.category)) byCategory.set(sc.category, [])
    byCategory.get(sc.category).push(sc)
  }
  return [...byCategory.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([label, shortcuts]) => ({
      label,
      shortcuts: shortcuts.sort((a, b) => a.command.localeCompare(b.command)),
    }))
})
</script>

<style scoped>
.ks-root {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

/* ── Search row ────────────────────────────────────────────────────────────── */
.ks-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #454545);
  flex-shrink: 0;
}

.ks-search-icon { color: var(--text-muted, #8c8c8c); flex-shrink: 0; }

.ks-search-input {
  flex: 1;
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border, #454545);
  outline: none;
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  padding: 4px 8px;
  min-width: 0;
  height: 26px;
}
.ks-search-input:focus { border-color: var(--accent, #0078d4); }

.ks-search-clear {
  background: none;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  flex-shrink: 0;
}
.ks-search-clear:hover { color: var(--text, #ccc); }

/* ── Table header ──────────────────────────────────────────────────────────── */
.ks-table-head {
  display: grid;
  grid-template-columns: 2fr 1.4fr 1fr 0.7fr;
  padding: 0 16px;
  height: 28px;
  align-items: center;
  border-bottom: 1px solid var(--border, #454545);
  flex-shrink: 0;
}

.ks-table-head > div {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* ── Table body ────────────────────────────────────────────────────────────── */
.ks-table-body {
  flex: 1;
  overflow-y: auto;
}

.ks-no-results {
  padding: 40px 24px;
  color: var(--text-muted, #888);
  font-size: 13px;
}

.ks-group-header {
  padding: 10px 16px 6px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-muted, #888);
  text-transform: uppercase;
  letter-spacing: 0.06em;
  position: sticky;
  top: 0;
  background: var(--sidebar-bg, #252526);
  z-index: 1;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}

/* ── Row ───────────────────────────────────────────────────────────────────── */
.ks-row {
  display: grid;
  grid-template-columns: 2fr 1.4fr 1fr 0.7fr;
  padding: 0 16px;
  height: 32px;
  align-items: center;
}
.ks-row:hover { background: var(--hover, rgba(255,255,255,0.05)); }
.ks-row--alt  { background: rgba(0, 0, 0, 0.08); }
.ks-row--alt:hover { background: var(--hover, rgba(255,255,255,0.05)); }

.ks-col-command {
  font-size: 13px;
  color: var(--text, #ccc);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 12px;
}

.ks-col-keybinding {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}

.ks-key-group {
  display: flex;
  align-items: center;
  gap: 2px;
}

.ks-key {
  display: inline-block;
  padding: 1px 5px;
  font-size: 11px;
  font-family: monospace;
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border-subtle, #555);
  border-bottom-width: 2px;
  border-radius: 3px;
  color: var(--text, #ccc);
  line-height: 1.5;
}

.ks-chord-sep {
  font-size: 10px;
  color: var(--text-muted, #777);
  margin: 0 2px;
}

.ks-unbound {
  font-size: 12px;
  color: var(--text-muted, #666);
}

.ks-when-text {
  font-size: 12px;
  color: var(--text-muted, #888);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  padding-right: 8px;
}

.ks-source-text {
  font-size: 12px;
  color: var(--text-muted, #666);
}
</style>
