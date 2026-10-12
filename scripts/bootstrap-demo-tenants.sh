#!/usr/bin/env bash
# Bootstrap deux tenants démo (valeur multi-tenant visible).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"

cd "$ROOT"
CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)

bootstrap_one() {
  local tenant="$1" name="$2" config="$3"
  "${CLI[@]}" create-tenant "$tenant" "$name" || true
  "${CLI[@]}" publish-config "$tenant" "$config"
  "${CLI[@]}" put-secret "$tenant" alerts.intake_email \
    '{"to":"ops@example.com","from":"alerts@example.com"}'
  "${CLI[@]}" put-secret "$tenant" alerts.intake_slack '{}'
  "${CLI[@]}" put-secret "$tenant" crm.hubspot '{"sandbox":"true"}'
  "${CLI[@]}" put-secret "$tenant" calendar.google '{"sandbox":"true"}'
  echo "{\"ok\":true,\"tenant\":\"$tenant\"}"
}

bootstrap_one demo-tenant "Demo Cabinet Durand" \
  "$ROOT/config/examples/inbound.avocats.example.json"
"${CLI[@]}" publish-config demo-tenant \
  "$ROOT/config/examples/document_to_action.btp.example.json" || true

bootstrap_one demo-martin "Demo Cabinet Martin" \
  "$ROOT/config/examples/inbound.experts-comptables.example.json"
"${CLI[@]}" publish-config demo-martin \
  "$ROOT/config/examples/document_to_action.btp.example.json" || true

echo '{"ok":true,"tenants":["demo-tenant","demo-martin"],"next":"open http://127.0.0.1:3000/demo"}'
