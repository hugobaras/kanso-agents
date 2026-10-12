#!/usr/bin/env bash
# P19-01 — Pack M7 D2A light (corpus ≥100 + rapport ; seuils 85/15 = stretch).
# Pas de smoke upload (D-126).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
API="${M7_API:-http://127.0.0.1:3000}"
OUT_DIR="${M7_OUT_DIR:-$ROOT/tmp}"
LABELS="$ROOT/eval/documents/corpus/labels"
mkdir -p "$OUT_DIR"
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
SUMMARY="$OUT_DIR/m7-summary-$STAMP.json"

HEALTH_OK=0
CORPUS_OK=0
CORPUS_SIZE=0
LABEL_COUNT=0
STRETCH_GO=0
CORPUS_REPORT=""
FAILS=()

last_corpus_json() {
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
    if isinstance(obj, dict) and "metrics" in obj and "go_nogo" in obj:
      last=obj
    idx=end
  except json.JSONDecodeError:
    idx=i+1
if last is None:
  raise SystemExit(1)
print(json.dumps(last))
'
}

LABEL_COUNT=$(find "$LABELS" -name 'syn-*.json' 2>/dev/null | wc -l | tr -d ' ')

echo "== M7 labels =="
echo "{\"label_count\":$LABEL_COUNT}"
if [[ "$LABEL_COUNT" -lt 100 ]]; then
  FAILS+=("corpus_labels_lt_100")
fi

echo "== M7 health (soft) =="
if curl -sf "$API/health" >/dev/null; then
  HEALTH_OK=1
  echo '{"ok":true,"health":true}'
else
  echo '{"ok":false,"health":false,"soft":true}' >&2
fi

echo "== M7 eval:corpus =="
set +e
CORPUS_OUT=$(pnpm eval:corpus 2>&1)
CORPUS_EC=$?
set -e
echo "$CORPUS_OUT" | tail -n 40

METRICS_JSON="{}"
if PARSED=$(printf '%s' "$CORPUS_OUT" | last_corpus_json); then
  CORPUS_REPORT=$(printf '%s' "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("report",""))')
  METRICS_JSON="$PARSED"
  CORPUS_SIZE=$(printf '%s' "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("metrics",{}).get("corpus_size",0))')
  STRETCH=$(printf '%s' "$PARSED" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("go_nogo",""))')
  if [[ "$STRETCH" == "GO" ]]; then STRETCH_GO=1; fi
  # Light: size >= 100 and metrics present (seuils stretch non bloquants — D-125)
  if [[ "$CORPUS_SIZE" -ge 100 ]]; then
    CORPUS_OK=1
  else
    FAILS+=("corpus_size_lt_100")
  fi
else
  FAILS+=("eval_corpus_parse")
fi
[[ "$CORPUS_EC" -eq 0 ]] || true

OVERALL=0
if [[ "$CORPUS_OK" -eq 1 && "$LABEL_COUNT" -ge 100 ]]; then
  OVERALL=1
fi

export HEALTH_OK CORPUS_OK CORPUS_SIZE LABEL_COUNT STRETCH_GO
export CORPUS_REPORT SUMMARY OVERALL METRICS_JSON
export FAILS_CSV="${FAILS[*]-}"
python3 - <<'PY'
import json, os
from datetime import datetime, timezone
fails = [f for f in os.environ.get("FAILS_CSV", "").split() if f]
metrics = {}
try:
  raw = os.environ.get("METRICS_JSON") or "{}"
  parsed = json.loads(raw)
  metrics = parsed.get("metrics") or {}
  thresholds = parsed.get("thresholds") or {}
except Exception:
  thresholds = {}
summary = {
  "at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
  "ok": os.environ.get("OVERALL") == "1",
  "decision": "GO_M7_LIGHT" if os.environ.get("OVERALL") == "1" else "NO_GO",
  "health": os.environ.get("HEALTH_OK") == "1",
  "label_count": int(os.environ.get("LABEL_COUNT") or 0),
  "corpus_size": int(os.environ.get("CORPUS_SIZE") or 0),
  "eval_corpus_ok": os.environ.get("CORPUS_OK") == "1",
  "stretch_go_nogo": "GO" if os.environ.get("STRETCH_GO") == "1" else "NO_GO_OR_UNKNOWN",
  "stretch_note": "critical_field_accuracy≥85% / anomaly_rate≤15% = stretch (non bloquant M7 light)",
  "metrics": metrics,
  "thresholds_stretch": thresholds,
  "corpus_report": os.environ.get("CORPUS_REPORT") or None,
  "failures": fails,
  "human_blockers": [
    "DPA design partner signé (données réelles)",
    "Lot B pilote anonymisé",
    "VPS OVH / rota si prod",
  ],
}
path = os.environ["SUMMARY"]
open(path, "w").write(json.dumps(summary, indent=2) + "\n")
print(json.dumps(summary, indent=2))
print(f"wrote {path}", flush=True)
PY

[[ "$OVERALL" -eq 1 ]]
