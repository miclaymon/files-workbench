#!/usr/bin/env bash
# Files Workbench — Linux installer (pre-alpha).
# Downloads the latest AppImage from GitHub Releases, installs it to
# ~/.local/bin, and adds a desktop entry. No root required.
#
#   curl -fsSL https://raw.githubusercontent.com/miclaymon/files-workbench/main/install.sh | bash
#
# Requires: curl. AppImages need FUSE on some distros (e.g. `sudo apt install libfuse2`).
set -euo pipefail

REPO="miclaymon/files-workbench"
APP_NAME="Files Workbench"
BIN_DIR="${XDG_BIN_HOME:-$HOME/.local/bin}"
APP_PATH="$BIN_DIR/FilesWorkbench.AppImage"
DESKTOP_DIR="${XDG_DATA_HOME:-$HOME/.local/share}/applications"

echo "Finding the latest ${APP_NAME} release…"
URL=$(curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
  | grep -o '"browser_download_url": *"[^"]*\.AppImage"' | head -1 | cut -d'"' -f4)

if [ -z "${URL}" ]; then
  echo "error: no .AppImage asset found in the latest release of ${REPO}." >&2
  echo "       (A maintainer needs to attach the Linux AppImage to a GitHub Release.)" >&2
  exit 1
fi

mkdir -p "$BIN_DIR" "$DESKTOP_DIR"
echo "Downloading: ${URL}"
curl -fSL "$URL" -o "$APP_PATH"
chmod +x "$APP_PATH"

cat > "$DESKTOP_DIR/files-workbench.desktop" <<EOF
[Desktop Entry]
Name=${APP_NAME}
Comment=File manager (pre-alpha)
Exec=${APP_PATH}
Type=Application
Categories=Utility;System;FileTools;
Terminal=false
EOF

echo
echo "Installed ${APP_NAME} → ${APP_PATH}"
echo "Launch it from your applications menu, or run: ${APP_PATH}"
if ! echo ":$PATH:" | grep -q ":$BIN_DIR:"; then
  echo "Note: $BIN_DIR is not on your PATH — add it to run 'FilesWorkbench.AppImage' directly."
fi
