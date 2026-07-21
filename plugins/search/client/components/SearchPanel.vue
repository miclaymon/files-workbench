<template>
  <div class="sp">
    <!-- Query input -->
    <div class="sp-input-row">
      <svg class="sp-input-icon" width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiMagnify" /></svg>
      <input
        ref="inputRef"
        v-model="query"
        class="sp-input"
        type="text"
        placeholder="Search files by name…"
        spellcheck="false"
        @keydown.down.prevent="move(1)"
        @keydown.up.prevent="move(-1)"
        @keydown.enter.prevent="openFocused"
        @keydown.esc="query = ''"
      />
      <button v-if="query" class="sp-clear" title="Clear" @click="query = ''; focusInput()">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiClose" /></svg>
      </button>
    </div>

    <!-- Filters -->
    <div class="sp-filters">
      <button class="sp-chip" :class="{ 'sp-chip--on': filesOnly }" @click="toggleFilter('files')">Files</button>
      <button class="sp-chip" :class="{ 'sp-chip--on': dirsOnly }" @click="toggleFilter('dirs')">Folders</button>
      <span class="sp-spacer" />
      <span v-if="page && query" class="sp-count">{{ page.total }} result{{ page.total === 1 ? '' : 's' }}<span v-if="page.tookMs != null" class="sp-took"> · {{ page.tookMs }}ms</span></span>
    </div>

    <!-- Status / state banners -->
    <div v-if="unavailable" class="sp-state sp-state--warn">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiAlertOutline" /></svg>
      <div>
        <div>Search index unavailable.</div>
        <div class="sp-state-sub">The index service isn't running (set <code>FW_INDEX_ROOTS</code>).</div>
      </div>
    </div>
    <div v-else-if="indexing" class="sp-state">
      <span class="sp-spinner" />
      <div>Building index… <span class="sp-state-sub">{{ status?.fileCount?.toLocaleString?.() ?? 0 }} files so far</span></div>
    </div>

    <!-- Results -->
    <div v-if="!unavailable" class="sp-results" role="listbox">
      <div v-if="!query" class="sp-empty">Type to search indexed files.</div>
      <div v-else-if="loading && !results.length" class="sp-empty">Searching…</div>
      <div v-else-if="!results.length" class="sp-empty">No matches for “{{ query }}”.</div>

      <button
        v-for="(r, i) in results"
        :key="r.path"
        class="sp-row"
        :class="{ 'sp-row--focused': i === focusIdx }"
        role="option"
        :aria-selected="i === focusIdx"
        :title="r.path"
        @click="open(r)"
        @mousemove="focusIdx = i"
      >
        <span class="sp-row-icon">
          <ResolvedIcon
            v-if="iconFor(r) && !failedIcons.has(r.path)"
            :result="iconFor(r)" :size="16" icon-class="sp-pack-icon"
            @fail="failedIcons.add(r.path)"
          />
          <svg v-else width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path :d="mdiFallback(r)" /></svg>
        </span>
        <span class="sp-row-main">
          <span class="sp-row-name">{{ r.name }}</span>
          <span class="sp-row-path">{{ parentOf(r.path) }}</span>
        </span>
      </button>

      <button v-if="page && page.nextOffset >= 0 && results.length" class="sp-more" @click="loadMore">
        Show more
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from 'vue'
import { mdiMagnify, mdiClose, mdiAlertOutline, mdiFolder, mdiFile } from '@mdi/js'
import { searchIndex, indexStatus, subscribeIndex, useIconRegistry, ResolvedIcon } from '@workbench/plugin-sdk'

// The Search panel: query the filesystem index and open results. `api` is the
// plugin's permission-scoped Workbench API (needs `editor` to open tabs).
const props = defineProps({ api: { type: Object, required: true } })

const PAGE_SIZE = 100
const DEBOUNCE_MS = 200

const inputRef = ref(null)
const query = ref('')
const filesOnly = ref(false)
const dirsOnly = ref(false)

