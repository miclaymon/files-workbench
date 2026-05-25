import { ref, watch } from 'vue'

const STORAGE_KEY = 'workbench-state'
const VERSION = 1

const DEFAULTS = {
  version: VERSION,
  sidebarVisible: true,
  sidebarWidth: 240,
  activeActivity: 'explorer',
  rightpaneWidth: 380,
  rightPanel: 'preview',
  bottompaneHeight: 150,
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw)
    if (parsed.version !== VERSION) return { ...DEFAULTS }
    return { ...DEFAULTS, ...parsed }
  } catch {
    return { ...DEFAULTS }
  }
}

function saveState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

export function useWorkbenchState() {
  const stored = loadState()

  const sidebarVisible   = ref(stored.sidebarVisible)
  const sidebarWidth     = ref(stored.sidebarWidth)
  const activeActivity   = ref(stored.activeActivity)
  const rightpaneWidth   = ref(stored.rightpaneWidth)
  const rightPanel       = ref(stored.rightPanel)
  const bottompaneHeight = ref(stored.bottompaneHeight)

  let saveTimer = null
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      saveState({
        version: VERSION,
        sidebarVisible:   sidebarVisible.value,
        sidebarWidth:     sidebarWidth.value,
        activeActivity:   activeActivity.value,
        rightpaneWidth:   rightpaneWidth.value,
        rightPanel:       rightPanel.value,
        bottompaneHeight: bottompaneHeight.value,
      })
    }, 500)
  }

  watch([sidebarVisible, sidebarWidth, activeActivity, rightpaneWidth, rightPanel, bottompaneHeight], scheduleSave)

  return { sidebarVisible, sidebarWidth, activeActivity, rightpaneWidth, rightPanel, bottompaneHeight }
}
