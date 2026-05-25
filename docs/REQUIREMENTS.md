# Requirements

## Core

- Browse the local filesystem in a tabbed interface with multiple tabs open simultaneously
- Navigate directories via double-click, breadcrumb path bar, and keyboard shortcuts
- Support forward/back navigation history per tab
- Display files and folders in multiple layouts: grid, list, table (more layouts planned)
- Show file thumbnails (images, video frames) in directory views
- Explorer sidebar with a collapsible/expandable folder tree

## File operations

- Select single and multiple items (click, Shift+click, Ctrl+click, checkboxes)
- Copy, cut, and paste files and folders
- Rename files and folders inline (double-click on name)
- Move items via drag-and-drop to a target folder
- Delete items (to be implemented)
- Context menu with common operations on items and empty space

## Preview panel

- Preview the most recently selected file(s) in a side panel
- Images: full-resolution with blurred thumbnail placeholder while loading
- Video: playback via Video.js with transport controls and playback rate
- Audio: waveform via Wavesurfer.js, embedded album art, transport controls
- Code and text files: syntax-highlighted read-only Monaco Editor view
- HTML files: rendered iframe preview with toggle to source view
- Show file dimensions, format, size, and duration metadata below media previews

## Explorer tree

- Show directory hierarchy lazily (children loaded on first expand)
- Persist expanded state across sessions (localStorage)
- Display indent guides on hover
- Support drag-and-drop to move items into folders (drop targets: directories only)
- Show files optionally (configurable; default: directories only)

## Preferences

- Choose app theme (dark, light, black)
- Set accent color
- Toggle: always show checkboxes, show hidden files, show files in explorer
- Choose default directory layout
- Adjust drag activation delay
- All preferences persisted and merged from `config/preferences/`

## Keyboard shortcuts

- Standard file manager shortcuts: Ctrl+C, Ctrl+X, Ctrl+V, Delete, F2 (rename), Enter (open)
- Navigation: Alt+Left/Right (history), Alt+Up (parent), Ctrl+T (new tab), Ctrl+W (close tab)
- Customizable via `config/keybindings/user-keybindings.json`

## Theming

- Built-in themes: dark, light, black (OLED)
- All colors defined as CSS custom properties
- User-defined themes via `config/themes/`

## Non-functional

- Fast directory listing for large directories (thousands of files)
- Thumbnail caching (server-side SQLite, planned)
- Runs as a native Electron app on Linux, macOS, and Windows
- Also usable as a web app in a browser (limited by browser sandboxing)
