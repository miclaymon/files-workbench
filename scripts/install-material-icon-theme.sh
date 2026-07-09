#!/usr/bin/env bash
#
# install-material-icon-theme.sh — generate the Material Icon Theme icon pack from
# the upstream project's published release artifact (a .vsix, which is just a zip).
#
# Why the release and not a `git clone`: upstream gitignores `dist/`, so the icon
# theme JSON (the name/extension/folder → icon mapping tables) is NOT in the source
# tree — it is produced by their Node/Bun build. The released .vsix already contains
# the built `dist/material-icons.json` plus every SVG (including open-folder
# variants and clones), so we fetch that and need only `curl` + `unzip` — no build
# toolchain.
#
# The icon pack is two layers:
#   • the server-side config plugin under config/plugins/material-icon-theme/, which
#     the Go server loads to serve /icons/manifest (mappings) and /icons/svg (assets);
#   • the client plugin under client/builtin-plugins/material-icon-theme/, which
#     registers the getIcon handler (the `icons` permission) and consumes those
#     endpoints. The Go server already replicates VS Code's pattern-matching, so no
#     logic needs porting here.
#
# This script (re)generates the FIRST layer's vendored assets (gitignored). It is
# safe to re-run; it stages into a temp dir and swaps atomically, and never clobbers
# a hand-edited plugin.json.
#
# Usage:
#   scripts/install-material-icon-theme.sh [--ref <release-tag>]
#     --ref v5.36.1   pin a specific release (default: latest)
#   GITHUB_TOKEN=...  optional, raises the GitHub API rate limit
#
# Requires: curl, unzip, python3.

set -euo pipefail

REPO="material-extensions/vscode-material-icon-theme"
PLUGIN_ID="material-icon-theme"
SOURCE_SUBDIR="vscode-material-icon-theme"
REF=""

while [ $# -gt 0 ]; do
  case "$1" in
    --ref) REF="${2:?--ref needs a value}"; shift 2 ;;
    -h|--help) sed -n '2,33p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "unknown argument: $1 (try --help)" >&2; exit 2 ;;
  esac
done

for tool in curl unzip python3; do
  command -v "$tool" >/dev/null || { echo "error: $tool not found" >&2; exit 1; }
done

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLUGIN_DIR="$ROOT/config/plugins/$PLUGIN_ID"
DEST="$PLUGIN_DIR/$SOURCE_SUBDIR"

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Auth header (optional) to dodge the unauthenticated GitHub API rate limit.
AUTH=()
[ -n "${GITHUB_TOKEN:-}" ] && AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN")

api_path="latest"; [ -n "$REF" ] && api_path="tags/$REF"
echo "▶ Resolving ${REF:-latest} release of $REPO …"
release_json="$(curl -fsSL "${AUTH[@]}" "https://api.github.com/repos/$REPO/releases/$api_path")"

read -r TAG VSIX_URL <<EOF
$(printf '%s' "$release_json" | python3 -c '
import sys, json
d = json.load(sys.stdin)
vsix = next((a["browser_download_url"] for a in d.get("assets", []) if a["name"].endswith(".vsix")), "")
if not vsix:
    sys.exit("no .vsix asset on the release")
print(d.get("tag_name", "?"), vsix)
')
EOF
echo "▶ Release $TAG"

echo "▶ Downloading $(basename "$VSIX_URL") …"
curl -fSL "${AUTH[@]}" -o "$TMP/pack.vsix" "$VSIX_URL"

# A .vsix is a zip; the built pack lives under extension/{dist,icons} + the manifest.
echo "▶ Extracting theme JSON + SVGs …"
unzip -q "$TMP/pack.vsix" 'extension/dist/*' 'extension/icons/*' 'extension/package.json' -d "$TMP/x"
[ -f "$TMP/x/extension/dist/material-icons.json" ] || { echo "error: theme JSON missing in vsix" >&2; exit 1; }
[ -d "$TMP/x/extension/icons" ]                    || { echo "error: icons/ missing in vsix"      >&2; exit 1; }

icon_count="$(find "$TMP/x/extension/icons" -name '*.svg' | wc -l | tr -d ' ')"
echo "▶ Installing $icon_count SVG icons into config/plugins/$PLUGIN_ID/$SOURCE_SUBDIR/ …"
# Swap the staged tree in with a quick mv so a running server's icon files never
# vanish for longer than an instant.
rm -rf "$DEST"
mkdir -p "$PLUGIN_DIR"
mv "$TMP/x/extension" "$DEST"

# Ensure a plugin manifest exists; never clobber a hand-edited one. theme:"" makes
# the Go loader auto-detect the theme file from the bundled package.json.
if [ ! -f "$PLUGIN_DIR/plugin.json" ]; then
  echo "▶ Writing config/plugins/$PLUGIN_ID/plugin.json …"
  cat > "$PLUGIN_DIR/plugin.json" <<JSON
{
  "id": "$PLUGIN_ID",
  "name": "Material Icon Theme",
  "type": "icon-pack",
  "adapter": "vscode-icon-theme",
  "source": "$SOURCE_SUBDIR",
  "theme": ""
}
JSON
else
  echo "▶ Keeping existing plugin.json."
fi

echo
echo "✓ Material Icon Theme $TAG installed at config/plugins/$PLUGIN_ID/"
echo "  Restart the server (e.g. npm run dev) to load it. Expect a log line like:"
echo "    plugins: loaded icon pack \"$PLUGIN_ID\" (… mappings)"
