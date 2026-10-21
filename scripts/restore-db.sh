#!/bin/sh
# Restaure une sauvegarde chiffrée dans une base VIDE (jamais par-dessus la production).
#   TARGET_DATABASE_URL=… KANSO_BACKUP_KEY=… sh scripts/restore-db.sh /backups/kanso-….dump.enc
set -eu
FILE="${1:?Fichier de sauvegarde requis}"
: "${TARGET_DATABASE_URL:?Set TARGET_DATABASE_URL (base vide de destination)}"
: "${KANSO_BACKUP_KEY:?Set KANSO_BACKUP_KEY}"
existing=$(psql "$TARGET_DATABASE_URL" -tAc "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$existing" != "0" ]; then
  echo "Refus : la base cible contient déjà $existing tables. Restaurez dans une base vide puis basculez." >&2
  exit 1
fi
# Roles referenced by RLS policies must exist before the policies are restored.
psql "$TARGET_DATABASE_URL" -q -v ON_ERROR_STOP=1 <<'SQL'
do $$ begin
  if not exists (select from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
SQL
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:KANSO_BACKUP_KEY -in "$FILE" \
  | pg_restore --dbname "$TARGET_DATABASE_URL" --no-owner --no-privileges --exit-on-error
echo "Restauration terminée dans la base cible."
