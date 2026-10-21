#!/bin/sh
# Preuve de restauration : sauvegarde, restaure dans une base temporaire, compare les comptages, supprime la base.
#   DATABASE_URL=postgres://user:pass@host:5432/kanso KANSO_BACKUP_KEY=… sh scripts/check-backup.sh
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${KANSO_BACKUP_KEY:?Set KANSO_BACKUP_KEY}"
TMPDIR_B=$(mktemp -d)
CHECK_DB="kanso_restore_check_$(date +%s)"
ADMIN_URL="${DATABASE_URL%/*}/postgres"
TARGET_URL="${DATABASE_URL%/*}/$CHECK_DB"
cleanup() { psql "$ADMIN_URL" -q -c "drop database if exists $CHECK_DB" >/dev/null 2>&1 || true; rm -rf "$TMPDIR_B"; }
trap cleanup EXIT

sh "$ROOT/scripts/backup-db.sh" "$TMPDIR_B" >/dev/null
FILE=$(ls "$TMPDIR_B"/kanso-*.dump.enc)
psql "$ADMIN_URL" -q -c "create database $CHECK_DB"
TARGET_DATABASE_URL="$TARGET_URL" sh "$ROOT/scripts/restore-db.sh" "$FILE" >/dev/null

status=0
for t in tenants users subscriptions memberships portal_dossiers portal_files schema_migrations; do
  a=$(psql "$DATABASE_URL" -tAc "select count(*) from $t")
  b=$(psql "$TARGET_URL" -tAc "select count(*) from $t")
  if [ "$a" = "$b" ]; then echo "ok   $t : $a"; else echo "ÉCART $t : source $a, restauré $b"; status=1; fi
done
[ "$status" = 0 ] && echo "Restauration vérifiée." || echo "Restauration INCOMPLÈTE." >&2
exit "$status"
