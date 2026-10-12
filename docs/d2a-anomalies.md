# D2A — anomalies attendues (mock)

Le corpus lot A encode volontairement ~15 % d’anomalies pour tester le pipeline.

| Outcome label | Raison typique | Action ops |
|---------------|----------------|------------|
| `draft` | Champs OK | Draft comptable mock |
| `anomaly_low_confidence` | Confiance champ critique basse | Revoir / relancer extract |
| `anomaly_validation` | Totals incohérents | Corriger document source |
| `anomaly_iban` | IBAN hors liste connue | Whitelist ou discard |
| `anomaly_duplicate` | Clé déjà vue | Ignorer doublon |

## Démo

Sur `/demo`, tenant **Martin** : upload stub / pipeline D2A (si stack up + config `document_to_action` publiée).  
Pas requis pour `pnpm m7` (D-126).

## Lot B

Docs pilote anonymisés sous DPA uniquement — hors git si sensibles.
