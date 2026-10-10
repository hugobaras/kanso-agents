# Kanso Solutions

Mono-dépôt TypeScript — moteurs agentiques configurables (**Inbound** + **Document-to-Action**).

## Prérequis

- Node.js 22+
- pnpm 11+
- Docker (Postgres local, port hôte **5433**)

## Commandes

```bash
pnpm install
pnpm build
pnpm test
pnpm eval:inbound      # 30 cas Inbound mock
pnpm eval:documents    # échantillon D2A
pnpm eval:corpus       # ≥100 docs synthétiques lot A
```

### Upload document (file jobs)

```bash
# publier aussi la config D2A
pnpm --filter @kanso/admin-cli exec node dist/index.js publish-config demo-tenant \
  config/examples/document_to_action.btp.example.json
DATABASE_URL=… KANSO_MASTER_KEY=… \
  ./apps/inbound-api/node_modules/.bin/tsx scripts/smoke-upload.mts
```

### API + widget (local)

```bash
docker compose -f infra/docker/compose.yml up -d db
export DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso
export KANSO_MASTER_KEY='local-dev-only-change-me-32chars!'
./scripts/apply-migrations.sh
pnpm --filter @kanso/admin-cli exec node dist/index.js create-tenant demo-tenant "Demo"
pnpm --filter @kanso/admin-cli exec node dist/index.js publish-config demo-tenant \
  config/examples/inbound.avocats.example.json
pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret demo-tenant alerts.intake_email \
  '{"to":"ops@example.com"}'
pnpm --filter @kanso/inbound-widget build
pnpm --filter @kanso/inbound-api dev
# http://127.0.0.1:3000/demo
```

## Docs clés

| Doc | Contenu |
|-----|---------|
| [DECISIONS.md](DECISIONS.md) | Journal des décisions |
| [docs/p0-execution.md](docs/p0-execution.md) | Backlog P0 |
| [docs/p1-execution.md](docs/p1-execution.md) | Backlog P1 |
| [docs/p2-execution.md](docs/p2-execution.md) | Backlog P2 |
| [docs/p3-execution.md](docs/p3-execution.md) | Backlog P3 |
| [docs/checklist-pilote.md](docs/checklist-pilote.md) | Go pilote (signatures) |
| [docs/ops-humain.md](docs/ops-humain.md) | Actions hors agent |

## Structure

Voir [docs/phase-1-structure-depot.md](docs/phase-1-structure-depot.md).
