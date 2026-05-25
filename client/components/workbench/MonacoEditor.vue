<template>
  <div ref="containerEl" class="monaco-container" />
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'plaintext' },
  fontSize: { type: Number, default: 13 },
})

const containerEl = ref(null)
let editor = null
let monacoApi = null

// Vite bundles workers referenced via new URL() at build time.
// We only configure MonacoEnvironment once per page lifetime.
function ensureWorkerEnv() {
  if (window.MonacoEnvironment) return
  window.MonacoEnvironment = {
    getWorker(_, label) {
      if (label === 'json')
        return new Worker(new URL('monaco-editor/esm/vs/language/json/json.worker', import.meta.url), { type: 'module' })
      if (label === 'css' || label === 'scss' || label === 'less')
        return new Worker(new URL('monaco-editor/esm/vs/language/css/css.worker', import.meta.url), { type: 'module' })
      if (label === 'html' || label === 'handlebars' || label === 'razor')
        return new Worker(new URL('monaco-editor/esm/vs/language/html/html.worker', import.meta.url), { type: 'module' })
      if (label === 'typescript' || label === 'javascript')
        return new Worker(new URL('monaco-editor/esm/vs/language/typescript/ts.worker', import.meta.url), { type: 'module' })
      return new Worker(new URL('monaco-editor/esm/vs/editor/editor.worker', import.meta.url), { type: 'module' })
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
