#!/usr/bin/env bash
# P13-01 — Onboard design partner (<1 h). Console alerts by default; SMTP optional.
# Usage:
#   DATABASE_URL=... KANSO_MASTER_KEY=... \
#   PARTNER_TENANT=cabinet-durand PARTNER_NAME='Cabinet Durand' \
#   PARTNER_COLOR='#1B2A4A' PARTNER_ALERT_TO=ops@example.com \
#   bash scripts/onboard-partner.sh
# Optional SMTP (slot only — leave unset for console):
#   PARTNER_SMTP_HOST=ssl0.ovh.net PARTNER_SMTP_PORT=587 \
#   PARTNER_SMTP_USER=... PARTNER_SMTP_PASS=... PARTNER_SMTP_FROM=alerts@...
# After signed DPA: --set-dpa or PARTNER_DPA_SIGNED=1
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
: "${DATABASE_URL:?DATABASE_URL required}"
: "${KANSO_MASTER_KEY:?KANSO_MASTER_KEY required}"

TENANT="${PARTNER_TENANT:?PARTNER_TENANT required (slug, e.g. cabinet-durand)}"
NAME="${PARTNER_NAME:?PARTNER_NAME required}"
COLOR="${PARTNER_COLOR:-#1B2A4A}"
ALERT_TO="${PARTNER_ALERT_TO:-partner-ops@example.com}"
ALERT_FROM="${PARTNER_SMTP_FROM:-alerts@example.com}"
CFG_SRC="${PARTNER_CONFIG:-$ROOT/config/examples/inbound.partner-template.json}"
API_BASE="${PARTNER_API_BASE:-http://127.0.0.1:3000}"
OUT_DIR="${PARTNER_PACK_DIR:-$ROOT/tmp/partner-pack-$TENANT}"
SET_DPA=0
for arg in "$@"; do
  case "$arg" in
    --set-dpa) SET_DPA=1 ;;
    --help|-h)
      sed -n '2,14p' "$0"
      exit 0
      ;;
  esac
done
if [[ "${PARTNER_DPA_SIGNED:-0}" == "1" ]]; then SET_DPA=1; fi

if [[ ! -f "$CFG_SRC" ]]; then
  echo "{\"ok\":false,\"error\":\"config_not_found\",\"path\":\"$CFG_SRC\"}" >&2
  exit 1
fi

TMP="$(mktemp)"
# shellcheck disable=SC2001
sed -e "s/PARTNER_DISPLAY_NAME/${NAME//\//\\/}/g" \
    -e "s/\"primary_color\": \"#[0-9A-Fa-f]\\{3,8\\}\"/\"primary_color\": \"$COLOR\"/" \
    "$CFG_SRC" >"$TMP"

cd "$ROOT"
CLI=(pnpm --filter @kanso/admin-cli exec node dist/index.js)
pnpm --filter @kanso/admin-cli build >/dev/null

"${CLI[@]}" create-tenant "$TENANT" "$NAME" || true
"${CLI[@]}" publish-config "$TENANT" "$TMP"

if [[ -n "${PARTNER_SMTP_HOST:-}" ]]; then
  export PARTNER_SMTP_HOST PARTNER_SMTP_PORT="${PARTNER_SMTP_PORT:-587}"
  export PARTNER_SMTP_USER="${PARTNER_SMTP_USER:-}" PARTNER_SMTP_PASS="${PARTNER_SMTP_PASS:-}"
  export PARTNER_SMTP_FROM="$ALERT_FROM" PARTNER_ALERT_TO="$ALERT_TO"
  SMTP_JSON=$(python3 - <<'PY'
import json, os
print(json.dumps({
  "host": os.environ["PARTNER_SMTP_HOST"],
  "port": os.environ.get("PARTNER_SMTP_PORT", "587"),
  "user": os.environ.get("PARTNER_SMTP_USER", ""),
  "pass": os.environ.get("PARTNER_SMTP_PASS", ""),
  "from": os.environ["PARTNER_SMTP_FROM"],
  "to": os.environ["PARTNER_ALERT_TO"],
}))
PY
)
  "${CLI[@]}" put-secret "$TENANT" alerts.intake_email "$SMTP_JSON"
else
  "${CLI[@]}" put-secret "$TENANT" alerts.intake_email \
    "{\"to\":\"$ALERT_TO\",\"from\":\"$ALERT_FROM\"}"
fi

"${CLI[@]}" put-secret "$TENANT" crm.hubspot '{"sandbox":"true"}'
"${CLI[@]}" put-secret "$TENANT" calendar.google '{"sandbox":"true"}'

if [[ "$SET_DPA" -eq 1 ]]; then
  "${CLI[@]}" set-dpa "$TENANT" --signed
else
  "${CLI[@]}" set-dpa "$TENANT" --unsigned || true
fi

rm -f "$TMP"

mkdir -p "$OUT_DIR"
SNIPPET="$OUT_DIR/widget-snippet.html"
cat >"$SNIPPET" <<EOF
<!-- Kanso Inbound — $NAME ($TENANT) -->
<script
  src="${API_BASE}/widget/kanso-widget.js"
  data-tenant="${TENANT}"
  data-api="${API_BASE}"
  data-primary-color="${COLOR}"
></script>
EOF

README_PACK="$OUT_DIR/README.md"
cat >"$README_PACK" <<EOF
# Pack remise — $NAME

- Tenant: \`$TENANT\`
- DPA signé (flag): $([ "$SET_DPA" -eq 1 ] && echo oui || echo non — uploads docs réels bloqués)
- Alertes: $([ -n "${PARTNER_SMTP_HOST:-}" ] && echo "SMTP $PARTNER_SMTP_HOST" || echo "console (pas de host)")
- Snippet: \`widget-snippet.html\`
- DPA modèle: docs/legal/dpa-design-partner.md
- One-pager: docs/partner-pack-onepager.md
- Checklist M4: docs/checklist-m4.md

Après signature DPA réelle:
\`\`\`
pnpm --filter @kanso/admin-cli exec node dist/index.js set-dpa $TENANT --signed
\`\`\`
EOF

export TENANT NAME SET_DPA OUT_DIR SNIPPET API_BASE
python3 - <<'PY'
import json, os
print(json.dumps({
  "ok": True,
  "tenant": os.environ["TENANT"],
  "name": os.environ["NAME"],
  "dpa_signed": os.environ["SET_DPA"] == "1",
  "smtp": bool(os.environ.get("PARTNER_SMTP_HOST")),
  "pack_dir": os.environ["OUT_DIR"],
  "snippet": os.environ["SNIPPET"],
  "next": [
    f"open {os.environ['API_BASE']}/demo",
    f"embed {os.environ['SNIPPET']}",
    "sign DPA then: kanso-admin set-dpa <tenant> --signed",
  ],
}, ensure_ascii=False))
PY
