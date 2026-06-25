import { markRaw } from 'vue'
import { mdiMagnifyScan } from '@mdi/js'

import PlaceholderPanel from '~/components/workbench/views/PlaceholderPanel.vue'

// Search plugin — a placeholder for project-wide file/content search (built out
// later in the roadmap). A first-party plugin contributing a Primary Side Bar
// panel (an Activity Bar entry) through the permission-scoped `api`.
export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({ id: api.manifest.id, label: 'Search', icon: mdiMagnifyScan })
    .addView(new PanelView({
      id: 'search',
      label: 'Search',
      icon: mdiMagnifyScan,
      location: 'PrimarySideBar',
      sections: ['searchMain'],
      acceptsSections: false,
    }))
    .addView(new ViewSection({
      id: 'searchMain',
      label: 'Search',
      homeView: 'search',
      component: markRaw(PlaceholderPanel),
      props: () => ({ title: 'Search', icon: mdiMagnifyScan, note: 'File and content search is coming soon.' }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
