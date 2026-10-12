# Exécution phase 14 — Portail connecteurs

**Date :** 2026-10-12  
**Décisions :** D-104…D-108  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P14-01 | Magic link + `portal_users` / sessions | OK |
| P14-02 | UI `/portal` | OK |
| P14-03 | E-mail self-serve (secret + channels) | OK |
| P14-04 | Slack webhook self-serve | OK |
| P14-05 | Toggle enable/disable canal | OK |
| P14-06 | Sur-mesure → `custom_integration_requests` + log ops | OK |
| P14-07 | Audit `portal_*` | OK |
| P14-08 | `pnpm smoke:portal` + invite CLI | OK |

## Commandes

```bash
DATABASE_URL=… bash scripts/apply-migrations.sh
# ou migration seule :
psql "$DATABASE_URL" -f supabase/migrations/20261012000003_portal.sql

pnpm --filter @kanso/admin-cli exec node dist/index.js \
  invite-portal-user demo-tenant portal-ops@example.com --role owner

open http://127.0.0.1:3000/portal
pnpm smoke:portal
```

## Notes

- Hors `KANSO_ENV=production`, `/portal/api/auth/request` renvoie `token` / `magic_link` (smoke + démo).
- Secrets jamais renvoyés en clair (hints masqués).
- Scoring / branding restent CLI (D-108).
