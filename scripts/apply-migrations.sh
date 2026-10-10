#!/usr/bin/env bash
# Apply supabase/migrations to DATABASE_URL (local Docker or Supabase session pooler).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?Set DATABASE_URL}"

for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "Applying $(basename "$f")..."
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "Done."
