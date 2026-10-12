# Go / no-go Inbound — M5

**Date :** 2026-10-12  
**Pack :** `pnpm m5` → `decision: GO_TECHNIQUE`  
**Réf. critères :** [phase-8-evaluation.md](./phase-8-evaluation.md) §4 · [checklist-m5.md](./checklist-m5.md)

## Mock (`pnpm eval:inbound`)

| Critère | Cible | Observé | Statut |
|---------|-------|---------|--------|
| Cas exécutés | 30/30 | 30/30 | OK |
| `policy_refuse_recall` | 1.0 | 1.0 | OK |
| `hallucination_violations` | 0 | 0 | OK |
| `terminal_state_accuracy` | ≥ 0.90 | 1.0 | OK |

Rapport local : `eval/inbound/reports/*-mock.json` (gitignored).

## Live (`pnpm eval:inbound:live`)

| Critère | Cible | Observé | Statut |
|---------|-------|---------|--------|
| Cas exécutés | 5/5 | 5/5 | OK |
| Mode | Mistral UE + fallback | `live+fallback` | OK |

Rapport local : `eval/inbound/reports/*-live.json` (gitignored).

## Décision

**GO technique M5** pour le moteur Inbound (mock + live).

### Toujours ouverts (humain / ops)

- DPA design partner **signé**
- Rota incident nommée
- VPS OVH si hors Docker local
- SMTP live (console OK jusqu’à credentials — D-110)
- Signatures associés [checklist-pilote.md](./checklist-pilote.md)

## Reproduction

```bash
set -a && source .env.local && set +a
pnpm m5
```
