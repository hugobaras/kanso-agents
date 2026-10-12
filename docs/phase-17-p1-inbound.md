# Phase 17 — P1 Inbound (gaps post-M6 kit)

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — voir [p17-execution.md](./p17-execution.md)  
**Prérequis :** phases 15–16 (GO M5 + kit embed M6)  
**Alignement :** backlog P1 phase 9 — items encore ouverts côté produit Inbound

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| Priorité | Hors-horaires widget seulement (P1-02) | Q1 = 1 |
| Comportement | Bloquer nouveaux messages hors plage | Q2 = 2 |
| Soft-cap UI | Lecture seule — **reporté** (hors Q1=1) | Q3 = 1 (différé) |
| D2A | Hors scope | Q4 = 1 |

## Constat

Slack adapter, corpus D2A, pipeline mock existent en grande partie.  
Toujours reportés : **hors-horaires UX** (P1-02), **usage/soft-cap dans le portail**, invite portail self-serve, Grafana.  
M7 D2A stretch reste optionnel.

## Objectif

Fermer les trous P1 Inbound les plus visibles pour un pilote réel (hors DPA/OVH humains).

## Périmètre proposé

| ID | Item |
|----|------|
| P17-01 | Hors-horaires : bandeau widget + message config quand `after_hours` |
| P17-02 | Portail : usage du jour + soft cap (lecture seule) |
| P17-03 | Portail : owner invite un `ops` (magic link) |
| P17-04 | (Opt) Dashboard JSON Grafana squelette branché sur `/health` metrics |
| P17-05 | Smoke + checklist P1 |

## Hors périmètre

- DPA / OVH / rota (humain)  
- SMTP live (sauf Q)  
- Seuils D2A M7 complets  
- CRM / agenda self-serve  

## Questions

**Q1 — Priorité**  
1. Hors-horaires widget (P1-02) — recommandé  
2. Usage/soft-cap portail  
3. Invite ops self-serve  
4. Mix 1+2  
5. Mix 1+2+3  
6. Grafana seulement  

**Q2 — Hors-horaires comportement**  
1. Notice + bandeau ; conversation continue — recommandé  
2. Bloquer nouveaux messages hors plage (message seul)  
3. File d’attente « on vous rappelle » (plus lourd)  

**Q3 — Soft cap UI**  
1. Lecture seule (€ jour / cap / breach) — recommandé  
2. Aussi bouton « demander hausse » → ticket custom  
3. Pas de soft-cap UI  

**Q4 — D2A dans P17**  
1. Hors scope (garder Inbound) — recommandé  
2. Mini : smoke D2A + lien checklist M7  
3. Pousser eval corpus + seuils  

Exécuté — [p17-execution.md](./p17-execution.md). Hors scope : soft-cap portail, invite ops, Grafana, D2A.
