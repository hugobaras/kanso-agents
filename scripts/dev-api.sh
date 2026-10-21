#!/usr/bin/env bash
# Local API with .env.local (Postgres from infra/docker/compose.yml on :5433).
# Variables passed on the command line win over .env.local, e.g.:
#   PORT=3100 KANSO_PUBLIC_URL=http://localhost:3100 bash scripts/dev-api.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CALLER_PORT="${PORT:-}"
CALLER_PUBLIC_URL="${KANSO_PUBLIC_URL:-}"
CALLER_APP_URL="${KANSO_APP_URL:-}"
set -a; . "$ROOT/.env.local"; set +a
# API and worker run from different folders: a relative storage dir would split their files.
case "${KANSO_STORAGE_DIR:-}" in /*|"") ;; *) export KANSO_STORAGE_DIR="$ROOT/$KANSO_STORAGE_DIR" ;; esac
export PORT="${CALLER_PORT:-${PORT:-3000}}"
export KANSO_PUBLIC_URL="${CALLER_PUBLIC_URL:-${KANSO_PUBLIC_URL:-http://localhost:$PORT}}"
export KANSO_APP_URL="${CALLER_APP_URL:-${KANSO_APP_URL:-http://localhost:3001}}"
cd "$ROOT/apps/inbound-api"
exec ./node_modules/.bin/tsx watch src/index.ts
