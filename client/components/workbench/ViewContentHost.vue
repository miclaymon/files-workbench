<template>
  <component
    :is="entry.component"
    v-if="entry?.component"
    v-bind="boundProps"
    v-on="boundOn"
    :ref="setRef"
  />
  <div v-else class="vch-missing">Unknown view: {{ id }}</div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { getViewEntry } from '../../composables/useViewRegistry.js'

// Renders the content for a view/section id by looking it up in the registry and
// binding the props/events it declares against the shared `viewCtx` provided by
// Workbench. Replaces the old per-container named slots so any view or section
// can render in any container.
const props = defineProps({
  id: { type: String, required: true },
})

const ctx   = inject('viewCtx', null)
const entry = computed(() => getViewEntry(props.id))

const boundProps = computed(() => (entry.value?.props && ctx) ? entry.value.props(ctx) : {})
const boundOn    = computed(() => (entry.value?.on    && ctx) ? entry.value.on(ctx)    : {})

// Forward the mounted instance back to a Workbench ref (e.g. explorerPanelRef)
// for the few panels Workbench calls imperatively (.refresh()).
function setRef(el) {
  if (entry.value?.expose && ctx?.setRef) ctx.setRef(entry.value.expose, el)
}
</script>

<style scoped>
.vch-missing {
  padding: 12px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
