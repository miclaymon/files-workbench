import { markRaw } from 'vue'
import { mdiInformation } from '@mdi/js'

import DetailsSectionInfo        from './components/details/DetailsSectionInfo.vue'
import DetailsSectionMetadata    from './components/details/DetailsSectionMetadata.vue'
import DetailsSectionEXIF        from './components/details/DetailsSectionEXIF.vue'
import DetailsSectionXMP         from './components/details/DetailsSectionXMP.vue'
import DetailsSectionIPTC        from './components/details/DetailsSectionIPTC.vue'
import DetailsSectionRaw         from './components/details/DetailsSectionRaw.vue'
import DetailsSectionPermissions from './components/details/DetailsSectionPermissions.vue'
import DetailsSectionChecksums   from './components/details/DetailsSectionChecksums.vue'

// Details plugin entry. A first-party plugin loaded through the plugin host (not
// compiled into ACTIVITIES) — it contributes the Details panel (eight sections) to
// the Secondary Side Bar entirely through the permission-scoped `api`.
//
// Like Preview, a pure consumer of the selection capability: every section reads
// the focused item / path from the active activity's published selection through
// the host context, so the panel reflects whatever the active activity selected.
const path = ctx => ctx.selection.value?.selectedPath ?? ''

export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({ id: api.manifest.id, label: 'Details', icon: mdiInformation })
    .addView(new PanelView({
      id: 'details',
      label: 'Details',
      icon: mdiInformation,
      location: 'SecondarySideBar',
      sections: ['detailsInfo', 'detailsMetadata', 'detailsExif', 'detailsXmp', 'detailsIptc', 'detailsRaw', 'detailsPermissions', 'detailsChecksums'],
    }))
    .addView(new ViewSection({
      id: 'detailsInfo',
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
    }))
    .addView(new ViewSection({
      id: 'detailsMetadata', label: 'Metadata', homeView: 'details',
      component: markRaw(DetailsSectionMetadata), props: ctx => ({ selectedPath: path(ctx) }),
    }))
    .addView(new ViewSection({
      id: 'detailsExif', label: 'Metadata: EXIF', homeView: 'details',
      component: markRaw(DetailsSectionEXIF), props: ctx => ({ selectedPath: path(ctx) }),
    }))
    .addView(new ViewSection({
      id: 'detailsXmp', label: 'Metadata: XMP', homeView: 'details',
      component: markRaw(DetailsSectionXMP), props: ctx => ({ selectedPath: path(ctx) }),
    }))
    .addView(new ViewSection({
      id: 'detailsIptc', label: 'Metadata: IPTC', homeView: 'details',
      component: markRaw(DetailsSectionIPTC), props: ctx => ({ selectedPath: path(ctx) }),
    }))
    .addView(new ViewSection({
      id: 'detailsRaw', label: 'Metadata: RAW', homeView: 'details',
      component: markRaw(DetailsSectionRaw), props: ctx => ({ selectedPath: path(ctx) }),
    }))
    .addView(new ViewSection({
      id: 'detailsPermissions', label: 'Permissions', homeView: 'details',
      component: markRaw(DetailsSectionPermissions),
      props: ctx => ({ selectedPath: path(ctx), details: ctx.selection.value?.details ?? null }),
    }))
    .addView(new ViewSection({
      id: 'detailsChecksums', label: 'Checksums', homeView: 'details',
      component: markRaw(DetailsSectionChecksums),
      props: ctx => ({ selectedPath: path(ctx), details: ctx.selection.value?.details ?? null }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
