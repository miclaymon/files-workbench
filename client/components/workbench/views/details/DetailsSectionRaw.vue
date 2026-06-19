<template>
  <DetailsRows
    :selected="!!selectedPath"
    :applies="isRaw"
    na-message="RAW metadata is only available for RAW photo and video files."
    :rows="[]"
    empty-message="RAW metadata coming soon."
  />
</template>

<script setup>
import { computed } from 'vue'
import DetailsRows from './DetailsRows.vue'

const RAW_EXTS = new Set(['cr2','cr3','nef','nrw','arw','raf','orf','dng','rw2','pef','ptx','srw','3fr','fff','mef','mrw','erf','x3f','iiq','rwl','r3d','braw','ari'])

const props = defineProps({
  selectedPath: { type: String, default: '' },
})

const ext   = computed(() => props.selectedPath?.split('.').pop()?.toLowerCase() ?? '')
const isRaw = computed(() => RAW_EXTS.has(ext.value))
</script>
