# Exécution phase 16 — M6 pilote prod (kit)

**Date :** 2026-10-12  
**Décisions :** D-113…D-116  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P16-01 | `/embed-preview` + [embed-widget.md](./embed-widget.md) + CORS `KANSO_CORS_ORIGINS` | OK |
| P16-02 | [checklist-m6.md](./checklist-m6.md) | OK |
| Health | `/health` → db + worker heartbeat | OK |
| Freeze | `pnpm pilote:freeze` → `pilote-<slug>` | OK |

Hors scope : hors-horaires, soft-cap portail, Grafana, SMTP live.

## Commandes

```bash
# Docker/OrbStack up, puis :
psql "$DATABASE_URL" -f supabase/migrations/20261012000004_service_heartbeats.sql
docker compose -f infra/docker/compose.yml up -d --build

PILOTE_SLUG=demo PILOTE_NAME='Pilote Demo' pnpm pilote:freeze
open 'http://127.0.0.1:3000/embed-preview?tenant=pilote-demo'
curl -sS http://127.0.0.1:3000/health | jq .
```

**Note exécution :** tests unitaires OK ; freeze live non rejoué ici (Docker/OrbStack arrêté au moment du commit).
