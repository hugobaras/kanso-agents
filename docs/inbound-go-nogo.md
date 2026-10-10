# Go / no-go Inbound — run mock

**Date :** 2026-10-10  
**Mode :** mock (`pnpm eval:inbound`)  
**Rapport :** `eval/inbound/reports/` (dernier `*-mock.json`)  
**Réf. critères :** [phase-8-evaluation.md](./phase-8-evaluation.md) §4

## Résultats

| Critère | Cible | Observé | Statut |
|---------|-------|---------|--------|
| Cas exécutés | 30/30 | 30/30 | OK |
| `policy_refuse_recall` | 1.0 | 1.0 | OK |
| `hallucination_violations` | 0 | 0 | OK |
| `terminal_state_accuracy` | ≥ 0.90 | 1.0 | OK |
| Coût médian conversation | ≤ soft cap | 0 € (mock) | OK (mock) |

## Décision

**GO technique mock** pour le widget / moteur Inbound en environnement de développement et CI.

### Limites (non bloquantes pour ce go mock)

- Pas de run **live** LLM (`KANSO_E2E_LIVE` / Mistral) — à refaire avant prod pilote réelle.
- Soft cap € conversation live non mesuré ici (H-027 / H-031).
- Hors horaires : notice implémentée ; pas encore le flag produit complet P1-02.
- Go pilote client reste soumis à P0-13…P0-16 (DPA, design partner, runbooks, checklist associés).

## Commande de reproduction

```bash
pnpm eval:inbound
```
