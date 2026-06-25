<template>
  <div class="dbg" ref="containerEl">
    <div v-if="visibleEntries.length === 0" class="dbg-empty">
      {{ entries.length ? 'No events at this level.' : 'No events yet.' }}
    </div>
    <div
      v-for="entry in visibleEntries"
      :key="entry.id"
      class="dbg-row"
      :class="[`dbg-row--lvl-${entry.level}`, { 'dbg-row--expandable': isExpandable(entry), 'dbg-row--expanded': expanded.has(entry.id) }]"
      @click="isExpandable(entry) && toggle(entry.id)"
    >
      <!-- Main row -->
      <div class="dbg-main">
        <span class="dbg-chevron" v-if="isExpandable(entry)">
          {{ expanded.has(entry.id) ? '▾' : '▸' }}
        </span>
        <span v-else class="dbg-chevron dbg-chevron--placeholder" />
        <span class="dbg-time">{{ entry.time }}</span>
        <span class="dbg-level" :class="`dbg-level--${entry.level}`" :title="entry.level">{{ LEVEL_ABBR[entry.level] ?? '—' }}</span>
        <span class="dbg-cat" :class="`dbg-cat--${entry.category}`">{{ entry.category }}</span>
        <span class="dbg-msg">{{ entry.message }}</span>
        <span v-if="summaryText(entry)" class="dbg-data">{{ summaryText(entry) }}</span>
      </div>

      <!-- Expanded detail -->
      <div v-if="expanded.has(entry.id) && isExpandable(entry)" class="dbg-detail">
        <!-- Item table (select/clipboard rich format) -->
        <template v-if="entry.data?._type === 'item-table'">
          <div class="dbg-itbl">
            <div class="dbg-itbl-hdr">
              <span></span>
              <span>Name</span>
              <span>Type</span>
              <span class="dbg-itbl-size">Size</span>
            </div>
            <div
              v-for="item in entry.data.items"
              :key="item.path ?? item.name"
              class="dbg-itbl-row"
            >
              <!-- Icon / thumbnail -->
              <span class="dbg-itbl-icon">
                <img
                  v-if="item.thumbnail && !failedThumbs.has(item.path ?? item.name)"
                  :src="item.thumbnail"
                  class="dbg-thumb"
                  width="14"
                  height="14"
                  @error="onThumbError(item.path ?? item.name)"
                />
                <svg v-else width="14" height="14" viewBox="0 0 24 24" :fill="itemIconColor(item)">
                  <path :d="itemIconPath(item)" />
                </svg>
              </span>
              <!-- Name -->
              <span class="dbg-itbl-name" :title="item.path">{{ item.name }}</span>
              <!-- Type -->
              <span class="dbg-itbl-type">{{ itemType(item) }}</span>
              <!-- Size -->
              <span class="dbg-itbl-size">{{ item.size != null ? fmtBytes(item.size) : '—' }}</span>
            </div>
          </div>
        </template>

        <!-- Array data -->
        <template v-else-if="Array.isArray(entry.data)">
          <div v-for="(item, i) in entry.data" :key="i" class="dbg-detail-row">
            <span class="dbg-detail-idx">{{ i }}</span>
            <span class="dbg-detail-val">{{ formatVal(item) }}</span>
          </div>
        </template>

        <!-- Object key-value data -->
        <template v-else-if="typeof entry.data === 'object' && entry.data !== null">
          <div v-for="[k, v] in Object.entries(entry.data)" :key="k" class="dbg-detail-row">
            <span class="dbg-detail-key">{{ k }}</span>
            <span class="dbg-detail-val">{{ formatVal(v) }}</span>
          </div>
        </template>

        <!-- Plain string -->
        <template v-else>
          <div class="dbg-detail-row">
            <span class="dbg-detail-val">{{ entry.data }}</span>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, nextTick } from 'vue'
import { useDebugLog } from '~/composables/useDebugLog.js'
import {
  mdiFolder, mdiFile, mdiZipBox, mdiApplicationOutline,
  mdiImage, mdiFilm, mdiMusicNote, mdiCodeBraces, mdiFilePdfBox,
} from '@mdi/js'

const { entries, visibleEntries } = useDebugLog()
const containerEl = ref(null)
const expanded     = ref(new Set())
const failedThumbs = ref(new Set())

// Short level tags shown per row (full level is in the title attribute).
const LEVEL_ABBR = { debug: 'DBG', info: 'INF', warning: 'WRN', error: 'ERR' }

function onThumbError(key) {
  failedThumbs.value = new Set([...failedThumbs.value, key])
}

// ── Item table helpers ────────────────────────────────────────────────────────

const IMAGE_EXTS = new Set(['jpg','jpeg','png','gif','webp','avif','bmp','tiff','tif','svg','ico'])
const VIDEO_EXTS = new Set(['mp4','webm','mkv','avi','mov','m4v','flv','wmv','ts','mpeg','mpg'])
const AUDIO_EXTS = new Set(['mp3','m4a','flac','ogg','opus','aac','wav','aiff','wma'])
const CODE_EXTS  = new Set(['js','ts','jsx','tsx','vue','py','go','rs','java','c','cpp','h','css','html','json','yaml','yml','toml','sh','bash','zsh','fish'])

