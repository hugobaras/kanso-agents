#!/usr/bin/env bash
# Local API with .env.local (Postgres from infra/docker/compose.yml on :5433).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
set -a; . "$ROOT/.env.local"; set +a
export KANSO_APP_URL="${KANSO_APP_URL:-http://localhost:3001}"
export KANSO_PUBLIC_URL="${KANSO_PUBLIC_URL:-http://localhost:3000}"
export PORT="${PORT:-3000}"
cd "$ROOT/apps/inbound-api"
exec ./node_modules/.bin/tsx watch src/index.ts
