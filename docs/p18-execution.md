# Exécution phase 18 — Portail usage / soft-cap

**Date :** 2026-10-12  
**Décisions :** D-121…D-124 (D-119 confirmée)  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P18-01 | `GET /portal/api/usage` | OK |
| P18-02 | Carte Usage + barre + badge breach | OK |
| Soft | `pnpm smoke:portal` vérifie usage | OK |

Hors scope : invite ops, demande hausse, Grafana, coupe widget.

## API

```json
{
  "ok": true,
  "timezone": "Europe/Paris",
  "day_total_eur": 0,
  "soft_cap_eur": 5,
  "soft_cap_breached": false,
  "usage_pct": 0,
  "call_count": 0,
  "hint": "…"
}
```

## Suite

Phase 19 = D2A M7 light (D-124).