const page = ref(null)
const results = ref([])
const loading = ref(false)
const focusIdx = ref(0)
const failedIcons = ref(new Set())

const status = ref(null)
const unavailable = ref(false)
const indexing = computed(() => status.value?.state === 'building')

const { resolveIcon } = useIconRegistry()

let debounceTimer = null
let inFlight = null // AbortController for the current request

function focusInput() { nextTick(() => inputRef.value?.focus()) }

function toggleFilter(which) {
  if (which === 'files') { filesOnly.value = !filesOnly.value; if (filesOnly.value) dirsOnly.value = false }
  else { dirsOnly.value = !dirsOnly.value; if (dirsOnly.value) filesOnly.value = false }
}

function buildQuery(offset = 0) {
  return {
    text: query.value.trim(),
    match: 'substring',
    filesOnly: filesOnly.value,
    dirsOnly: dirsOnly.value,
    sort: 'relevance',
    limit: PAGE_SIZE,
    offset,
  }
}

async function run(offset = 0) {
  const text = query.value.trim()
  if (!text) {
    page.value = null
    results.value = []
    return
  }
  inFlight?.abort()
  inFlight = new AbortController()
  loading.value = true
  try {
    const res = await searchIndex(buildQuery(offset), { signal: inFlight.signal })
    unavailable.value = false
    if (offset === 0) {
      results.value = res.results
      focusIdx.value = 0
    } else {
      results.value = results.value.concat(res.results)
    }
    page.value = res
  } catch (e) {
    if (e.name === 'AbortError') return
    if (String(e.message).includes('unavailable')) unavailable.value = true
    if (offset === 0) { results.value = []; page.value = null }
  } finally {
    loading.value = false
  }
}

function loadMore() {
  if (page.value && page.value.nextOffset >= 0) run(page.value.nextOffset)
}

// Debounced re-query on input / filter change.
watch([query, filesOnly, dirsOnly], () => {
  clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => run(0), DEBOUNCE_MS)
})

// ── Icons ───────────────────────────────────────────────────────────────────
function iconFor(r) {
  return resolveIcon({ path: r.path, name: r.name, isDir: r.isDir, kind: r.isDir ? 'directory' : 'file', activityName: 'search' })
}
function mdiFallback(r) { return r.isDir ? mdiFolder : mdiFile }

// ── Navigation ──────────────────────────────────────────────────────────────
function parentOf(p) {
  const i = p.lastIndexOf('/')
  return i > 0 ? p.slice(0, i) : p
}
function baseName(p) {
  const i = p.lastIndexOf('/')
  return i >= 0 ? p.slice(i + 1) : p
}

// Open a result: a folder opens as a directory tab; a file reveals in its parent
// directory with the file selected.
function open(r) {
  if (r.isDir) {
    props.api.editor.openTab('dir', { title: r.name, params: { path: r.path } })
  } else {
    const parent = parentOf(r.path)
    props.api.editor.openTab('dir', {
      title: baseName(parent),
      params: { path: parent, selectedPath: r.path, selectedItems: [{ name: r.name, path: r.path }], focusedItem: { name: r.name, path: r.path, type: 'file' } },
    })
  }
}

function move(delta) {
  if (!results.value.length) return
  const n = results.value.length
  focusIdx.value = (focusIdx.value + delta + n) % n
  nextTick(() => document.querySelector('.sp-row--focused')?.scrollIntoView({ block: 'nearest' }))
}
function openFocused() {
  const r = results.value[focusIdx.value]
  if (r) open(r)
}

// ── Index status + live updates ──────────────────────────────────────────────
let stopSub = null
let statusTimer = null

async function refreshStatus() {
  try {
    status.value = await indexStatus()
    unavailable.value = false
  } catch (e) {
    if (String(e.message).includes('unavailable')) unavailable.value = true
  }
}

onMounted(() => {
  focusInput()
  refreshStatus()
  // Poll status while the index is still building so the banner clears itself.
  statusTimer = setInterval(() => { if (indexing.value || !status.value) refreshStatus() }, 2000)
  // Live results: when the index changes, re-run the current query (debounced).
  stopSub = subscribeIndex(() => {
    if (!query.value.trim()) return
    clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => run(0), DEBOUNCE_MS)
  }, { onError: () => { /* SSE reconnects on its own; ignore */ } })
})

