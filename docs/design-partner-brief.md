# Brief onboarding — design partner Inbound

**Produit :** widget marque blanche + qualification + alerte e-mail  
**Prérequis :** DPA signé ([modèle](./legal/dpa-design-partner.md))

## 1. Infos à collecter

| Champ | Exemple |
|-------|---------|
| `tenant_id` | `cabinet-durand` |
| Nom affiché | Cabinet Durand |
| Couleur primaire | `#1B2A4A` |
| Domaine(s) site | `https://www.cabinet-durand.fr` |
| Destinataire alertes | `contact@cabinet-durand.fr` |
| SMTP (ou console en démo) | host/user/pass/from |
| Questions / scoring | Adapter `config/examples/inbound.avocats.example.json` |

## 2. Commandes (local / staging)

```bash
export DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso
export KANSO_MASTER_KEY='…'   # ≥ 32 caractères

pnpm --filter @kanso/admin-cli exec node dist/index.js create-tenant cabinet-durand "Cabinet Durand"

pnpm --filter @kanso/admin-cli exec node dist/index.js put-secret cabinet-durand alerts.intake_email \
  '{"host":"","port":"","user":"","pass":"","from":"alerts@example.com","to":"ops@example.com"}'

# Éditer puis publier la config
pnpm --filter @kanso/admin-cli exec node dist/index.js publish-config cabinet-durand \
  config/examples/inbound.avocats.example.json
```

## 3. Smoke

```bash
# API up
DATABASE_URL=… KANSO_MASTER_KEY=… pnpm --filter @kanso/inbound-api dev

# Session + 1 tour
./apps/inbound-api/node_modules/.bin/tsx scripts/smoke-turn.mts

# Widget
open http://127.0.0.1:3000/demo
# ou snip:
# <script src="https://API/widget/kanso-widget.js"
#   data-tenant="cabinet-durand" data-api="https://API" data-primary-color="#1B2A4A"></script>
```

## 4. Checklist remise

- [ ] Disclaimer IA visible  
- [ ] Alerte e-mail reçue (ou log console en démo)  
- [ ] Pas de conseil juridique dans les réponses  
- [ ] Soft cap / usage visibles côté Kanso (`usage_ledger`)  
