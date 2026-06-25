<template>
  <div class="sm-root">

      <!-- Top search bar -->
      <div class="sm-search-row">
        <svg class="sm-search-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <path d="M9.5,3A6.5,6.5 0 0,1 16,9.5C16,11.11 15.41,12.59 14.44,13.73L14.71,14H15.5L20.5,19L19,20.5L14,15.5V14.71L13.73,14.44C12.59,15.41 11.11,16 9.5,16A6.5,6.5 0 0,1 3,9.5A6.5,6.5 0 0,1 9.5,3M9.5,5C7,5 5,7 5,9.5C5,12 7,14 9.5,14C12,14 14,12 14,9.5C14,7 12,5 9.5,5Z" />
        </svg>
        <input
          ref="searchRef"
          v-model="searchQuery"
          class="sm-search-input"
          placeholder="Search settings"
          autocomplete="off"
          spellcheck="false"
        />
        <button v-if="searchQuery" class="sm-search-clear" @click="searchQuery = ''">✕</button>
      </div>

      <div class="sm-body">

            <!-- Left sidebar -->
            <nav class="sm-sidebar" @keydown.stop>
              <div
                v-for="section in visibleSections"
                :key="section.key"
                class="sm-nav-item"
                :class="{ 'sm-nav-item--active': activeSection === section.key }"
                @click="scrollToSection(section.key)"
              >
                {{ section.title }}
              </div>
            </nav>

            <!-- Settings content -->
            <div class="sm-content" ref="contentRef" @scroll.passive="onScroll" @keydown.stop>

              <div v-if="searchQuery && filteredItems.length === 0" class="sm-no-results">
                No settings found for "{{ searchQuery }}"
              </div>

              <template v-for="section in (searchQuery ? filteredSections : visibleSections)" :key="section.key">
                <div
                  class="sm-section"
                  :data-section="section.key"
                  :ref="el => { if (el) sectionEls[section.key] = el; else delete sectionEls[section.key] }"
                >
                  <h2 class="sm-section-heading">{{ section.title }}</h2>

                  <div
                    v-for="item in section.items"
                    :key="item.path"
                    class="sm-item"
                  >
                    <!-- Checkbox (inline label) -->
                    <template v-if="item._control === 'checkbox'">
                      <div class="sm-item-label sm-item-label--check">
                        <label class="sm-checkbox-label">
                          <input
                            type="checkbox"
                            :checked="getVal(item.path)"
                            @change="e => setVal(item.path, e.target.checked)"
                          />
                          <span class="sm-item-title">
                            <span v-if="item._sectionTitle" class="sm-item-prefix">{{ item._sectionTitle }}: </span>{{ item.title }}
                          </span>
                          <span v-if="isModified(item)" class="sm-modified-dot" title="Modified from default" />
                        </label>
                        <p v-if="item.description" class="sm-item-desc">{{ item.description }}</p>
                      </div>
                    </template>

                    <!-- All other controls -->
                    <template v-else>
                      <div class="sm-item-label">
                        <span class="sm-item-title">
                          <span v-if="item._sectionTitle" class="sm-item-prefix">{{ item._sectionTitle }}: </span>{{ item.title }}
                        </span>
                        <span v-if="isModified(item)" class="sm-modified-dot" title="Modified from default" />
                      </div>
                      <p v-if="item.description" class="sm-item-desc">{{ item.description }}</p>

                      <select
                        v-if="item._control === 'select'"
                        class="sm-select"
                        :value="getVal(item.path)"
                        @change="e => setVal(item.path, e.target.value)"
                      >
                        <option v-for="opt in item.enum" :key="opt" :value="opt">
                          {{ item._optionLabels?.[opt] ?? ENUM_LABELS[opt] ?? opt }}
                        </option>
                      </select>

                      <input
                        v-else-if="item._control === 'number'"
                        type="number"
                        class="sm-input sm-input--number"
                        :value="getVal(item.path)"
                        :min="item.minimum"
                        :max="item.maximum"
                        @change="e => setVal(item.path, Number(e.target.value))"
                      />

                      <input
                        v-else-if="item._control === 'text'"
                        type="text"
                        class="sm-input"
                        :value="getVal(item.path)"
                        @change="e => setVal(item.path, e.target.value)"
                      />

                      <input
                        v-else-if="item._control === 'color'"
                        type="color"
                        class="sm-color"
                        :value="getVal(item.path)"
                        @change="e => setVal(item.path, e.target.value)"
                      />
                    </template>
                  </div>
                </div>
              </template>
            </div>
          </div>

      <!-- Save status indicator -->
      <Transition name="saved">
        <div v-if="saveStatus" class="sm-save-status">{{ saveStatus }}</div>
      </Transition>

  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted, inject, useAttrs } from 'vue'
