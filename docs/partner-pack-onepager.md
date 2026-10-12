# Pack remise — design partner Kanso Inbound

**Produit :** widget marque blanche · qualification · score · alerte (console ou SMTP)  
**Éditeur :** Kanso Solutions (shbt studio SAS)

## Ce que vous recevez

1. **Tenant** isolé (`tenant_id`) + config publiée  
2. **Snippet** à coller sur votre site (ou page stub)  
3. **Alerte** vers votre boîte (SMTP) ou logs console en pré-prod  
4. **DPA** modèle à signer avant données / documents clients réels  

## Démarrage technique (&lt; 1 h)

```bash
export DATABASE_URL=… KANSO_MASTER_KEY=…   # jamais en git
PARTNER_TENANT=cabinet-exemple \
PARTNER_NAME='Cabinet Exemple' \
PARTNER_COLOR='#1B2A4A' \
PARTNER_ALERT_TO=contact@cabinet-exemple.fr \
bash scripts/onboard-partner.sh
# Pack généré dans tmp/partner-pack-<tenant>/
```

Snippet type :

```html
<script
  src="https://API/widget/kanso-widget.js"
  data-tenant="cabinet-exemple"
  data-api="https://API"
  data-primary-color="#1B2A4A"
></script>
```

## Garde DPA (technique)

Sans `dpa_signed`, les uploads de documents **non-stub** sont refusés (403 `dpa_required`).  
Après signature humaine :

```bash
kanso-admin set-dpa <tenant_id> --signed
```

Tenants `demo-*` et fichiers stub restent autorisés pour la démo.

## Liens

| Doc | Rôle |
|-----|------|
| [dpa-design-partner.md](./legal/dpa-design-partner.md) | Modèle DPA |
| [design-partner-brief.md](./design-partner-brief.md) | Infos à collecter |
| [checklist-m4.md](./checklist-m4.md) | Go M4 |
| [runbooks/incident.md](./runbooks/incident.md) | Incident / rota |
