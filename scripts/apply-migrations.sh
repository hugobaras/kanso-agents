#!/bin/sh
# Apply supabase/migrations to DATABASE_URL (local Docker or Supabase session pooler).
# Tracks applied files in schema_migrations so the script is safe to re-run.
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?Set DATABASE_URL}"

psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
create table if not exists schema_migrations (
  filename text primary key,
  applied_at timestamptz not null default now()
);
SQL

# Legacy DBs (created before tracking): mark pre-tracking files as applied
# when their tables already exist.
has_tenants=$(psql "$DATABASE_URL" -tAc "select to_regclass('public.tenants') is not null")
tracked=$(psql "$DATABASE_URL" -tAc "select count(*) from schema_migrations")
if [ "$has_tenants" = "t" ] && [ "$tracked" = "0" ]; then
  for f in "$ROOT"/supabase/migrations/202610*.sql; do
    name=$(basename "$f")
    case "$name" in
      20261010*|20261012*)
        psql "$DATABASE_URL" -q -c "insert into schema_migrations (filename) values ('$name') on conflict do nothing"
        ;;
    esac
  done
  # Heartbeats table may be missing on older local DBs; its migration is idempotent.
  psql "$DATABASE_URL" -q -c "delete from schema_migrations where filename = '20261012000004_service_heartbeats.sql'"
fi

for f in "$ROOT"/supabase/migrations/*.sql; do
  name=$(basename "$f")
  done_already=$(psql "$DATABASE_URL" -tAc "select 1 from schema_migrations where filename = '$name'")
  if [ "$done_already" = "1" ]; then
    continue
  fi
  echo "Applying $name..."
  psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 --single-transaction -f "$f"
  psql "$DATABASE_URL" -q -c "insert into schema_migrations (filename) values ('$name')"
done
echo "Done."
