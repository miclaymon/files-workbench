# Roadmap

Items roughly ordered by priority. See `TODO.md` for the full flat list.

## Near-term

- **Rename via F2** — trigger inline rename from keyboard in addition to double-click
- **Directory address bar** — history dropdown and path autocomplete in the breadcrumb bar

## Medium-term

- **Keybind customization** — full keyboard shortcut editor in preferences; keybind events bubble through the DOM and can be captured by components
- **Command palette** — fuzzy search over commands, recently visited paths, and open tabs
- **Custom directory icons (extended)** — custom thumbnail support; `[Files Workbench]` section in `.directory` for app-specific overrides; open-variant folder icons require `generateOpenFolderIcons.ts` (needs Bun), currently falls back to closed-folder variant
- **Home page improvements** — recent files, pinned folders, quick-access shortcuts
- **Archive exploration** — browse contents of `.zip`, `.tar`, `.gz`, `.7z`, `.rar` as virtual directories

## Long-term

- **Explorer View: expanded Places** — Places (GNOME/Nautilus/Dolphin-style root nodes, currently Root + Home) grows to include Desktop, Documents, Downloads, Music, Pictures, Videos, Trash; user-customizable
- **Explorer View: Remote section** — Network (SMB/NAS, Bluetooth fileshare) and Cloud Storage (Dropbox, Google Drive, iCloud Drive, Proton Drive) and FTP/SFTP/SCP locations
- **Explorer View: Drives/Volumes section** — internal and removable drives
- **Explorer View: Libraries** — user-created virtual groupings of multiple path locations whose contents are aggregated and displayed together in a Library View tab (similar to Directory View); e.g. a Windows Library spanning Program Files, Program Files (x86), and %APPDATA%/Local/Roaming
- **Service worker + WebSocket** — real-time directory change notifications; move heavy data transfer (large directory listings, streaming thumbnails) to a persistent WebSocket channel
- **Background file indexing** — full-text and metadata search index
- **Tab window splitting** — drag a tab out to open it in a new Electron window (like VS Code)
- **MCP integration** — expose file operations as MCP tools

## Known issues / tech debt

- Thumbnail rendering for directories with custom icons (`.directory`, `desktop.ini`) not yet implemented
- Explorer tree does not show a visual indicator when a directory is empty (cannot expand)
- `useDragAndDrop.js` is now orphaned — editor tabs moved to `useEditorDnd.js` (region-aware drop targets); the generic helper can be removed or repurposed
- Old per-layout Vue components (`DirectoryGridLayout.vue`, `DirectoryListLayout.vue`, etc.) remain in `client/components/workbench/` but are no longer used — should be removed once the new unified `DirectoryLayout.vue` is confirmed stable
- Click debounce not yet applied to explorer tree nodes and some directory item edge cases
- Open-folder icon variants for `vscode-material-icon-theme` require `generateOpenFolderIcons.ts` (needs Bun); currently falls back to the closed-folder variant

## Recently completed

- **Composables folder reorganization** — `client/composables/` split into three layers: `interaction/` (UI-behavior primitives: all drag systems, click debounce, hover preview, sidebar/sash resize), `workbench/` (the Workbench assembly-root slices), and root (foundational services: workspaces, preferences, queues, layout grid, view registry, icon pack). All explicit import paths updated across components and composables; Nuxt auto-imports are unaffected (scanned recursively)

- **Workbench decomposition into composable slices** — `Workbench.vue` shrank from ~2270 to ~600 lines by extracting its logic into hand-rolled store slices wired by dependency injection: `useEditorGrid`, `useViewLayout` (+ `workbenchChrome`), `useSelection`, `useFileOperations`, `useFileContextMenus`, `useAppMenus`, `useStatusBar`, `useArchive`, and `useWorkbenchKeyboard`. Workbench is now a thin assembly root that instantiates the slices, passes each one's return into its dependents, and `provide`s the few descendants need. The selection↔editor cycle is broken by keeping `useEditorGrid` selection-free. Separately, the sidebar/panel tab strip was extracted from `ViewContainer.vue` into a presentational `ViewTabStrip.vue` (the editor's own tab strip is kept distinct). See `docs/REFACTOR-WORKBENCH.md`

