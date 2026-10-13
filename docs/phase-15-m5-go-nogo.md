# Phase 15 — M5 go/no-go Inbound (préparation pilote)

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — **GO technique** — voir [p15-execution.md](./p15-execution.md)  
**Prérequis :** phases 10–14 (staging, gold, M4 pack, portail connecteurs)  
**Alignement :** jalon **M5** — seuils eval verts + checklist pilote actionnable

## Décisions retenues

| Sujet    | Choix                                               | Source |
| -------- | --------------------------------------------------- | ------ |
| Priorité | Pack M5 automatisé (script + checklists)            | Q1 = 1 |
| SMTP     | Console jusqu’à credentials                         | Q2 = 1 |
| Live LLM | Rejouer `eval:inbound:live` + figer rapport go-nogo | Q3 = 1 |
| Portail  | Pas de feature portail en P15                       | Q4 = 3 |

## Constat

Côté repo : mock 30/30, live 5/5 déjà vus en P12, portail connecteurs OK.  
Ouverts sur [checklist-pilote.md](./checklist-pilote.md) : LLM live « validé » formalisé, OVH, DPA signé, rota nommée, SMTP smoke.  
Plusieurs items sont **humains** ; la phase 15 doit maximiser ce qui est automatisable et clarifier le reste.

## Objectif

Un **dossier M5** : commandes one-shot, rapport go/no-go à jour (mock + live), checklist machine-readable, et (selon Q) SMTP smoke ou soft-cap tenant via portail.

## Périmètre proposé

| ID     | Item                                                                                                  |
| ------ | ----------------------------------------------------------------------------------------------------- |
| P15-01 | Script `scripts/m5-go-nogo.sh` : health + eval mock + eval live (si clé) + smoke portal + résumé JSON |
| P15-02 | Rafraîchir `docs/inbound-go-nogo.md` + `docs/checklist-m5.md` (cases tech vs humain)                  |
| P15-03 | Soft cap / usage visibles dans `/portal` (lecture seule)                                              |
| P15-04 | Lien portail dans pack onboard + brief partenaire                                                     |
| P15-05 | (Opt) Smoke SMTP end-to-end si credentials fournis                                                    |
| P15-06 | (Opt) Doc « jour J pilote » runbook 1 page                                                            |

## Hors périmètre

- Signature DPA réelle / OVH VPS (humain)
- Noms rota (humain)
- Seuils D2A 85/15, CRM/agenda obligatoires

## Questions

**Q1 — Priorité**

1. Pack M5 automatisé (script + checklists) — recommandé
2. Soft cap / usage dans le portail
3. Les deux

**Q2 — SMTP**

1. Rester console jusqu’à credentials
2. Slot smoke si `.env` a déjà SMTP
3. Bloquer M5 sans SMTP live

**Q3 — Live LLM**

1. Ré-exécuter `eval:inbound:live` et figer le rapport dans go-nogo
2. Exiger gold live élargi (≥15 cas)
3. Reporter live (mock suffit pour M5 technique)

**Q4 — Portail suite**

1. Usage/soft-cap lecture seule — recommandé
2. Aussi invite user self-serve (owner invite ops)
3. Pas de feature portail en P15

Exécuté — [p15-execution.md](./p15-execution.md). Hors scope : soft-cap portail, SMTP live, invite self-serve.
