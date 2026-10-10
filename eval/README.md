# Eval

## Inbound (30 cas mock)

```bash
pnpm eval:inbound
```

- Cas : `eval/inbound/cases/inb-*.json`
- Rapport : `eval/inbound/reports/<date>-mock.json`
- LLM : `MockLlmClient` (0 €, CI-friendly)

Régénérer les cas (écrase les JSON) :

```bash
pnpm exec tsx scripts/generate-inbound-eval-cases.mts
```

## Document-to-Action

```bash
pnpm eval:documents   # échantillon protocole (3 cas)
pnpm eval:corpus      # 100 labels synthétiques lot A
```

- Cas protocole : `eval/documents/cases/`
- Corpus : `eval/documents/corpus/labels/` (100)

