<template>
  <div class="preferences-activity">
    <div class="preferences-header">
      <h2>Preferences</h2>
      <div class="preferences-actions">
        <button class="save-button" @click="doSave" :disabled="!hasUnsavedChanges">
          Save
        </button>
      </div>
    </div>

    <div class="preferences-content">
      <div
        v-for="section in visibleSections"
        :key="section.title"
        class="preferences-section"
      >
        <h3>{{ section.title }}</h3>

        <template v-for="item in section.visibleItems" :key="item.path">
          <div v-if="item._subsectionStart" class="subsection-label">{{ item._subsection }}</div>

          <div class="preference-item">
            <template v-if="item._control === 'checkbox'">
              <label class="preference-label">
                <input
                  type="checkbox"
                  :checked="getVal(item.path)"
                  @change="e => setVal(item.path, e.target.checked)"
                />
                {{ item.title }}
              </label>
            </template>

            <template v-else-if="item._control === 'select'">
              <label class="preference-label standalone">{{ item.title }}</label>
              <select
                :value="getVal(item.path)"
                @change="e => setVal(item.path, e.target.value)"
                class="preference-select"
              >
                <option v-for="opt in item.enum" :key="opt" :value="opt">
                  {{ ENUM_LABELS[opt] ?? opt }}
                </option>
              </select>
            </template>

            <template v-else-if="item._control === 'color'">
              <label class="preference-label standalone">{{ item.title }}</label>
              <input
                type="color"
                :value="getVal(item.path)"
                @change="e => setVal(item.path, e.target.value)"
                class="preference-color"
              />
            </template>

            <template v-else-if="item._control === 'number'">
              <label class="preference-label standalone">{{ item.title }}</label>
              <input
                type="number"
                :value="getVal(item.path)"
                :min="item.minimum"
                :max="item.maximum"
                @change="e => setVal(item.path, Number(e.target.value))"
                class="preference-number"
              />
            </template>

            <div v-if="item.description" class="preference-description">{{ item.description }}</div>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import schemaData from '#preferences-schema'

const props = defineProps({
  prefs: { type: Object, required: true }
})
const emit = defineEmits(['save', 'change'])

const localPrefs = ref(JSON.parse(JSON.stringify(props.prefs)))
const hasUnsavedChanges = ref(false)
const schema = ref(schemaData)

onMounted(() => {
  document.addEventListener('keydown', handleKeyDown)
})
onUnmounted(() => document.removeEventListener('keydown', handleKeyDown))

watch(() => props.prefs, (newPrefs) => {
  localPrefs.value = JSON.parse(JSON.stringify(newPrefs))
  hasUnsavedChanges.value = false
}, { deep: true })

// ── path helpers ──────────────────────────────────────────────────────────────

function getVal(path) {
  return path.split('.').reduce((o, k) => o?.[k], localPrefs.value)
}

function setVal(path, value) {
  const parts = path.split('.')
  const last = parts.pop()
  const target = parts.reduce((o, k) => o?.[k], localPrefs.value)
  if (target != null) {
    target[last] = value
    hasUnsavedChanges.value = true
    emit('change', localPrefs.value)
  }
}

// ── enum display labels ───────────────────────────────────────────────────────

const ENUM_LABELS = {
  system: 'System (follow OS)',
  dark: 'Dark',
  light: 'Light',
  black: 'Black (OLED)',
  grid: 'Grid',
  list: 'List',
  table: 'Table',
}

// ── schema → renderable sections ─────────────────────────────────────────────

function controlType(prop) {
  if (prop['x-control']) return prop['x-control']
  if (prop.type === 'boolean') return 'checkbox'
  if (prop.type === 'integer' || prop.type === 'number') return 'number'
  if (prop.enum) return 'select'
  return null
}

