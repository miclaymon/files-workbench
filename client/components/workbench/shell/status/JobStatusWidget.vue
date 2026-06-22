<template>
  <span v-if="job" class="sb-progress">
    <span class="sb-progress-text">{{ job.progressLabel || job.title }}</span>
    <meter class="sb-meter" :value="job.progress.done" :max="job.progress.total" />
  </span>
</template>

<script setup>
// Core activity's running-job progress meter. Self-gates: present only while a
// job notification is in progress.
import { computed, inject } from 'vue'

const ctx = inject('viewCtx', null)
const job = computed(() => ctx?.activeJob?.value ?? null)
</script>

<style scoped>
.sb-progress {
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  flex-shrink: 0;
  margin-right: 4px;
}
.sb-progress-text { overflow: hidden; text-overflow: ellipsis; max-width: 240px; }
.sb-meter {
  -webkit-appearance: none;
  appearance: none;
  width: 90px;
  height: 9px;
  border: 1px solid white;
  border-radius: 5px;
  background: transparent;
  flex-shrink: 0;
}
/* Chromium meter internals — transparent track, white fill. */
.sb-meter::-webkit-meter-bar {
  background: transparent;
  border: none;
  border-radius: 5px;
}
.sb-meter::-webkit-meter-optimum-value,
.sb-meter::-webkit-meter-suboptimum-value,
.sb-meter::-webkit-meter-even-less-good-value {
  background: white;
  border-radius: 4px;
}
</style>
