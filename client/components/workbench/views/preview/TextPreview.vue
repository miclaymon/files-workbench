<template>
  <div class="text-preview-container">
    <MonacoEditor :modelValue="text" :language="language" :fontSize="fontSize" />
  </div>
</template>

<script setup>
import MonacoEditor from '../../editor/MonacoEditor.vue'

defineProps({
  text: { type: String, default: '' },
  language: { type: String, default: 'plaintext' },
  fontSize: { type: Number, default: 13 },
})
</script>

<style scoped>
.text-preview-container {
  height: 300px;
  user-select: text;
}
</style>