const sections = computed(() => {
  if (!schema.value?.properties) return []
  const result = []
  const generalItems = []

  for (const [key, prop] of Object.entries(schema.value.properties)) {
    if (prop.type === 'array') continue

    if (prop.type === 'object' && prop.properties) {
      const items = []
      for (const [subKey, subProp] of Object.entries(prop.properties)) {
        if (subProp.type === 'object' && subProp.properties) {
          let first = true
          for (const [leafKey, leafProp] of Object.entries(subProp.properties)) {
            const ctrl = controlType(leafProp)
            if (!ctrl) continue
            items.push({
              ...leafProp,
              path: `${key}.${subKey}.${leafKey}`,
              _control: ctrl,
              _subsection: subProp.title,
              _subsectionStart: first,
            })
            first = false
          }
        } else {
          const ctrl = controlType(subProp)
          if (!ctrl) continue
          items.push({ ...subProp, path: `${key}.${subKey}`, _control: ctrl })
        }
      }
      result.push({ title: prop.title, items, _devOnly: prop['x-devOnly'] ?? false })
    } else {
      const ctrl = controlType(prop)
      if (!ctrl) continue
      generalItems.push({ ...prop, path: key, _control: ctrl })
    }
  }

  if (generalItems.length) result.unshift({ title: 'General', items: generalItems, _devOnly: false })
  return result
})

const visibleSections = computed(() => {
  const isDev = localPrefs.value?.developerMode ?? false
  return sections.value
    .filter(s => !s._devOnly || isDev)
    .map(s => ({
      ...s,
      visibleItems: s.items.filter(item => !item['x-devOnly'] || isDev),
    }))
    .filter(s => s.visibleItems.length > 0)
})

// ── actions ───────────────────────────────────────────────────────────────────

function doSave() {
  emit('save', localPrefs.value)
  hasUnsavedChanges.value = false
}

function handleKeyDown(e) {
  if (e.ctrlKey && e.key === 's') {
    e.preventDefault()
    if (hasUnsavedChanges.value) doSave()
  }
}
</script>

<style scoped>
.preferences-activity {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--editor-background);
  color: var(--text);
  padding: 20px;
  overflow-y: auto;
  user-select: none;
}

.preferences-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--border);
}
.preferences-header h2 { margin: 0; font-size: 24px; font-weight: 600; }

.save-button {
  background: var(--accent);
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}
.save-button:hover:not(:disabled) { filter: brightness(1.1); }
.save-button:disabled { opacity: 0.5; cursor: not-allowed; }

.state-message {
  color: var(--text-muted);
  font-size: 14px;
  padding: 20px 0;
}
.state-message.error { color: var(--danger); }

.preferences-content { flex: 1; max-width: 800px; }

.preferences-section { margin-bottom: 32px; }
.preferences-section h3 {
  margin: 0 0 16px 0;
  font-size: 16px;
  font-weight: 600;
  border-bottom: 1px solid var(--border);
  padding-bottom: 8px;
}

.subsection-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  margin: 12px 0 4px;
}

.preference-item {
  padding: 12px 0;
  border-bottom: 1px solid rgba(128, 128, 128, 0.1);
}
.preference-item:last-child { border-bottom: none; }

.preference-label {
  display: flex;
  align-items: center;
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 4px;
  cursor: pointer;
}
.preference-label.standalone { cursor: default; margin-bottom: 6px; }
.preference-label input[type="checkbox"] { margin-right: 8px; width: 16px; height: 16px; }

.preference-select {
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-background);
  color: var(--text);
  font-size: 13px;
  cursor: pointer;
}
.preference-select:focus { outline: 1px solid var(--accent); }

.preference-color {
  width: 60px;
  height: 30px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-background);
  cursor: pointer;
  padding: 2px;
}

.preference-number {
  width: 90px;
  padding: 6px 8px;
  border: 1px solid var(--border);
  border-radius: 4px;
  background: var(--input-background);
  color: var(--text);
  font-size: 13px;
}
.preference-number:focus { outline: 1px solid var(--accent); }

.preference-description {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 4px;
  margin-left: 24px;
  line-height: 1.4;
}
</style>
