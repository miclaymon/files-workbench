# Material Icon Theme Plugin

Provides file and folder icons from the [vscode-material-icon-theme](https://github.com/material-extensions/vscode-material-icon-theme) extension.

## Installation

Run the generator script from the repo root. It downloads the upstream project's
published release artifact (a `.vsix`, which is just a zip) and extracts the built
theme JSON + SVGs — no `git clone` or build toolchain, just `curl` + `unzip`:

```sh
scripts/install-material-icon-theme.sh             # latest release
scripts/install-material-icon-theme.sh --ref v5.36.1   # pin a release
# GITHUB_TOKEN=… raises the GitHub API rate limit (optional)
```

> Why the release and not `git clone`: upstream **gitignores `dist/`**, so the theme
> JSON (`material-icons.json`) is not in the source tree — it is produced by their
> build. The released `.vsix` already contains the built `dist/` and every SVG
> (including open-folder variants), so we fetch that instead.

The generated assets live under `vscode-material-icon-theme/` and are gitignored
(re-run the script after a fresh checkout). The directory ends up looking like:

```
config/plugins/material-icon-theme/
  plugin.json                       ← committed manifest (id/type/adapter/source)
  vscode-material-icon-theme/       ← generated, gitignored
    package.json                    ← used to auto-detect the theme file
    icons/                          ← SVG icon files
    dist/material-icons.json        ← the theme definition
```

Restart the server after running it. You should see a log line like:

```
plugins: loaded icon pack "material-icon-theme" (N ext, N name, N folder mappings)
```

## How it works

- The server reads `vscode-material-icon-theme/package.json` to find the theme JSON path.
- The theme JSON maps filenames/extensions/folder names to icon definition names.
- Those mappings are sent to the client once at startup via `/_api/v1/icons/manifest`.
- The client resolves icon names locally (no per-file round-trip) and fetches SVGs on demand.
- SVGs are served with a 24 h cache header, so each icon is only downloaded once per session.
- Thumbnails always take priority over pack icons for media files.
