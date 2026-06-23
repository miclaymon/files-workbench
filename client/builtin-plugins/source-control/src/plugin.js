import { markRaw } from 'vue'
import { mdiSourceBranch, mdiSourceCommit, mdiSourceRepository, mdiFileTree, mdiFormatListBulleted } from '@mdi/js'

import RepositoriesSection from './components/SourceControlRepositoriesSection.vue'
import ChangesSection from './components/SourceControlChangesSection.vue'
import GraphSection from './components/SourceControlGraphSection.vue'
import GitGraph from './components/SourceControlGitGraph.vue'
import BranchStatusWidget from './components/SourceControlBranchStatusWidget.vue'
import { initGitData, useGitData } from './git-data.js'

// Source Control plugin entry. A first-party plugin loaded through the plugin host
// (not compiled into ACTIVITIES) — it contributes its activity, a PrimarySideBar
// panel with three view sections (Repositories / Changes / Graph), an editor tab,
// and a status widget entirely through the permission-scoped `api`.
//
// Repo model: the Repositories section lists the git repos found across the open
// editors; selecting one drives the Changes and Graph sections. The Git Graph
// editor tab is independent — it pins the selected repo at open time and keeps it
// for the tab's lifetime (passed as tab params).
//
// (markRaw keeps the components out of the reactive registry's proxying.)
export function activate(api) {
  const { Activity, PanelView, ViewSection, EditorView, StatusView } = api

  // Wire the data layer to the brokered scm API and re-detect repos as the open
  // editor tabs change (a directory opened/closed may add/remove a repository).
  initGitData(api)
  const git = useGitData()
  const offTab = api.events.on('active-tab-change', () => git.refresh())

  api.commands.register({
    id: 'sourceControl.viewGitGraph',
    title: 'View Git Graph',
    category: 'Source Control',
    run: () => {
      const repo = git.selectedRepo.value
      if (!repo) return
      api.editor.openTab('git-graph', {
        title: `Git Graph — ${repo.name}`,
        params: { repoId: repo.id },
        focusExisting: false,
      })
    },
  })

  const activity = new Activity({ id: api.manifest.id, label: 'Source Control', icon: mdiSourceBranch })
    .addView(new PanelView({
      id: 'sourceControl',
      label: 'Source Control',
      icon: mdiSourceBranch,
      location: 'PrimarySideBar',
      sections: ['scRepositories', 'scChanges', 'scGraph'],
    }))
    .addView(new ViewSection({
      id: 'scRepositories',
      label: 'Repositories',
      icon: mdiSourceRepository,
      homeView: 'sourceControl',
      component: markRaw(RepositoriesSection),
    }))
    .addView(new ViewSection({
      id: 'scChanges',
      label: 'Changes',
      icon: mdiSourceBranch,
      homeView: 'sourceControl',
      component: markRaw(ChangesSection),
      actions: [
        {
          id: 'toggleChangesView',
          // Reflects the next mode (like VS Code's SCM view-as toggle).
          icon:  () => git.changesViewMode.value === 'tree' ? mdiFormatListBulleted : mdiFileTree,
          title: () => git.changesViewMode.value === 'tree' ? 'View as List' : 'View as Tree',
          run:   () => git.toggleChangesView(),
        },
        {
          id: 'viewGitGraph',
          icon: mdiSourceCommit,
          title: 'View Git Graph (git log)',
          run: () => api.commands.execute('sourceControl.viewGitGraph'),
        },
      ],
    }))
    .addView(new ViewSection({
      id: 'scGraph',
      label: 'Graph',
      icon: mdiSourceCommit,
      homeView: 'sourceControl',
      component: markRaw(GraphSection),
    }))
    .addView(new EditorView({
      id: 'gitGraph',
      kind: 'git-graph',
      label: 'Git Graph',
      icon: mdiSourceCommit,
      component: markRaw(GitGraph),
      // The tab pins its repo at open time; this binds it to the tab view.
      props: (tab) => ({ repoId: tab.params?.repoId ?? null }),
    }))
    .addView(new StatusView({
      id: 'scBranch',
      region: 'left',
      order: 2,
      component: markRaw(BranchStatusWidget),
    }))

  const offActivity = api.activities.register(activity)
  return () => { offTab?.(); offActivity() }
}

export function deactivate() {}
