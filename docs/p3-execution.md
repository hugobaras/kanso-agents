# Exécution backlog P3

**Date :** 2026-10-10  
**Statut :** livré côté repo (features opt-in / gated)

## P3-01 — RAG Inbound

- `InMemoryRagRetriever` + injection contexte dans le system prompt
- Activation : `KANSO_RAG_ENABLED=1`
- Seed FAQ démo par tenant (honoraires / RDV)
- Citations obligatoires dans le prompt ; pas d’embeddings externes au stub

## P3-02 — Drive / Dropbox

- `GoogleDriveSourceAdapter` / `DropboxSourceAdapter` (HTTP + sandbox)
- Registry : `google_drive`, `dropbox`

## P3-03 — Mode `final`

- Pipeline / adapters acceptent `draft|final`
- Garde-fou : `KANSO_ALLOW_FINAL=1` **ou** refus `final_not_confirmed`
- CLI : `kanso-admin confirm-final-action <tenant> --i-understand-final` (audit)

```bash
pnpm --filter @kanso/admin-cli exec node dist/index.js \
  confirm-final-action demo-tenant --i-understand-final
export KANSO_ALLOW_FINAL=1
```

## P3-04 — HA / 2e instance

- Overlay [`infra/docker/compose.ha.yml`](../infra/docker/compose.ha.yml) + nginx
- Sessions Postgres → scale API sans sticky session

```bash
docker compose -f infra/docker/compose.yml -f infra/docker/compose.ha.yml \
  up -d --scale inbound-api=2
```
