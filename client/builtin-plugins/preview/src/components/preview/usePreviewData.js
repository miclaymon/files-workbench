import { ref, watch } from 'vue'
import { loadPreview, forceLoadText } from './load.js'

// Loads + holds a single item's preview reactively, reloading whenever the item's
// path changes. Shared by the Preview editor tab and the Preview lightbox so both
// render an item through the exact same loader (load.js) and state shape.
//
// `getItem` is a getter returning the current item ({ path, name, kind, size } |
// null). Returns { preview, metadata, loading, forceLoad } — the props a
// single-mode PreviewItem expects, plus the tooLarge "load anyway" handler.
export function usePreviewData(getItem) {
  const preview  = ref(null)
  const metadata = ref(null)
  const loading  = ref(false)

  async function load(item) {
    if (!item?.path) { preview.value = null; metadata.value = null; return }
    loading.value = true
    try {
      const { preview: p, metadata: md } = await loadPreview(item)
      preview.value = p
      metadata.value = md
    } finally {
      loading.value = false
    }
  }

  async function forceLoad(item) {
    loading.value = true
    try {
      const p = await forceLoadText(item, preview.value?.language)
      if (p) preview.value = p
    } finally {
      loading.value = false
    }
  }

  watch(() => getItem()?.path, () => load(getItem()), { immediate: true })

  return { preview, metadata, loading, forceLoad }
}
