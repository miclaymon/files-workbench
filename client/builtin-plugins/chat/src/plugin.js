import { markRaw } from 'vue'
import { mdiMessage } from '@mdi/js'

import PlaceholderPanel from '~/components/workbench/views/PlaceholderPanel.vue'

// Chat plugin — a placeholder for the planned LLM chat assistant (built out later
// in the roadmap). A first-party plugin contributing a single Secondary Side Bar
// panel through the permission-scoped `api`.
export function activate(api) {
  const { Activity, PanelView, ViewSection } = api

  const activity = new Activity({ id: api.manifest.id, label: 'Chat', icon: mdiMessage })
    .addView(new PanelView({
      id: 'chat',
      label: 'Chat',
      icon: mdiMessage,
      location: 'SecondarySideBar',
      sections: ['chatMain'],
      acceptsSections: false,
    }))
    .addView(new ViewSection({
      id: 'chatMain',
      label: 'Chat',
      homeView: 'chat',
      component: markRaw(PlaceholderPanel),
      props: () => ({ title: 'Chat', icon: mdiMessage, note: 'An LLM chat assistant is coming soon.' }),
    }))

  return api.activities.register(activity)
}

export function deactivate() {}
