#!/usr/bin/env bash
# Reset démo staging en 1 commande (P12-01).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if [[ ! -f .env.staging ]]; then
  cp .env.staging.example .env.staging
  echo "created .env.staging — renseigner MISTRAL_API_KEY + KANSO_MASTER_KEY si besoin"
fi

set -a
# shellcheck disable=SC1091
source .env.staging
set +a

export DATABASE_URL="${DATABASE_URL:-postgres://kanso:kanso@127.0.0.1:5434/kanso}"

echo "== docker staging =="
docker compose -f infra/docker/compose.yml -f infra/docker/compose.staging.yml \
  --env-file .env.staging up -d --build

echo "== wait health =="
for _ in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3000/health >/dev/null; then
    break
  fi
  sleep 1
done
curl -sf http://127.0.0.1:3000/health | head -c 200 || {
  echo "API not healthy"
  exit 1
}
echo

echo "== admin-cli build =="
pnpm --filter @kanso/admin-cli build >/dev/null

echo "== bootstrap tenants =="
chmod +x scripts/bootstrap-demo-tenants.sh
./scripts/bootstrap-demo-tenants.sh

echo "{\"ok\":true,\"demo\":\"http://127.0.0.1:3000/demo\",\"ops\":\"http://127.0.0.1:3000/demo/ops\"}"
