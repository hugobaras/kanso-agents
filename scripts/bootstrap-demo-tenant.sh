#!/usr/bin/env bash
# Bootstrap tenant démo interne (phase 10 F) — données fictives uniquement.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TENANT="${1:-demo-tenant}"
NAME="${2:-Demo Kanso}"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"

cd "$ROOT"
CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)

"${CLI[@]}" create-tenant "$TENANT" "$NAME"
"${CLI[@]}" publish-config "$TENANT" "$ROOT/config/examples/inbound.avocats.example.json"
"${CLI[@]}" publish-config "$TENANT" "$ROOT/config/examples/document_to_action.btp.example.json"

# Console e-mail fallback (pas de host) — remplacer par SMTP réel ensuite
"${CLI[@]}" put-secret "$TENANT" alerts.intake_email \
  '{"to":"ops@example.com","from":"alerts@example.com"}'
"${CLI[@]}" put-secret "$TENANT" alerts.intake_slack '{}'
"${CLI[@]}" put-secret "$TENANT" crm.hubspot '{"sandbox":"true"}'
"${CLI[@]}" put-secret "$TENANT" calendar.google '{"sandbox":"true"}'

echo "{\"ok\":true,\"tenant\":\"$TENANT\",\"next\":\"pnpm --filter @kanso/inbound-api dev + open /demo\"}"
