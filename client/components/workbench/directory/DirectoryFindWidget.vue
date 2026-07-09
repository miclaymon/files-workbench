<template>
  <div class="dfw" @keydown="onWidgetKey">

    <!-- Find row -->
    <div class="dfw-row">
      <button
        class="dfw-chevron"
        :class="{ 'dfw-chevron--open': showReplace }"
        title="Toggle Replace"
        @click="toggleReplace"
      >
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
          <path v-if="showReplace" d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/>
          <path v-else d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6-1.41-1.41z"/>
        </svg>
      </button>
      <input
        ref="findInputRef"
        class="dfw-input"
        type="text"
        placeholder="Find…"
        spellcheck="false"
        :value="query"
        @input="emit('update:query', $event.target.value)"
        @keydown="onFindKey"
      />
      <button class="dfw-btn" :class="{ 'dfw-btn--on': caseSensitive }" title="Match Case (Alt+C)" @click="emit('update:caseSensitive', !caseSensitive)">Aa</button>
      <button class="dfw-btn dfw-btn--ab" :class="{ 'dfw-btn--on': wholeWord }" title="Match Whole Word (Alt+W)" @click="emit('update:wholeWord', !wholeWord)">ab</button>
      <button class="dfw-btn" :class="{ 'dfw-btn--on': useRegex }" title="Use Regular Expression (Alt+R)" @click="emit('update:useRegex', !useRegex)">.*</button>
      <span class="dfw-count" :class="{ 'dfw-count--empty': !query }">
        {{ !query ? '' : matchCount === 0 ? 'No results' : `${Math.max(0, currentIdx) + 1} of ${matchCount}` }}
      </span>
      <button class="dfw-icon-btn" :disabled="matchCount === 0" title="Previous Match (Shift+Enter)" @click="emit('prev')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6z"/></svg>
      </button>
      <button class="dfw-icon-btn" :disabled="matchCount === 0" title="Next Match (Enter)" @click="emit('next')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>
      </button>
      <button class="dfw-icon-btn dfw-icon-btn--close" title="Close (Escape)" @click="emit('close')">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      </button>
    </div>

    <!-- Replace row -->
    <div v-if="showReplace" class="dfw-row dfw-replace-row">
      <div class="dfw-indent" />
      <input
        ref="replaceInputRef"
        class="dfw-input"
        type="text"
        placeholder="Replace…"
        spellcheck="false"
        v-model="replaceQuery"
        @keydown="onReplaceKey"
      />
      <button
        class="dfw-replace-btn"
        :disabled="matchCount === 0"
        title="Replace current match (Enter)"
        @click="emit('replace', replaceQuery)"
      >Replace</button>
      <button
        class="dfw-replace-btn"
        :disabled="matchCount === 0"
        title="Replace all matches"
        @click="emit('replace-all', replaceQuery)"
      >Replace All</button>
    </div>

  </div>
</template>

<script setup>
import { ref, nextTick, onMounted } from 'vue'

defineProps({
  query:         { type: String,  default: '' },
  caseSensitive: { type: Boolean, default: false },
  wholeWord:     { type: Boolean, default: false },
  useRegex:      { type: Boolean, default: false },
  matchCount:    { type: Number,  default: 0 },
  currentIdx:    { type: Number,  default: -1 },
})

const emit = defineEmits([
  'close', 'next', 'prev', 'replace', 'replace-all',
  'update:query', 'update:caseSensitive', 'update:wholeWord', 'update:useRegex',
])

const findInputRef    = ref(null)
const replaceInputRef = ref(null)
const showReplace     = ref(false)
const replaceQuery    = ref('')

onMounted(() => findInputRef.value?.focus())
defineExpose({ focus: () => findInputRef.value?.focus() })

function toggleReplace() {
  showReplace.value = !showReplace.value
  if (showReplace.value) nextTick(() => replaceInputRef.value?.focus())
  else nextTick(() => findInputRef.value?.focus())
}

function onWidgetKey(e) {
  e.stopPropagation()
}

function onFindKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
  else if (e.key === 'Enter') { e.preventDefault(); e.shiftKey ? emit('prev') : emit('next') }
}

function onReplaceKey(e) {
  if (e.key === 'Escape') { e.preventDefault(); emit('close') }
  else if (e.key === 'Enter') { e.preventDefault(); emit('replace', replaceQuery.value) }
}
</script>

<style scoped>
.dfw {
  display: flex;
  flex-direction: column;
  padding: 4px 6px;
  background: var(--surface-alt, #252526);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 6px 6px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  user-select: none;
  gap: 4px;
}

.dfw-row {
  display: flex;
  align-items: center;
  gap: 2px;
}

.dfw-replace-row {
  padding-top: 3px;
  border-top: 1px solid var(--border);
}

/* Chevron that toggles the replace row */
.dfw-chevron {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  flex-shrink: 0;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  padding: 0;
  transition: all 0.1s;

  &:hover { background: rgba(255,255,255,0.07); color: var(--text); }
  &--open { color: var(--text); }
}

/* Aligns the replace input with the find input above it */
.dfw-indent {
  width: 22px;
  flex-shrink: 0;
}

.dfw-input {
  background: var(--surface, #1e1e1e);
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text);
  font: inherit;
  font-size: 13px;
  height: 26px;
  width: 160px;
  padding: 0 6px;
  outline: none;
  flex-shrink: 0;

  &:focus { border-color: var(--accent); }
  &::placeholder { color: var(--text-muted); }
}

.dfw-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  font-size: 11px;
  font-family: monospace;
  padding: 0;
  transition: all 0.1s;

  &:hover { background: rgba(255,255,255,0.07); color: var(--text); }

  &--ab { text-decoration: underline; font-weight: 600; }
  &--on {
    background: color-mix(in srgb, var(--accent) 18%, transparent);
    border-color: color-mix(in srgb, var(--accent) 40%, transparent);
    color: var(--accent);
  }
}

.dfw-count {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 60px;
  text-align: center;
  white-space: nowrap;
  flex-shrink: 0;
  transition: opacity 0.1s;

  &.dfw-count--empty { opacity: 0; }
}

.dfw-icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: all 0.1s;

  &:hover { background: rgba(255,255,255,0.07); color: var(--text); }
  &:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
  &--close { margin-left: 2px; }
}

.dfw-replace-btn {
  background: transparent;
  border: 1px solid var(--border);
  border-radius: 3px;
  color: var(--text-muted);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  height: 24px;
  padding: 0 8px;
  white-space: nowrap;
  flex-shrink: 0;
  transition: all 0.1s;

  &:hover { background: rgba(255,255,255,0.07); color: var(--text); border-color: rgba(255,255,255,0.2); }
  &:disabled { opacity: 0.3; cursor: default; pointer-events: none; }
}
</style>