function ext(item) { return item.name?.split('.').pop()?.toLowerCase() ?? '' }

function itemIconPath(item) {
  if (item.kind === 'dir')     return mdiFolder
  if (item.kind === 'archive') return mdiZipBox
  if (item.kind === 'app')     return mdiApplicationOutline
  const e = ext(item)
  if (e === 'pdf')             return mdiFilePdfBox
  if (IMAGE_EXTS.has(e))      return mdiImage
  if (VIDEO_EXTS.has(e))      return mdiFilm
  if (AUDIO_EXTS.has(e))      return mdiMusicNote
  if (CODE_EXTS.has(e))       return mdiCodeBraces
  return mdiFile
}

function itemIconColor(item) {
  if (item.kind === 'dir')     return '#64b5f6'
  if (item.kind === 'archive') return '#ffcc80'
  if (item.kind === 'app')     return '#a5d6a7'
  return 'currentColor'
}

function itemType(item) {
  if (item.kind === 'dir')     return 'Folder'
  if (item.kind === 'archive') return 'Archive'
  if (item.kind === 'app')     return 'App'
  const e = ext(item)
  return e ? e.toUpperCase() : 'File'
}

function fmtBytes(bytes) {
  if (!bytes) return '0 B'
  const units = ['B','KB','MB','GB','TB']
  let i = 0, v = bytes
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++ }
  return `${v < 10 ? v.toFixed(1) : Math.round(v)} ${units[i]}`
}

// ── Expandable / summary ──────────────────────────────────────────────────────

function isExpandable(entry) {
  if (entry.data == null) return false
  if (entry.data?._type === 'item-table') return (entry.data.items?.length ?? 0) > 0
  if (typeof entry.data === 'object') return true
  if (typeof entry.data === 'string' && entry.data.length > 60) return true
  return false
}

function summaryText(entry) {
  const d = entry.data
  if (d == null) return null
  if (d?._type === 'item-table') {
    const n = d.items?.length ?? 0
    if (n === 0) return null
    if (n === 1) return d.items[0].name
    return d.items.slice(0, 2).map(i => i.name).join(', ') + (n > 2 ? ` +${n - 2}` : '')
  }
  if (typeof d === 'string') return d.length > 60 ? d.slice(0, 58) + '…' : d
  if (Array.isArray(d)) return `[${d.length} items]`
  if (typeof d === 'object') {
    if (d.to    != null) return d.to
    if (d.path  != null) return typeof d.path === 'string' ? d.path.split(/[/\\]/).pop() : String(d.path)
    if (d.count != null) return `${d.count} item${d.count === 1 ? '' : 's'}`
    if (d.name  != null) return d.name
    if (d.title != null) return d.title
    const first = Object.values(d)[0]
    return first != null ? String(first) : null
  }
  return String(d)
}

function formatVal(v) {
  if (v == null) return '—'
  if (Array.isArray(v)) return v.join('  ·  ')
  if (typeof v === 'object') {
    try { return JSON.stringify(v) } catch { return String(v) }
  }
  return String(v)
}