import schemaData from '#preferences-schema'
import { contributedSchemaProperties } from '~/composables/usePreferenceSchema.js'
import { listIconThemes } from '~/composables/useIconRegistry.js'

// Works in both presentations of the same EditorView. As a modal, ModalHost binds
// `prefs` in and a `save` listener out (Workbench.js modal def). As a promoted
// editor tab, neither is bound, so we fall back to the host (`viewCtx`): prefs from
// `viewCtx.prefs`, and saving through `viewCtx.savePreferences`.
const props = defineProps({
  prefs: { type: Object, default: null },
})
const emit = defineEmits(['save'])

const viewCtx = inject('viewCtx', null)
const attrs = useAttrs()
const sourcePrefs = computed(() => props.prefs ?? viewCtx?.prefs ?? {})

// Persist edited prefs: through the modal's `save` listener when bound, else (as a
// promoted tab, where none is) straight to the host's savePreferences.
function persist(p) {
  if (attrs.onSave) emit('save', p)
  else viewCtx?.savePreferences?.(p)
}

// ── Local prefs copy ──────────────────────────────────────────────────────────

const localPrefs = ref(JSON.parse(JSON.stringify(sourcePrefs.value)))

watch(sourcePrefs, (p) => {
  localPrefs.value = JSON.parse(JSON.stringify(p))
}, { deep: true })

onMounted(async () => {
  searchQuery.value   = ''
  activeSection.value = visibleSections.value[0]?.key ?? ''
  await nextTick()
  searchRef.value?.focus()
})

// ── Value helpers ─────────────────────────────────────────────────────────────

function getVal(path) {
  // Fall back to the schema default so contributed settings (not present in the
  // user's prefs until changed) render at their declared default.
  const v = path.split('.').reduce((o, k) => o?.[k], localPrefs.value)
  return v !== undefined ? v : getDefault(path)
}

function getDefault(path) {
  return path.split('.').reduce((o, k) => o?.[k], defaults.value)
}

function isModified(item) {
  const cur = getVal(item.path)
  const def = getDefault(item.path)
  return def !== undefined && JSON.stringify(cur) !== JSON.stringify(def)
}

// Auto-save with debounce
let _saveTimer = null
const saveStatus = ref('')

function setVal(path, value) {
  const parts = path.split('.')
  const last  = parts.pop()
  // Create intermediate namespaces so a contributed section's first write
  // (e.g. sourceControl.changesViewMode) doesn't no-op.
  let target = localPrefs.value
  for (const k of parts) {
    if (target[k] == null || typeof target[k] !== 'object') target[k] = {}
    target = target[k]
  }
  target[last] = value
  scheduleSave()
}

function scheduleSave() {
  clearTimeout(_saveTimer)
  _saveTimer = setTimeout(async () => {
    await persist(localPrefs.value)
    saveStatus.value = '✓ Saved'
    clearTimeout(_statusTimer)
    _statusTimer = setTimeout(() => { saveStatus.value = '' }, 1500)
  }, 300)
}

let _statusTimer = null
onUnmounted(() => { clearTimeout(_saveTimer); clearTimeout(_statusTimer) })

// ── Schema → sections ─────────────────────────────────────────────────────────

const ENUM_LABELS = {
  system: 'System (follow OS)',
  dark:   'Dark',
  light:  'Light',
  black:  'Black (OLED)',
  'grid-xs':       'Grid (XS)',
  'grid-sm':       'Grid (SM)',
  grid:            'Grid',
  'grid-md':       'Grid (MD)',
  'grid-lg':       'Grid (LG)',
  'grid-xl':       'Grid (XL)',
  'grid-xxl':      'Grid (XXL)',
  list:            'List',
  details:         'Details',
  'gallery-grid':  'Gallery – Grid',
  'gallery-mosaic':'Gallery – Mosaic',
  feed:            'Feed',
}

function controlType(prop) {
  if (prop['x-control']) return prop['x-control']
  if (prop.type === 'boolean') return 'checkbox'
  if (prop.type === 'integer' || prop.type === 'number') return 'number'
  if (prop.enum) return 'select'
  if (prop.type === 'string') return 'text'
  return null
}

// Some selects are populated at runtime from a dynamic registry rather than a
// static schema `enum` (e.g. the installed icon-pack plugins). `x-options` names
// the source; returns { enum, labels } merged onto the item, or null.
function dynamicOptions(prop) {
  if (prop['x-options'] === 'iconThemes') {
    const themes = listIconThemes()
    return { enum: themes.map(t => t.id), labels: Object.fromEntries(themes.map(t => [t.id, t.label])) }
  }
  return null
}

