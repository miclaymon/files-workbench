<template>
  <component
    :is="comp"
    v-if="comp"
    v-bind="{ ...boundProps, ...$attrs }"
    :ref="setInstance"
  />
  <div v-else class="tab-host-missing">No editor view registered for "{{ tab?.kind }}".</div>
</template>

<script setup>
import { computed } from 'vue'
import { tabViewForKind } from '~/composables/useViewRegistry.js'

// Editor counterpart of ViewContentHost: resolves an editor tab's `kind` to its
// registered tab-view entry and renders its component. Props come from the
// entry's `props(tab, ctx)`; event listeners attached by the parent (EditorGroup)
// pass straight through via `$attrs`, so the existing event-up chain to Workbench
// is unchanged. The mounted instance is handed back through `registerInstance`
// together with this host's own tab id, so EditorGroup can key its imperative
// handles (refresh / optimistic rename) by tab — correct even under <KeepAlive>,
// where switching tabs deactivates (not unmounts) the previous instance.
const props = defineProps({
  tab:                { type: Object, default: null },
  prefs:              { type: Object, required: true },
  excludedCategories: { type: Array,  default: () => ['System'] },
  registerInstance:   { type: Function, default: null },
})

defineOptions({ inheritAttrs: false })

const entry = computed(() => (props.tab ? tabViewForKind(props.tab.kind) : null))
const comp  = computed(() => entry.value?.component ?? null)

const boundProps = computed(() =>
  entry.value?.props
    ? entry.value.props(props.tab, { prefs: props.prefs, excludedCategories: props.excludedCategories })
    : {}
)

function setInstance(el) { props.registerInstance?.(el, props.tab?.id) }
</script>

<style scoped>
.tab-host-missing {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  color: var(--text-muted);
  font-size: 13px;
  user-select: none;
}
</style>
