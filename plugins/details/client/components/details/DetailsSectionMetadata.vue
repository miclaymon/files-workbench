<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="isAudio"
    na-message="No media tags available for this file type."
    :rows="rows"
    :loading="loading"
    :error="error"
    empty-message="No tags embedded in this file."
  >
    <template v-if="isAudio" #extra>
      <div class="dsmd-rating-row">
        <span class="dsmd-rating-label">Rating</span>
        <div class="dsmd-rating">
          <button v-for="i in 5" :key="i"
                  class="dsmd-star" :class="{ 'dsmd-star--on': i <= rating }"
                  @click="rating = (rating === i ? 0 : i)"
                  :title="`${i} star${i > 1 ? 's' : ''}`">★</button>
        </div>
      </div>
    </template>
  </DetailsRows>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import DetailsRows from './DetailsRows.vue'
import { API_BASE, API_V } from '@workbench/plugin-sdk'

const AUDIO_EXTS = new Set(['mp3','m4a','m4b','m4p','flac','ogg','opus','aac','wav','aiff','aif','wma','dsf','alac'])

const props = defineProps({
  selectedPath: { type: String, default: '' },
})

const tags    = ref(null)
const loading = ref(false)
const error   = ref(false)
const rating  = ref(0)

const ext     = computed(() => props.selectedPath?.split('.').pop()?.toLowerCase() ?? '')
const isAudio = computed(() => AUDIO_EXTS.has(ext.value))

function trackStr(no, of) {
  if (!no) return null
  return of ? `${no} / ${of}` : String(no)
}

const rows = computed(() => {
  const t = tags.value
  if (!t) return []
  return [
    { key: 'title',        label: 'Title',        value: t.title        || null },
    { key: 'artist',       label: 'Artist',       value: t.artist       || null },
    { key: 'album',        label: 'Album',        value: t.album        || null },
    { key: 'album_artist', label: 'Album Artist', value: t.album_artist || null },
    { key: 'year',         label: 'Year',         value: t.year         || null },
    { key: 'genre',        label: 'Genre',        value: t.genre        || null },
    { key: 'composer',     label: 'Composer',     value: t.composer     || null },
    { key: 'track',        label: 'Track',        value: trackStr(t.track_no, t.track_of) },
    { key: 'disc',         label: 'Disc',         value: trackStr(t.disc_no, t.disc_of) },
    { key: 'comment',      label: 'Comment',      value: t.comment      || null },
  ]
})

watch(() => props.selectedPath, async (path) => {
  tags.value  = null
  error.value = false
  rating.value = 0
  if (!path || !isAudio.value) return

  loading.value = true
  try {
    const r = await fetch(`${API_BASE}/_api/${API_V}/media/audio_tags?path=${encodeURIComponent(path)}`)
    if (r.ok) tags.value = await r.json()
    else      error.value = true
  } catch { error.value = true }
  finally   { loading.value = false }
}, { immediate: true })
</script>

<style scoped>
.dsmd-rating-row {
  display: grid;
  grid-template-columns: 80px 1fr;
  gap: 8px;
  padding: 4px 6px;
  background: var(--surface, rgba(255,255,255,0.02));
  border-top: 1px solid var(--border, rgba(255,255,255,0.04));
  align-items: center;
}

.dsmd-rating-label {
  font-size: 11px;
  color: var(--text-muted);
  white-space: nowrap;
}

.dsmd-rating {
  display: flex;
  gap: 2px;
}

.dsmd-star {
  background: none;
  border: none;
  padding: 0;
  font-size: 15px;
  color: var(--text-muted);
  cursor: pointer;
  line-height: 1;
  transition: color 0.1s;

  &:hover,
  &.dsmd-star--on { color: var(--accent, #f0a500); }
}
</style>
