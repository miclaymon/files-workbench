<template>
  <div class="dr">
    <p v-if="!selected" class="dr-note">No file selected</p>
    <p v-else-if="!applies" class="dr-note">{{ naMessage }}</p>
    <div v-else-if="loading" class="dr-loading">
      <span v-for="n in shimmerCount" :key="n" class="dr-shimmer" />
    </div>
    <p v-else-if="error" class="dr-note">{{ errorMessage }}</p>
    <template v-else>
      <dl v-if="filteredRows.length" class="dr-rows">
        <div v-for="row in filteredRows" :key="row.key ?? row.label" class="dr-row">
          <dt>{{ row.label }}</dt>
          <dd>{{ Array.isArray(row.value) ? row.value.join(', ') : row.value }}</dd>
        </div>
      </dl>
      <p v-else class="dr-note">{{ emptyMessage }}</p>
      <slot name="extra" />
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'

const props = defineProps({
  selected:     { type: Boolean, default: false },
  applies:      { type: Boolean, default: true },
  rows:         { type: Array,   default: () => [] },
  loading:      { type: Boolean, default: false },
  error:        { type: Boolean, default: false },
  shimmerCount: { type: Number,  default: 4 },
  naMessage:    { type: String,  default: 'Not available for this file type.' },
  errorMessage: { type: String,  default: 'Could not read metadata.' },
  emptyMessage: { type: String,  default: 'No data found in this file.' },
})

const filteredRows = computed(() =>
  (props.rows ?? []).filter(r => r.value != null && r.value !== '')
)
</script>

<style scoped>
.dr {
  margin: 6px 10px 10px;
  border: 1px solid var(--border, rgba(255,255,255,0.04));
}

.dr-note {
  padding: 6px 8px;
  margin: 0;
  font-size: 12px;
  color: var(--text-muted);
  font-style: italic;
}

/* ── Loading shimmer ───────────────────────────────────────────────────────── */

.dr-loading {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}

.dr-shimmer {
  display: block;
  height: 12px;
  border-radius: 3px;
  background: linear-gradient(
    90deg,
    var(--surface-alt, rgba(255,255,255,0.06)) 25%,
    var(--hover-background, rgba(255,255,255,0.1)) 50%,
    var(--surface-alt, rgba(255,255,255,0.06)) 75%
  );
  background-size: 200% 100%;
  animation: dr-shimmer 1.4s infinite;

  /* Staggered widths cycling through 5 positions */
  &:nth-child(5n+1) { width: 85%; }
  &:nth-child(5n+2) { width: 65%; }
  &:nth-child(5n+3) { width: 75%; }
  &:nth-child(5n+4) { width: 55%; }
  &:nth-child(5n)   { width: 70%; }
}

@keyframes dr-shimmer {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Rows table ────────────────────────────────────────────────────────────── */

.dr-rows {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
}

.dr-row {
  display: grid;
  grid-template-columns: var(--dr-label-width, 80px) 1fr;
  gap: 8px;
  padding: 4px 6px;
  background: var(--surface, rgba(255,255,255,0.02));
  border-bottom: 1px solid var(--border, rgba(255,255,255,0.04));
  align-items: baseline;

  &:last-child { border-bottom: none; }

  dt {
    font-size: 11px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  dd {
    font-size: 12px;
    color: var(--text);
    margin: 0;
    word-break: break-word;
    white-space: pre-wrap;
  }
}
</style>
