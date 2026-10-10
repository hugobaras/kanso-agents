# Phase 7 — Squelette de code

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-10  
**Statut :** validé (2026-10-10)  
**Prérequis :** phases 0–6 validées

## Objectif

Livrer un mono-dépôt qui installe, compile, typecheck et passe les tests, avec interfaces, schémas Zod, migrations SQL et e2e mockés pour les deux produits.

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| HTTP API | Hono | Q1 = 1 |
| Tests | Vitest | Q2 = 1 |
| E2E | Inbound + Document-to-Action mockés | Q3 = 1 |
| LLM tests | Mock CI ; live opt-in `KANSO_E2E_LIVE=1` (stub phase 7) | Q4 = 3 |
| SQL | `supabase/migrations/` sans apply cloud | Q5 = 1 |

## Contenu livré

- Apps : `inbound-api`, `inbound-widget`, `document-worker`, `admin-cli`
- Packages : `shared`, `config`, `tenancy`, `llm`, `adapters`, `inbound-engine`, `document-pipeline`
- Exemples : `config/examples/*.json`
- Migration : `supabase/migrations/20261010000000_init.sql`
- CI : `.github/workflows/ci.yml` (lint, typecheck, test)
- Tooling : pnpm workspaces + Turborepo

## Scénarios e2e

1. **Inbound** (`packages/inbound-engine`) : 3 réponses mock → `score_final=75` → alerte `hot_lead`
2. **Document-to-Action** (`packages/document-pipeline`) : extract mock → validate → `createDraft` Pennylane mock

## Hors périmètre phase 7

- Vrais providers LLM / CRM / Pennylane
- Apply migrations Supabase cloud
- Widget UI complet
- Grafana / OVH deploy

## Ce qui reste incertain

- Wiring live LLM réel derrière `KANSO_E2E_LIVE`
- RLS SQL fine (migration minimale seulement)
- Build widget navigateur (entry TS seule)

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Squelette pris pour produit fini | Attentes clients | Docs « skeleton » explicites |
| Tests mock trop heureux | Régression prod | Phase 8 jeux de tests réels |

## Question de validation

Le dépôt compile-t-il et les tests passent-ils chez vous (`pnpm install && pnpm test`) ? Répondez **validé** pour ouvrir la phase 8, ou indiquez les amendements.
