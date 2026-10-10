# Exécution backlog P1

**Date :** 2026-10-10  
**Statut :** backlog P1 livré côté repo (corpus 100 docs = chantier données)

## P1-01 — AlertAdapter Slack

**Fait :**
- `SlackWebhookAlertAdapter` + console fallback (`webhook_url` dans secret)
- Dispatch multi-canal e-mail **et** Slack sur événements config
- Exemple config : canal `alerts.intake_slack`

```bash
pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret demo-tenant alerts.intake_slack \
  '{"webhook_url":"https://hooks.slack.com/services/..."}'
# sans webhook_url → log console
pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret demo-tenant alerts.intake_slack '{}'
```

## P1-02 — Hors-horaires flag + message

**Fait :**
- Notice + `afterHours` dans `startQualification`
- API `after_hours` sur `POST …/sessions`
- Widget : bandeau système si hors horaires

## P1-03 — Grafana Free dashboards

**Fait :** squelette [`infra/grafana/dashboard-kanso.json`](../infra/grafana/dashboard-kanso.json) + README import.

## P1-05 — Pipeline D2A mock

**Fait :**
- Étapes `ingest` / `extract` / `validate` / `createDraftAction` / `runDocumentPipeline`
- Worker bootstrap mock + **poll Postgres** (`claimNextJob` SKIP LOCKED)
- API `POST /v1/:tenant/documents` (upload_web) + `GET …/documents/:jobId`

```bash
pnpm --filter @kanso/admin-cli exec node dist/index.js publish-config demo-tenant \
  config/examples/document_to_action.btp.example.json
# API up, puis :
DATABASE_URL=… ./apps/inbound-api/node_modules/.bin/tsx scripts/smoke-upload.mts
pnpm --filter @kanso/document-worker dev   # poll loop
```

## P1-04 — Corpus D2A ≥100

**Fait :** 100 labels synthétiques lot A + `pnpm eval:corpus` (go/no-go mock).  
**Reste :** lot B pilote anonymisé (données réelles).

## P1-06 — Eval D2A

**Fait :** `pnpm eval:documents` (échantillon mock 3 cas protocole).

## P1-07 — Staging allégé

**Fait :** `infra/docker/compose.staging.yml` (env staging, port DB 5434).