- **Context menus + per-instance section menu** — three new right-click context menus: tab (Hide '\<Tab\>', Hide Badge, Move to Secondary Side Bar / Bottom Panel), header (per-view checkboxes with shortcut hints, Show Tab Icons, Hide panel), and section heading (Hide '\<Section\>', Hide Badge, full section list). The ⋯ "More actions…" menu is reworked to show one line per *present instance* (in view order) plus ghost lines for declared sections with no instance — toggling a present line removes that specific instance, toggling a ghost adds a fresh one. Adopted/foreign sections disappear from the menu once removed; declared true-child sections are always recoverable via their ghost. A `workbenchChrome` object is `provide()`d once by `Workbench` and injected by `ViewContainer`, exposing hide/show/move/toggle-icon logic so the three shell wrappers don't thread it as props. `prefs.workbench.showTabIcons` (toggled by Show Tab Icons) controls icon visibility in the tab strip

- **Section `instanceId` + semantic DOM attributes** — every section carries a `uuidv4` `instanceId` (backfilled via `_normalizeSections` for legacy workspace data), used as the `v-for` key in `SplitSectionArea` so Vue can track duplicate sections as distinct DOM nodes. Rendered section and view elements are stamped with `data-section-id` (e.g. `"Workbench:Explorer.OpenEditors"`), `data-section-instance-uuid`, and `data-view-id` (e.g. `"Workbench:Explorer"`) for automation and DevTools inspection. `viewDataId` / `sectionDataId` helpers in `useViewRegistry.js`

- **`allowDuplicateSections` now functional** — `handleSectionMove`, `handleSectionToTab`, and `handleViewReabsorb` now check `viewAllowsDuplicateSections(viewId)` before blocking a duplicate; with `instanceId`-based keys, Vue correctly renders two instances of the same section. The reabsorb early-return guard (which silently discarded a floated tab when its sections were already in the destination) is also conditioned on `!allowDuplicateSections`

- **`viewSections` cross-container migration** — `handleViewTransfer`, `handleViewMerge`, and `handleViewUnmerge` now move `viewSections` data from the source container ref to the destination alongside the tab entry; dragging an Explorer tab from the Secondary Side Bar to the Bottom Panel no longer shows "Unknown view: explorer"

- **Collapsed section divider** — a `border-top` is applied to a section heading when it follows another section without a sash (i.e. `i > 0 && !needsSash`), giving a clear visual boundary when an expanded section is adjacent to a collapsed one

- **Explorer tree polish** — tree indent width 14 → 16 px, expand chevron 12 → 16 px, bottom padding on tree list, root-node top margin tweak; `ExplorerPanel` uses `overflow-y: auto` so Places scrolls independently when its content overflows

