# Checklist M7 — D2A sandbox (light)

**Produit :** Kanso · jalon M7 (phase 9 / 19)  
**Nature :** non bloquant pour pilote Inbound  
**Prérequis :** pipeline mock + corpus lot A

## Critères M7 light (bloquants pack)

- [x] ≥100 labels `eval/documents/corpus/labels/syn-*.json` (2026-10-12)
- [x] `pnpm m7` → `decision: GO_M7_LIGHT`
- [x] Rapport `tmp/m7-summary-*.json`
- [x] [d2a-go-nogo.md](./d2a-go-nogo.md) à jour

## Stretch (informatif — D-125)

- [x] `critical_field_accuracy` ≥ 0.85 (mock = 1.0)
- [x] `anomaly_rate` ≤ 0.15 (mock = 0.15)
- [x] `draft_write_success` ≥ 0.95
- [x] `go_nogo` corpus = GO (seuils phase 8)

## Ops / démo

- [ ] Worker heartbeat visible via `/health` (si stack up)
- [ ] Démo D2A Martin sur `/demo` (optionnel)
- [ ] Anomalies attendues comprises ([d2a-anomalies.md](./d2a-anomalies.md))

## Humain (hors light)

- [ ] DPA avant lot B / docs clients
- [ ] Pennylane sandbox credentials si draft réel

## Décision

| Date | Labels | M7 light | Stretch | Notes |
|------|--------|----------|---------|-------|
| 2026-10-12 | 100 | **GO** | **GO** (mock) | Pause produit D-128 |

## Commande

```bash
pnpm m7
```
