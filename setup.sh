#!/usr/bin/env bash
set -euo pipefail

echo "Setting up Files Workbench 2..."
echo ""

# Root deps (provides concurrently)
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
