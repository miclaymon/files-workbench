import { markRaw } from 'vue'
import { mdiSync } from '@mdi/js'

import { PlaceholderPanel } from '@fw/sdk'

// Converter plugin — a placeholder for file format conversion (built out later in
// the roadmap). A first-party plugin contributing a Primary Side Bar panel (an
// Activity Bar entry) through the permission-scoped `api`.
export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({ id: api.manifest.id, label: 'Converter', icon: mdiSync })
    .addView(new PanelView({
      id: 'converter',
      label: 'Converter',
      icon: mdiSync,
      location: 'PrimarySideBar',
      sections: ['converterMain'],
      acceptsSections: false,
    }))
    .addView(new ViewSection({
      id: 'converterMain',
      label: 'Converter',
      homeView: 'converter',
      component: markRaw(PlaceholderPanel),
      props: () => ({ title: 'Converter', icon: mdiSync, note: 'File format conversion is coming soon.' }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
