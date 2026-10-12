#!/usr/bin/env bash
# P14 — smoke portail connecteurs (magic link local + email connector).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"

API="${PORTAL_API:-http://127.0.0.1:3000}"
TENANT="${PORTAL_SMOKE_TENANT:-demo-tenant}"
EMAIL="${PORTAL_SMOKE_EMAIL:-portal-ops@example.com}"

cd "$ROOT"
CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)
pnpm --filter @kanso/admin-cli build >/dev/null

"${CLI[@]}" invite-portal-user "$TENANT" "$EMAIL" --role owner

if ! curl -sf "$API/health" >/dev/null; then
  echo "{\"ok\":false,\"error\":\"api_down\",\"hint\":\"start inbound-api on $API\"}" >&2
  exit 1
fi

REQ=$(curl -sS -X POST "$API/portal/api/auth/request" \
  -H 'content-type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"tenant_id\":\"$TENANT\"}")
TOKEN=$(printf '%s' "$REQ" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token') or '')")
if [[ -z "$TOKEN" ]]; then
  echo "{\"ok\":false,\"error\":\"no_magic_token\",\"response\":$REQ}" >&2
  exit 1
fi

SESS=$(curl -sS -X POST "$API/portal/api/auth/consume" \
  -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\"}")
ST=$(printf '%s' "$SESS" | python3 -c "import sys,json; print(json.load(sys.stdin)['session_token'])")

curl -sS -X PUT "$API/portal/api/connectors/email" \
  -H "authorization: Bearer $ST" \
  -H 'content-type: application/json' \
  -d '{"to":"portal-ops@example.com","from":"alerts@example.com"}' >/dev/null

LIST=$(curl -sS "$API/portal/api/connectors" -H "authorization: Bearer $ST")
export LIST TENANT
python3 - <<'PY'
import json, os
d = json.loads(os.environ["LIST"])
email = next(c for c in d["connectors"] if c["type"] == "email")
assert email["connected"] and email["enabled"], email
print(json.dumps({"ok": True, "tenant": os.environ["TENANT"], "email_connected": True}))
PY
