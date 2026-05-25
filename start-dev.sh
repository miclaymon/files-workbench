#!/usr/bin/env bash
set -euo pipefail

cleanup() {
  echo ""
  echo "Shutting down..."
  kill 0
  exit 0
}

trap cleanup SIGINT SIGTERM

echo "Starting development servers..."
echo ""

# FastAPI server
echo "→ FastAPI on http://localhost:8000"
(cd server/v1 && .venv/bin/uvicorn main:app --reload --port 8000) &

# Nuxt + Electron (waits for Nuxt to be ready before opening the window)
echo "→ Nuxt + Electron (http://localhost:3000)"
(cd client && npm run dev) &

wait
