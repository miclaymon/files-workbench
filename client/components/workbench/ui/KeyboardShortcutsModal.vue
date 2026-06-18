<template>
  <Teleport to="body">
    <Transition name="ks">
      <div v-if="visible" class="ks-backdrop" @mousedown.self="$emit('close')">
        <div class="ks-dialog" role="dialog" aria-label="Keyboard Shortcuts">

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
            <button class="ks-close-btn" title="Close (Esc)" @click="$emit('close')" @keydown.stop>
              <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                <path d="M19,6.41L17.59,5L12,10.59L6.41,5L5,6.41L10.59,12L5,17.59L6.41,19L12,13.41L17.59,19L19,17.59L13.41,12L19,6.41Z" />
              </svg>
            </button>
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
            <div v-if="filteredShortcuts.length === 0" class="ks-no-results">
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
                </div>
                <div class="ks-col-when ks-when-text">{{ sc.when ?? '' }}</div>
                <div class="ks-col-source ks-source-text">{{ sc.source ?? 'Default' }}</div>
              </div>
            </template>
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'

const props = defineProps({
  visible: { type: Boolean, required: true },
})
defineEmits(['close'])

const searchRef  = ref(null)
const searchQuery = ref('')

watch(() => props.visible, async (v) => {
  if (v) {
    searchQuery.value = ''
    await nextTick()
    searchRef.value?.focus()
  }
})

// ── Shortcut definitions ──────────────────────────────────────────────────────
// keys: array of chords; each chord is an array of key tokens

const SHORTCUT_GROUPS = [
  {
    label: 'General',
    shortcuts: [
      { command: 'Command Palette',       keys: [['Ctrl', 'Shift', 'P']], when: 'Always' },
      { command: 'Settings',              keys: [['Ctrl', ',']], when: 'Always' },
    ],
  },
  {
    label: 'Editing',
    shortcuts: [
      { command: 'Undo',                  keys: [['Ctrl', 'Z']] },
      { command: 'Redo',                  keys: [['Ctrl', 'Y']] },
      { command: 'Copy',                  keys: [['Ctrl', 'C']] },
      { command: 'Cut',                   keys: [['Ctrl', 'X']] },
      { command: 'Paste',                 keys: [['Ctrl', 'V']] },
      { command: 'Select All',            keys: [['Ctrl', 'A']], when: 'Directory focused' },
    ],
  },
  {
    label: 'Files',
    shortcuts: [
      { command: 'Rename',                keys: [['F2']],              when: 'File selected' },
      { command: 'Move to Trash',         keys: [['Delete']],          when: 'File selected' },
      { command: 'Delete Permanently',    keys: [['Shift', 'Delete']], when: 'File selected' },
    ],
  },
  {
    label: 'View',
    shortcuts: [
      { command: 'Zoom In',               keys: [['Ctrl', '+']], when: 'Directory focused' },
      { command: 'Zoom Out',              keys: [['Ctrl', '-']], when: 'Directory focused' },
      { command: 'Reset Zoom',            keys: [['Ctrl', '0']], when: 'Directory focused' },
    ],
  },
  {
    label: 'Editor',
    shortcuts: [
      { command: 'Split Editor Right',    keys: [['Ctrl', '\\']] },
      { command: 'Close Tab',             keys: [['Ctrl', 'W']] },
      { command: 'Focus Editor Group 1',  keys: [['Ctrl', '1']] },
      { command: 'Focus Editor Group 2',  keys: [['Ctrl', '2']] },
      { command: 'Focus Editor Group 3',  keys: [['Ctrl', '3']] },
      { command: 'Focus Editor Group 4',  keys: [['Ctrl', '4']] },
      { command: 'Focus Editor Group 5',  keys: [['Ctrl', '5']] },
    ],
  },
]

// ── Filtered view ─────────────────────────────────────────────────────────────

const filteredShortcuts = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return SHORTCUT_GROUPS.flatMap(g => g.shortcuts)
  return SHORTCUT_GROUPS.flatMap(g =>
    g.shortcuts.filter(sc =>
      sc.command.toLowerCase().includes(q) ||
      sc.keys.flat().join(' ').toLowerCase().includes(q) ||
      (sc.when ?? '').toLowerCase().includes(q)
    )
  )
})

const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return SHORTCUT_GROUPS
  return SHORTCUT_GROUPS
    .map(g => ({
      ...g,
      shortcuts: g.shortcuts.filter(sc =>
        sc.command.toLowerCase().includes(q) ||
        sc.keys.flat().join(' ').toLowerCase().includes(q) ||
        (sc.when ?? '').toLowerCase().includes(q)
      ),
    }))
    .filter(g => g.shortcuts.length > 0)
})
</script>

<style scoped>
/* ── Backdrop ──────────────────────────────────────────────────────────────── */
.ks-backdrop {
  position: fixed;
  inset: 0;
  z-index: 8000;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
}

/* ── Dialog ────────────────────────────────────────────────────────────────── */
.ks-dialog {
  width: min(860px, 90vw);
  height: min(640px, 88vh);
  background: var(--sidebar-bg, #252526);
  border: 1px solid var(--border, #454545);
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.6);
  display: flex;
  flex-direction: column;
  overflow: hidden;
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

.ks-close-btn {
  background: none;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  padding: 3px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-left: 4px;
}
.ks-close-btn:hover { color: var(--text, #ccc); background: var(--hover, rgba(255,255,255,0.07)); }

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

/* ── Transition ────────────────────────────────────────────────────────────── */
.ks-enter-active, .ks-leave-active { transition: opacity 0.12s, transform 0.12s; }
.ks-enter-from, .ks-leave-to { opacity: 0; transform: scale(0.97); }
</style>
