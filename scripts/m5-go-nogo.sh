#!/usr/bin/env bash
# P15-01 — Pack M5 go/no-go (health + eval mock + eval live + smoke portal soft).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API="${M5_API:-http://127.0.0.1:3000}"
OUT_DIR="${M5_OUT_DIR:-$ROOT/tmp}"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SUMMARY="$OUT_DIR/m5-summary-$STAMP.json"

MOCK_OK=0
LIVE_OK=0
LIVE_SKIP=0
HEALTH_OK=0
PORTAL_OK=0
PORTAL_SKIP=0
MOCK_REPORT=""
LIVE_REPORT=""
FAILS=()

last_json() {
  python3 -c '
import json,sys
text=sys.stdin.read()
dec=json.JSONDecoder()
idx=0
last=None
while True:
  i=text.find("{", idx)
  if i<0: break
  try:
    obj, end = dec.raw_decode(text, i)
    if isinstance(obj, dict) and "ok" in obj and "passed" in obj:
      last=obj
    idx=end
  except json.JSONDecodeError:
    idx=i+1
if last is None:
  raise SystemExit(1)
print(json.dumps(last))
'
}

echo "== M5 health =="
if curl -sf "$API/health" >/dev/null; then
  HEALTH_OK=1
  echo '{"ok":true,"health":true}'
else
  FAILS+=("health_down")
  echo '{"ok":false,"health":false}' >&2
fi

echo "== M5 eval mock =="
set +e
MOCK_OUT=$(pnpm eval:inbound 2>&1)
MOCK_EC=$?
set -e
echo "$MOCK_OUT" | tail -n 25
if MOCK_PARSED=$(printf '%s' "$MOCK_OUT" | last_json) \
  && printf '%s' "$MOCK_PARSED" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; print(d.get("report",""))' > /tmp/m5-mock-report.txt
then
  MOCK_OK=1
  MOCK_REPORT=$(cat /tmp/m5-mock-report.txt)
else
  FAILS+=("eval_mock")
fi
[[ "$MOCK_EC" -eq 0 ]] || true

echo "== M5 eval live =="
if [[ -z "${MISTRAL_API_KEY:-}" ]]; then
  LIVE_SKIP=1
  FAILS+=("live_skipped_no_mistral_key")
  echo '{"ok":false,"skip":"MISTRAL_API_KEY missing"}' >&2
else
  set +e
  LIVE_OUT=$(pnpm eval:inbound:live 2>&1)
  LIVE_EC=$?
  set -e
  echo "$LIVE_OUT" | tail -n 25
  if LIVE_PARSED=$(printf '%s' "$LIVE_OUT" | last_json) \
    && printf '%s' "$LIVE_PARSED" | python3 -c 'import json,sys; d=json.load(sys.stdin); assert d.get("ok") is True; print(d.get("report",""))' > /tmp/m5-live-report.txt
  then
    LIVE_OK=1
    LIVE_REPORT=$(cat /tmp/m5-live-report.txt)
  else
    FAILS+=("eval_live")
  fi
  [[ "$LIVE_EC" -eq 0 ]] || true
fi

echo "== M5 smoke portal (soft) =="
if [[ -n "${DATABASE_URL:-}" && -n "${KANSO_MASTER_KEY:-}" && "$HEALTH_OK" -eq 1 ]]; then
  set +e
  pnpm smoke:portal >/tmp/m5-portal.out 2>&1
  PORTAL_EC=$?
  set -e
  if [[ "$PORTAL_EC" -eq 0 ]]; then
    PORTAL_OK=1
    tail -n 5 /tmp/m5-portal.out
  else
    FAILS+=("smoke_portal")
    tail -n 20 /tmp/m5-portal.out >&2 || true
  fi
else
  PORTAL_SKIP=1
  echo '{"skip":"need DATABASE_URL+KANSO_MASTER_KEY+health"}'
fi

OVERALL=0
if [[ "$MOCK_OK" -eq 1 && "$LIVE_OK" -eq 1 ]]; then
  OVERALL=1
fi

export MOCK_OK LIVE_OK LIVE_SKIP HEALTH_OK PORTAL_OK PORTAL_SKIP
export MOCK_REPORT LIVE_REPORT SUMMARY OVERALL
export FAILS_CSV="${FAILS[*]-}"
python3 - <<'PY'
import json, os
from datetime import datetime, timezone
fails = [f for f in os.environ.get("FAILS_CSV", "").split() if f]
summary = {
  "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "ok": os.environ.get("OVERALL") == "1",
  "health": os.environ.get("HEALTH_OK") == "1",
  "eval_mock": os.environ.get("MOCK_OK") == "1",
  "eval_live": os.environ.get("LIVE_OK") == "1",
  "eval_live_skipped": os.environ.get("LIVE_SKIP") == "1",
  "smoke_portal": os.environ.get("PORTAL_OK") == "1",
  "smoke_portal_skipped": os.environ.get("PORTAL_SKIP") == "1",
  "mock_report": os.environ.get("MOCK_REPORT") or None,
  "live_report": os.environ.get("LIVE_REPORT") or None,
  "failures": fails,
  "decision": "GO_TECHNIQUE" if os.environ.get("OVERALL") == "1" else "NO_GO",
  "human_blockers": [
    "DPA design partner signé",
    "VPS OVH (si prod)",
    "Rota incident nommée",
    "SMTP live (optionnel jusqu'à credentials)",
  ],
}
path = os.environ["SUMMARY"]
open(path, "w").write(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
print(f"wrote {path}", flush=True)
PY

[[ "$OVERALL" -eq 1 ]]
