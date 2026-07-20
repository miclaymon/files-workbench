import { reactive, ref } from 'vue'
import { API_BASE, CONTROL_BASE, API_V } from '@files-workbench/core'

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

// Boot-skeleton support (client/index.html): mirrors the `--bg` value of each
// built-in theme in config/themes/*.json. There's no live CSS-variable
// application from those files yet (workbench.css still hardcodes the dark
// palette on :root) — this only needs to track the *selected* theme id so the
// next launch's inline skeleton can guess the right background before any CSS
// loads. Keep in sync with config/themes/*.json and the copy in
// client/electron/main.js (Node can't share this module — no DOM/fetch there).
const THEME_BG = {
  dark: '#181818',
  light: '#f3f3f3',
  black: '#000000',
}

function resolveThemeBg(theme) {
  if (theme === 'system') {
    const prefersLight = typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: light)').matches
    return prefersLight ? THEME_BG.light : THEME_BG.dark
  }
  return THEME_BG[theme] ?? THEME_BG.dark
}

function persistThemeBg(theme) {
  try { localStorage.setItem('fw:theme-bg', resolveThemeBg(theme)) } catch { /* storage unavailable/full — skeleton falls back to its default */ }
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

  _inflightPromise = fetch(`${API_BASE}/_api/${API_V}/preferences`)
    .then(res => {
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json()
    })
    .then(loaded => {
      deepMerge(prefs, loaded)
      _ready = true
      persistThemeBg(prefs.theme)
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
  const res = await fetch(`${CONTROL_BASE}/_api/${API_V}/preferences`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newPrefs),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  deepMerge(prefs, newPrefs)
  persistThemeBg(prefs.theme)
}

async function reload() {
  _ready = false
  return _load()
}

export function usePreferences() {
  _load()
  return { prefs, loading, error, save, reload }
}
