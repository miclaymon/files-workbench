# Material Icon Theme Plugin

Provides file and folder icons from the [vscode-material-icon-theme](https://github.com/material-extensions/vscode-material-icon-theme) extension.

## Installation

Clone the repo into this directory:

```sh
cd config/plugins/material-icon-theme
git clone https://github.com/material-extensions/vscode-material-icon-theme
```

The directory should end up looking like:

```
config/plugins/material-icon-theme/
  plugin.json
  vscode-material-icon-theme/
    package.json          ← used to auto-detect the theme file
    icons/                ← SVG icon files
    material-icons.json   ← the theme definition
```

Restart the server after cloning. You should see a log line like:

```
plugins: loaded icon pack "material-icon-theme" (N ext, N name, N folder mappings)
```

## How it works

- The server reads `vscode-material-icon-theme/package.json` to find the theme JSON path.
- The theme JSON maps filenames/extensions/folder names to icon definition names.
- Those mappings are sent to the client once at startup via `/_api/v2/icons/manifest`.
- The client resolves icon names locally (no per-file round-trip) and fetches SVGs on demand.
- SVGs are served with a 24 h cache header, so each icon is only downloaded once per session.
- Thumbnails always take priority over pack icons for media files.
