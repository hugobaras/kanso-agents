# Phase 11 — Inbound riche (M2)

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** exécuté (2026-10-12) — voir [p11-execution.md](./p11-execution.md)  
**Prérequis :** phase 10 (staging live, tenant démo, Mistral auth, fallback heuristique)  
**Alignement :** jalon **M2** phase 9 — Inbound MVP technique _utilisable_, pas questionnaire bête

## Décisions retenues

| Sujet       | Choix                                                           | Source |
| ----------- | --------------------------------------------------------------- | ------ |
| Priorité    | LLM-first + contexte + retries **et** chips widget en parallèle | Q1 = 3 |
| Handoff     | Synthèse LLM contrainte + template code si LLM down             | Q2 = 3 |
| Heuristique | Filet uniquement après retries Mistral                          | Q3 = 2 |
| SMTP        | Reporter (console OK)                                           | Q4 = 2 |
| Modèle      | Agent choisit après smoke quota                                 | Q5 = 3 |

## Constat (fin phase 10)

Le funnel marche (états, score, handoff), mais l’expérience est **trop simple** :

- Mistral souvent en **429** → repli heuristique (merci / question suivante)
- Pas d’**historique** passé au LLM (un tour = un appel isolé)
- Widget = zone de texte seule (pas de **choix** pour `single_choice`)
- Messages assistant peu naturels ; pas de **synthèse** handoff
- Alertes SMTP encore en fallback console

## Objectif

Rendre Inbound **conversationnel et LLM-first** sur staging, avec filet heuristique uniquement en dernier recours. Widget guidé. Alerte e-mail réelle si credentials fournis.

## Périmètre proposé

| ID     | Item                                                                                 | Pourquoi                                      |
| ------ | ------------------------------------------------------------------------------------ | --------------------------------------------- |
| P11-01 | Contexte multi-tours dans le prompt (messages session + question courante + options) | LLM comprend « d’ici jeudi » sans heuristique |
| P11-02 | Retry Mistral (backoff 429) + circuit court → heuristique                            | Moins de « reformuler » / moins de mode bête  |
| P11-03 | Prompt handoff : synthèse courte contrainte (garde-fous phase 3)                     | Clôture pro, pas template unique              |
| P11-04 | Widget : chips / boutons pour `single_choice` (+ free text toujours possible)        | UX cabinet, moins d’erreurs                   |
| P11-05 | API : exposer `expected_question` + `options` dans la réponse turn/session           | Alimente les chips                            |
| P11-06 | Smoke eval live 3–5 cas (hors CI) quand quota OK                                     | Preuve M2 qualité                             |
| P11-07 | SMTP live `put-secret` + smoke alerte (si credentials)                               | M2 « alerte e-mail »                          |

## Hors périmètre

- OVH VPS (toujours reporté)
- RAG (P3-01)
- CRM / Calendar réels
- Redesign marque widget luxe
- Changement de modèle produit (Inbound first inchangé)

## Critères de done

- [ ] Tour LLM reçoit historique + options ; heuristique = fallback après retry
- [ ] Widget affiche chips pour questions à choix
- [ ] Handoff = message synthétique validé (pas seulement la phrase fixe actuelle _ou_ enrichi)
- [ ] `docs/p11-execution.md` + smokes documentés
- [ ] SMTP réel **ou** bloquant noté (comme phase 10)

## Exécution

Fait : P11-01…P11-06. P11-07 SMTP reporté.