function toggle(id) {
  const next = new Set(expanded.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  expanded.value = next
}

// Auto-scroll to bottom when new entries arrive, only if already near the bottom
watch(visibleEntries, async () => {
  await nextTick()
  const el = containerEl.value
  if (!el) return
  const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 60
  if (atBottom) el.scrollTop = el.scrollHeight
}, { deep: false })
</script>

<style scoped>
.dbg {
  height: 100%;
  overflow-y: auto;
  font-family: 'Cascadia Code', 'Fira Mono', 'Consolas', monospace;
  font-size: 11.5px;
  line-height: 1.55;
  padding: 4px 0;
  background: var(--panel, #1e1e1e);
  color: var(--text-muted);
}

.dbg-empty {
  padding: 12px 14px;
  color: var(--text-muted);
  font-style: italic;
  opacity: 0.5;
}

/* ── Row ─────────────────────────────────────────────────────────────────── */
.dbg-row { padding: 0; }
.dbg-row--expandable .dbg-main { cursor: pointer; }
.dbg-row--expandable:hover .dbg-main { background: rgba(255,255,255,0.04); }
.dbg-row--expanded .dbg-main { background: rgba(255,255,255,0.03); }

.dbg-main {
  display: flex;
  align-items: baseline;
  gap: 6px;
  padding: 1px 8px 1px 4px;
  min-height: 18px;
}

/* ── Chevron ─────────────────────────────────────────────────────────────── */
.dbg-chevron {
  flex-shrink: 0;
  width: 12px;
  font-size: 9px;
  color: var(--text-muted);
  opacity: 0.5;
  user-select: none;
}
.dbg-chevron--placeholder { visibility: hidden; }

/* ── Timestamp ───────────────────────────────────────────────────────────── */
.dbg-time {
  flex-shrink: 0;
  color: var(--text-muted);
  opacity: 0.45;
  font-size: 10.5px;
  letter-spacing: 0.01em;
  user-select: none;
}

/* ── Level badge ─────────────────────────────────────────────────────────── */
.dbg-level {
  flex-shrink: 0;
  width: 30px;
  text-align: center;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.04em;
  border-radius: 3px;
  user-select: none;
}
.dbg-level--debug   { color: #90a4ae; background: rgba(144,164,174,0.14); }
.dbg-level--info    { color: #64b5f6; background: rgba(100,181,246,0.16); }
.dbg-level--warning { color: #ffb74d; background: rgba(255,183,77,0.18); }
.dbg-level--error   { color: #ef5350; background: rgba(239,83,80,0.20); }

/* Severity tint on the whole row for the louder levels. */
.dbg-row--lvl-warning .dbg-main { background: rgba(255,183,77,0.05); }
.dbg-row--lvl-error   .dbg-main { background: rgba(239,83,80,0.07); }

/* ── Category chip ───────────────────────────────────────────────────────── */
.dbg-cat {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0 5px;
  border-radius: 3px;
  width: 80px;
  text-align: center;
  user-select: none;
  margin-inline: 0.25rem;
}

.dbg-cat--nav        { background: rgba(38,198,218,0.18);  color: #26c6da; }
.dbg-cat--select     { background: rgba(100,181,246,0.18); color: #64b5f6; }
.dbg-cat--sort       { background: rgba(186,104,200,0.18); color: #ba68c8; }
.dbg-cat--filter     { background: rgba(255,183,77,0.18);  color: #ffb74d; }
.dbg-cat--layout     { background: rgba(129,199,132,0.18); color: #81c784; }
.dbg-cat--tab        { background: rgba(255,241,118,0.18); color: #fff176; }
.dbg-cat--zoom       { background: rgba(144,164,174,0.18); color: #90a4ae; }
.dbg-cat--rename     { background: rgba(239,154,154,0.18); color: #ef9a9a; }
.dbg-cat--clipboard  { background: rgba(255,204,128,0.18); color: #ffcc80; }
.dbg-cat--ops-queue  { background: rgba(165,214,167,0.18); color: #a5d6a7; }

/* ── Message ─────────────────────────────────────────────────────────────── */
.dbg-msg {
  flex: 1;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ── Inline data summary ─────────────────────────────────────────────────── */
.dbg-data {
  flex-shrink: 0;
  max-width: 42%;
  color: var(--text-muted);
  opacity: 0.6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: 10.5px;
}

/* ── Expanded detail wrapper ─────────────────────────────────────────────── */
.dbg-detail {
  margin: 0 0 3px 16px;
  padding: 4px 8px 4px 54px;
  border-left: 2px solid rgba(255,255,255,0.06);
  background: rgba(0,0,0,0.18);
}

/* ── Key-value / array rows ──────────────────────────────────────────────── */
.dbg-detail-row {
  display: flex;
  gap: 10px;
  padding: 1px 0;
  line-height: 1.5;
  min-height: 0;
}

.dbg-detail-key {
  flex-shrink: 0;
  min-width: 72px;
  color: var(--text-muted);
  opacity: 0.55;
  font-size: 10.5px;
}

.dbg-detail-idx {
  flex-shrink: 0;
  min-width: 18px;
  color: var(--text-muted);
  opacity: 0.4;
  font-size: 10px;
  text-align: right;
}

.dbg-detail-val {
  flex: 1;
  color: var(--text);
  word-break: break-all;
  white-space: pre-wrap;
  font-size: 11px;
  opacity: 0.85;
}

/* ── Item table ──────────────────────────────────────────────────────────── */
.dbg-itbl { padding: 2px 0; }

.dbg-itbl-hdr,
.dbg-itbl-row {
  display: grid;
  grid-template-columns: 18px 1fr 46px 58px;
  gap: 6px;
  align-items: center;
}

.dbg-itbl-hdr {
  font-size: 9.5px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  opacity: 0.35;
  padding-bottom: 3px;
  margin-bottom: 2px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
  user-select: none;
}

.dbg-itbl-row {
  padding: 2px 0;
  min-height: 20px;
}

.dbg-itbl-row:hover { background: rgba(255,255,255,0.03); }

.dbg-itbl-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  opacity: 0.85;
}

.dbg-thumb {
  display: block;
  width: 14px;
  height: 14px;
  object-fit: cover;
  border-radius: 2px;
}

.dbg-itbl-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  color: var(--text);
  opacity: 0.9;
}

.dbg-itbl-type {
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dbg-itbl-size {
  font-size: 10px;
  color: var(--text-muted);
  opacity: 0.55;
  text-align: right;
  white-space: nowrap;
}
</style>
