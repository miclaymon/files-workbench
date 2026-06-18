import { ref, computed } from 'vue'

// ── App menus slice ───────────────────────────────────────────────────────────
// The File / Edit / View title-bar menus, the Settings menu, the command-palette
// command list (flattened from those menus), and the modal open-state. This is the
// aggregation layer that wires app-wide state into menu descriptors, so it pulls
// from most other slices — it owns no domain logic beyond menu assembly + palette
// flattening.
export function useAppMenus({ fileOps, selection, editor, history, prefs, savePrefs, statusbar, explorerPanelRef, appearance, views }) {
  const { createNewFolder, createNewFile, doUndo, doRedo, copyToClipboard, cutToClipboard, doPaste, clipboard } = fileOps
  const { selectedItems } = selection
  const { editorController } = editor
  const { flashStatus } = statusbar
  const { zenMode, centeredLayout, sidebarVisible, rightpaneVisible, statusbarVisible, bottompaneVisible } = appearance
  const { registry: PANEL_VIEW_REGISTRY, isViewVisible, hideView, showView } = views

  const fileMenuItems = computed(() => [
    { key: 'newfolder', label: 'New Folder', action: createNewFolder },
    { key: 'newfile',   label: 'New File',   action: createNewFile   }
  ])

  const editMenuItems = computed(() => [
    { key: 'undo', label: `Undo${history.undoLabel.value ? ` "${history.undoLabel.value}"` : ''}`, action: doUndo, disabled: !history.canUndo.value },
    { key: 'redo', label: `Redo${history.redoLabel.value ? ` "${history.redoLabel.value}"` : ''}`, action: doRedo, disabled: !history.canRedo.value },
    { separator: true },
    { key: 'copy',  label: 'Copy',  action: () => copyToClipboard(selectedItems.value) },
    { key: 'cut',   label: 'Cut',   action: () => cutToClipboard(selectedItems.value)  },
    { key: 'paste', label: 'Paste', action: doPaste, disabled: clipboard.value.count === 0 },
  ])

  const viewMenuItems = computed(() => [
    { key: 'appearance', label: 'Appearance', submenu: [
      { key: 'fullscreen',     label: 'Full Screen',     type: 'toggle',
        checked: () => !!document.fullscreenElement,
        action:  () => { document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen() } },
      { key: 'zenMode',        label: 'Zen Mode',        type: 'toggle', checked: () => zenMode.value,        action: () => { zenMode.value        = !zenMode.value        } },
      { key: 'centeredLayout', label: 'Centered Layout', type: 'toggle', checked: () => centeredLayout.value, action: () => { centeredLayout.value = !centeredLayout.value } },
      { separator: true },
      { key: 'menuBar',          label: 'Menu Bar',           type: 'toggle', checked: () => true,                      disabled: true },
      { key: 'primarySidebar',   label: 'Primary Side Bar',   type: 'toggle', checked: () => sidebarVisible.value,   action: () => { sidebarVisible.value   = !sidebarVisible.value   } },
      { key: 'secondarySidebar', label: 'Secondary Side Bar', type: 'toggle', checked: () => rightpaneVisible.value, action: () => { rightpaneVisible.value = !rightpaneVisible.value } },
      { key: 'statusBar',        label: 'Status Bar',         type: 'toggle', checked: () => statusbarVisible.value, action: () => { statusbarVisible.value = !statusbarVisible.value } },
      { key: 'panel',            label: 'Panel',              type: 'toggle', checked: () => bottompaneVisible.value, action: () => { bottompaneVisible.value = !bottompaneVisible.value } },
      { separator: true },
      { key: 'moveSidebar',      label: 'Move Primary Side Bar Right', disabled: true },
      { key: 'activityBarPos',   label: 'Activity Bar Position', submenu: [
        { key: 'activityDefault', label: 'Default', disabled: true },
        { key: 'activityTop',     label: 'Top',     disabled: true },
        { key: 'activityBottom',  label: 'Bottom',  disabled: true },
        { key: 'activityHidden',  label: 'Hidden',  disabled: true },
      ]},
      { key: 'panelPos',         label: 'Panel Position', submenu: [
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
      { key: 'splitUp',    label: 'Split Up',    action: () => editorController.splitActiveGroup('top') },
      { key: 'splitDown',  label: 'Split Down',  action: () => editorController.splitActiveGroup('bottom') },
      { key: 'splitLeft',  label: 'Split Left',  action: () => editorController.splitActiveGroup('left') },
      { key: 'splitRight', label: 'Split Right', action: () => editorController.splitActiveGroup('right') },
      { separator: true },
      { key: 'single',       label: 'Single',         action: () => editorController.applyLayoutPreset('single') },
      { key: 'twoColumns',   label: 'Two Columns',    action: () => editorController.applyLayoutPreset('twoColumns') },
      { key: 'twoRows',      label: 'Two Rows',       action: () => editorController.applyLayoutPreset('twoRows') },
      { key: 'threeColumns', label: 'Three Columns',  action: () => editorController.applyLayoutPreset('threeColumns') },
      { key: 'grid',         label: 'Grid (2×2)',     action: () => editorController.applyLayoutPreset('grid') },
      { separator: true },
      { key: 'moveNewWindow', label: 'Move Editor into New Window', disabled: true },
      { key: 'copyNewWindow', label: 'Copy Editor into New Window', disabled: true },
    ] },
    { key: 'alwaysShowCheckboxes', label: 'Always show checkboxes', type: 'toggle', checked: () => prefs.explorer.alwaysShowCheckboxes, action: () => { prefs.explorer.alwaysShowCheckboxes = !prefs.explorer.alwaysShowCheckboxes } },
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
  ])

  const settingsMenuItems = computed(() => [
    { key: 'preferences', label: 'Preferences', action: openSettingsModal },
    { key: 'keyboard-shortcuts', label: 'Keyboard Shortcuts', action: openKeyboardShortcuts }
  ])

  // Title-bar menu strip (File / Edit / View). MenuBar owns its own open/position
  // state; the items arrays stay computed here so they react to app state.
  const titleMenus = computed(() => [
    { key: 'file', label: 'File', items: fileMenuItems.value },
    { key: 'edit', label: 'Edit', items: editMenuItems.value },
    { key: 'view', label: 'View', items: viewMenuItems.value },
  ])

  // ── Command palette ───────────────────────────────────────────────────────────

  const commandPaletteOpen        = ref(false)
  const settingsModalOpen         = ref(false)
  const keyboardShortcutsModalOpen = ref(false)

  function flattenMenuItems(items, category = '') {
    const out = []
    for (const item of items) {
      if (item.separator || item.type === 'separator') continue
      const path = category
        ? (item.submenu ? `${category} > ${item.label}` : category)
        : (item.submenu ? item.label : '')
      if (item.submenu) {
        out.push(...flattenMenuItems(item.submenu, path))
      } else if (item.action && !item.disabled) {
        out.push({
          key:       item.key ?? item.label,
          label:     item.label,
          category:  path,
          action:    item.action,
          checkable: item.type === 'toggle',
          checked:   item.type === 'toggle' ? !!(item.checked?.()) : false,
        })
      }
    }
    return out
  }

  const allCommands = computed(() => [
    ...flattenMenuItems(fileMenuItems.value,     'File'),
    ...flattenMenuItems(editMenuItems.value,     'Edit'),
    ...flattenMenuItems(viewMenuItems.value,     'View'),
    ...flattenMenuItems(settingsMenuItems.value, 'Settings'),
  ])

  function openCommandPalette() { commandPaletteOpen.value = true }
  function openSettingsModal() { settingsModalOpen.value = true }
  function openKeyboardShortcuts() { keyboardShortcutsModalOpen.value = true }

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
    titleMenus, settingsMenuItems, allCommands,
    commandPaletteOpen, settingsModalOpen, keyboardShortcutsModalOpen,
    openCommandPalette, openSettingsModal, openKeyboardShortcuts, savePreferences,
  }
}
