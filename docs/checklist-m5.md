# Checklist M5 — Go/no-go Inbound

**Produit :** Kanso · jalon M5 (phase 9 / 15)  
**Critère :** seuils eval verts + dossier technique prêt ; données client réelles = checklist pilote humaine.

## Technique (automatisable)

- [x] `pnpm m5` → `decision: GO_TECHNIQUE` (2026-10-12)
- [x] Eval mock 30/30 (`pnpm eval:inbound`)
- [x] Eval live 5/5 (`pnpm eval:inbound:live` + `MISTRAL_API_KEY`)
- [x] `/health` OK sur runtime ciblé
- [x] Rapport résumé dans `tmp/m5-summary-*.json`
- [x] [inbound-go-nogo.md](./inbound-go-nogo.md) à jour (mock + live)

## Soft (non bloquant M5 technique)

- [x] `pnpm smoke:portal` (si DB + API) — 2026-10-12
- [ ] Démo `/demo` manuelle OK
- [x] Alertes console visibles (SMTP reporté jusqu’à credentials — D-110)

## Humain (bloquant données client / prod)

- [ ] DPA design partner **signé**
- [ ] Sous-traitants critiques cochés (`docs/legal/dpa-subprocessors.md`)
- [ ] Rota incident nommée (`docs/runbooks/incident.md`)
- [ ] VPS OVH si hors Docker local (`docs/ovh-provision.md`)
- [ ] Signatures associés sur [checklist-pilote.md](./checklist-pilote.md)

## Décision

| Date | Mock | Live | M5 technique | Notes |
|------|------|------|--------------|-------|
| 2026-10-12 | 30/30 | 5/5 | **GO** | SMTP/OVH/DPA humains ouverts |

## Commande

```bash
set -a && source .env.local && set +a
pnpm m5
```