function buildItem(prop, path, sectionTitle) {
  const ctrl = controlType(prop)
  if (!ctrl) return null
  const opts = dynamicOptions(prop)
  return {
    ...prop,
    path,
    _control:      ctrl,
    _sectionTitle: sectionTitle,
    ...(opts ? { enum: opts.enum, _optionLabels: opts.labels } : {}),
  }
}

function extractDefaults(schema, path = '') {
  const out = {}
  if (!schema?.properties) return out
  for (const [k, prop] of Object.entries(schema.properties)) {
    const p = path ? `${path}.${k}` : k
    if (prop.type === 'object') Object.assign(out, extractDefaults(prop, p))
    else if ('default' in prop) out[p] = prop.default
  }
  return out
}

// The static base schema merged with sections contributed by activities/plugins
// (the configuration contribution point), so their settings render here too.
const schemaProps = computed(() => ({ ...(schemaData?.properties ?? {}), ...contributedSchemaProperties() }))

const defaults = computed(() => {
  const flat = extractDefaults({ properties: schemaProps.value })
  // Reconstruct nested object from flat paths
  const out = {}
  for (const [path, val] of Object.entries(flat)) {
    const parts = path.split('.')
    let node = out
    for (let i = 0; i < parts.length - 1; i++) {
      node[parts[i]] ??= {}
      node = node[parts[i]]
    }
    node[parts.at(-1)] = val
  }
  return out
})

const sections = computed(() => {
  const props = schemaProps.value
  if (!Object.keys(props).length) return []
  const result = []
  const generalItems = []

  for (const [key, prop] of Object.entries(props)) {
    if (prop.type === 'array') continue

    if (prop.type === 'object' && prop.properties) {
      const items = []
      for (const [subKey, subProp] of Object.entries(prop.properties)) {
        const item = buildItem(subProp, `${key}.${subKey}`, prop.title)
        if (item) items.push(item)
      }
      if (items.length) {
        result.push({
          key,
          title:    prop.title,
          items,
          _devOnly: prop['x-devOnly'] ?? false,
        })
      }
    } else {
      const item = buildItem(prop, key, '')
      if (item) generalItems.push(item)
    }
  }

  if (generalItems.length) {
    result.unshift({ key: '__general', title: 'General', items: generalItems, _devOnly: false })
  }
  return result
})

const visibleSections = computed(() => {
  const isDev = localPrefs.value?.developerMode ?? false
  return sections.value
    .filter(s => !s._devOnly || isDev)
    .map(s => ({ ...s, items: s.items.filter(i => !i['x-devOnly'] || isDev) }))
    .filter(s => s.items.length > 0)
})

// ── Search ────────────────────────────────────────────────────────────────────

const searchQuery = ref('')

const filteredItems = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return []
  return visibleSections.value.flatMap(s =>
    s.items.filter(i =>
      i.title.toLowerCase().includes(q) ||
      (i.description ?? '').toLowerCase().includes(q)
    )
  )
})

const filteredSections = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return visibleSections.value
  return visibleSections.value
    .map(s => ({
      ...s,
      items: s.items.filter(i =>
        i.title.toLowerCase().includes(q) ||
        (i.description ?? '').toLowerCase().includes(q)
      ),
    }))
    .filter(s => s.items.length > 0)
})

// ── Sidebar active tracking ───────────────────────────────────────────────────

const contentRef   = ref(null)
const searchRef    = ref(null)
const sectionEls   = {}
const activeSection = ref('')

function scrollToSection(key) {
  searchQuery.value = ''
  nextTick(() => {
    const el = sectionEls[key]
    if (el && contentRef.value) {
      contentRef.value.scrollTo({ top: el.offsetTop - 12, behavior: 'smooth' })
      activeSection.value = key
    }
  })
}

function onScroll() {
  if (searchQuery.value) return
  const scrollTop = contentRef.value?.scrollTop ?? 0
  let current = ''
  for (const section of visibleSections.value) {
    const el = sectionEls[section.key]
    if (el && el.offsetTop - 48 <= scrollTop) current = section.key
  }
  if (current) activeSection.value = current
}
</script>

