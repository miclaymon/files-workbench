<template>
  <span class="status-connection" :class="{ disconnected: !connected }">
    <span class="connection-dot" />{{ label }}
  </span>
</template>

<script setup>
// Core activity's server-connection indicator. Always shown.
import { computed, inject } from 'vue'

const ctx = inject('viewCtx', null)
const connected = computed(() => ctx?.serverConnected?.value ?? true)
const label     = computed(() => ctx?.statusRight?.value ?? '')
</script>

<style scoped>
.status-connection { display: flex; align-items: center; gap: 5px; white-space: nowrap; flex-shrink: 0; opacity: 0.85; }
.status-connection.disconnected { opacity: 1; color: #ffcdd2; }
.connection-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #a5d6a7;
  flex-shrink: 0;
}
.status-connection.disconnected .connection-dot { background: #ef9a9a; }
</style>
