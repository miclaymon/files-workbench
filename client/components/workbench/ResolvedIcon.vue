<template>
  <!-- Image URL (or a plugin-relative file path, resolved by the host as a URL) -->
  <img
    v-if="result.type === 'url' || result.type === 'file.path'"
    :src="result.icon"
    :width="size || undefined"
    :height="size || undefined"
    :class="iconClass"
    @error="$emit('fail')"
  />
  <!-- A Vue component the theme supplied directly -->
  <component :is="result.icon" v-else-if="result.type === 'component'" :class="iconClass" />
  <!-- Raw MDI-style path data ('d') rendered as an inline SVG -->
  <svg
    v-else-if="result.type === 'svg.path'"
    :width="size || undefined"
    :height="size || undefined"
    viewBox="0 0 24 24"
    fill="currentColor"
    :class="iconClass"
  >
    <path :d="result.icon" />
  </svg>
</template>

<script setup>
// Renders the descriptor an icon-theme's getIcon handler returns (see
// useIconRegistry.js): { type: 'url' | 'file.path' | 'component' | 'svg.path', icon }.
// Layer 2 of the icon pipeline — the consuming renderer decides ordering (custom
// icon → this → MDI default) and reacts to `fail` (an <img> that 404s) by falling
// back to its own default glyph. `size` is optional: omit it to let CSS size the
// element (the directory layouts vary the icon size per view via a class).
defineProps({
  result:    { type: Object, required: true },
  size:      { type: Number, default: 0 },
  iconClass: { type: [String, Array, Object], default: '' },
})
defineEmits(['fail'])
</script>
