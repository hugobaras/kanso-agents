# Checklist passage pilote Inbound (§5 phase 9)

**À signer par les associés** avant données client réelles.

## Produit / technique

- [x] Tenant `active` / draft avec config Inbound `published` (CLI)  
- [x] Disclaimer IA visible  
- [x] Garde-fous A/B/C actifs  
- [x] Alerte e-mail (SMTP ou console démo)  
- [x] Eval Inbound mock : policy 100 %, hallucinations 0, terminal ≥ 90 % ([go-nogo](./inbound-go-nogo.md))  
- [x] Corpus D2A ≥100 synthétique + `pnpm eval:corpus` (GO mock)  

- [x] `/health` + worker heartbeat skeleton  
- [x] `usage_ledger` + soft cap  
- [ ] Run **live** LLM (Mistral) validé  
- [ ] VPS OVH provisionné (hors local Docker)

## Sécurité / RGPD

- [ ] DPA design partner **signé** (pas seulement brouillon)  
- [ ] DPA sous-traitants critiques cochés  
- [x] Isolation `tenant_id` + RLS en place  
- [x] Purge retention disponible (`purge-retention`)  
- [x] Textes = moyens (brouillons `docs/legal/`)

## Ops

- [ ] Rota incident nommée dans [runbooks/incident.md](./runbooks/incident.md)  
- [x] Runbook S1/S2 rédigé  
- [ ] Smoke conversation réelle + réception alerte SMTP

## Signatures associés

| Nom | Date | Go pilote (oui/non) |
|-----|------|---------------------|
| | | |
| | | |
