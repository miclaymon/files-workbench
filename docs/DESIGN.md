# Design & Architecture

## Overview

Files Workbench is a multi-process desktop application:

```
┌──────────────────────────────────────┐
│  Electron main process               │
│  (client/electron/main.js)           │
│  ┌────────────────────────────────┐  │
│  │  Renderer process              │  │
│  │  Vue 3 SPA (Vite)              │  │
│  │  http://localhost:3000         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
              │ HTTP /_api/v1/*
┌──────────────────────────────────────┐
│  Go HTTP server                      │
│  data:    http://localhost:8001      │
│  control: http://localhost:8002      │
└──────────────────────────────────────┘
```

There is no dev proxy: in development the Vite dev server (port 3000) serves the client, which calls both Go servers directly with absolute URLs (`client/lib/api-config.js`; CORS is permissive on the Go side) — exactly as the packaged app does. In production `vite build` emits a static bundle (`client/dist/`) that Electron loads directly from disk.

## Frontend component model

### Component folder structure

All workbench components live under `client/components/workbench/` and are grouped into seven subfolders (every component is imported explicitly — there are no auto-imports):

| Folder | Contents |
|---|---|
| `shell/` | `TitleBar`, `MenuBar`, `CommandCenter`, `AppHistory`, `ActivityBar`, `StatusBar` (a host of activity status widgets), `PrimarySideBar`, `SecondarySideBar`, `BottomPanel`, `NotificationPanel`, `NotificationItem`, `NotificationJobGroup`, `NotificationOperation`; `status/` subfolder for the self-gating status widgets — the app chrome and resizable workspace panes |
| `layout/` | `ViewContainer`, `SplitViewArea`, `SplitView`, `SplitSectionArea`, `SplitSection`, `ViewContentHost`, `ViewActions`, `ViewDropOverlay`, `Sash` |
| `editor/` | `Editor`, `GridView`, `EditorGroup`, `EditorDropOverlay`, `TabContentHost` (resolves a tab's `kind` → registered tab view), `DirectoryTab`, `HomePage`, `MonacoEditor` |
| `directory/` | `DirectoryPanel`, `DirectoryLayout`, all `Directory*Layout` variants, `DirectoryBreadcrumb`, `DirectoryHoverPreview`, `AudioPlayer`, `VideoPlayer` |
| `explorer/` | `ExplorerPanel`, `TreeList`, `TreeItem`, `OpenEditorsView` |
| `views/` | `ChatPanel`, `DetailsPanel`, `PlaceholderPanel` (Preview's and Debug's components moved into their runtime plugins under `/plugins`) |
| `ui/` | `FloatingMenu`, `ContextMenu`, `Tooltip`, `CommandPalette`, `ModalEditor` (shared modal chrome), `ModalHost` (renders the active registered modal), `SettingsModal`, `KeyboardShortcutsModal` |

`Workbench.vue` lives at the root of `components/workbench/`.

### Composable folder structure

Composables live in `client/composables/` and are split into three layers (imported explicitly by path):

| Folder | Contents |
|---|---|
| `composables/*.js` | Foundational services and utilities: `useWorkspaces`, `usePreferences`, `useFileOpsQueue`, `useActionHistory`, `useDebugLog`, `useLayoutGrid`, `useViewRegistry`, `usePreferenceSchema` (contributed Settings sections), `useDirectoryFileTree` (file-tree builder), `useIconRegistry` (icon-theme registry), `useLightbox` (overlay service), `useCustomIcon`, `useRpc` |
| `composables/activity/` | Inter-activity API (see Activity system): `useEmitter` (pub/sub primitive), `useActivityHost` (the broker + frozen `facade`, provided as `viewCtx`), and the contribution registries `useCommandRegistry` / `useKeybindingRegistry` / `useHookRegistry` |
| `composables/plugins/` | Plugin loader (see Plugin system): `usePluginApi` (builds the frozen, permission-scoped plugin API) and `usePluginHost` (loads/unloads `{ manifest, module }` pairs, dependency-ordered, with lifecycle) |
| `composables/interaction/` | UI-behavior primitives consumed by individual components: drag systems (`useDrag`, `useRightClickDrag`, `useTreeDrag`, `useEditorDnd`, `useViewDrag`), `useClickDebounce`, `useHoverPreview`, `useSideBar`, `useStackResize` |
| `composables/workbench/` | Workbench assembly-root slices — see Workbench shell section: `useStatusBar`, `useNotifications`, `useArchive`, `useEditorGrid`, `useViewLayout`, `useSelection`, `useFileOperations`, `useFileContextMenus`, `useAppMenus`, `useWorkbenchKeyboard` |

Activity definition modules live in `client/activities/` (a sibling of `components/` and `composables/`) — one file per activity plus `index.js` (the ordered activities list). Surface lookups and tab-kind→activity resolution live in the dynamic `useViewRegistry.js`. The UI **model classes** these are wrapped into (`Activity`, `View`, …) live in `client/models/ui/`, and the plugin model (manifest validator, permissions) in `client/models/plugin/`. First-party plugins live in `client/builtin-plugins/`. See the Activity system and Plugin system sections.

### Workbench shell

`Workbench.vue` is the root component, structured as a thin **assembly root**: its business logic and state are decomposed into composable "slices" (hand-rolled store slices, à la Pinia), which it instantiates, wires together by passing each slice's return into its dependents (dependency injection by parameter — no hidden globals, no circular deps), and `provide`s the few that deep descendants need. The leaf slices are instantiated first; the order respects the dependency graph below. The slices:

- `useStatusBar` — server-ping lifecycle, the transient status line (+ `flashStatus`), and directory stats *(leaf)*
- `useArchive` — archive-file detection (`isArchiveItem`) + host capabilities *(leaf)*
- `useEditorGrid` — the editor split-grid model, every structural mutation, and the provided `editorController`; deliberately selection-free so the selection dependency stays one-directional
- `useViewLayout` — the panel/sidebar layout engine: per-container view lists, merge groups, per-view section state, every drag-driven layout mutation (transfer / merge / unmerge / section adoption), and the provided `workbenchChrome`
- `useSelection` — current selection + explorer/directory/open/navigate handlers (consumes the editor grid). Now instantiated by the **Explorer activity** (`activities/explorer.js`), which wraps it as the `selection` capability; Workbench pulls its refs/handlers from `host.api('explorer')`
- `useFileOperations` — create/rename/trash/delete/compress/extract/paste/move/undo + clipboard, elevation dialog, and the install prompt
- `useFileContextMenus` — the cursor-positioned ContextMenu item lists (editor tab / background / right-drag / item); builds owner base items and appends contributed items via `menus.items(menuId)`
- `useAppMenus` — the File/Edit/View + Settings menus assembled from the **command registry** (`{ command }` refs + contributed items) and the modal open-state
- `useWorkbenchKeyboard` — window-level keyboard **dispatcher** (chord → command via the keybinding registry); self-manages its listener

`useWorkspaces` is the single persistence instance; Workbench keeps it and passes it to `useViewLayout` (and pulls `getInitialEditor`/`saveEditor`/`explorerContext` for the editor + host). Workbench still owns the small local appearance/maximize toggles. The `viewCtx` that registry-bound content binds against is now the **activity host** (see Activity system), which Workbench builds and `provide`s; it assigns its slice handlers onto the host once the slices are instantiated. It composes the visible chrome from `shell/` components, which stay presentational (props in, events out):

- `TitleBar` (`shell/`) — brand + `MenuBar` (File/Edit/View, each `{ key, label, items }`; the items arrays stay computed in `Workbench`), `AppHistory` (global back/forward — a placeholder, distinct from a tab's navigation history and from undo/redo), `CommandCenter` (the omnibar → command palette), and Electron window controls. `MenuBar` and `ActivityBar` own their own dropdown open/position state locally.
- `ActivityBar` (`shell/`) — primary-view switcher, now **registry-driven**: it renders an icon per `listPrimaryViews()` entry (panels with `location: 'PrimarySideBar'`, e.g. Explorer + the Source Control plugin) so a plugin's activity appears automatically, plus the Settings gear (which owns its own menu, fed `settingsMenuItems`); emits `toggle-view`.
- `PrimarySideBar` (`shell/`) — the left pane: a non-droppable `ViewContainer` showing the single active primary view (Explorer's Open Editors + Places sections, or any other registered `PrimarySideBar` panel); switches on the active primary view chosen in the Activity Bar
- `Editor` (`editor/`) — the recursive split grid of editor groups; receives `viewRoot`/`activeGroupId`/`maximizedGroupId`/`prefs` and a `registerGroup` ref-callback prop (the `useEditorGrid` slice owns the EditorGroup instance registry it uses for imperative refresh/rename), and re-emits every EditorGroup event up unchanged
- `SecondarySideBar` + `BottomPanel` (`shell/`) — the two movable, droppable panes, each wrapping a tabbed `ViewContainer` (see ViewContainer panel system) plus its maximize/hide actions
- All floating UI (context menus, right-drag drop menus, command palette, settings modal, keyboard shortcuts modal)
- `StatusBar` (`shell/`) — now an activity-driven host: it renders the registered status widgets (`shell/status/*`) by region (left/right) and carries no props. The Explorer widget shows directory item count/size, selection count/size, and the clipboard pill; the core Workbench widgets show the transient message, running-job meter, server-connection indicator, and notification bell. Each widget injects the host and self-gates.

The three panes share `useSideBar.js`, which (1) runs the mousedown drag-resize loop, reporting new sizes back via `v-model:width`/`v-model:height` so persistence stays in `Workbench`, and (2) attaches a `ResizeObserver` that derives each pane's split direction (`dropDirection`) from its measured shape — tall → `col`, wide → `row` — instead of hard-coding it. So a side bar stacks merged views vertically and the (wide) bottom panel stacks them horizontally automatically, and the direction adapts if a pane is ever repositioned. Cross-container coordination (`handleViewTransfer`/`Merge`/`Unmerge`/`handleSectionMove`, which move views and sections *between* panes) lives in the `useViewLayout` slice instantiated by `Workbench`; the pane components just forward `ViewContainer`'s events.

The View menu exposes two submenus: **Appearance** (toggle sidebar/panel/status bar visibility, zen mode, centered layout) and **Views** (toggle individual views such as Preview, Details, Chat, and Debug on or off). Toggling a view off marks it as intentionally hidden in the workspace; startup recovery (`recoverMissingViews`) skips hidden views so they stay off across reloads.

### Editor groups (split grid)

The editor area is a recursive split-view tree (VS Code's "grid") defined in `useLayoutGrid.js`. A node is either a **branch** (`direction: 'row' | 'column'`, `children[]`, and `sizes[]` of flex-grow weights) or a **leaf** = an **editor group** holding `tabs[]` + `activeTabId`. `GridView.vue` renders the tree recursively, placing a `Sash.vue` resize handle between siblings; leaves are emitted through a scoped slot so the engine stays generic (it will later host side-bar/panel views too).

`Workbench.vue` holds the reactive tree (`editorRoot`), the focused group (`activeGroupId`), and the maximized group (`maximizedGroupId`). When `maximizedGroupId` is set, `viewRoot` collapses to just that leaf so `GridView` renders only the maximized group. `Workbench` `provide`s an `editorController` (inject key `editorController`) to the groups with the structural ops: `activateTab`, `promoteTab`, `togglePin`, `closeTab`, `dropTab`, `splitActiveGroup`, `applyLayoutPreset`, `closeAllTabs`, `toggleTabPreviews`, `maximizeGroup`, `toggleLockGroup`. New tabs open in the active group; `activeTab` (the active group's active tab) drives the right panel, status bar, and selection. Each `EditorGroup.vue` re-emits its content events (select/open/navigate/…) up to `Workbench`, preserving the centralized-logic pattern. The grid is persisted per workspace (see State management).

Each leaf carries two per-group flags: `tabPreviews` (default `true`) — when `false`, single-click explorer navigation opens a permanent tab instead of the italic preview slot; `locked` — when `true`, the group rejects incoming tab additions and drops from other groups. `EditorGroup` shows a fixed-right actions section outside the scrollable tab strip: a lock icon (when locked, click to unlock) and a `⋯` button that opens a menu with Close All, Enable Tab Previews (toggle), Maximize/Restore Group, and Lock/Unlock Group.

Tabs support preview mode (`mode: 'peek'`, italic, one reused slot per group; promoted to `'normal'` on double-click or navigation), sticky pinning (`pinned`, grouped to the front with a pin affordance), horizontal-scroll overflow with a dropdown, and region-aware drag (see Drag and drop). View ▸ Editor Layout offers split up/down/left/right and presets (Single, Two Columns, Two Rows, Three Columns, Grid 2×2). Keyboard: `Ctrl+\` split right, `Ctrl+1..9` focus group, `Ctrl+W` close tab (Electron only — browser intercepts), `Ctrl+,` open Settings, `Ctrl+Shift+P` open Command Palette.

### Modal editors (Settings, Keyboard Shortcuts)

Modals are a **registered surface**: an activity contributes a `ModalView` (id, title, icon, body component, optional context actions), `facade.modals.open(id)` makes it active, and `ui/ModalHost.vue` renders the active one inside the shared `ui/ModalEditor.vue` chrome. `ModalEditor` is the reusable shell — a titlebar with icon + title on the left and a permanent **Open-in-Main-Window / Maximize / Close** trio (plus context actions) on the right; Esc closes via a capture-phase listener. *Open in Main Window* `promote`s the modal to an editor tab (the same `EditorView` presented as a tab). Settings and Keyboard Shortcuts are modals declared on the **Workbench** activity (their `.vue` files are body-only; the host supplies the chrome).

`SettingsModal.vue` is styled after VS Code's Settings editor: a top search bar, a left sidebar listing sections, and a scrollable main area with sticky headings. Sections are derived from the **merge** of the static base schema (`preferences.schema.json` via the `#preferences-schema` alias) and **contributed** sections — activities/plugins call `api.preferences.register({ key, title, properties })` (registry: `usePreferenceSchema.js`), so their settings appear automatically. Top-level scalars form a **General** section; `type: object` properties (base or contributed) each become a named section; `x-devOnly` properties hide unless Developer Mode is on. `getVal` falls back to the schema default (so a contributed setting renders before it's set) and `setVal` creates intermediate namespaces (so a contributed section's first write persists). Each change updates a `localPrefs` deep copy and schedules a 300 ms-debounced `savePrefs` (no manual Save); a modified-from-default setting shows a blue dot; a brief `✓ Saved` appears after each write. Opens via `Ctrl+,` or Settings ▸ Preferences.

`KeyboardShortcutsModal.vue` is a read-only reference table (**Command / Keybinding / When / Source** columns, `<kbd>` chips, search filtering) built from the **live** command + keybinding registries — one row per command×binding, grouped by category, unbound commands shown with no chord. Opens via Settings ▸ Keyboard Shortcuts.

### Command palette

`CommandPalette.vue` is a floating modal (teleported to `<body>`) driven by a **mode-prefix** architecture: a leading prefix selects a mode — `>` Show and Run Commands (wired), `?` the mode list, empty = Go to File (stub). The title-bar omnibar opens the **home view** (mode list + results); `Ctrl+P` opens Go to File; `Ctrl+Shift+P` opens `>` commands. New modes (file/symbol search) drop into the same provider model without UI changes.

In commands mode the items come from the **command registry** (`Workbench`'s `paletteCommands`): `commands.list()` filtered to enabled commands that opt in (`palette !== false`), each annotated with its **bound chord** (reverse lookup via `keybindings.forCommand`) and a `toggled` checkmark; with an empty query they split into **recently used** (persisted to localStorage) + **other commands**. So commands contributed by any activity/plugin appear automatically with their shortcut.

Fuzzy scoring ranks results: exact → prefix → substring → sequential character match → excluded. Arrow keys navigate, Enter executes (deferred one frame so the palette closes first), Escape dismisses. The open handlers fire before the input-focus guard, so the palette opens from any context.

### ViewContainer panel system

`ViewContainer.vue` is the unified panel container used for the primary sidebar, secondary sidebar, and bottom panel. It renders a tab strip at the top and, for the active tab, delegates its body to a recursive **SplitView / SplitSection** hierarchy:

```
ViewContainer (tab strip + ⋯ menu + merge/transfer orchestration)
└─ SplitViewArea     stacks SplitViews for one tab slot; heading shown only when >1
   └─ SplitView      a whole View context; lighter "context" heading; drag-out = unmerge
      └─ SplitSectionArea   stacks the View's SplitSections; heading shown only when >1
         └─ SplitSection     a UI group within a View; renders ViewContentHost(:id)
```

Two orthogonal axes drive it. `mergedSlots` (`{ [primaryId]: [{ id, collapsed, size }] }`) tracks **which Views stack in a slot** (the SplitViewArea level). `viewSections` (`{ [viewId]: Section[] }`, `Section = { id, homeViewId, collapsed, size, instanceId, locked? }`) tracks **each View's own sections** (the SplitSectionArea level). `instanceId` is a uuidv4 generated at section creation and backfilled by `_normalizeSections` for legacy data; it is used as the `v-for` key so Vue can track two sections with the same `id` as distinct DOM nodes (needed for duplicate sections). A heading appears only when its level has more than one sibling — so a standalone View with one implicit self-section renders as plain content, exactly as before. The primary sidebar is just a non-droppable (`:droppable="false"`) single-View container whose Explorer view owns the `places` + `openEditors` sections; there is no longer a separate "sections mode".

**Content registry**: view/section content is rendered by id through `ViewContentHost.vue`, which looks the id up in `useViewRegistry.js` (`{ label, icon, component, props(ctx), on(ctx), homeView, sections, actions, expose }`) and binds it against a shared `viewCtx` provided by `Workbench.vue` — which is the **activity host** (see Activity system). Rendering by id (rather than container-scoped named slots) lets any view or section render in any container — the prerequisite for cross-context section drag.

**Tab drag**: each tab is HTML5-draggable. Dropping a tab onto another container's tab strip reorders or transfers it (secondary sidebar ↔ bottom panel). Shared drag state lives in `useViewDrag.js` (`activeDrag` + `DRAG_MIME`).

**Drag-to-merge**: while a tab drag is active, each visible slot shows a `ViewDropOverlay`; dropping stacks the dragged view as another `SplitView` in the target slot. The `dropDirection` prop controls whether SplitViews stack top/bottom (`col`) or left/right (`row`); it is supplied by the owning pane and derived from the pane's measured shape (see `useSideBar.js` in the Workbench shell section), so side bars stack vertically and the bottom panel horizontally. Dragging a SplitViewHeading back to the tab bar extracts it (via the `fromMergedViewId` field on `DRAG_MIME`, distinguished in `onBarDrop`).

**Section reorder & cross-context adoption**: SplitSection headings are draggable (their own `SECTION_DRAG_MIME`, separate from tab/view drags), carrying `{ sectionId, fromViewId, fromContainerId, homeViewId, locked, dockable }`.

- **Reorder** — dropping within the same area reorders in place (no forced ordering; even a locked section like Places can be reordered within Explorer).
- **Adoption (drop on another View's body)** — a section travels *with* its biological parent View. Rather than being inserted into the target View's own section list, the section's `homeViewId` View **materialises as its own SplitView** in the target slot (exactly like merging a tab), and the section is filed under `viewSections[homeViewId]` in that container. `section-move` → `handleSectionMove` removes it from the source parent (de-materialising a now-empty floated parent) and `_materializeParentSplitView` adds the parent next to the drop target. A View *always* holds a given home's sections under that home's id, so a floated parent groups all of one home's relocated sections: with one section its `SplitView` heading folds in the section name (`Explorer: Open Editors`); with two or more it reads just `Explorer` and the section headings reappear.
- **New tab (drop on the tab strip)** — `ViewContainer`'s tab bar accepts section drops too; `section-to-tab` → `handleSectionToTab` surfaces the biological parent as a standalone tab (labelled by the parent, e.g. `Explorer`) holding the section. Tab labels/icons fall back to the content registry so a floated parent tab renders correctly.
- **Section menus** — `ViewContainer`'s ⋯ ("More actions…") menu lists one line per *present instance* in view order, followed by a ghost line for each declared true-child section with no present instance. Toggling a present instance removes that specific instance (identified by `instanceId`); toggling a ghost adds a fresh one. This means declared sections stay available forever (a hidden true child can always be re-added via its ghost), while adopted/foreign sections vanish once removed. The same builder feeds the section heading right-click context menu, so both are always in sync.
- **Context menus** — right-clicking a view tab opens a **tab context menu** (Hide '\<Tab\>', Hide Badge, Move to Secondary Side Bar / Bottom Panel); right-clicking the header bar opens a **header context menu** (a checkbox per view belonging to this area including hidden ones, Show Tab Icons, and container-specific tail actions like Hide Secondary Side Bar / Hide Panel). Right-clicking a section heading opens a **section context menu** (Hide '\<Section\>', Hide Badge, then the full section list). The event travels up `SplitSection → SplitSectionArea → SplitView → SplitViewArea → ViewContainer`. All three use a single cursor-positioned `FloatingMenu` shared within the container. These menus only appear in movable containers (Secondary Side Bar and Bottom Panel); the primary sidebar gets the ⋯ dropdown but no tab/header menus.
- **Chrome state** — a `workbenchChrome` object is `provide()`d once by `Workbench.vue` and injected by `ViewContainer`. It exposes: hide/show/toggle view visibility (recording each view's last container for restore), move a view to another container, query which views belong to a container (visible + hidden, with shortcut hints), hide a container, toggle `showTabIcons`, and a badge-visible placeholder. This avoids threading props through the three shell wrappers. `hideView` delegates to a shared internal that strips the view from all containers and marks it in `hiddenViews`; the existing Views settings menu now reuses the same functions.
- **Tab icons** — `prefs.workbench.showTabIcons` (default `true`, persisted) controls whether icons appear in the tab strip. Toggled by Show Tab Icons in the header context menu.
- **Duplicate guard** — a View won't hold the same section id twice unless its registry entry sets `allowDuplicateSections: true` (default off). When off, dropping a section a View already holds is refused — the not-allowed cursor on the home-View body (`acceptsDrop`), and authoritatively with an alert in `handleSectionMove`/`handleSectionToTab` (`_blockDuplicateDrop`). When on, the `v-for` keying by `instanceId` ensures Vue treats the two identical sections as distinct DOM nodes.
- **Semantic DOM attributes** — rendered section and view elements carry `data-section-id` (e.g. `"Workbench:Explorer.OpenEditors"`), `data-section-instance-uuid` (the `instanceId`), and `data-view-id` (e.g. `"Workbench:Explorer"`) for automation and DevTools inspection. Helper functions `viewDataId(viewId)` and `sectionDataId(sectionId, homeViewId)` in `useViewRegistry.js` generate the `Workbench:Namespace.SubId` format.
- **Collapsed section divider** — when a collapsed section follows an expanded section (or any section follows a non-first section without a sash between them), a `border-top: 1px solid var(--border)` is applied to its heading via the `hasDivider` prop (`i > 0 && !needsSash(sections, i)`). This gives a clear visual boundary without adding an interactive sash handle.
- **`viewSections` cross-container migration** — `handleViewTransfer`, `handleViewMerge`, and `handleViewUnmerge` now migrate `viewSections` data from the source container ref to the destination when moving a view (and any merged views) between containers. Previously, Explorer dragged from the Secondary Side Bar to the Bottom Panel would show "Unknown view: explorer" because `panelViewSections.explorer` was `undefined` and the fallback self-section had no registered component.

Drag state (`activeDrag`/`activeSectionDrag` in `useViewDrag.js`) is normally cleared on `dragend`, but a drop that removes the dragged element (merge, re-absorb, transfer, adoption) can stop `dragend` from firing — so the drop handlers (`clearDragState` in `ViewContainer`, and `SplitSectionArea.onAreaDrop`) clear it explicitly, otherwise a stale `activeDrag` keeps the drop overlay mounted and silently blocks interaction.

A View's own self-section (`id === viewId`) can't be dragged out at all; **locked** (Places) and `dockable: false` sections can be reordered but are barred from *leaving* their biological parent (rejected at the drop side, both on bodies and the tab strip). A View only accepts *incoming* docked sections when its registry entry's `acceptsSections !== false` — Preview and Chat opt out (single-section, headerless), so they're never dock targets.

**Action buttons** (`ViewActions.vue`, bound to `viewCtx`) **cascade by hierarchy**: a section's buttons live in its **section heading** when that's shown, otherwise they bubble to the **view heading** (SplitViewHeading), otherwise to the **tab strip**; a view's own buttons live in its view heading when shown, otherwise the tab strip; panel actions (maximize/hide) always sit at the right of the tab strip. Each level renders the groups it holds inline, separated by a thin divider (`ViewActions` takes either a flat `actions` array or a `groups` array of arrays, and drops empty groups so no stray separators appear), with panel actions as the last group. The registry helpers drive this: `sectionActions`/`viewActions` (a view's own registry `actions`), `sectionHeadingShown(sections, section)`, and `bubbledSectionActions(viewId, sections)` (named sections whose heading is hidden). A section opts to **always** show its heading via `alwaysShowHeading` (set on Places) — so Places keeps its heading (and *Refresh*) even as Explorer's only section, rather than hiding the heading and bubbling the button up. Examples: Debug's *Clear* (view action), Places' *Refresh* (section action).

`ViewActions` also renders **editor-tab actions**: `EditorGroup` renders the *active tab's* `EditorView.actions` (resolved via `tabViewForKind(activeTab.kind)`) in its tab bar, bound to a tab-aware ctx (`{ ...host, tab }`) passed through the `ctx` prop instead of the injected `viewCtx`. Beyond `disabled`, an action may declare `when(ctx)` to gate its **visibility** — used so Markdown's *Open as Preview* / *Open Preview to the Side* appear only on a Markdown source-preview tab. Example: the Preview plugin's `previewTab` view.

**Re-absorbing a floated View**: when a section has been floated into another container as its parent View (a SplitView or a standalone tab — see adoption above), dragging that View (its tab or its SplitViewHeading) back onto the *same* View elsewhere folds its sections home and discards the floated copy. The drop is detected when the dragged view id equals the target view id from a different container (`overlayFor` shows the drop overlay even where view stacking is disabled, e.g. the non-droppable primary sidebar); `content-drop` → `view-reabsorb` → `handleViewReabsorb` in `Workbench.vue`.

**View management**: `PANEL_VIEW_REGISTRY` maps view IDs to icons, labels, and display-only shortcut hints. `VIEW_DEFAULT_CONTAINER` maps each ID to its home container. `isViewVisible` checks all containers and merge groups; `addView(id, preferredCid)` places a missing view back in a preferred or default container; `recoverMissingViews` (called on `onMounted`) restores any views lost due to corrupted workspace state, skipping those in `hiddenViews`. A runtime `viewLastContainer` map remembers each view's most recent container so that re-showing a hidden view returns it home rather than defaulting to the registry default.

Note: the **Activity Bar** (`.activitybar`, the icon-only strip) is a distinct, separate VS Code concept from the views described above — it switches which view container is shown in the primary sidebar. Its entries are registry-driven (`listPrimaryViews()`: panels with `location: 'PrimarySideBar'`), so registering a `PrimarySideBar` panel (first-party or plugin) adds an icon automatically.

### Context menu

`ContextMenu.vue` renders two independent `<teleport to="body">` elements — one for the main menu panel and one for the submenu panel — so neither is clipped by ancestor `overflow: hidden` containers.

Each menu item has two separate click areas: the `.cm-item-label` span (fires the action) and a `.cm-item-sub-btn` chevron button (opens the submenu). This split-button pattern means clicking the label of an item that has a submenu fires the default action immediately rather than requiring an extra click to open the sub-panel.

Quick-action icon buttons at the top of the menu render MDI SVG icons when `icon` is an MDI path string (detected by `isMdiPath`: starts with `'M'`).

Submenu position is computed from the chevron button's `getBoundingClientRect()` and flipped left if it would overflow the right viewport edge. Main menu position is clamped to the viewport in a `watch` that fires after `nextTick` once the menu DOM is mounted.

### Directory view

`DirectoryTab` fetches directory listings and manages navigation history. It passes items down to `DirectoryPanel`, which applies client-side sort/filter via a `processedItems` computed property, then renders the result through `DirectoryLayout`.

`DirectoryLayout` is a single unified component that handles all view modes — grid (XS through XXL), list, details, gallery-grid, gallery-mosaic, and feed — via a `data-layout` attribute on its root element. All layout-specific behavior is CSS-driven from that attribute. The layout prop is set by the user via a picker button in `DirectoryPanel`.

### Sort and filter

`DirectoryPanel` owns `sortField`, `sortDir`, `filterTypes`, `filterSizePreset`, and `filterDatePreset` refs. A `processedItems` computed property applies all active filters and then sorts, always placing directories first. The active state is shown in a contextual bar below the navigation header with removable chips.

### Explorer tree

`ExplorerPanel` uses `useDirectoryFileTree` in **lazy** mode: virtual roots (`Root`, `Home`, `Drives`) are loaded by `loadExplorerRoots` from `client/lib/explorer-roots.js`, and each root's children are fetched on first expand via `/_api/v1/Explorer` endpoints. Expanded state is persisted to the workspace via `explorerContext` (the `state-change` event propagated up to `Workbench`). The tree is recursive: `TreeItem` renders a node and its children, forwarding events up through `TreeList` → `ExplorerPanel` → `Workbench`.

### Event propagation pattern

All user-initiated events (select, navigate, rename, contextmenu, etc.) travel upward via `defineEmits` chains. Every intermediate component just re-emits the event transparently. `Workbench.vue` is the single place that acts on them — updating state, calling the API, or triggering side effects.

This means adding a new event in a leaf component requires threading it through every layer in the chain. This is intentional: it keeps business logic centralized and components dumb.

## Activity system

The workbench is organized into **activities** — self-contained feature modules. In-core activities live in `client/activities/` (`workbench`, `chat`); `explorer`, `preview`, `details`, and `debug` are contributed by first-party **plugins** in `client/builtin-plugins/` (loaded through the plugin host, not compiled into `ACTIVITIES`). An activity declares the **surfaces** it contributes and, optionally, a runtime **API** that other activities query or subscribe to. This modularizes each activity's context and is the foundation of the plugin system (see Plugin system below): first-party activities use the same internal API a plugin does, narrowed by permission.

### Activity definition

Each module default-exports a plain object:

```
{
  id, label, icon, core?,                 // identity
  setup(ctx) → api,                       // optional; ctx = { api, host, editor, prefs, services, log } — register commands/keybindings/menus via api
  tabViews:    { [viewId]: { kind, label, icon, component, props(tab, ctx) } },
  panelViews:  { [viewId]: { label, icon, component?, sections?, acceptsSections?, actions?, props?, on? } },
  sections:    { [sectionId]: { label, icon, homeView, component, props(ctx), on(ctx), actions, … } },
  statusViews: { [id]: { region: 'left' | 'right', order, component } },
}
```

Three **surfaces**, each rendered by id:

- **Tab views** — editor tabs. `editor/TabContentHost.vue` resolves a tab's runtime `kind` → its tab view → component (the editor twin of `ViewContentHost`). Parent (`EditorGroup`) listeners pass straight through via `$attrs`, so the existing event-up chain to `Workbench` is unchanged; the mounted instance is handed back via a `registerInstance` callback so `EditorGroup` keeps its imperative handle for refresh / optimistic rename.
- **Panel views & sections** — sidebar/panel content. Unchanged from before; `ViewContentHost.vue` + the SplitView/SplitSection hierarchy render them. The registry just sources them from activities now.
- **Status views** — status-bar widgets. `shell/StatusBar.vue` is a host that renders the registered widgets by region (`shell/status/*`); each widget injects the host and **self-gates** (renders nothing when it has no relevant context).

`useViewRegistry.js` flattens every activity's surfaces into the by-id lookups the panel system already used (`getViewEntry`, `viewActions`, `sectionActions`, …), so that subsystem needed no changes, and adds activity-aware helpers: `tabViewForKind`, `getStatusViews(region)`, `activityOfView`, `activityOfTabKind`, `listActivities`, `getActivity`. The stores are now **reactive and dynamic**: surfaces are ingested through `registerActivity(def)` / `unregisterActivity(id)` (bootstrapped from the activities list at import; plugins use the same path at runtime), so registering or removing an activity adds/removes its surfaces live.

### The activity host (broker)

`composables/activity/useActivityHost.js` instantiates each activity's API (calling its `setup`) and brokers collaboration. It is `provide()`d as `viewCtx` — replacing the old hand-built bag — so registry-bound content (panels, sections, tab views, status widgets, action buttons) binds against it. Its public surface:

- `api(id)` / `requireApi(id)` — query another activity's API.
- `selection` — a reactive **capability**: the *active* activity's published selection snapshot (`{ selectedItems, focusedItem, selectedPath, details }`) or `null`. Preview/Details read this, so they depend on a capability rather than on Explorer specifically; any future activity that publishes a selection drives them too.
- `on` / `once` / `emit` — app-level pub/sub. Events: `active-tab-change`, `active-activity-change`.
- `log(category, msg, data)` — delegates to the Debug activity's logger API.
- `activeTab`, `activeActivityId`, `activeGroupId`, `editorRoot`, `prefs`.

`Workbench.vue` additionally `Object.assign`s its slice handlers (rename / move / context-menu / new-item modals / imperative ref forwarding) and app-status refs (clipboard, server connection, active job, notifications) onto the host so existing entries and status widgets reach them. **These are app internals, deliberately not part of the eventual public plugin API** (see `docs/ROADMAP.md` → Plugin system).

### Contribution registries & the public facade

The host also builds the frozen **`host.facade`** — handed to every `setup` as `api`, and the surface third-party plugins will import. It is the *contribution + query* surface, deliberately distinct from the host (`ctx`) that behaviours run against:

- **Commands** (`useCommandRegistry.js`) are the **single source of truth** for invokable behaviour. `facade.commands.register({ id, title, category?, icon?, when?(ctx), toggled?(ctx), run(ctx, …args), palette? })` returns a disposer; `execute(id, …args)` runs it (no-op when `when` is false). Menus, keybindings, and the command palette all reference commands **by id** rather than embedding actions. Workbench registers the app catalog (`editor.*` / `edit.*` / `file.*` / `view.*` / `workbench.*`) where its slice handlers are in scope; activities register their own in `setup` (e.g. `debug.clearLog`).
- **Keybindings** (`useKeybindingRegistry.js`) map a chord to a command. `facade.keybindings.register({ key, command, args?, when?, allowInInput? })`; the dispatcher (`useWorkbenchKeyboard`) normalizes each keydown to a canonical chord (`cmd`/`meta` fold to `ctrl`) and runs the bound command. `allowInInput` lets a binding (the palette, settings) fire while an input is focused.
- **Menus** — `facade.menus.register(menuId, { command|items|build, group?, order?, when? })` + `menus.items(menuId, ctx)`. Owner-built menus (the menu bar in `useAppMenus`; the context menus in `useFileContextMenus`) assemble their **base** items directly, then append contributed items keyed by menu id (`menubar/{file,edit,view,settings}`, `editor/tab`, `directory/{item,background,right-drag}`). This is the two-tier model: an activity controls its own menus directly, while any activity/plugin can contribute options to app-level menus.
- **Hooks** (`useHookRegistry.js`) — `facade.hooks.add(name, fn, order)` / `apply(name, value, ctx)`: a synchronous, ordered transform/veto chain (distinct from fire-and-forget events). The menu contribution API is built on it; future cancellable points (`before-rename`, …) use the same mechanism.
- **Activities** — `facade.activities.register(def)` / `unregister(id)` / `get` / `list`: dynamic registration that wires an activity's API **and** its surfaces together. First-party activities use the startup bootstrap; a plugin calls `register` at runtime and gets a disposer that removes both.
- **Modals** — `facade.modals.open(id)` / `close()` / `promote(id)` / `active` / `get` / `list`: modal-editor surfaces (a `ModalView` contributed by an activity). `promote` re-presents the modal as an editor tab (see Modal editors above). Settings and Keyboard Shortcuts are modals on the Workbench activity.
- **Editor** — `facade.editor.openTab(kind, { title, params, focusExisting, toSide })` / `tabs()`: open a registered editor tab by kind (focusing an existing one of that kind, or pinning per-tab `params`), and read the open tabs. `toSide` opens the tab in a fresh split group to the right (via the grid's `openTabBeside`, which — unlike `splitActiveGroup` — doesn't clone the current tab) — used by "Open Preview to the Side".
- **Preferences** — `facade.preferences.register({ key, title, properties })` / `get(path)`: contribute a Settings section (merged into the panel by `SettingsModal`, registry in `usePreferenceSchema.js`) and read a value. Contributed values live under `prefs.<key>` and persist normally.

### Collaboration: two mechanisms

1. **Reactive capability pull** (Vue reactivity). A consumer reads `host.selection` or `host.api(id).<ref>` inside a computed/template and updates automatically. Used by Preview/Details (render from the current selection) and the status widgets. Best for "render from current state."
2. **Event push** (`composables/activity/useEmitter.js` → `createEmitter`: `on`/`once`/`off`/`emit`/`clear`, with isolated subscriber errors). Each providing activity owns an emitter and exposes `on`; it `emit`s on change (Explorer emits `selection-change`; the host emits the app-level events). A subscriber does `host.api('explorer').on('selection-change', cb)`. Best for imperative reactions (prefetch, logging) and for non-Vue consumers.

### Ownership examples

- **Explorer** owns the selection + directory-stats context: its `setup` wraps the existing `useSelection` slice, exposes a `selection` capability and `dirStats`, and emits `selection-change`. `Workbench` sources the selection refs/handlers from `host.api('explorer')` and feeds them to the file-op / menu / keyboard slices unchanged — ownership moved, the consuming wiring did not.
- **Preview / Details** are pure consumers — every prop reads `host.selection`, self-gating when it is `null` (e.g. on the Home tab).
- **Debug** is a provider — its API exposes `log()`, surfaced app-wide as `host.log(...)` so any activity can push to the Debug panel.

There is no workspace-schema change: the runtime tab `kind` remains the bridge between persisted tabs and the registry's tab views.

## Plugin system

A **plugin** is an out-of-core activity loaded at runtime through a *permission-scoped* view of the same facade — first-party activities and plugins share one contribution path; a plugin just gets a narrowed API. The authoring guide is [`docs/PLUGINS.md`](PLUGINS.md); the architecture:

- **UI model** (`client/models/ui/`) — UI-agnostic classes (`Activity`, `View`, `EditorView`, `ModalView`, `PanelView`, `ViewSection`, `StatusView`) that carry metadata + a component reference, no Vue imports. `fromDefinition.js` wraps the declarative `client/activities/*.js` objects into instances, so first-party activities keep their authoring shape while `useViewRegistry` operates on instances; a plugin constructs them directly (`new Activity(...).addView(new PanelView(...))`).
- **Manifest + permissions** (`client/models/plugin/`) — `manifest.js` validates a Chrome-style `manifest.json` (id/version, `client`/`server` target entries, `permissions`, `host_permissions`, `dependencies`, `engines.sdk`; a plugin must declare a client and/or server target). `permissions.js` defines the tiers: front-end `PERMISSIONS` each gating a facade slice, `HOST_PERMISSIONS` (reserved brokers), and `SERVER_PERMISSIONS` gating a WASM backend's host functions. Unknown permissions are ignored with a warning (forward-compatible).
- **Loader** (`client/composables/plugins/`) — `usePluginApi.js` builds the frozen `api` handed to `activate`: the UI model classes + `log` always, plus exactly the facade slices the declared permissions grant. `usePluginHost.js` loads/unloads `{ manifest, module }` pairs (dependency-ordered, with disposers). `activate(api)` contributes and returns a disposer; `deactivate(api)` is optional.
- **Loading** — client plugins are compiled to self-contained ES modules (`client/scripts/build-plugins.js`, with `vue`/`@fw/sdk` externalized to the host so a plugin shares the app's single Vue instance) and loaded at **runtime**: the client fetches `/_api/v1/plugins/manifest`, content-hash-verifies each artifact against the committed `plugins.lock.json` (prod refuses a mismatch, dev warns), then dynamic-imports it into the same `{ manifest, module }` the host consumes (`useRuntimePlugins.js`). First-party plugins load through the exact path a third-party one would. **Explorer** is the one exception — it stays compiled in (`client/builtin-plugins/index.js`) and loads synchronously, because Workbench pulls its selection API during bootstrap.
- **Sandboxed backend** — a plugin adds backend functionality through its own `server` block: JS compiled to WebAssembly (`build-plugins.js` → extism/wazero) that the Go server runs with **no ambient authority** beyond the `SERVER_PERMISSIONS` it declares (`exec:git`, `fs:read`, …). The client calls it via `api.server` (gated by the `server` permission) — a generic RPC bridge (`client/lib/plugin-rpc.js` → `/_api/v1/plugins/{id}/rpc`) bound to the plugin's own id, replacing the former per-service brokers (`api.scm`/`scm-api.js`/`scm.go`).

The reference is the first-party **Source Control** plugin (`plugins/source-control/`): a `PrimarySideBar` panel with Repositories / Changes / Graph view sections, a Git Graph editor tab (repo pinned at open time via tab `params`), a branch status widget, commands + a section action, a contributed preference, and a **git WASM backend** reached via `api.server` (gated by `exec:git`/`fs:read`) — all through the permission-scoped API.

## State management

No Pinia or Vuex. State lives in:
- `Workbench.vue` `reactive`/`ref` — global app state (editor grid, prefs, clipboard); selection + directory stats now live in the **Explorer activity's API** (`host.api('explorer')`, see Activity system) and are consumed by Workbench's file-op / menu / keyboard slices
- `useWorkspaces.js` — the persisted per-workspace model in `localStorage` (`files-workbench.workspaces`), versioned with forward migration (v1→v2 wraps the flat tabs array into a single-group leaf; v2→v3 renames panel areas to primarySidebar/secondarySidebar/panel and adds `viewContainerOrder`, `mergeGroups`, and `activeViewContainerId`; v3→v4 renames the `activity` fields to `view`; v4→v5 unifies per-container section storage into a `viewSections` map keyed by view id, with `homeViewId` on each section, replacing the old `sectionState`); serialises the editor grid, sidebar/panel layout, and explorer tree state
- `DirectoryTab.vue` — navigation history, items list, thumbnail map
- `DirectoryPanel.vue` — sort/filter state, layout picker state
- `ExplorerPanel.vue` — lazy tree state via `useDirectoryFileTree` (per-path child cache; expanded nodes persisted to workspace as `explorerContext`)
- Module-level refs in `useTreeDrag.js` — shared drag state across all tree nodes

## Drag and drop systems

There are four independent drag systems:

| System | Used by | Mechanism |
|---|---|---|
| `useDrag.js` | Directory grid/list/table items (left-button) | Custom mousedown → ghost clone, 200 ms delay, `onActivate` callback for multi-select |
| `useRightClickDrag.js` | Directory items (right-button) | Suppresses native `contextmenu` on mousedown; ghost clone on move; resolves to `onRightClick` or `onDrop` on mouseup |
| `useTreeDrag.js` | Explorer tree nodes | Custom mousedown → chip ghost, module-level shared state, directory-only drop targets |
| `useEditorDnd.js` | Editor tabs & groups | Native HTML5 drag with shared module state + region detection (`dropRegion`): dropping on a tab strip reorders/moves a tab; dropping on a group's edge/center splits or merges groups (`DropOverlay.vue` shows the target zone) |
| `ViewContainer.vue` + `useViewDrag.js` | Panel views & sections | Native HTML5 drag with shared `activeDrag`/`activeSectionDrag` refs. `DRAG_MIME`: tab-strip drop reorders/transfers between containers, content-area drop (`ViewDropOverlay`) merges views as stacked SplitViews, SplitViewHeading drag extracts back to a tab. `SECTION_DRAG_MIME`: SplitSection heading drag reorders within an area or adopts the section into another View's area (`section-move` → `handleSectionMove`) |

The file drag systems (`useDrag`, `useTreeDrag`, `useRightClickDrag`) do not set `dataTransfer` and therefore cannot interoperate with native OS drop targets.

Right-click drag releases show a "drop action" context menu (`showRightDragDropMenu` in `Workbench.vue`) with Move Here / Copy Here / Create Symlink Here options; if all dragged items are archives, the menu offers Extract Here instead of Compress to Archive Here.

## Click handling

`useClickDebounce` wraps every interactive item to distinguish single-click (select) from double-click (navigate/open). Key properties:
- Modifier keys (Ctrl/Meta/Shift) bypass the delay and fire immediately
- `cancel()` flushes any pending single-click timer (used when rename mode activates to suppress spurious selection)
- The delay is 220 ms — long enough to detect a double-click but shorter than most users' patience

## Preview panel

`PreviewPanel` determines the preview type by checking file extension first (via an `EXT_LANGUAGE` map), then MIME type from the server. This avoids misidentifying `.ts` TypeScript files as `video/mp2t`.

Preview kinds: `text` (Monaco), `html` (iframe + source toggle), `image`, `video` (Video.js), `audio` (Wavesurfer.js), `binary` (no preview).

File content is fetched from the Go server directly in dev and production alike (`/_api/v1/fs/preview` for text, `/_api/v1/media/preview` for media bytes).

## Inline rename

Double-clicking a filename in the tree or directory view opens an inline `contenteditable` span. `v-if`/`v-else` swaps the display span for the edit span — this prevents Vue's virtual DOM from patching over user edits. On commit (Enter or blur) the component emits `rename({ path, newName })` which travels up to `Workbench.handleRename` for the eventual API call.

## Theming

All colors are CSS custom properties defined in `client/assets/css/workbench.css`. The theme JSON files in `config/themes/` are the source of truth for each built-in theme; at startup the app applies them by setting CSS variables on `:root`. The user's accent color overrides `--accent` independently of the theme.

## CSS architecture

### Scoped component styles

All component styles use Vue `<style scoped>`. Each component's stylesheet is its own module; selectors get a `[data-v-xxxx]` attribute injected by Vite at build time. Scoped styles are compatible with native CSS nesting — the injected attribute suffix is applied to the final compound selector after nesting is resolved.

**Native CSS nesting** (`&` selector, nested at-rules) is used throughout rather than BEM-style flat selector lists. Children are nested directly inside their parent block:

```css
.dl-item {
  /* base */
  &:hover { background: rgba(255,255,255,0.05); }
  &.dl-item--selected { border-color: var(--accent); }
  .dl-name { font-size: 13px; }
}
```

**Layout variants via nested `&[data-layout="x"]` blocks** — `DirectoryLayout.vue` uses a single `.dl` block containing one nested block per layout variant. Shared behavior (e.g., all columnar layouts) is factored into `:is()` selectors inside `.dl`:

```css
.dl {
  /* grid default */
  &:is([data-layout="list"], [data-layout="details"]) { display: flex; }
  &[data-layout="details"] { .dl-item { min-width: 420px; } }
}
```

### Container queries

Components that need size-responsive behavior declare a CSS containment context on their wrapper element and use `@container` queries — **not** `@media` queries, which are viewport-relative and not useful for panel-sized UI:

```css
.dl-wrap {
  container-type: inline-size;
  container-name: dl;
}

@container dl (max-width: 480px) {
  .dl:is([data-layout="list"], ...) { .dl-date { display: none; } }
}
```

Container queries are placed at the bottom of the `<style scoped>` block after all regular selectors.

### Global CSS (`workbench.css`)

`client/assets/css/workbench.css` owns:
- `:root` custom property definitions (all theme color variables, spacing tokens)
- Base resets (`*, box-sizing: border-box`, body defaults)
- Scrollbar styles
- Utility classes used across multiple components

`@layer` declarations belong here (not in scoped component styles) when cascade ordering across utility classes is needed. Scoped component blocks do not use `@layer`.

### Rules of thumb

- Prefer nesting over flat selector repetition when selectors share a semantic parent.
- Use `container-type: inline-size` on the element whose width the content responds to, not on a distant ancestor.
- `@container` queries are for layout adaptation (hide columns at narrow widths); `@media` queries are reserved for system-level behavior (e.g., `prefers-reduced-motion`).
- `:deep()` is only for targeting child component internals from a parent — use it sparingly.

## File operations

`Workbench.vue` handles all mutating file operations (rename, move, copy, trash, delete, compress, decompress, create folder). Every op is enqueued as a serialisable descriptor via `useFileOpsQueue.enqueue({ label, kind, params })` — there are no inline fetch calls for writes. The queue resolves to a Promise that `Workbench` awaits to handle success, errors, and special responses:

- **`requiresElevation`** (403): the server detected a path that needs sudo/admin. The UI shows a password dialog; the caller re-enqueues with the `*_elevated` kind.
- **`missingTool`** (422, decompress only): a required external tool (`7z`, `unrar`) is not installed. The UI shows per-platform install instructions.

Rename uses an optimistic update: `DirectoryTab.renameItem` patches the item in-place immediately; the network op runs in the background; on failure the patch is rolled back.

Find & Replace's "Replace All" uses a batch path: `DirectoryLayout` emits a single `rename-batch` event (forwarded up through DirectoryPanel → DirectoryTab → EditorGroup → Editor → Workbench) rather than N individual `rename` events. `handleRenameBatch` in `useFileOperations` calls `forEachGroup(r => r.batchRenameItems?.(ops))` for one atomic optimistic UI update — unchanged items keep the same object reference so Vue skips their DOM diff entirely. All server renames are fired in parallel; failures roll back individually. After `Promise.allSettled`, `clearOptimisticThumbnails` removes the temporary `thumbnailPath` field so thumbnail URLs switch to the now-existing new paths.

Thumbnail continuity during batch rename: each item receives a stable `_id` at fetch time (`DirectoryTab`), used as the v-for key in `DirectoryLayout`. Renaming changes `item.path` but not `_id`, so Vue reuses the existing DOM node instead of remounting it — the loaded `<img>` is never destroyed. `itemsWithThumbnails` uses `item.thumbnailPath ?? item.path` to build the thumbnail URL, keeping it pointed at the still-existing old path during the operation window. `imageStates` migration carries the `'loaded'` state forward to the new path key so the `<img>` v-if stays true and nothing re-loads. A race where a lazy-load intersects exactly as the file is moved is healed by an exponential backoff retry (200 ms → 2 s, up to 6 attempts while a rename is in flight).

Reversible operations (rename, move, copy) push an entry to `useActionHistory` so Ctrl+Z / Ctrl+Y work across the session.

## Notifications

`useNotifications` is a module-level singleton (like `useFileOpsQueue`) so any producer can push without prop-drilling. `Workbench` instantiates it, owns the panel's open state, and passes `notify`/`startJob` into `useFileOperations`. The bell toggle + unread dot live in the status bar (right side); the floating `NotificationPanel` teleports to the body, anchored bottom-right above the bell, and closes on Esc or outside-click (ignoring the bell).

Two notification shapes share one renderer:

- **Simple** — `title`/`message`/`actions`, optional flat `items` list. Used by single-call ops (trash, delete, compress, extract, move, copy). Failures carry a **Retry** action.
- **Job** — `startJob({ verb, operations })` creates a `type: 'progress'` notification and returns `start`/`succeed`/`fail`/`setActions` handles. As each operation settles, the title (`Job: rename 142 items (2 failed)`), `type`, and `progress` recompute live. The panel renders three collapsible status subgroups (In progress / Failed / Completed), each operation expandable to its details (original/new name, started, finished/failed, duration, error). Batch rename is the first job producer.

`silent` notifications appear in the panel but never light the unread dot or toast — used by trivial single ops (single rename, create file/folder). `activeJob` (the newest still-running `progress` job) drives a status-bar progress item (descriptive text + `<meter>`) that is only visible while a job runs. Relative times render via `<time datetime="PT…">2h 30m ago</time>` (see `lib/time.js`).

## Service worker operations queue

`public/sw.js` is a service worker that maintains a per-client operation queue keyed by `event.source.id`. The lifecycle:

1. App startup calls `swQueue.init()` (plugin `sw.client.js`), which registers the SW and sends `INIT` with `controlBase` and `apiV`.
2. Each `useFileOpsQueue.enqueue()` call sends `ENQUEUE { id, kind, params }` to the SW and stores the op locally as a fallback buffer.
3. When the caller is ready to execute, `swQueue.execute(opIds)` creates one Promise per op in a `_pending` map, then sends `EXECUTE` to the SW.
4. The SW drains its queue and fires all ops **concurrently** via `fetch`. Each op sends `OP_COMPLETE` or `OP_ERROR` back to the client independently.
5. The client's `_onMessage` handler resolves or rejects the corresponding Promise.

If the SW is unavailable (first load, no HTTPS, unsupported browser), `sw-queue.js` falls back to direct `fetch` from the main thread using the same `ENDPOINTS` map.

## Server architecture

The active backend is a Go HTTP server (`server/v1/`) using the stdlib `net/http` package. There is no framework — routes are registered on a `http.ServeMux`. All routes are prefixed with `/_api/v1/`.

The process starts **two independent `http.Server` goroutines** on separate ports:

| Server | Port | Content |
|---|---|---|
| Data | 8001 (`PORT` env) | All read-only GETs — listing, stat, preview, media, icons, preferences |
| Control | 8002 (`CONTROL_PORT` env) | All mutating POSTs/PUTs — rename, move, copy, delete, trash, compress, decompress |

This separation ensures slow thumbnail or listing requests on the data server never delay file-operation responses on the control server — the two goroutines share no locks in the hot path.

Functional areas:

- **fs** — file system CRUD: list directory, stat, rename, move, copy, create file/dir, write file, delete, trash, open with system app; archive files get `kind: "archive"` in listing responses
- **archive** — list archive contents (ZIP, TAR, 7Z, RAR) as virtual directory entries; capabilities endpoint reports available tools
- **permissions** — blocks critical OS paths; detects when elevation is required and returns structured 403 responses
- **exe** (Windows) — extract icon and version metadata from PE resource sections
- **explorer** — directory tree listing: root nodes, home directory, drives, lazy-expandable subtree, exclusion categories
- **media** — thumbnails (image resize via `golang.org/x/image`; video frame and audio artwork extraction via ffmpeg), file metadata, raw file serving
- **icons** — serve icon pack manifest (`/icons/manifest`) and individual SVG icons by definition name (`/icons/svg?name=…`)
- **preferences** — read and write user preferences JSON, serve the preferences JSON Schema
- **plugins** — serves the runtime plugin manifest (`GET /_api/v1/plugins/manifest`) and per-plugin artifacts (client ES modules + WASM backends; `GET /_api/v1/plugins/{id}/{artifact}`), and hosts each plugin's sandboxed WASM backend behind a generic RPC broker (`POST /_api/v1/plugins/{id}/rpc` → `plugin_host.go`, extism/wazero). Git source control now lives here as the **Source Control** plugin's WASM backend (`api.server`, gated by `exec:git`/`fs:read`), which replaced the former core `scm.go` endpoints
- **perf** — client-side performance log ingestion

Thumbnail generation is handled by `thumbnail.go` and results are stored in a disk-based cache keyed by file path, size, and type. `blacklist.go` loads path exclusion rules from a server-side config file rather than URL parameters.

### Directory customization

`customization.go` reads platform-specific directory customization files at listing time — no extra round-trip needed:

| File | Platform | Parsed groups |
|---|---|---|
| `.directory` | KDE/Dolphin (freedesktop.org) | `[Desktop Entry]` (`Name`/`Icon`/`Comment`) + app group `[X-Files-Workbench]` |
| `desktop.ini` | Windows | `[.ShellClassInfo]` (`IconResource`/`IconFile`, `InfoTip`) + app group `[X-Files-Workbench]` |
| `.DS_Store` | macOS | presence only (binary format) |

`.directory` is the canonical, writable file; the app stores its own keys under the
`[X-Files-Workbench]` group (freedesktop `X-` vendor-extension convention). `readDirCustomization`
**merges** both files by field: the app group wins over the standard group, and within a tier
`.directory` wins over `desktop.ini`. These reads bypass the blacklist intentionally — the
blacklist controls what appears in listing responses; this is an internal server read that
enriches parent-directory metadata. The `customization` field is embedded in every directory
item returned by `list_dir` and the Explorer APIs.

**Icons** may be an absolute path, a `~/…` path, a **relative** path to an image inside the
folder (e.g. `Icon=cover.png`, resolved to an absolute path only when the file exists), a Dolphin
`folder-<color>` name, or an XDG icon-theme name. The server resolves the display value (relative
→ absolute) while keeping the raw value in `icon_raw`. The full source priority is
**`[X-Files-Workbench] Icon` (`.directory`, then `desktop.ini`) → `[Desktop Entry] Icon` /
`[.ShellClassInfo]` → icon pack → MDI default**; the source selection is resolved server-side, and
the client's `useCustomIcon.js` then renders the winner (absolute paths via `fs/preview`;
`folder-<color>` names as inline `<svg fill="currentColor">`, bypassing the icon-pack `<img>`
since CSS `color` cannot tint an image element).

**Writes** are lossless. An order-preserving INI document model (`iniDoc`) edits a single key
while leaving every other line — comments, ordering, unknown groups, localized keys — intact, so
`formatDotDirectory`-style whole-file rewrites are gone. When only a `desktop.ini` exists, the
first write seeds a new `.directory` importing its name/icon/comment. Endpoints:

| Endpoint | Purpose |
|---|---|
| `GET /_api/v1/fs/customization?path=` | typed summary (icon resolved) **+** raw editable `sections` |
| `PUT /_api/v1/fs/customization?path=` | typed `{name,icon,comment}` (`null` = keep, `""` = remove) → `[Desktop Entry]` |
| `PATCH /_api/v1/fs/customization?path=` | generic `ops: [{op:'set'\|'delete', section?, key, value?}]` (section defaults to `[X-Files-Workbench]`) |
| `POST /_api/v1/fs/pin` | `{path, names, pinned}` — add/remove names in `[X-Files-Workbench] Pinned` |

**Pinned items.** `[X-Files-Workbench] Pinned` holds a freedesktop `;`-list of item names.
`simpleListDir` stamps `pinned:true` on matching items and groups them first (then the usual
dirs-first/name rules within each group, so a pinned file can sit above an unpinned folder). The
directory view re-applies the same pinned-first rule in its client sort (`DirectoryPanel`), and
shows a pin badge; the Pin/Unpin action lives in the item context menu.

### Icon pack plugin system

`plugins.go` loads third-party icon packs from `config/plugins/` at startup. Each plugin directory contains a `plugin.json` manifest. The only supported adapter is `vscode-icon-theme`, which reads a VSCode extension icon theme JSON file and builds lookup tables for file extensions, file names, and folder names.

At startup, the first successfully-loaded plugin becomes `activeIconTheme`. Icon names are resolved server-side and embedded in every list and explorer API response as `icon` and `icon_open` string fields. `resolve()` and `resolveOpen()` only return icon names whose SVG files exist on disk, cascading through fallbacks gracefully (named-open → named-closed → default-open → default-closed). Preferring the named-closed icon over the generic open folder keeps custom folder icons visually consistent when no specific open-variant SVG has been generated.

On the client, icon-pack resolution is now a **plugin contribution**, not a hardcoded lookup. The Material Icon Theme is a first-party plugin (`plugins/material-icon-theme/`) that registers a theme — `{ id, label, getIcon }` — through the Workbench API (`api.icons`, gated by the `icons` permission). The module-level singleton `useIconRegistry.js` holds the registered themes and the active one; renderers call `resolveIcon(ctx)` (ctx = `{ path, name, isDir, kind, extension, expanded, … }`), which delegates to the active theme's `getIcon` and returns a `{ type, icon }` descriptor (or `null`). `ResolvedIcon.vue` renders that descriptor (`url`/`file.path` → `<img>`, `component`, `svg.path` → inline SVG), falling back to the MDI default on a `null` result or an `<img>` load error. Icons resolve at **render time** — they are no longer baked into the listing nodes (the server still stamps `item.icon`/`item.icon_open` for now, but the client no longer consumes them). The active theme follows the `iconTheme` preference, else the first registered.

## Configuration system

User configuration is read from `config/` at startup. The app merges `user-*.json` over `default-*.json` using a shallow merge. JSON Schema files (`*.schema.json`) validate the merged result. Unknown keys in user files are ignored rather than causing errors, to support forward-compatibility when the schema evolves.

Plugins are loaded from `config/plugins/`. Each subdirectory is a plugin; the server reads `plugin.json` and initializes any supported plugins at startup. Plugin directories are not gitignored — they are part of the repo and can contain bundled or cloned third-party assets.

### Config vs. data paths (dev vs. packaged)

The server resolves its paths through four roots, each overridable by an env var so a
packaged build can read read-only config from app resources while writing user data
to a writable location. Unset (dev / `go run`), they fall back to the repo layout:

| Var | Holds | Dev fallback |
|---|---|---|
| `FW_CONFIG_DIR` | read-only config: preferences schema + defaults, plugins | `<repo>/config` |
| `FW_DATA_DIR` | writable user data: `user-preferences.json` | `<repo>/config` |
| `FW_LOGS_DIR` | writable logs: `perf.log` | `<repo>/server/logs` |
| `FW_BLACKLIST` | the path-protection `blacklist.yaml` | `<repo>/server/v1/blacklist.yaml` |

Preferences are split accordingly: the schema and defaults are read from the
read-only config dir, while `user-preferences.json` is read/written under the data
dir (so it survives in a packaged app where resources are read-only).

## Packaging & distribution

A production build is a self-contained Electron app that **bundles and launches the
Go server** — there is no separate backend to install.

- **Build** (`npm run build:electron`): `client/scripts/build-server.js` compiles the
  Go server to `server/v1/dist/` (platform-correct name), `build-plugins.js` emits the
  production plugin artifacts, `vite build` emits the static client to `client/dist/`,
  then electron-builder packages everything. The server
  binary, the `config/` tree, and `blacklist.yaml` are copied in via electron-builder
  `extraResources` (they live in `process.resourcesPath`, outside the asar so the
  binary stays executable).
- **Launch** (`client/electron/main.js`): in production the main process `spawn`s the
  bundled server on fixed ports 8001/8002, passing the `FW_*` env vars above
  (`FW_CONFIG_DIR` → bundled config, `FW_DATA_DIR` → Electron's `userData`), waits for
  `/health`, then opens the window; it kills the server on `will-quit`. In dev the
  server is run separately by `npm run dev:server`, so the spawn is skipped.
- **Installers**: electron-builder produces an AppImage (Linux), dmg (macOS), and
  NSIS `.exe` (Windows). `install.sh` / `install.ps1` at the repo root fetch the
  latest release's asset from GitHub. Releases are published manually for now; a
  tag-triggered CI matrix build is on the roadmap.
