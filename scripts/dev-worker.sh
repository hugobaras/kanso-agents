#!/usr/bin/env bash
# Local document worker + scheduler with .env.local.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/.env.local"; set +a
export KANSO_APP_URL="${KANSO_APP_URL:-http://localhost:3001}"
export KANSO_WORKER_BOOTSTRAP=0
cd "$ROOT/apps/document-worker"
exec ./node_modules/.bin/tsx watch src/index.ts
