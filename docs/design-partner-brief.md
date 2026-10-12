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

Template générique : [`config/examples/inbound.partner-template.json`](../config/examples/inbound.partner-template.json)  
(remplacer `PARTNER_DISPLAY_NAME`, options, scoring, couleur).

```bash
# Reset démo 2 tenants (Durand + Martin)
pnpm demo:reset

# Onboard design partner (P13) — génère pack + snippet
export DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5434/kanso
export KANSO_MASTER_KEY='…'   # ≥ 32 caractères
PARTNER_TENANT=cabinet-exemple \
PARTNER_NAME='Cabinet Exemple' \
PARTNER_COLOR='#1B2A4A' \
PARTNER_ALERT_TO=contact@cabinet-exemple.fr \
pnpm onboard:partner

# Ou smoke template générique
DESIGN_PARTNER_TENANT=partner-template \
DESIGN_PARTNER_NAME='Cabinet Exemple' \
pnpm smoke:partner

# Après DPA signé
pnpm --filter @kanso/admin-cli exec node dist/index.js set-dpa cabinet-exemple --signed

# Portail connecteurs (e-mail / Slack / sur-mesure)
pnpm --filter @kanso/admin-cli exec node dist/index.js \
  invite-portal-user cabinet-exemple contact@cabinet-exemple.fr --role owner
open http://127.0.0.1:3000/portal

# Tenant pilote figé + preview embed (M6)
PILOTE_SLUG=exemple PILOTE_NAME='Cabinet Exemple' pnpm pilote:freeze
open 'http://127.0.0.1:3000/embed-preview?tenant=pilote-exemple'
```

## 3. Smoke

```bash
# Widget cockpit valeur
open http://127.0.0.1:3000/demo

# Snippet site partenaire
# <script src="https://API/widget/kanso-widget.js"
#   data-tenant="partner-template" data-api="https://API" data-primary-color="#1B2A4A"></script>
```

## 4. Checklist remise

- [ ] Disclaimer IA visible  
- [ ] Alerte e-mail reçue (ou log console / panneau ops en démo)  
- [ ] Pas de conseil juridique/comptable dans les réponses  
- [ ] Score + `hot_lead` / handoff visibles côté ops  
- [ ] Soft cap / usage visibles (`usage_ledger`)  
- [ ] Config publiée depuis template (pas de secrets en git)  
