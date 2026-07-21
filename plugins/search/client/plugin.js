import { markRaw } from 'vue'
import { mdiMagnifyScan } from '@mdi/js'

import SearchPanel from './components/SearchPanel.vue'

// Search plugin — project-wide file search backed by the filesystem index
// (@files-workbench/core → fw-indexer). Contributes a Primary Side Bar panel (an
// Activity Bar entry) whose results open through the permission-scoped `api`
// (needs `editor` to open directory tabs).
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
      component: markRaw(SearchPanel),
      props: () => ({ api }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
