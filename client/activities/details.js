import { markRaw } from 'vue'
import { mdiInformation } from '@mdi/js'

import DetailsSectionInfo        from '../components/workbench/views/details/DetailsSectionInfo.vue'
import DetailsSectionMetadata    from '../components/workbench/views/details/DetailsSectionMetadata.vue'
import DetailsSectionEXIF        from '../components/workbench/views/details/DetailsSectionEXIF.vue'
import DetailsSectionXMP         from '../components/workbench/views/details/DetailsSectionXMP.vue'
import DetailsSectionIPTC        from '../components/workbench/views/details/DetailsSectionIPTC.vue'
import DetailsSectionRaw         from '../components/workbench/views/details/DetailsSectionRaw.vue'
import DetailsSectionPermissions from '../components/workbench/views/details/DetailsSectionPermissions.vue'
import DetailsSectionChecksums   from '../components/workbench/views/details/DetailsSectionChecksums.vue'

// ── Details activity ────────────────────────────────────────────────────────
//
// Another pure consumer of the selection capability. Every section reads the
// focused item / path from `host.selection`, so the Details panel reflects
// whatever the active activity has selected.
const path = ctx => ctx.selection.value?.selectedPath ?? ''

export default {
  id: 'details',
  label: 'Details',
  icon: mdiInformation,
  builtin: true,

  panelViews: {
    details: {
      label: 'Details',
      icon: mdiInformation,
      sections: ['detailsInfo', 'detailsMetadata', 'detailsExif', 'detailsXmp', 'detailsIptc', 'detailsRaw', 'detailsPermissions', 'detailsChecksums'],
    },
  },

  sections: {
    detailsInfo: {
      label: 'Details',
      homeView: 'details',
      component: markRaw(DetailsSectionInfo),
      props: ctx => ({
        selectedPath: path(ctx),
        selectedItem: ctx.selection.value?.focusedItem ?? ctx.selection.value?.selectedItems?.[0] ?? null,
        details:      ctx.selection.value?.details ?? null,
      }),
      on: ctx => ({
        rename: (...a) => ctx.handleRename?.(...a),
      }),
    },
    detailsMetadata: {
      label: 'Metadata',
      homeView: 'details',
      component: markRaw(DetailsSectionMetadata),
      props: ctx => ({ selectedPath: path(ctx) }),
    },
    detailsExif: {
      label: 'Metadata: EXIF',
      homeView: 'details',
      component: markRaw(DetailsSectionEXIF),
      props: ctx => ({ selectedPath: path(ctx) }),
    },
    detailsXmp: {
      label: 'Metadata: XMP',
      homeView: 'details',
      component: markRaw(DetailsSectionXMP),
      props: ctx => ({ selectedPath: path(ctx) }),
    },
    detailsIptc: {
      label: 'Metadata: IPTC',
      homeView: 'details',
      component: markRaw(DetailsSectionIPTC),
      props: ctx => ({ selectedPath: path(ctx) }),
    },
    detailsRaw: {
      label: 'Metadata: RAW',
      homeView: 'details',
      component: markRaw(DetailsSectionRaw),
      props: ctx => ({ selectedPath: path(ctx) }),
    },
    detailsPermissions: {
      label: 'Permissions',
      homeView: 'details',
      component: markRaw(DetailsSectionPermissions),
      props: ctx => ({
        selectedPath: path(ctx),
        details:      ctx.selection.value?.details ?? null,
      }),
    },
    detailsChecksums: {
      label: 'Checksums',
      homeView: 'details',
      component: markRaw(DetailsSectionChecksums),
      props: ctx => ({
        selectedPath: path(ctx),
        details:      ctx.selection.value?.details ?? null,
      }),
    },
  },
}
