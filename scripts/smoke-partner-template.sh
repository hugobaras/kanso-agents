#!/usr/bin/env bash
# Smoke design-partner template (P12-04) — tenant éphémère partner-template.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"

TENANT="${DESIGN_PARTNER_TENANT:-partner-template}"
NAME="${DESIGN_PARTNER_NAME:-Partner Template Demo}"
CFG="$ROOT/config/examples/inbound.partner-template.json"

TMP="$(mktemp)"
sed "s/PARTNER_DISPLAY_NAME/${NAME}/g" "$CFG" >"$TMP"

cd "$ROOT"
CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)
pnpm --filter @kanso/admin-cli build >/dev/null

"${CLI[@]}" create-tenant "$TENANT" "$NAME" || true
"${CLI[@]}" publish-config "$TENANT" "$TMP"
"${CLI[@]}" put-secret "$TENANT" alerts.intake_email \
  '{"to":"partner-ops@example.com","from":"alerts@example.com"}'
"${CLI[@]}" put-secret "$TENANT" crm.hubspot '{"sandbox":"true"}'
"${CLI[@]}" put-secret "$TENANT" calendar.google '{"sandbox":"true"}'
rm -f "$TMP"

export DESIGN_PARTNER_TENANT="$TENANT"

if curl -sf http://127.0.0.1:3000/health >/dev/null 2>&1; then
  START_JSON=$(curl -sS -X POST "http://127.0.0.1:3000/v1/${TENANT}/sessions")
  SID=$(printf '%s' "$START_JSON" | python3 -c "import sys,json; print(json.load(sys.stdin)['session_id'])")
  RESP=$(curl -sS -X POST "http://127.0.0.1:3000/v1/${TENANT}/sessions/${SID}/messages" \
    -H 'content-type: application/json' \
    -d '{"text":"Offre principale"}')
  export TENANT SID RESP
  python3 - <<'PY'
import json, os
d = json.loads(os.environ["RESP"])
assert d.get("assistant_message"), d
print(json.dumps({
    "ok": True,
    "tenant": os.environ["TENANT"],
    "session_id": d["session_id"],
    "state": d["state"],
}))
PY
else
  pnpm exec tsx scripts/smoke-design-partner.mts
fi
