# Exécution phase 12 — Gold + packaging

**Date :** 2026-10-12  
**Décisions :** D-096…D-099  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P12-01 | `scripts/demo-reset.sh` + `pnpm demo:reset` | OK |
| P12-02 | `pnpm eval:inbound` (30 cas mock) | OK — 30/30 |
| P12-03 | `pnpm eval:inbound:live` (5 cas) | OK — 5/5 |
| P12-04 | `inbound.partner-template.json` + `pnpm smoke:partner` | OK |
| P12-05 | Brief partenaire + checklist | OK |
| P12-06 | Bullets valeur sur `/demo` | OK |

Rapports : `eval/inbound/reports/*-mock.json`, `*-live.json`.

## Commandes

```bash
pnpm demo:reset
pnpm eval:inbound
set -a && source .env.local && set +a && pnpm eval:inbound:live
pnpm smoke:partner
open http://127.0.0.1:3000/demo
```