- **Section drag/menu polish** — fixed a stale drop overlay that lingered after a re-absorb/merge and silently blocked clicks (drop handlers now clear drag state explicitly, since `dragend` can't fire when the dragged element is removed by the drop). The ⋯ menu now lists a view's declared sections as presence toggles (persisting as a view-level button even when only one section remains; toggling re-adds/removes a section). Added a per-view `allowDuplicateSections` guard (default off) that blocks dropping a section a view already holds, with a not-allowed cursor and an alert

- **Hierarchical action buttons + re-absorb + always-on section headings** — action buttons now cascade by hierarchy (section heading → view heading → tab strip) and render in separated groups (`ViewActions` gained a `groups` prop; `useViewRegistry` gained `viewActions`/`sectionActions`/`sectionHeadingShown`/`bubbledSectionActions`, replacing `resolveViewActions`). Sections can opt into `alwaysShowHeading` (set on Places) so the heading and its buttons stay put even as a View's only section. A floated parent View (an adopted section surfaced as a tab/SplitView) can be dragged back onto its home View to re-absorb its sections (`view-reabsorb` → `handleViewReabsorb`), including onto the non-droppable primary sidebar

- **Section adoption travels with the biological parent View** — dragging a section (e.g. Open Editors) into another View now surfaces its home View as its own SplitView in that slot (like merging a tab) instead of nesting it as a sub-section of the target: one section → heading `Explorer: Open Editors`, two+ → `Explorer` with section headings. Dropping a section on a sidebar/panel **tab strip** spawns the parent as a standalone tab (`section-to-tab` → `handleSectionToTab`). Locked sections (Places) are now reorderable within Explorer but still can't be pulled out or hidden; the forced "Places first" ordering was dropped. No schema change — the model maps onto the existing `mergedSlots` + `viewSections`

- **Sidebar/panel extraction + adaptive split direction** — the primary side bar, secondary side bar, and bottom panel markup moved out of `Workbench.vue` into `shell/PrimarySideBar.vue`, `shell/SecondarySideBar.vue`, and `shell/BottomPanel.vue`, sharing a new `useSideBar.js` composable. `useSideBar` owns the drag-resize loop (sizes persist via `v-model` back to the workspace refs in `Workbench`) and a `ResizeObserver` that derives each pane's `dropDirection` from its measured shape (tall → `col`, wide → `row`) instead of hard-coding it — so merged-view stacking adapts to placement and is forward-compatible with repositioning panels. Cross-container view/section moves stay centralized in `Workbench`; the panes forward `ViewContainer` events. Note: a wide-and-short secondary side bar will now stack merged views as rows (intended adaptive behavior, a change from the old always-`col`)

- **Workbench shell extraction** — the app chrome was pulled out of the 2000-line `Workbench.vue` into a new `shell/` folder of presentational components (state + logic stay in `Workbench`, passed via props/events): `TitleBar` (composing `MenuBar`, `AppHistory`, `CommandCenter`, and window controls), `ActivityBar`, and `StatusBar`. The editor area became `editor/Editor.vue` (wraps `GridView`/`EditorGroup`, takes a `registerGroup` ref-callback so `Workbench` keeps the group registry, re-emits all events). `AppHistory` is a placeholder for global navigation history (distinct from per-tab history and undo/redo). `MenuBar`/`ActivityBar` own their dropdown open/position state locally

- **Component folder reorganization** — `client/components/workbench/` split into six subfolders: `layout/` (ViewContainer + SplitView hierarchy), `editor/` (GridView, EditorGroup, DirectoryTab, …), `directory/` (DirectoryPanel + all layout variants), `explorer/` (ExplorerPanel, tree, OpenEditorsView), `views/` (PreviewPanel, DetailsPanel, ChatPanel, DebugPanel + `preview/` subfolder), `ui/` (FloatingMenu, ContextMenu, Tooltip, modals, CommandPalette). `DropOverlay` renamed `EditorDropOverlay`; `BreadcrumbFullPath` renamed `DirectoryBreadcrumb`. `Panel.vue` and `PreferencesActivity.vue` (both retired) deleted. Nuxt's `pathPrefix: false` keeps all auto-import names flat

- **SplitView / SplitSection unification** — the primary sidebar's accordion and the secondary/bottom panels' merged tabs are now one recursive engine: `SplitViewArea` → `SplitView` → `SplitSectionArea` → `SplitSection` (a heading appears only when its level has >1 sibling). `ViewContainer.vue` lost its separate "sections mode" — the primary sidebar is just a non-droppable single-View container. View/section content renders by id through `ViewContentHost.vue` + a `useViewRegistry.js` registry (replacing per-container named slots), bound against a shared `viewCtx`. Sash math lives in `useStackResize.js`; drag state in `useViewDrag.js`. `ViewSection.vue` retired
- **Cross-context sections** — SplitSection headings can be reordered within their area, or dragged into a *different* View's area where they're "adopted" (`section-move` → `handleSectionMove`); an adopted section shows its home View as a display-only prefix (`Explorer: Open Editors`) via `homeViewId`. A View's own self-section and locked sections (Places) can't be pulled out. Persisted per container as a `viewSections` map keyed by view id
- **Workspace schema v5** — unifies section storage: `primarySidebar.sectionState` and the legacy panel `sectionState` are replaced by a per-container `viewSections` map (`{ [viewId]: Section[] }`, each `Section` carrying `homeViewId`); v4→v5 migration moves Explorer's sections over and preserves Places-first + locked invariants
- **View/section context actions** — registry-declared `actions` render in the tab strip while a view is standalone and relocate into its SplitViewHeading once merged (hover/focus-revealed, `@click.stop`); section actions render in the SplitSectionHeading. `ViewActions.vue`; examples: Debug *Clear*, Places *Refresh*

- **Settings and keyboard shortcuts modals** — `SettingsModal.vue` replaces the old preferences editor tab: VS Code–style layout with search, left sidebar section nav, auto-save on change (300 ms debounce), blue modified-dot indicator, and `Ctrl+,` shortcut (fires even from inputs); `KeyboardShortcutsModal.vue` is a read-only grouped table of all shortcuts with `<kbd>` key chips and search filtering; both open from Settings menu; `PreferencesActivity.vue` (editor-tab approach) retired

- **Command palette** — `CommandPalette.vue` floating modal with fuzzy search over all menu commands; opens via `Ctrl+Shift+P` or omnibar click; commands flattened from all four menus with category breadcrumbs; toggle items show current checkmark state; arrow-key navigation; basic implementation, more features planned

- **ViewContainer panel system** — unified `ViewContainer.vue` replaces the old `Panel` component for secondary sidebar and bottom panel; two modes: tabs (one view visible at a time) and accordion sections (primary sidebar Open Editors + Places); tab drag-to-reorder within a container and cross-container drag between secondary sidebar and bottom panel; drag-to-merge drops a tab onto a panel's content area to stack it as a collapsible sub-section inside the target slot (`mergedSlots`); sub-sections resize with sash handles (top/bottom for secondary sidebar, left/right for bottom panel); section headers drag back to the tab bar to extract; `ViewSection.vue`, `ViewDropOverlay.vue`, and `OpenEditorsView.vue` added as new components

- **View management** — `PANEL_VIEW_REGISTRY` + View ▸ Views submenu to show/hide individual views (Preview, Details, Chat, Debug); hiding marks the view in `hiddenViews` so it stays hidden after reload; startup recovery (`recoverMissingViews`) restores views lost due to corrupted workspace state; panel action buttons to maximize and hide each panel

- **View menu additions** — View ▸ Appearance submenu with per-element toggle checkmarks (primary sidebar, secondary sidebar, bottom panel, status bar, zen mode, centered layout); View ▸ Views submenu for per-view toggles; `FloatingMenu` now renders a checkmark glyph for `type: 'toggle'` items with a truthy `checked()` callback

- **Activity → View rename** — renamed the "activity" terminology used for individual tabs/sections hosted inside a `ViewContainer` (Preview, Details, Chat, Debug, Explorer) to "view", matching VS Code's vocabulary where the Activity Bar (the icon-only sidebar switcher) is a distinct concept from the views hosted in a container; touched `ViewContainer.vue` (props, emit payload fields, `DRAG_MIME`, CSS classes), `Workbench.vue` (`PANEL_VIEW_REGISTRY`, handlers, menu items), and `useWorkspaces.js` (see schema v4 below); the Activity Bar itself (`.activitybar`, `toggleActivity` → `togglePrimaryView`) keeps its VS Code name since it's a separate UI element

- **Workspace schema v4** — renames persisted `primarySidebar.activities` → `primarySidebar.views` and `panel.hiddenActivities` → `panel.hiddenViews` as part of the Activity → View rename; v3→v4 migration moves the old field values over automatically

- **Workspace schema v3** — `panel.viewContainerOrder`, `panel.activeViewContainerId`, `panel.mergeGroups`, `panel.hiddenActivities` (now `hiddenViews`, see v4), and `secondarySidebar.mergeGroups` added to the persisted workspace model; forward-compat backfill patches ensure existing workspaces upgrade automatically; v2→v3 migration renames panel areas to `primarySidebar`/`secondarySidebar`/`panel`

- **Editor split grid** — recursive split-view grid of editor groups (`useLayoutGrid.js` engine, `GridView.vue`/`Sash.vue` renderer, `EditorGroup.vue` leaf); split any group up/down/left/right via tab drag-drop to an edge, View ▸ Editor Layout menu, or `Ctrl+\`; five layout presets; per-group tab-previews toggle, lock, and maximize; `⋯` group actions menu; workspace schema v2 with forward migration; all layout mutations logged to the debug panel

- **Right-click drag-and-drop** — `useRightClickDrag` composable suppresses native `contextmenu` on mousedown (fixes Linux/X11 early-fire), shows ghost clone during drag, resolves to a "drop action" menu on release: Move Here, Copy Here, Create Symlink Here; archives get Extract Here instead of Compress to Archive Here
- **Context menu redesign** — two `<teleport to="body">` panels (main + submenu) prevent clipping; MDI SVG icons in quick-action buttons and item rows; split label/chevron item pattern so label click fires action and chevron opens submenu independently; viewport clamping and submenu left-flip on overflow; 1 px separators
- **Empty-space context menu** — right-clicking the directory background shows New Folder, New File, Open in Terminal, and Paste
- **Open in Terminal** — `POST /_api/v2/fs/open_terminal` tries common Linux terminal emulators in priority order; macOS uses `osascript`; Windows tries Windows Terminal then `cmd.exe`; `fsOpenTerminal()` in `fs-api.js`
- **Clipboard status bar pill** — clipboard mode (Copy/Cut), item count, and total size shown inline in the status bar; replaced the floating clipboard toast
- **Debug panel expandable entries** — click any log row to expand a detail view; SELECT and CLIPBOARD entries render a mini item table (icon/thumbnail, filename, type, size) using the thumbnail URL already loaded in the directory view; other entries render a key/value grid; `summaryText()` shows a preview of filenames on the collapsed row
- **Enriched debug log calls** — NAV logs from/to paths; SELECT logs item count + total size in the message with full item objects for the table; CLIPBOARD Copy/Cut/Paste logs full item list; OPS-QUEUE logs structured source/dest/format data; TAB logs path and kind
- **Preferences save fix** — `usePreferences.js` save() was POSTing to the data server (port 8001); fixed to use `CONTROL_BASE` (port 8002) where `handlePreferencesPut` is registered
- **New File action** — "New File" in toolbar actions and empty-space context menu; prompts for name and creates via the ops queue
- **Directory customization** — server parses `.directory` (KDE/Dolphin), `desktop.ini` (`[.ShellClassInfo]`), and detects `.DS_Store` for each directory in listings; custom name, icon, and comment returned as `customization` field; `GET`/`PUT /_api/v2/fs/customization` endpoints for reading and writing `.directory` files; `useCustomIcon.js` composable resolves Dolphin `folder-<color>` names and absolute icon paths; folder-color tints render as inline `<svg fill="currentColor">` so CSS `color` applies correctly
- **Server-side directory sizes** — `list_dir` now accepts `includeDirSize=true`; sizes are computed concurrently (goroutines + semaphore, capped at 8) for directory items on the current page only; client-side async `dir_size` request-per-directory loop removed
- **Icon pack plugin system** — VSCode icon theme adapter loaded from `config/plugins/`; `vscode-material-icon-theme` bundled as first plugin; icons resolved server-side and embedded in list and explorer API responses; `useIconPack.js` composable for client-side manifest access; MDI fallback on load error
- **Breadcrumb overflow** — ResizeObserver-based detection collapses middle segments into an expandable `···` chip when the path bar overflows; always keeps the first and last two segments visible; clicking `···` shows a dropdown of hidden segments
- **Hover preview centering fix** — image natural dimensions are captured during preload and applied as explicit `width`/`height` on the overlay so `translate(-50%, -50%)` is correct from the first frame (no position snap)
- **Go v2 server** — replaced FastAPI/Python backend with a Go `net/http` server (`server/v2/`) for better concurrency and binary serving performance
- **All directory layouts** — grid (XS, SM, default, MD, LG, XL, XXL), list, details, gallery-grid, gallery-mosaic, and feed, all handled by the unified `DirectoryLayout.vue`
- **Sort and filter** — client-side sort by name/size/type/date (modified, created, accessed); filter by file type group, size preset, and date preset; active-state bar with removable chips
- **Exclusion rules from server config** — excluded file categories loaded server-side from a config file rather than passed as URL parameters
- **Thumbnail caching** — disk-based cache for generated image, video, and audio thumbnails
- **Status bar** — shows item count and total size for the current directory; updates to show selected item count and size when items are selected
