<template>
  <span class="pending-value">
    <span :class="{ 'pv-pulse': pending }"><slot /></span>
    <svg v-if="pending" class="pv-spinner" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path :d="mdiLoading" />
    </svg>
  </span>
</template>

<script setup>
import { mdiLoading } from '@mdi/js'

// Wraps a value that is still being computed (e.g. a directory size mid-walk): the
// slotted value slowly pulses its opacity and a small spinner shows beside it while
// `pending`, signalling "not final — at least this much". Settles (no pulse/spinner)
// when pending flips false.
defineProps({ pending: { type: Boolean, default: false } })
</script>

<style scoped>
.pending-value { display: inline-flex; align-items: center; gap: 4px; }
.pv-pulse { animation: pv-pulse 1.6s ease-in-out infinite; }
.pv-spinner { flex-shrink: 0; opacity: 0.8; animation: pv-spin 0.9s linear infinite; }
@keyframes pv-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.42; } }
@keyframes pv-spin  { to { transform: rotate(360deg); } }
</style>
