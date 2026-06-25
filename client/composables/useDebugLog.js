import { ref, computed } from 'vue'

// Severity ladder, low → high. Every log entry carries one `level`; the Debug panel
// can filter to a minimum severity. `log()` defaults to 'debug' since most internal
// traces are verbose — callers pass a higher level for notable events / problems.
export const LOG_LEVELS = ['debug', 'info', 'warning', 'error']
const RANK = Object.fromEntries(LOG_LEVELS.map((l, i) => [l, i]))

const MAX_ENTRIES = 500
const entries  = ref([])
const minLevel = ref('debug')   // lowest severity shown; 'debug' shows everything
let _seq = 0

function _timestamp() {
  const d = new Date()
  return (
    String(d.getHours()).padStart(2, '0') + ':' +
    String(d.getMinutes()).padStart(2, '0') + ':' +
    String(d.getSeconds()).padStart(2, '0') + '.' +
    String(d.getMilliseconds()).padStart(3, '0')
  )
}

export function useDebugLog() {
  // log(category, message, data?, level='debug')
  function log(category, message, data, level = 'debug') {
    const lvl = RANK[level] != null ? level : 'debug'
    entries.value.push({ id: ++_seq, time: _timestamp(), level: lvl, category, message, data })
    if (entries.value.length > MAX_ENTRIES)
      entries.value.splice(0, entries.value.length - MAX_ENTRIES)
  }

  function clear() { entries.value = [] }

  // Entries at or above the current minimum severity.
  const visibleEntries = computed(() => {
    const min = RANK[minLevel.value] ?? 0
    return min === 0 ? entries.value : entries.value.filter(e => (RANK[e.level] ?? 0) >= min)
  })

  // Advance the filter through the ladder: All → Info+ → Warnings+ → Errors → All.
  function cycleLevelFilter() {
    minLevel.value = LOG_LEVELS[((RANK[minLevel.value] ?? 0) + 1) % LOG_LEVELS.length]
  }

  return { entries, visibleEntries, log, clear, minLevel, cycleLevelFilter }
}
