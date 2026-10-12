# Exécution phase 10 — fondations live

**Date :** 2026-10-12  
**Statut :** fondations OK — SMTP réel + OVH reportés  
**Repo :** https://github.com/hugobaras/kanso-agents

## Décisions (validées par « go »)

Voir [phase-10-mise-en-prod.md](./phase-10-mise-en-prod.md) — D-085…D-090.

## A — GitHub

**Fait :** remote privé `hugobaras/kanso-agents`, `main` poussée, CI présente.

## B — Staging Docker live-ready

**Fait :**
- `.env.staging.example` + `infra/docker/compose.staging.yml` (Mistral, storage, poll, port DB **5434**)
- Stack up : `db` healthy, `inbound-api` **staging** `/health` → `{"ok":true}`, worker poll
- `scripts/bootstrap-demo-tenant.sh` → tenant `demo-tenant` + configs inbound/D2A
- Session live : `POST /v1/demo-tenant/sessions` → `Qualify` OK

```bash
cp .env.staging.example .env.staging   # MISTRAL_API_KEY + KANSO_MASTER_KEY
docker compose -f infra/docker/compose.yml -f infra/docker/compose.staging.yml \
  --env-file .env.staging up -d --build
export DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5434/kanso
export KANSO_MASTER_KEY=…   # même valeur que .env.staging
./scripts/bootstrap-demo-tenant.sh demo-tenant "Demo Kanso"
# widget : http://127.0.0.1:3000/demo
```

## C — Supabase `kanso`

**Fait :** projet healthy `ogyurifuplcrjsonimab` (eu-west-3), 9 tables + RLS.  
**Fix applied :** `kanso_current_tenant_id` `search_path = public` (migration `20261012000001_…`) — security advisors vides.

**Reste (humain, quand bascule apps hors Postgres Docker) :** URI pooler dans `.env.staging` / prod. Ne **pas** utiliser `shapemax`.

## D — Mistral live

**Fait (auth) :** `MISTRAL_API_KEY` chargée depuis `.env.local` ; `GET /v1/models` autorisé.  
**Smoke structured :** `scripts/smoke-mistral.mts` atteint l’API live ; **HTTP 429 rate limit** au moment du run (compte / quota) — retry plus tard :

```bash
set -a && source .env.local && set +a
pnpm exec tsx scripts/smoke-mistral.mts
```

## E — SMTP

**Partiel :** bootstrap met un fallback console (`to`/`from` example.com, pas de host).  
**Bloquant live alertes :** credentials SMTP OVH non fournis → `put-secret` réel + `smoke-alert` ensuite.

## F — Tenant démo

**Fait** sur staging Docker : `demo-tenant`, configs published, secrets sandbox CRM/calendar + e-mail fallback.

## G — OVH

**Reporté** (Q1 = staging local d’abord).

## H — Design partner

Parallèle — [design-partner-brief.md](./design-partner-brief.md) + DPA ; pas de données réelles sans signature.

## Checklist M1 (phase 9)

| Critère | Statut |
|---------|--------|
| GitHub + CI | OK |
| Supabase UE `kanso` | OK + advisor search_path corrigé |
| Staging Docker live-ready | OK (stack up, health staging) |
| Mistral live | Auth OK ; completion 429 temporaire |
| SMTP live | Attente credentials (fallback console OK démo) |
| VPS OVH | Reporté |
| Tenant démo | OK (`demo-tenant` + session API) |
