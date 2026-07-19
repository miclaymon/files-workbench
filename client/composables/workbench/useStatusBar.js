import { ref, computed, onMounted, onUnmounted } from 'vue'
import { API_BASE } from '@files-workbench/core'

// ── Status bar slice ──────────────────────────────────────────────────────────
// Server-connection state + the transient status line + directory stats. A leaf
// (no other slice deps); many slices consume `flashStatus` to surface a message
// that reverts to "Ready". Owns its own ping lifecycle.
export function useStatusBar() {
  const serverConnected = ref(true)
  const dirStats = ref({ count: 0, totalSize: 0 })
  const status = ref({ /*left: 'Ready', right: 'Connected'*/ })

  const statusRight = computed(() => serverConnected.value ? 'Connected' : 'Disconnected')

  function formatBytes(bytes) {
    if (!bytes) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB', 'TB']
    let i = 0
    let val = bytes
    while (val >= 1024 && i < units.length - 1) { val /= 1024; i++ }
    return `${val < 10 ? val.toFixed(1) : Math.round(val)} ${units[i]}`
  }

  // Show a transient message on the left status line, reverting to "Ready".
  function flashStatus(message, ms = 2000) {
    status.value.left = message
    // setTimeout(() => { status.value.left = 'Ready' }, ms)
  }

  // ── Server connection ping ────────────────────────────────────────────────
  let _pingInterval = null
  async function pingServer() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) })
      serverConnected.value = res.ok
    } catch {
      serverConnected.value = false
    }
  }

  onMounted(() => {
    pingServer()
    _pingInterval = setInterval(pingServer, 10000)
  })
  onUnmounted(() => clearInterval(_pingInterval))

  return { serverConnected, dirStats, status, statusRight, formatBytes, flashStatus }
}
