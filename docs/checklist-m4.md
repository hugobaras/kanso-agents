# Checklist M4 — Design partner prêt à signer

**Produit :** Kanso Solutions · Inbound  
**Critère M4 :** DPA + brief config + tenant draft (ou active post-signature)

Cocher avant remise pack / signature.

## Legal / commercial

- [ ] DPA modèle relu (`docs/legal/dpa-design-partner.md`)
- [ ] Sous-traitants critiques listés (`docs/legal/dpa-subprocessors.md`)
- [ ] Brief infos cabinet rempli (`docs/design-partner-brief.md`)
- [ ] One-pager remis (`docs/partner-pack-onepager.md`)
- [ ] Pas de données client réelles avant DPA signé

## Technique onboard

- [ ] `scripts/onboard-partner.sh` exécuté (tenant + config + secrets console)
- [ ] Snippet widget généré dans `tmp/partner-pack-<tenant>/`
- [ ] Disclaimer IA visible sur widget / page stub
- [ ] Alerte reçue (console ops ou SMTP si credentials fournis)
- [ ] Soft cap / `usage_ledger` visibles
- [ ] Flag `dpa_signed` = **false** tant que DPA non signé
- [ ] Smoke session OK (`pnpm smoke:partner` ou curl `/v1/<tenant>/sessions`)

## Ops

- [ ] Rota placeholder lue (`docs/runbooks/incident.md`) — noms à remplir
- [ ] Canal incident défini (e-mail / Slack interne)
- [ ] Doc OVH provision lue si go infra (`docs/ovh-provision.md`) — VPS non requis pour M4

## Post-signature (hors M4 strict, avant docs réels)

- [ ] DPA **signé** (humain)
- [ ] `kanso-admin set-dpa <tenant> --signed`
- [ ] Upload doc réel testé (403 avant / 200 après)

## Signatures associés

| Nom | Date | M4 go (oui/non) |
|-----|------|-----------------|
| | | |
| | | |
