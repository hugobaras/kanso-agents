# Exécution backlog P0

**Date :** 2026-10-10  
**Statut :** backlog P0 livré côté repo (signatures / OVH / DPA / LLM live restent humains)

## P0-01 — Migrations + RLS

**Fait (repo) :**
- [`supabase/migrations/20261010000000_init.sql`](../supabase/migrations/20261010000000_init.sql) — tables + `tenant_secrets`
- [`supabase/migrations/20261010000001_rls.sql`](../supabase/migrations/20261010000001_rls.sql) — RLS + `kanso_current_tenant_id()`
- Script [`scripts/apply-migrations.sh`](../scripts/apply-migrations.sh)

**Fait (local 2026-10-10) :**
- Postgres Docker up sur le port hôte **5433** (5432 déjà pris par un Postgres système)
- 9 tables + RLS activé
- Smoke : `create-tenant` / `publish-config` / `put-secret` OK

**Optionnel :** projet Supabase cloud **`kanso`** (eu-west-3, 0 €/mois) — dire `ok crée le projet kanso` si besoin.

## P0-02 — Docker / env

**Fait :** `infra/docker/compose.yml` (db + api + worker), Dockerfiles, `.env.example` enrichi.  
**Reste :** provision VPS OVH réelle (compte associé) — hors agent sans credentials.

## P0-03 — Secrets + admin-cli

**Fait :**
- Chiffrement AES-256-GCM (`@kanso/tenancy`)
- `PostgresSecretStore`
- CLI : `create-tenant`, `put-secret`, `publish-config`, `validate-config`

## P0-04 — Sessions Postgres + TTL

**Fait :**
- `PostgresSessionStore` + TTL `KANSO_SESSION_TTL_MINUTES` (défaut 30)
- API `POST /v1/:tenantId/sessions` (création + disclaimer)

## P0-05 — Orchestration hybride + validation LLM

**Fait :**
- `orchestrateTurn` — transitions code, intent LLM
- Garde-fous A/B/C : schéma Zod, `question_id` allowlist, sanitisation prix/délais
- Retry validation ×2 puis fallback template
- API `POST /v1/:tenantId/sessions/:sessionId/messages`
- Tests : `orchestrate.test.ts` + e2e happy path

## P0-06 — Provider LLM (Mistral UE)

**Fait :**
- `MistralLlmClient` → `https://api.eu.mistral.ai/v1/chat/completions`
- `response_format.json_schema` + parse Zod
- `createLlmClient()` : `MISTRAL_API_KEY` → Mistral, sinon mock
- Modèle par défaut : alias `mistral-small-latest` (overridable `KANSO_MISTRAL_MODEL`) — *hypothèse à vérifier* via `GET …/models` sur l’endpoint EU

**Pour activer le live :** exporter `MISTRAL_API_KEY` puis relancer l’API.

## P0-07 — Alertes e-mail

**Fait :**
- `SmtpEmailAlertAdapter` (nodemailer) — OVH/Brevo SMTP via secret `host/from/to/user/pass`
- `ConsoleEmailAlertAdapter` si pas de `host` (local)
- `withAdapterRetry` (3 essais)
- Branchement API : `dispatchInboundAlert` sur `alert_event`

**Secret SMTP exemple :**
```bash
pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret demo-tenant alerts.intake_email \
  '{"host":"ssl0.ovh.net","port":"587","user":"...","pass":"...","from":"alerts@example.com","to":"ops@example.com"}'
```

## P0-08 — Widget marque blanche

**Fait :**
- Bundle IIFE `apps/inbound-widget/dist/kanso-widget.js`
- Disclaimer client (« Assistant automatisé ») + disclaimer serveur au 1er message
- CORS API + routes `/widget/kanso-widget.js` et `/demo`
- Couleur / titre via `data-primary-color` / `data-title` / `data-tenant` / `data-api`

```bash
pnpm --filter @kanso/inbound-widget build
# Terminal 1: API
DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso \
KANSO_MASTER_KEY='local-dev-only-change-me-32chars!' \
pnpm --filter @kanso/inbound-api dev
# Ouvrir http://127.0.0.1:3000/demo
```

## P0-09 — usage_ledger + soft cap

**Fait :**
- Écriture `usage_ledger` à chaque appel LLM (via `MeteringLlmClient`)
- Estimation € (`estimateUsageEur`) — tarifs indicatifs Mistral
- Soft cap journalier `KANSO_SOFT_CAP_EUR_PER_DAY` (défaut **5 €**, H-027)
- Alerte interne : `console.warn` + `audit_events` (`soft_cap` / `exceeded`), 1×/jour/tenant
- Réponse messages : `usage.calls`, `usage.day_total_eur`, `usage.soft_cap_breached`

## P0-10 — Purge retention 90/90/365/30

**Fait :**
- `runRetentionPurge` (`@kanso/tenancy`) : sessions 90 j, docs 90 j, audit/usage 365 j, dead letters 90 j
- CLI : `kanso-admin purge-retention --dry-run` (défaut) / `--execute`
- Script cron : `scripts/purge-retention.sh`
- Logs appli 30 j : hors SQL (rotation stdout / Grafana)

```bash
DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso \
pnpm --filter @kanso/admin-cli exec node dist/index.js purge-retention --dry-run
```

## P0-11 — 30 cas eval Inbound + runner

**Fait :**
- 30 cas `eval/inbound/cases/inb-001`…`030` (happy / abandon / off_topic / advice / insist / human / after_hours / hallucination)
- Runner mock `pnpm eval:inbound` → rapport JSON
- Notice hors horaires dans `startQualification` (nécessaire aux cas 027–028)
- Run local : **30/30**, policy_refuse 100 %, hallucinations 0

## P0-12 — Go/no-go Inbound

**Fait :** [inbound-go-nogo.md](./inbound-go-nogo.md) — **GO technique mock** (critères phase 8 §4 OK).  
**Reste avant prod pilote :** run live LLM + P0-13…P0-16.

## P0-13 — DPA / registre / textes moyens

**Fait (brouillons) :** [docs/legal/](./legal/README.md)  
**Reste :** validation conseil (H-025) + signatures réelles.

## P0-14 — Design partner brief + smoke

**Fait :** [design-partner-brief.md](./design-partner-brief.md) + `scripts/smoke-design-partner.mts`  
**Reste :** partenaire réel + DPA signé.

## P0-15 — Runbooks + rota

**Fait :** [runbooks/incident.md](./runbooks/incident.md) (template rota à remplir).

## P0-16 — Checklist pilote

**Fait :** [checklist-pilote.md](./checklist-pilote.md) — cases techniques cochées ; signatures / live / OVH / DPA ouverts.

## Commandes une fois DB up

```bash
export DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso
export KANSO_MASTER_KEY='local-dev-only-change-me-32chars!'
./scripts/apply-migrations.sh   # si DB déjà initialisée sans init scripts
pnpm --filter @kanso/admin-cli exec node dist/index.js create-tenant demo-tenant "Demo"
pnpm --filter @kanso/admin-cli exec node dist/index.js publish-config demo-tenant config/examples/inbound.avocats.example.json
pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret demo-tenant alerts.intake_email '{"to":"ops@example.com"}'
```
