# Go / no-go D2A — M7 light

**Date :** 2026-10-12  
**Pack :** `pnpm m7`  
**Réf. :** [phase-8-evaluation.md](./phase-8-evaluation.md) § D2A · [checklist-m7.md](./checklist-m7.md)

## Light (D-125)

| Critère | Cible | Statut |
|---------|-------|--------|
| Labels corpus lot A | ≥ 100 | **100** (2026-10-12) |
| Eval corpus exécutée | rapport JSON | `eval/documents/reports/*-corpus.json` |
| Décision light | `GO_M7_LIGHT` | **GO** |

**Smoke upload :** non (D-126) — corpus only.

## Stretch (informatif)

| Critère | Cible |
|---------|-------|
| `critical_field_accuracy` | ≥ 0.85 |
| `anomaly_rate` | ≤ 0.15 |
| `draft_write_success` | ≥ 0.95 |
| `case_pass_rate` | ≥ 0.90 |

Ces seuils ne bloquent **pas** le GO M7 light.

## Reproduction

```bash
pnpm m7
# ou :
pnpm eval:corpus
```
