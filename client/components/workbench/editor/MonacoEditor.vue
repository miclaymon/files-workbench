<template>
  <div ref="containerEl" class="monaco-container" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

// Monaco workers via Vite's first-class `?worker` imports. These resolve in both
// the dev server AND the production Rollup build — the previous
// `new Worker(new URL('monaco-editor/…', import.meta.url))` form only worked in dev:
// Rollup's worker plugin can't resolve the bare package specifier at build time and
// treated it as a path relative to this component, breaking `nuxt generate`.
import EditorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker'
import JsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker'
import CssWorker from 'monaco-editor/esm/vs/language/css/css.worker?worker'
import HtmlWorker from 'monaco-editor/esm/vs/language/html/html.worker?worker'
import TsWorker from 'monaco-editor/esm/vs/language/typescript/ts.worker?worker'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'plaintext' },
  fontSize: { type: Number, default: 13 },
})

const containerEl = ref(null)
let editor = null
let monacoApi = null

// Configure MonacoEnvironment once per page lifetime.
function ensureWorkerEnv() {
  if (window.MonacoEnvironment) return
  window.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json') return new JsonWorker()
      if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
      if (label === 'html' || label === 'handlebars' || label === 'razor') return new HtmlWorker()
      if (label === 'typescript' || label === 'javascript') return new TsWorker()
      return new EditorWorker()
    },
  }
}

onMounted(async () => {
  ensureWorkerEnv()
  monacoApi = await import('monaco-editor')

  editor = monacoApi.editor.create(containerEl.value, {
    value: props.modelValue,
    language: props.language,
    theme: 'vs-dark',
    readOnly: true,
    minimap: { enabled: false },
    scrollBeyondLastLine: false,
    automaticLayout: true,
    fontSize: props.fontSize,
    lineNumbers: 'on',
    folding: true,
    renderLineHighlight: 'none',
    overviewRulerLanes: 0,
    hideCursorInOverviewRuler: true,
    scrollbar: { verticalScrollbarSize: 6, horizontalScrollbarSize: 6 },
    padding: { top: 8, bottom: 8 },
  })
})

onUnmounted(() => {
  editor?.dispose()
  editor = null
})

watch(() => props.modelValue, (val) => {
  if (editor && editor.getValue() !== val) editor.setValue(val ?? '')
})

watch(() => props.language, (lang) => {
  if (editor && monacoApi) {
    monacoApi.editor.setModelLanguage(editor.getModel(), lang)
  }
})

watch(() => props.fontSize, (size) => {
  editor?.updateOptions({ fontSize: size })
})
</script>

<style scoped>
.monaco-container {
  width: 100%;
  height: 100%;
}
</style>