<style scoped>
/* ── Root (fills the ModalEditor body; positions the save indicator) ─────────── */
.sm-root {
  position: relative;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

/* ── Search row ────────────────────────────────────────────────────────────── */
.sm-search-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border, #454545);
  flex-shrink: 0;
  background: var(--sidebar-bg, #252526);
}

.sm-search-icon { color: var(--text-muted, #8c8c8c); flex-shrink: 0; }

.sm-search-input {
  flex: 1;
  background: var(--input-background, #3c3c3c);
  border: 1px solid var(--border, #454545);
  outline: none;
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  padding: 4px 8px;
  min-width: 0;
  height: 26px;
}
.sm-search-input:focus { border-color: var(--accent, #0078d4); }

.sm-search-clear {
  background: none;
  border: none;
  color: var(--text-muted, #888);
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
  flex-shrink: 0;
}
.sm-search-clear:hover { color: var(--text, #ccc); }

/* ── Body (sidebar + content) ──────────────────────────────────────────────── */
.sm-body {
  flex: 1;
  display: flex;
  overflow: hidden;
}

/* ── Sidebar ───────────────────────────────────────────────────────────────── */
.sm-sidebar {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid var(--border, #454545);
  overflow-y: auto;
  padding: 8px 0;
}

.sm-nav-item {
  padding: 5px 16px;
  font-size: 13px;
  color: var(--text-muted, #aaa);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  user-select: none;
}
.sm-nav-item:hover { color: var(--text, #ccc); background: var(--hover, rgba(255,255,255,0.05)); }
.sm-nav-item--active { color: var(--text, #ccc); background: var(--active-bg, rgba(255,255,255,0.08)); }

/* ── Content area ──────────────────────────────────────────────────────────── */
.sm-content {
  flex: 1;
  overflow-y: auto;
  padding: 0 0 32px 0;
}

.sm-no-results {
  padding: 40px 32px;
  color: var(--text-muted, #888);
  font-size: 13px;
}

/* ── Section ───────────────────────────────────────────────────────────────── */
.sm-section { padding: 0; }

.sm-section-heading {
  font-size: 13px;
  font-weight: 400;
  color: var(--text, #ccc);
  margin: 0;
  padding: 16px 32px 4px;
  border-bottom: 1px solid var(--border, #454545);
  position: sticky;
  top: 0;
  background: var(--sidebar-bg, #252526);
  z-index: 1;
  letter-spacing: 0.01em;
}

/* ── Setting item ──────────────────────────────────────────────────────────── */
.sm-item {
  padding: 14px 32px;
  border-bottom: 1px solid rgba(128, 128, 128, 0.08);
}
.sm-item:last-child { border-bottom: none; }

.sm-item-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.sm-item-label--check { flex-direction: column; align-items: flex-start; gap: 0; }

.sm-item-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #ccc);
}
.sm-item-prefix { font-weight: 400; color: var(--text-muted, #999); }

.sm-checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  color: var(--text, #ccc);
}
.sm-checkbox-label input[type="checkbox"] { width: 14px; height: 14px; flex-shrink: 0; accent-color: var(--accent, #0078d4); }

.sm-item-desc {
  font-size: 12px;
  color: var(--text-muted, #888);
  margin: 6px 0 8px 0;
  line-height: 1.5;
}
.sm-item-label--check .sm-item-desc { margin-left: 22px; }

.sm-modified-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--accent, #0078d4);
  flex-shrink: 0;
}

/* ── Controls ──────────────────────────────────────────────────────────────── */
.sm-select {
  display: block;
  min-width: 200px;
  max-width: 320px;
  padding: 4px 24px 4px 8px;
  border: 1px solid var(--border, #454545);
  background: var(--input-background, #3c3c3c);
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  appearance: auto;
}
.sm-select:focus { outline: 1px solid var(--accent, #0078d4); }

.sm-input {
  display: block;
  min-width: 200px;
  max-width: 320px;
  padding: 4px 8px;
  border: 1px solid var(--border, #454545);
  background: var(--input-background, #3c3c3c);
  color: var(--text, #ccc);
  font-size: 13px;
  font-family: inherit;
}
.sm-input:focus { outline: 1px solid var(--accent, #0078d4); }
.sm-input--number { min-width: 100px; max-width: 120px; }

.sm-color {
  width: 54px;
  height: 26px;
  border: 1px solid var(--border, #454545);
  background: var(--input-background, #3c3c3c);
  padding: 2px;
  cursor: pointer;
}

/* ── Save indicator ────────────────────────────────────────────────────────── */
.sm-save-status {
  position: absolute;
  bottom: 12px;
  right: 16px;
  font-size: 12px;
  color: var(--text-muted, #888);
  pointer-events: none;
}
.saved-enter-active, .saved-leave-active { transition: opacity 0.2s; }
.saved-enter-from, .saved-leave-to { opacity: 0; }
</style>
