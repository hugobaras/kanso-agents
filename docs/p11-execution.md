# Exécution phase 11 — Inbound riche (M2)

**Date :** 2026-10-12  
**Statut :** livré (SMTP reporté)  
**Décisions :** D-091…D-095

## Livré

| ID | Item | Statut |
|----|------|--------|
| P11-01 | Contexte multi-tours + options dans prompt | OK |
| P11-02 | `RetryLlmClient` (3× backoff) puis heuristique | OK |
| P11-03 | Handoff LLM + `buildHandoffTemplate` fallback | OK |
| P11-04 | Widget chips `single_choice` | OK |
| P11-05 | `expected_question` sur session + messages | OK |
| P11-06 | Modèle **ministral-8b-latest** (smoke quota OK) | OK |
| P11-07 | SMTP live | Reporté (Q4 = 2) |

## Modèle (D-095)

Smoke `POST /chat/completions` : `ministral-8b-latest` → HTTP 200 (préféré à `mistral-small-latest` pour limiter les 429).  
Défaut code + `compose.staging` / `.env.staging.example` : `KANSO_MISTRAL_MODEL=ministral-8b-latest`.

## Fichiers clés

- `packages/llm/src/retry.ts` — retries avant fallback
- `packages/inbound-engine/src/validate-llm.ts` — historique + options
- `packages/inbound-engine/src/handoff.ts` — synthèse / template
- `packages/inbound-engine/src/expected-question.ts`
- `apps/inbound-api/src/app.ts` — `expected_question` + Retry→Fallback
- `apps/inbound-widget` — chips

## Vérif locale

```bash
docker compose -f infra/docker/compose.yml -f infra/docker/compose.staging.yml \
  --env-file .env.staging up -d --build
open http://127.0.0.1:3000/demo
# Chips sous le fil ; free text toujours possible
```

## Reste

- SMTP réel quand credentials fournis
- OVH (phase 10 reporté)
- Eval live 3–5 cas hors CI (quand quota stable)
