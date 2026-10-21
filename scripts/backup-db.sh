#!/bin/sh
# Chiffre et conserve une sauvegarde complète de la base (pg_dump, format custom).
#   DATABASE_URL=… KANSO_BACKUP_KEY=… sh scripts/backup-db.sh [dossier]
# Sortie : <dossier>/kanso-AAAAMMJJ-HHMMSS.dump.enc (AES-256, clé dérivée PBKDF2).
# KANSO_BACKUP_KEEP_DAYS (défaut 30) : les sauvegardes plus anciennes du dossier sont supprimées.
# KANSO_BACKUP_S3_URI (optionnel, ex. s3://kanso-backups/db) : copie hors serveur via la CLI aws.
set -eu
: "${DATABASE_URL:?Set DATABASE_URL}"
: "${KANSO_BACKUP_KEY:?Set KANSO_BACKUP_KEY (gardée hors du serveur : sans elle, aucune restauration)}"
DIR="${1:-${KANSO_BACKUP_DIR:-/backups}}"
KEEP="${KANSO_BACKUP_KEEP_DAYS:-30}"
mkdir -p "$DIR"
STAMP=$(date -u +%Y%m%d-%H%M%S)
OUT="$DIR/kanso-$STAMP.dump.enc"
TMP="$OUT.partial"

# Never leave a readable plaintext dump on disk: pipe straight into the cipher.
pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:KANSO_BACKUP_KEY -out "$TMP"
mv "$TMP" "$OUT"
echo "Sauvegarde : $OUT ($(wc -c < "$OUT" | tr -d ' ') octets)"

if [ -n "${KANSO_BACKUP_S3_URI:-}" ]; then
  aws s3 cp "$OUT" "$KANSO_BACKUP_S3_URI/$(basename "$OUT")" ${KANSO_S3_ENDPOINT:+--endpoint-url "$KANSO_S3_ENDPOINT"}
  echo "Copiée vers $KANSO_BACKUP_S3_URI"
fi

find "$DIR" -name 'kanso-*.dump.enc' -type f -mtime +"$KEEP" -print -delete
