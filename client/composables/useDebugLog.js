import { ref, reactive, computed } from 'vue'

// Severity ladder, low → high. Every log entry carries one `level`. The Debug panel
// filters by an independent on/off per level (see `enabled`), so users can show any
// combination. `log()` defaults to 'debug' since most internal traces are verbose —
// callers pass a higher level for notable events / problems.
export const LOG_LEVELS = ['debug', 'info', 'warning', 'error']
const RANK = Object.fromEntries(LOG_LEVELS.map((l, i) => [l, i]))

const MAX_ENTRIES = 500
const entries = ref([])
// Which levels are currently shown — an independent toggle per level (all on by
// default). The panel's filter dropdown flips these.
const enabled = reactive(Object.fromEntries(LOG_LEVELS.map(l => [l, true])))
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

  // Entries whose level is currently enabled. Fast-path the common all-on case so
  // we don't filter every render when no level is hidden.
  const allLevelsEnabled = computed(() => LOG_LEVELS.every(l => enabled[l]))
  const visibleEntries = computed(() =>
    allLevelsEnabled.value ? entries.value : entries.value.filter(e => enabled[e.level] !== false)
  )

  function isLevelEnabled(level) { return enabled[level] !== false }
  function toggleLevel(level)    { if (level in enabled) enabled[level] = !enabled[level] }
  function setLevelEnabled(level, on) { if (level in enabled) enabled[level] = !!on }

  return {
    entries, visibleEntries, log, clear,
    levels: LOG_LEVELS, allLevelsEnabled, isLevelEnabled, toggleLevel, setLevelEnabled,
  }
}
