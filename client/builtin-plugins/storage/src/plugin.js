import { markRaw } from 'vue'
import { mdiHarddisk } from '@mdi/js'

import PlaceholderPanel from '~/components/workbench/views/PlaceholderPanel.vue'

// Storage plugin — a placeholder for disk-usage / storage management (built out
// later in the roadmap). A first-party plugin contributing a Primary Side Bar
// panel (an Activity Bar entry) through the permission-scoped `api`.
export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({ id: api.manifest.id, label: 'Storage', icon: mdiHarddisk })
    .addView(new PanelView({
      id: 'storage',
      label: 'Storage',
      icon: mdiHarddisk,
      location: 'PrimarySideBar',
      sections: ['storageMain'],
      acceptsSections: false,
    }))
    .addView(new ViewSection({
      id: 'storageMain',
      label: 'Storage',
      homeView: 'storage',
      component: markRaw(PlaceholderPanel),
      props: () => ({ title: 'Storage', icon: mdiHarddisk, note: 'Disk-usage and storage management is coming soon.' }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