onBeforeUnmount(() => {
  clearTimeout(debounceTimer)
  clearInterval(statusTimer)
  inFlight?.abort()
  stopSub?.()
})
</script>

<style scoped>
.sp {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  user-select: none;
}

.sp-input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 8px;
  padding: 0 8px;
  background: var(--input-bg, rgba(255, 255, 255, 0.06));
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.1));
  border-radius: 4px;
}
.sp-input-row:focus-within { border-color: var(--accent-color, #4a9eff); }
.sp-input-icon { flex: none; opacity: 0.6; }
.sp-input {
  flex: 1;
  min-width: 0;
  padding: 6px 0;
  border: none;
  background: transparent;
  color: inherit;
  font-size: 13px;
  outline: none;
}
.sp-clear {
  flex: none; display: flex; align-items: center;
  padding: 2px; border: none; background: transparent;
  color: inherit; opacity: 0.6; cursor: pointer; border-radius: 3px;
}
.sp-clear:hover { opacity: 1; background: rgba(255, 255, 255, 0.08); }

.sp-filters {
  display: flex; align-items: center; gap: 6px;
  margin: 0 8px 8px;
}
.sp-chip {
  padding: 2px 10px; font-size: 11px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  border-radius: 10px; background: transparent; color: inherit;
  opacity: 0.75; cursor: pointer;
}
.sp-chip:hover { opacity: 1; }
.sp-chip--on {
  opacity: 1;
  background: var(--accent-color, #4a9eff);
  border-color: var(--accent-color, #4a9eff);
  color: #fff;
}
.sp-spacer { flex: 1; }
.sp-count { font-size: 11px; opacity: 0.6; }
.sp-took { opacity: 0.7; }

.sp-state {
  display: flex; align-items: flex-start; gap: 8px;
  margin: 0 8px 8px; padding: 8px 10px;
  font-size: 12px; border-radius: 4px;
  background: rgba(255, 255, 255, 0.04);
}
.sp-state--warn { background: rgba(255, 180, 0, 0.1); }
.sp-state-sub { opacity: 0.6; font-size: 11px; margin-top: 2px; }
.sp-state code { font-size: 11px; opacity: 0.85; }

.sp-spinner {
  flex: none; width: 14px; height: 14px; margin-top: 1px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent-color, #4a9eff);
  border-radius: 50%;
  animation: sp-spin 0.7s linear infinite;
}
@keyframes sp-spin { to { transform: rotate(360deg); } }

.sp-results { flex: 1; min-height: 0; overflow-y: auto; }
.sp-empty { padding: 16px; font-size: 12px; opacity: 0.5; text-align: center; }

.sp-row {
  display: flex; align-items: center; gap: 8px; width: 100%;
  padding: 4px 10px; border: none; background: transparent;
  color: inherit; text-align: left; cursor: pointer;
}
.sp-row--focused { background: var(--hover-bg, rgba(255, 255, 255, 0.07)); }
.sp-row-icon { flex: none; display: flex; width: 16px; height: 16px; opacity: 0.9; }
.sp-row-main { flex: 1; min-width: 0; display: flex; flex-direction: column; line-height: 1.25; }
.sp-row-name {
  font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.sp-row-path {
  font-size: 11px; opacity: 0.5;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  direction: rtl; text-align: left; /* keep the meaningful tail of long paths visible */
}
.sp-more {
  display: block; width: calc(100% - 20px); margin: 6px 10px;
  padding: 6px; font-size: 12px; border-radius: 4px;
  border: 1px solid var(--border-color, rgba(255, 255, 255, 0.12));
  background: transparent; color: inherit; opacity: 0.8; cursor: pointer;
}
.sp-more:hover { opacity: 1; background: rgba(255, 255, 255, 0.05); }
</style>
