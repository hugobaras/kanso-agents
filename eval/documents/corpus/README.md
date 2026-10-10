# Corpus D2A

## Lot A — synthétique (repo)

- **100** labels `labels/syn-001.json` … `syn-100.json`
- Manifest : `manifest.jsonl`
- Répartition : 85 draft · 5 low_conf · 5 totals · 3 iban · 2 duplicate  
  → `anomaly_rate` = 15 % (seuil go/no-go)

```bash
pnpm eval:corpus
# régénérer :
pnpm exec tsx scripts/generate-d2a-corpus.mts
```

Fichiers PDF réels : hors git (`files/`, gitignored). Les runs mock utilisent le label comme fixture LLM.

## Lot B — pilote

Sous DPA, anonymisés, hors git si sensible. Ajouter des lignes au manifest + `labels/`.
