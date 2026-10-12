#!/usr/bin/env bash
# P16 — Create / freeze a pilote-<slug> tenant (config published + pack + freeze record).
# Usage:
#   DATABASE_URL=… KANSO_MASTER_KEY=… \
#   PILOTE_SLUG=durand PILOTE_NAME='Cabinet Durand' \
#   bash scripts/freeze-pilote.sh
# Optional: PILOTE_COLOR PILOTE_ALERT_TO PILOTE_ORIGINS --activate
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"
: "${PILOTE_SLUG:?PILOTE_SLUG required (without pilote- prefix)}"

SLUG="$(printf '%s' "$PILOTE_SLUG" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9-]/-/g')"
if [[ "$SLUG" == pilote-* ]]; then
  TENANT="$SLUG"
else
  TENANT="pilote-$SLUG"
fi
NAME="${PILOTE_NAME:-Pilote $SLUG}"
COLOR="${PILOTE_COLOR:-#1B2A4A}"
ALERT_TO="${PILOTE_ALERT_TO:-pilote-ops@example.com}"
API_BASE="${PILOTE_API_BASE:-http://127.0.0.1:3000}"
ORIGINS="${PILOTE_ORIGINS:-}"
ACTIVATE=0
for arg in "$@"; do
  case "$arg" in
    --activate) ACTIVATE=1 ;;
    --help|-h) sed -n '2,10p' "$0"; exit 0 ;;
  esac
done

export PARTNER_TENANT="$TENANT"
export PARTNER_NAME="$NAME"
export PARTNER_COLOR="$COLOR"
export PARTNER_ALERT_TO="$ALERT_TO"
export PARTNER_API_BASE="$API_BASE"
export PARTNER_PACK_DIR="${PILOTE_PACK_DIR:-$ROOT/tmp/partner-pack-$TENANT}"

bash "$ROOT/scripts/onboard-partner.sh"

CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)
cd "$ROOT"

if [[ "$ACTIVATE" -eq 1 ]]; then
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
    "update tenants set status = 'active' where tenant_id = '$TENANT';"
fi

VER=$(psql "$DATABASE_URL" -Atc \
  "select coalesce(max(version),0) from tenant_configs where tenant_id='$TENANT' and product='inbound' and status='published';")

FREEZE_DIR="$ROOT/tmp"
mkdir -p "$FREEZE_DIR"
FREEZE="$FREEZE_DIR/pilote-freeze-$TENANT.json"
export TENANT NAME COLOR API_BASE ORIGINS FREEZE VER ACTIVATE
python3 - <<'PY'
import json, os
from datetime import datetime, timezone
doc = {
  "frozen_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "tenant_id": os.environ["TENANT"],
  "display_name": os.environ["NAME"],
  "inbound_version": int(os.environ.get("VER") or 0),
  "status": "active" if os.environ.get("ACTIVATE") == "1" else "draft",
  "api_base": os.environ["API_BASE"],
  "cors_origins_hint": os.environ.get("ORIGINS") or None,
  "embed_preview": f"{os.environ['API_BASE']}/embed-preview?tenant={os.environ['TENANT']}",
  "snippet": (
    f'<script src="{os.environ["API_BASE"]}/widget/kanso-widget.js" '
    f'data-tenant="{os.environ["TENANT"]}" '
    f'data-api="{os.environ["API_BASE"]}" '
    f'data-primary-color="{os.environ["COLOR"]}"></script>'
  ),
  "note": "Re-publish only via intentional freeze; human DPA still required for real data.",
}
open(os.environ["FREEZE"], "w").write(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")
print(json.dumps({
  "ok": True,
  "tenant_id": doc["tenant_id"],
  "inbound_version": doc["inbound_version"],
  "embed_preview": doc["embed_preview"],
  "status": doc["status"],
}, ensure_ascii=False))
print(f"wrote {os.environ['FREEZE']}", flush=True)
PY
