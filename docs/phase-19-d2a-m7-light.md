# Phase 19 — D2A M7 light (sandbox non bloquant)

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — **GO_M7_LIGHT** — voir [p19-execution.md](./p19-execution.md)  
**Prérequis :** phase 18 ; D-124 = enchaîner D2A M7 light  
**Alignement :** jalon **M7** — ≥100 docs labellisés et/ou pipeline draft mock ; seuils 85/15 = stretch

## Décisions retenues

| Sujet        | Choix                                                   | Source             |
| ------------ | ------------------------------------------------------- | ------------------ |
| Niveau M7    | Pack script + checklist (seuils stretch, non bloquants) | Q1 = 1             |
| Smoke upload | Non — eval corpus only                                  | Q2 = 3             |
| Extract      | Mock / heuristique (défaut recommandé)                  | Q3 non répondu → 1 |
| Après M7     | Pause phases (focus humain DPA/OVH)                     | Q4 = 1             |

## Constat

Corpus synthétique ≥100 + `pnpm eval:corpus` et pipeline mock existent (P1).  
M7 n’est **pas** bloquant pour le pilote Inbound. Objectif : dossier M7 actionnable (script + checklist + rapport), sans forcer les seuils gold.

## Objectif

Un pack `pnpm m7` : health worker + smoke upload D2A + eval corpus, résumé JSON, checklist M7 machine-readable.

## Périmètre proposé

| ID     | Item                                                                          |
| ------ | ----------------------------------------------------------------------------- |
| P19-01 | `scripts/m7-d2a-go.sh` + `pnpm m7` (health, smoke upload stub, `eval:corpus`) |
| P19-02 | `docs/checklist-m7.md` + rafraîchir go/no-go D2A (seuils stretch explicites)  |
| P19-03 | Doc « anomalies attendues » + lien demo D2A Martin                            |
| P19-04 | (Opt) Améliorer extract mock si metrics trop loin des seuils                  |
| P19-05 | (Opt) Live OCR / extract réel — hors light sauf Q                             |

## Hors périmètre

- Pennylane `final`
- Seuils 85/15 **obligatoires** pour GO M7 light
- Données client réelles sans DPA

## Questions

**Q1 — Niveau M7 light**

1. Pack script + checklist + rapport (pas d’exigence seuils) — recommandé
2. Pack + tenter améliorer mock pour se rapprocher 85/15
3. Exiger seuils 85/15 pour cocher M7

**Q2 — Smoke upload**

1. Stub `demo-facture` sur `demo-martin` (DPA/demo OK) — recommandé
2. Aussi `pilote-*` si DPA signed
3. Pas de smoke upload (eval corpus only)

**Q3 — Extract**

1. Rester mock / heuristique — recommandé
2. Brancher un extract LLM optionnel si `MISTRAL_API_KEY`
3. OCR PDF réel maintenant

**Q4 — Après M7**

1. Pause phases (focus humain DPA/OVH) — recommandé
2. P20 Grafana / observabilité
3. P20 invite portail self-serve

Exécuté — [p19-execution.md](./p19-execution.md). **Pause produit** (D-128) : DPA / OVH / rota / SMTP.
