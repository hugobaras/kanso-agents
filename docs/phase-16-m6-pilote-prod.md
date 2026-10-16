# Phase 16 — M6 pilote prod (préparation)

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — voir [p16-execution.md](./p16-execution.md)  
**Prérequis :** phase 15 — **GO technique M5**  
**Alignement :** jalon **M6** — checklist §5 + widget sur site partenaire + alertes ops

## Décisions retenues

| Sujet         | Choix                                       | Source |
| ------------- | ------------------------------------------- | ------ |
| Priorité      | Kit embed + checklist M6                    | Q1 = 1 |
| Observabilité | Enrichir `/health` (+ worker heartbeat)     | Q2 = 2 |
| SMTP          | Console jusqu’à credentials                 | Q3 = 1 |
| Tenant        | Slot `pilote-<slug>` + script freeze config | Q4 = 2 |

## Constat

M5 technique vert (`pnpm m5`). M6 exige : widget embarqué chez le partenaire, alertes reçues ops, checklist pilote signée.  
Beaucoup reste **humain** (DPA, OVH, rota, signatures). Côté repo on peut livrer le **kit d’embarquement** et fermer les trous produit encore ouverts (hors-horaires, usage visible, Grafana léger).

## Objectif

Rendre possible un pilote « jour J » sans bricolage : snippet + checklist embed, smoke alerte documenté, gaps P1 utiles fermés selon priorités.

## Périmètre proposé

| ID     | Item                                                                            |
| ------ | ------------------------------------------------------------------------------- |
| P16-01 | Kit embed : page `/embed-preview` + snippet validé CORS Origin + doc partenaire |
| P16-02 | Checklist M6 machine-readable (`docs/checklist-m6.md`) liée à §5 pilote         |
| P16-03 | Hors-horaires : flag + message (P1-02) câblé config → widget/API                |
| P16-04 | Soft cap / usage lecture dans `/portal` (reporté de P15)                        |
| P16-05 | (Opt) Grafana Free import ou dashboard `/health` enrichi                        |
| P16-06 | (Opt) Smoke SMTP si credentials ; sinon doc « jour J alerte » console           |

## Hors périmètre

- Signature DPA / noms rota / provision OVH réelle
- CRM / agenda obligatoires
- Seuils D2A stretch M7

## Questions

**Q1 — Priorité**

1. Kit embed + checklist M6 — recommandé
2. Hors-horaires (P1-02)
3. Usage/soft-cap dans le portail
4. Mix 1+2
5. Mix 1+3
6. Les trois (1+2+3)

**Q2 — Observabilité**

1. Reporter Grafana
2. Enrichir `/health` (+ worker heartbeat summary) — recommandé
3. Grafana Free dashboard maintenant

**Q3 — SMTP**

1. Console jusqu’à credentials (comme D-110)
2. Smoke si `.env` a déjà SMTP
3. Exiger SMTP pour cocher M6 repo

**Q4 — Tenant cible M6**

1. Rester `demo-*` / partner-draft jusqu’à vrai DPA
2. Prévoir slot `pilote-<slug>` + script freeze config
3. Forcer un tenant `active` dès maintenant

Exécuté — [p16-execution.md](./p16-execution.md). Hors scope : hors-horaires, soft-cap portail, Grafana, SMTP live.
