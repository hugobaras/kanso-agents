# Checklist M6 — Pilote prod

**Produit :** Kanso · jalon M6 (phase 9 / 16)  
**Critère :** checklist §5 + widget sur site partenaire + alertes ops  
**Prérequis :** [checklist-m5.md](./checklist-m5.md) = GO technique

## Technique repo

- [ ] Tenant `pilote-<slug>` créé (`pnpm pilote:freeze`)
- [ ] Config inbound published (version figée dans `tmp/pilote-freeze-*.json`)
- [ ] Preview embed OK (`/embed-preview?tenant=…`)
- [ ] Snippet testé (chargement widget + 1 conversation)
- [ ] `KANSO_CORS_ORIGINS` renseigné pour le domaine partenaire (prod)
- [ ] `/health` : `db.ok` + worker heartbeat non stale (si worker up)
- [ ] Alertes console visibles (`/demo/ops` ou logs) — SMTP optionnel (D-115)

## Humain / ops

- [ ] DPA signé + `set-dpa --signed`
- [ ] Widget collé sur site (ou stub HTTPS)
- [ ] Destinataire alerte confirmé (portail ou secret)
- [ ] Rota incident nommée
- [ ] Signatures [checklist-pilote.md](./checklist-pilote.md)

## Décision

| Date | Tenant | Embed | Alertes | M6 | Notes |
|------|--------|-------|---------|----|-------|
| | | | | GO / NO-GO | |
