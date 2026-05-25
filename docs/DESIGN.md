# Design & Architecture

## Overview

Files Workbench 2 is a multi-process desktop application:

```
┌──────────────────────────────────────┐
│  Electron main process               │
│  (client/electron/main.js)           │
│  ┌────────────────────────────────┐  │
│  │  Renderer process              │  │
│  │  Nuxt 3 SPA (Vue 3)            │  │
│  │  http://localhost:3000         │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
              │ HTTP /_api/v2/*
┌──────────────────────────────────────┐
│  Go HTTP server                      │
│  http://localhost:8000               │
└──────────────────────────────────────┘
```

In development, Nuxt's Vite dev server proxies `/_api/v2/*` to port 8000. In production, Nuxt generates a static bundle that Electron loads directly from disk; the client calls the Go server on `http://localhost:8000` without a proxy.

## Frontend component model

### Workbench shell

`Workbench.vue` is the root component. It owns:
- Global app state: tabs, selected/focused items, clipboard, context menu
- Activity bar (explorer, search, settings icons)
- Sidebar (ExplorerPanel)
- Tab bar with drag-to-reorder (useDragAndDrop)
- Main content area (DirectoryTab or PreferencesActivity per tab)
- Right panel (PreviewPanel, DetailsPanel)
- All floating UI (context menus, floating menus, toast notifications)

### Directory view

`DirectoryTab` fetches directory listings and manages navigation history. It passes items down to `DirectoryPanel`, which applies client-side sort/filter via a `processedItems` computed property, then renders the result through `DirectoryLayout`.

`DirectoryLayout` is a single unified component that handles all view modes — grid (XS through XXL), list, details, gallery-grid, gallery-mosaic, and feed — via a `data-layout` attribute on its root element. All layout-specific behavior is CSS-driven from that attribute. The layout prop is set by the user via a picker button in `DirectoryPanel`.

### Sort and filter

`DirectoryPanel` owns `sortField`, `sortDir`, `filterTypes`, `filterSizePreset`, and `filterDatePreset` refs. A `processedItems` computed property applies all active filters and then sorts, always placing directories first. The active state is shown in a contextual bar below the navigation header with removable chips.

### Explorer tree

`ExplorerTree` owns expanded/collapsed state and lazy-loads children via `/_api/v2/Explorer`. The tree is recursive: `TreeItem` renders a node and its children, forwarding events up through `TreeList` → `ExplorerTree` → `ExplorerPanel` → `Workbench`.

### Event propagation pattern

All user-initiated events (select, navigate, rename, contextmenu, etc.) travel upward via `defineEmits` chains. Every intermediate component just re-emits the event transparently. `Workbench.vue` is the single place that acts on them — updating state, calling the API, or triggering side effects.

This means adding a new event in a leaf component requires threading it through every layer in the chain. This is intentional: it keeps business logic centralized and components dumb.

## State management

No Pinia or Vuex. State lives in:
- `Workbench.vue` `reactive`/`ref` — global app state (tabs, prefs, clipboard)
- `DirectoryTab.vue` — navigation history, items list, thumbnail map
- `DirectoryPanel.vue` — sort/filter state, layout picker state
- `ExplorerTree.vue` — expanded Set, children cache (also persisted to localStorage)
- Module-level refs in `useTreeDrag.js` — shared drag state across all tree nodes

## Drag and drop systems

There are three independent drag systems:

| System | Used by | Mechanism |
|---|---|---|
| `useDrag.js` | Directory grid/list/table items | Custom mousedown → ghost clone, 200 ms delay, `onActivate` callback for multi-select |
| `useTreeDrag.js` | Explorer tree nodes | Custom mousedown → chip ghost, module-level shared state, directory-only drop targets |
| `useDragAndDrop.js` | Tab bar | Native HTML5 drag (`draggable`, `@dragstart`/`@dragover`/`@drop`) for list reordering |

The file drag systems (`useDrag`, `useTreeDrag`) do not set `dataTransfer` and therefore cannot interoperate with native drop targets. When drop functionality is added to the directory view, the composables will need a `dataTransfer` payload.

## Click handling

`useClickDebounce` wraps every interactive item to distinguish single-click (select) from double-click (navigate/open). Key properties:
- Modifier keys (Ctrl/Meta/Shift) bypass the delay and fire immediately
- `cancel()` flushes any pending single-click timer (used when rename mode activates to suppress spurious selection)
- The delay is 220 ms — long enough to detect a double-click but shorter than most users' patience

## Preview panel

`PreviewPanel` determines the preview type by checking file extension first (via an `EXT_LANGUAGE` map), then MIME type from the server. This avoids misidentifying `.ts` TypeScript files as `video/mp2t`.

Preview kinds: `text` (Monaco), `html` (iframe + source toggle), `image`, `video` (Video.js), `audio` (Wavesurfer.js), `binary` (no preview).

In dev, file content is fetched from Nitro server routes (`/media-preview`, `/text-preview`) to bypass Vite's proxy size limit on large responses.

## Inline rename

Double-clicking a filename in the tree or directory view opens an inline `contenteditable` span. `v-if`/`v-else` swaps the display span for the edit span — this prevents Vue's virtual DOM from patching over user edits. On commit (Enter or blur) the component emits `rename({ path, newName })` which travels up to `Workbench.handleRename` for the eventual API call.

## Theming

All colors are CSS custom properties defined in `client/assets/css/workbench.css`. The theme JSON files in `config/themes/` are the source of truth for each built-in theme; at startup the app applies them by setting CSS variables on `:root`. The user's accent color overrides `--accent` independently of the theme.

## Server architecture

The active backend is a Go HTTP server (`server/v2/`) using the stdlib `net/http` package. There is no framework — routes are registered on a `http.ServeMux`. All routes are prefixed with `/_api/v2/`.

Functional areas:

- **fs** — file system CRUD: list directory, stat, rename, create file/dir, write file, open with system app
- **explorer** — directory tree listing: root nodes, home directory, drives, lazy-expandable subtree, exclusion categories
- **media** — thumbnails (image resize via `golang.org/x/image`; video frame and audio artwork extraction via ffmpeg), file metadata, raw file serving
- **preferences** — read and write user preferences JSON, serve the preferences JSON Schema
- **perf** — client-side performance log ingestion

Thumbnail generation is handled by `thumbnail.go` and results are stored in a disk-based cache keyed by file path, size, and type. `blacklist.go` loads path exclusion rules from a server-side config file rather than URL parameters.

A legacy FastAPI/Python server lives in `server/v1/` and is no longer actively used.

## Configuration system

User configuration is read from `config/` at startup. The app merges `user-*.json` over `default-*.json` using a shallow merge. JSON Schema files (`*.schema.json`) validate the merged result. Unknown keys in user files are ignored rather than causing errors, to support forward-compatibility when the schema evolves.
