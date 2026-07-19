import { ref, computed } from 'vue'

// ── App menus slice ───────────────────────────────────────────────────────────
// Assembles the File / Edit / View title-bar menus and the Settings menu from the
// command registry: actionable items are `{ command: id }` references resolved to
// label / enabled / toggle-state via the registry, while structural items
// (separators, submenus, disabled placeholders) stay literal. App-level menus also
// merge items contributed by any activity/plugin through the menu contribution API
// (host.facade.menus). This slice owns no behaviour — only menu assembly, the
// modal open-state, and the preferences-save passthrough.
export function useAppMenus({ host, history, views, savePrefs, statusbar, explorerPanelRef }) {
  const { commands, menus } = host.facade
  const { registry: PANEL_VIEW_REGISTRY, isViewVisible, hideView, showView } = views
  const { flashStatus } = statusbar

  // Resolve one descriptor for FloatingMenu. `{ command }` items pull their label /
  // disabled / toggle state from the registry; everything else passes through.
  // Returns null for a command id with no registered command (so a contribution
  // referencing a missing command is dropped rather than rendered broken).
  function resolveItem(item) {
    if (!item || item.separator) return item
    if (item.command) {
      const cmd = commands.get(item.command)
      if (!cmd) return null
      const label = typeof item.label === 'function' ? item.label() : (item.label ?? cmd.title)
      return {
        key:      item.command,
        label,
        icon:     item.icon ?? cmd.icon,
        action:   () => commands.execute(item.command),
        disabled: item.disabled ?? !commands.isEnabled(item.command),
        type:     cmd.toggled ? 'toggle' : item.type,
        checked:  cmd.toggled ? () => !!cmd.toggled(host) : item.checked,
      }
    }
    if (item.submenu) return { ...item, submenu: item.submenu.map(resolveItem).filter(Boolean) }
    return item
  }

  // Resolve a base tree, then append items contributed to this menu id.
  function buildMenu(tree, menuId) {
    return [...tree, ...menus.items(menuId, host)].map(resolveItem).filter(Boolean)
  }

  const fileTree = [
    { command: 'file.newFolder' },
    { command: 'file.newFile' },
  ]

  // editTree/viewTree are functions so their dynamic labels (undo/redo) and the
  // dynamic Views submenu are read inside the titleMenus computed and stay reactive.
  const editTree = () => [
    { command: 'edit.undo', label: `Undo${history.undoLabel.value ? ` "${history.undoLabel.value}"` : ''}` },
    { command: 'edit.redo', label: `Redo${history.redoLabel.value ? ` "${history.redoLabel.value}"` : ''}` },
    { separator: true },
    { command: 'edit.copy' },
    { command: 'edit.cut' },
    { command: 'edit.paste' },
  ]

  const viewTree = () => [
    { key: 'appearance', label: 'Appearance', submenu: [
      { command: 'view.toggleFullScreen',     label: 'Full Screen' },
      { command: 'view.toggleZenMode',        label: 'Zen Mode' },
      { command: 'view.toggleCenteredLayout', label: 'Centered Layout' },
      { separator: true },
      { key: 'menuBar', label: 'Menu Bar', type: 'toggle', checked: () => true, disabled: true },
      { command: 'view.togglePrimarySidebar',   label: 'Primary Side Bar' },
      { command: 'view.toggleSecondarySidebar', label: 'Secondary Side Bar' },
      { command: 'view.toggleStatusBar',        label: 'Status Bar' },
      { command: 'view.togglePanel',            label: 'Panel' },
      { separator: true },
      { key: 'moveSidebar', label: 'Move Primary Side Bar Right', disabled: true },
      { key: 'activityBarPos', label: 'Activity Bar Position', submenu: [
        { key: 'activityDefault', label: 'Default', disabled: true },
        { key: 'activityTop',     label: 'Top',     disabled: true },
        { key: 'activityBottom',  label: 'Bottom',  disabled: true },
        { key: 'activityHidden',  label: 'Hidden',  disabled: true },
      ]},
      { key: 'panelPos', label: 'Panel Position', submenu: [
        { key: 'panelBottom', label: 'Bottom', disabled: true },
        { key: 'panelTop',    label: 'Top',    disabled: true },
        { key: 'panelLeft',   label: 'Left',   disabled: true },
        { key: 'panelRight',  label: 'Right',  disabled: true },
      ]},
      { key: 'editorActionsPos', label: 'Editor Actions Position', submenu: [
        { key: 'editorActionsTitleBar', label: 'Title Bar', disabled: true },
        { key: 'editorActionsHidden',   label: 'Hidden',    disabled: true },
      ]},
      { key: 'tabBar', label: 'Tab Bar', submenu: [
        { key: 'tabBarShow', label: 'Show', disabled: true },
        { key: 'tabBarHide', label: 'Hide', disabled: true },
      ]},
      { separator: true },
      { key: 'wordWrap', label: 'Word Wrap', type: 'toggle', checked: () => false, disabled: true },
    ]},
    { key: 'editorLayout', label: 'Editor Layout', submenu: [
      { command: 'editor.splitUp',    label: 'Split Up' },
      { command: 'editor.splitDown',  label: 'Split Down' },
      { command: 'editor.splitLeft',  label: 'Split Left' },
      { command: 'editor.splitRight', label: 'Split Right' },
      { separator: true },
      { command: 'editor.layoutSingle',       label: 'Single' },
      { command: 'editor.layoutTwoColumns',   label: 'Two Columns' },
      { command: 'editor.layoutTwoRows',      label: 'Two Rows' },
      { command: 'editor.layoutThreeColumns', label: 'Three Columns' },
      { command: 'editor.layoutGrid',         label: 'Grid (2×2)' },
      { separator: true },
      { key: 'moveNewWindow', label: 'Move Editor into New Window', disabled: true },
      { key: 'copyNewWindow', label: 'Copy Editor into New Window', disabled: true },
    ]},
    { command: 'view.toggleAlwaysShowCheckboxes', label: 'Always show checkboxes' },
    { separator: true },
    { key: 'views', label: 'Views', submenu:
      Object.entries(PANEL_VIEW_REGISTRY).map(([id, meta]) => ({
        key:     `view-${id}`,
        label:   meta.label,
        type:    'toggle',
        checked: () => isViewVisible(id),
        action:  () => { isViewVisible(id) ? hideView(id) : showView(id) },
      }))
    },
    // Electron dev only: the renderer DevTools are otherwise unreachable with the
    // native menu suppressed and the window frameless.
    ...(window.electron?.isDev ? [
      { separator: true },
      { key: 'toggleDevTools', label: 'Toggle Developer Tools', action: () => window.electron.window.toggleDevTools() },
    ] : []),
  ]

  const settingsTree = [
    { command: 'workbench.openSettings',          label: 'Preferences' },
    { command: 'workbench.openKeyboardShortcuts', label: 'Keyboard Shortcuts' },
    { command: 'plugins.manage',                  label: 'Manage Plugins' },
  ]

  // Title-bar menu strip (File / Edit / View). MenuBar owns its own open/position
  // state; the items arrays stay computed here so they react to command state.
  const titleMenus = computed(() => [
    { key: 'file', label: 'File', items: buildMenu(fileTree,   'menubar/file') },
    { key: 'edit', label: 'Edit', items: buildMenu(editTree(), 'menubar/edit') },
    { key: 'view', label: 'View', items: buildMenu(viewTree(), 'menubar/view') },
  ])

  const settingsMenuItems = computed(() => buildMenu(settingsTree, 'menubar/settings'))

  // ── Modals ────────────────────────────────────────────────────────────────────
  // The command palette keeps its own open-state ref; Settings and Keyboard
  // Shortcuts are registered ModalView surfaces opened by id through the modal
  // controller (host.facade.modals), rendered by ModalHost.
  const commandPaletteOpen = ref(false)

  function openCommandPalette()    { commandPaletteOpen.value = true }
  function openSettingsModal()     { host.facade.modals.open('settings') }
  function openKeyboardShortcuts() { host.facade.modals.open('keyboardShortcuts') }
  function openPluginsManager()    { host.facade.modals.open('plugins') }

  async function savePreferences(newPrefs) {
    try {
      await savePrefs(newPrefs)
    } catch {
      flashStatus('Failed to save preferences', 2000)
      return
    }
    explorerPanelRef.value?.refresh()
  }

  return {
    titleMenus, settingsMenuItems,
    commandPaletteOpen,
    openCommandPalette, openSettingsModal, openKeyboardShortcuts, openPluginsManager, savePreferences,
  }
}
