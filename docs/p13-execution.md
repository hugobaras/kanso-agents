# Exécution phase 13 — Design partner M4

**Date :** 2026-10-12  
**Décisions :** D-100…D-103  
**Statut :** livré

## Livrables

| ID | Item | Statut |
|----|------|--------|
| P13-01 | `scripts/onboard-partner.sh` + `pnpm onboard:partner` | OK |
| P13-02 | Pack remise one-pager + snippet généré | OK |
| P13-03 | Migration `dpa_signed` + gate uploads + `set-dpa` | OK |
| P13-04 | `docs/checklist-m4.md` | OK |
| P13-05 | Runbook rota placeholder + incident | OK (existant enrichi) |
| P13-06 | `docs/ovh-provision.md` (doc only) | OK |

## Garde DPA

- Colonne `tenants.dpa_signed` / `dpa_signed_at`
- CLI : `kanso-admin set-dpa <tenant> --signed|--unsigned`
- `POST …/documents` → 403 `dpa_required` si non signé (sauf `demo-*` / stubs)

## Commandes

```bash
# Migration
DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5434/kanso bash scripts/apply-migrations.sh

# Onboard draft (sans DPA)
export DATABASE_URL=… KANSO_MASTER_KEY=…
PARTNER_TENANT=partner-draft PARTNER_NAME='Partner Draft' \
  bash scripts/onboard-partner.sh

# Après signature
pnpm --filter @kanso/admin-cli exec node dist/index.js set-dpa partner-draft --signed
```

## Hors scope (humain)

- Signature DPA réelle
- VPS OVH provisionné
- SMTP credentials production
