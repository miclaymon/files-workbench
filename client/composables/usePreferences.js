import { reactive, ref } from 'vue'
import { API_BASE, CONTROL_BASE, API_V } from '~/lib/api-config.js'

const DEFAULTS = {
  developerMode: false,
  theme: 'dark',
  workbench: {
    showTabIcons: true,
  },
  explorer: {
    showFiles: false,
    showIcons: true,
    alwaysShowCheckboxes: false,
    showHiddenFiles: false,
    autoOpenReadme: false,
    layout: 'grid',
    dragDelay: 200,
    indentScale: 1.0,
    hoverPreviewEnabled: true,
    hoverPreviewDelayMs: 1000,
  },
  excludedCategories: ['System'],
  preview: {
    enabled: true,
    maxPreviewBytes: 10000,
    editorFontSize: 13,
  },
  cache: {
    enabled: true,
    defaultTtlSeconds: 30,
    maxSizeMb: 500,
  },
  experimental: {
    showSystemFiles: false,
  },
}

function deepMerge(target, source) {
  for (const key of Object.keys(source)) {
    const val = source[key]
    if (val !== null && typeof val === 'object' && !Array.isArray(val) && typeof target[key] === 'object' && target[key] !== null) {
      deepMerge(target[key], val)
    } else {
      target[key] = val
    }
  }
}

// Module-level singleton — all callers share the same reactive state
const prefs = reactive(JSON.parse(JSON.stringify(DEFAULTS)))
const loading = ref(false)
const error = ref(null)

let _ready = false
let _inflightPromise = null

async function _load() {
  if (_ready) return
  if (_inflightPromise) return _inflightPromise

  loading.value = true
  error.value = null

  _inflightPromise = $fetch(`${API_BASE}/_api/${API_V}/preferences`)
    .then(loaded => {
      deepMerge(prefs, loaded)
      _ready = true
    })
    .catch(err => {
      error.value = err?.message ?? 'Failed to load preferences'
    })
    .finally(() => {
      loading.value = false
      _inflightPromise = null
    })

  return _inflightPromise
}

async function save(newPrefs) {
  await $fetch(`${CONTROL_BASE}/_api/${API_V}/preferences`, { method: 'PUT', body: newPrefs })
  deepMerge(prefs, newPrefs)
}

async function reload() {
  _ready = false
  return _load()
}

export function usePreferences() {
  _load()
  return { prefs, loading, error, save, reload }
}
