<template>
  <ModalEditor
    :visible="!!modal"
    :title="modal?.label ?? ''"
    :icon="modal?.icon ?? ''"
    :actions="modal?.actions ?? []"
    :width="modal?.width || undefined"
    :height="modal?.height || undefined"
    @close="host.facade.modals.close()"
    @open-in-window="host.facade.modals.promote(host.facade.modals.active.value)"
  >
    <component :is="modal.component" v-if="modal?.component" v-bind="boundProps" v-on="boundOn" />
  </ModalEditor>
</template>

<script setup>
import { computed } from 'vue'
import ModalEditor from './ModalEditor.vue'

// Renders the active modal surface (a registered ModalView) inside the shared
// ModalEditor chrome. The ModalView supplies title / icon / context actions and
// its body component; props/on bind to the host exactly as ViewContentHost binds
// panel/section views — so a plugin contributing a modal needs no bespoke wiring.
const props = defineProps({
  host: { type: Object, required: true },
})

const modal = computed(() => {
  const id = props.host.facade.modals.active.value
  return id ? props.host.facade.modals.get(id) : null
})

const boundProps = computed(() => (modal.value?.props ? modal.value.props(props.host) : {}))
const boundOn    = computed(() => (modal.value?.on    ? modal.value.on(props.host)    : {}))
</script>
