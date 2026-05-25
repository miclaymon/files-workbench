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

# Python venv + server deps
echo "→ Setting up Python environment for server/v1..."
python3 -m venv server/v1/.venv
server/v1/.venv/bin/pip install --upgrade pip -q
server/v1/.venv/bin/pip install -r server/v1/requirements.txt

echo ""
echo "✓ Setup complete."
echo ""
echo "  Start everything:  ./start-dev.sh"
echo "  Web only (no Electron): cd client && npm run dev:web"
echo "  Server only:       cd server/v1 && .venv/bin/uvicorn main:app --reload --port 8000"
