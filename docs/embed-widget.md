# Kit embed widget — partenaire

## Preview

```text
http://127.0.0.1:3000/embed-preview?tenant=pilote-durand&color=%231B2A4A
```

## Snippet

```html
<script
  src="https://API/widget/kanso-widget.js"
  data-tenant="pilote-durand"
  data-api="https://API"
  data-primary-color="#1B2A4A"
></script>
```

## CORS

Définir les origines autorisées du **site partenaire** :

```bash
KANSO_CORS_ORIGINS=https://www.cabinet-durand.fr,https://cabinet-durand.fr
```

Sans variable : l’API reflète l’`Origin` (pratique en local).  
En prod pilote : **toujours** fixer la liste.

## Freeze tenant pilote

```bash
PILOTE_SLUG=durand PILOTE_NAME='Cabinet Durand' \
  PILOTE_ORIGINS='https://www.cabinet-durand.fr' \
  pnpm pilote:freeze
# optionnel: bash scripts/freeze-pilote.sh --activate
```

Génère `tmp/pilote-freeze-pilote-durand.json` + pack onboard.
