# Phase 18 — Portail usage / soft-cap (+ suite P1)

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — voir [p18-execution.md](./p18-execution.md)  
**Prérequis :** phase 17 (hors-horaires bloquant) ; D-119 soft-cap UI différée  
**Alignement :** P1 restant + portail client post-M6

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| Priorité | Usage/soft-cap lecture seule | Q1 = 1 |
| Périmètre | Jour calendaire (Europe/Paris) + cap env | Q2 = 1 |
| Breach UX | Badge + texte d’aide | Q3 = 1 |
| Suite | P19 D2A M7 light après P18 | Q4 = 2 |

## Constat

Portail connecteurs livré (P14). Soft-cap / `usage_ledger` existent côté API mais **invisibles** au client.  
Invite ops self-serve et Grafana restent optionnels. D2A M7 stretch hors Inbound critique.

## Objectif

Donner au cabinet une lecture claire de sa conso LLM du jour vs soft cap, depuis `/portal`.

## Périmètre proposé

| ID | Item |
|----|------|
| P18-01 | `GET /portal/api/usage` — € jour, cap, breach, nb appels |
| P18-02 | UI portail : carte Usage (lecture seule) |
| P18-03 | (Opt) Invite ops self-serve (owner → email) |
| P18-04 | (Opt) Bouton « demander hausse de cap » → `custom_integration_requests` |
| P18-05 | Smoke + doc |

## Hors périmètre

- Modification du soft cap par le client (ops Kanso only)  
- Grafana Free (sauf Q)  
- D2A seuils M7  
- SMTP live  

## Questions

**Q1 — Priorité**  
1. Usage/soft-cap lecture seule — recommandé (honore D-119)  
2. + invite ops self-serve  
3. + demande hausse de cap  
4. Mix 1+2+3  
5. Grafana seulement  

**Q2 — Périmètre usage**  
1. Jour calendaire (Europe/Paris) + cap global env — recommandé  
2. Aussi 7 derniers jours sparkline  
3. Par produit (inbound vs d2a)  

**Q3 — Breach UX**  
1. Badge « soft cap atteint » + texte d’aide — recommandé  
2. Aussi e-mail ops Kanso auto  
3. Couper le widget (trop agressif MVP)  

**Q4 — Suite produit**  
1. Stop après P18 (pause phases)  
2. Enchaîner P19 D2A M7 light  
3. Enchaîner P19 staging/OVH doc drill  

Exécuté — [p18-execution.md](./p18-execution.md). Suite prévue : phase 19 D2A M7 light (D-124).
