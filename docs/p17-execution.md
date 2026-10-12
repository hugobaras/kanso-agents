# Exécution phase 17 — Hors-horaires bloquant

**Date :** 2026-10-12  
**Décisions :** D-117…D-120  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P17-01 | Hors plage → `ClosedDegraded` + notice (pas de qualification) | OK |
| API | `POST …/messages` → 403 `after_hours` hors plage | OK |
| Widget | Bandeau + input désactivé | OK |
| Config | `operations.after_hours_message` optionnel | OK |
| Eval | inb-027/028 adaptés (notice + ClosedDegraded) | OK |

## Comportement (D-118)

1. Hors `business_hours` : démarrage session avec message bloquant, état `ClosedDegraded`.  
2. Tout nouveau message API hors plage : **403** `{ error: "after_hours" }`.  
3. Widget : bandeau sombre + champ grisé.

## Commandes

```bash
pnpm --filter @kanso/inbound-engine test
pnpm --filter @kanso/config build
pnpm eval:inbound
```
