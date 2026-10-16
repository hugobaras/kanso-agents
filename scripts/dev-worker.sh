#!/usr/bin/env bash
# Local document worker + scheduler with .env.local.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/.env.local"; set +a
# API and worker run from different folders: a relative storage dir would split their files.
case "${KANSO_STORAGE_DIR:-}" in /*|"") ;; *) export KANSO_STORAGE_DIR="$ROOT/$KANSO_STORAGE_DIR" ;; esac
export KANSO_APP_URL="${KANSO_APP_URL:-http://localhost:3001}"
export KANSO_WORKER_BOOTSTRAP=0
cd "$ROOT/apps/document-worker"
exec ./node_modules/.bin/tsx watch src/index.ts
