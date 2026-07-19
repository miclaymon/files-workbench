// Example plugin client entry (illustrative — this lives in docs, not in the build).
//
// The host loads this module at runtime (fetched from the server, content-hash-
// verified, then imported), validates manifest.json, and calls activate(api). `api`
// is a permission-scoped WorkbenchAPI: it always carries the UI model classes
// (Activity, PanelView, StatusView, …) plus the facade slices the manifest's
// `permissions` grant — here "activities", "commands", and "keybindings". There is
// no api.menus / api.modals because the manifest did not request them.
//
// A plugin contributes the same way a first-party activity does: it builds an
// Activity (with its views) and registers it. activate() returns a disposer the
// host calls on unload, undoing every contribution.

// A plugin ships its own components. Inline render functions keep this example
// self-contained; a real plugin imports its own .vue single-file components and pulls
// Vue plus shared host surface from the SDK: `import { ref } from 'vue'` and
// `import { PlaceholderPanel } from '@fw/sdk'` (both externalized to the host at build).
const HelloPanel = {
  render() { return 'Hello from a plugin 👋' },
}

const HelloStatus = {
  render() { return 'hello-world active' },
}

export function activate(api) {
  const { Activity, PanelView, StatusView } = api

  // Build the activity and the surfaces it contributes.
  const activity = new Activity({ id: api.manifest.id, label: 'Hello', icon: api.manifest.icon })
    .addView(new PanelView({ id: 'hello', label: 'Hello', icon: api.manifest.icon, component: HelloPanel }))
    .addView(new StatusView({ id: 'helloStatus', region: 'left', order: 5, component: HelloStatus }))

  // A command (single source of truth) + a keybinding referencing it by id.
  api.commands.register({
    id: 'hello.greet',
    title: 'Hello: Greet',
    category: 'Hello',
    run: () => api.log('greeting from the example plugin'),
  })
  const offKey = api.keybindings.register({ key: 'ctrl+alt+h', command: 'hello.greet' })

  // Register the activity (API + surfaces) and return a disposer that removes
  // everything this plugin added.
  const offActivity = api.activities.register(activity)
  return () => { offKey(); offActivity() }
}

export function deactivate() {
  // Optional: release any resources not covered by the activate() disposer.
}
