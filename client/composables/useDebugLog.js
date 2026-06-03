import { ref } from 'vue'

const MAX_ENTRIES = 500
const entries = ref([])
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
  function log(category, message, data) {
    entries.value.push({ id: ++_seq, time: _timestamp(), category, message, data })
    if (entries.value.length > MAX_ENTRIES)
      entries.value.splice(0, entries.value.length - MAX_ENTRIES)
  }

  function clear() { entries.value = [] }

  return { entries, log, clear }
}
