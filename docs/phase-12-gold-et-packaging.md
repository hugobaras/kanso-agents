# Phase 12 — Gold Inbound + packaging démo / partenaire

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** exécuté (2026-10-12) — voir [p12-execution.md](./p12-execution.md)  
**Prérequis :** phases 10–11 + démo ops (`/demo` score, alertes, D2A, 2 tenants)  
**Alignement :** jalon **M3** (gold inbound) + amorçage **M4** (design partner)

## Décisions retenues

| Sujet          | Choix                                   | Source |
| -------------- | --------------------------------------- | ------ |
| Priorité       | Eval gold **et** packaging en parallèle | Q1 = 3 |
| Eval live      | 3–5 cas Mistral maintenant (hors CI)    | Q2 = 1 |
| Design partner | Template + smoke (pas chasse DPA code)  | Q3 = 2 |
| SMTP           | Console démo OK jusqu’au pilote         | Q4 = 3 |

## Constat

M2 technique + cockpit démo sont en place. Il manque pour convaincre / piloter :

- une **preuve qualité** rejouable (eval gold, pas seulement smoke manuel)
- un **reset démo en 1 commande** (tenants + secrets + configs)
- un **parcours partenaire** prêt (template tenant + smoke scripté)
- D2A démo **fiable** (déjà mock staging — à documenter / figer)

## Objectif

Passer de « ça tourne sur mon ordi » à « on peut montrer et mesurer » : gold set + packaging ops/commercial.

## Périmètre proposé

| ID     | Item                                                                           | Done quand                              |
| ------ | ------------------------------------------------------------------------------ | --------------------------------------- |
| P12-01 | Script `scripts/demo-reset.sh` (down/up optionnel + bootstrap 2 tenants + D2A) | 1 commande → `/demo` OK                 |
| P12-02 | Runner eval inbound mock CI-safe + rapport `eval/inbound/reports/`             | `pnpm eval:inbound` vert                |
| P12-03 | Sous-ensemble live 3–5 cas (hors CI, si quota Mistral)                         | rapport `*-live.json` ou skip documenté |
| P12-04 | Smoke design-partner scripté (`scripts/smoke-design-partner.mts` enrichi)      | exit 0 sur staging                      |
| P12-05 | Template config partenaire + checklist short dans brief                        | doc + fichier config                    |
| P12-06 | Page `/demo` : légende « ce que ça prouve » (3 bullets valeur)                 | copy UX                                 |

## Hors périmètre

- OVH / SMTP réel (sauf si Q SMTP = credentials)
- RAG, mode final comptable
- Go/no-go seuils phase 8 complets (M5)

## Questions

**Q1 — Priorité**

1. Qualité (eval gold + live) d’abord
2. Packaging démo / partenaire d’abord
3. Les deux en parallèle (recommandé)

**Q2 — Eval live**

1. Tenter 3–5 cas Mistral maintenant
2. Mock only cette phase
3. Live plus tard (M5)

**Q3 — Design partner**

1. Rester sur tenants `demo-*` uniquement
2. Ajouter template `partner-template` + smoke
3. Chercher signature DPA en parallèle (humain) + template code

**Q4 — SMTP**

1. Toujours reporter
2. Je fournis credentials
3. Inbox démo console suffit jusqu’au pilote

Exécution : [p12-execution.md](./p12-execution.md).
