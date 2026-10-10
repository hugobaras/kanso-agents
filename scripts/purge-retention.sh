#!/usr/bin/env bash
# Cron quotidien : dry-run par défaut. Passer --execute pour purger.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
MODE="${1:---dry-run}"
cd "$ROOT"
exec pnpm --filter @kanso/admin-cli exec node dist/index.js purge-retention "$MODE"
