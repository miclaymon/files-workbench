#!/usr/bin/env bash
set -euo pipefail

echo "Setting up Files Workbench..."
echo ""

# The client depends on sibling package checkouts via file: installs.
for pkg in workbench-framework workbench-ui-vue workbench-framework-plugin-sdk files-workbench-core; do
  if [ ! -d "../$pkg" ]; then
    echo "✗ Missing sibling checkout: ../$pkg"
    echo "  Clone it first: git clone git@github.com:miclaymon/$pkg.git ../$pkg"
    exit 1
  fi
done
if [ ! -d "../files-workbench-plugins/files-workbench-material-icons" ]; then
  echo "✗ Missing ../files-workbench-plugins/files-workbench-material-icons"
  echo "  (standalone plugin package — a root file: dependency)"
  exit 1
fi

# Root deps (provides concurrently + the material-icons plugin symlink)
echo "→ Installing root dependencies..."
npm install

# Client deps
echo "→ Installing client dependencies..."
npm install --prefix client

echo ""
echo "✓ Setup complete."
echo ""
echo "  Start everything:       npm run dev"
echo "  Browser only (no Electron): npm run dev:web"
echo "  Server only:            npm run dev:server"
