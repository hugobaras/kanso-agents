# Provision OVH VPS — Kanso (doc seulement)

**Statut :** doc Phase 13 (D-101) — **ne provisionne pas** automatiquement.  
**Cible budget :** &lt; 50 € / mois (VPS entrée de gamme + IP + snapshots légers).  
**Région :** UE (FR préférée).

## Prérequis humains

- Compte OVHcloud + moyen de paiement
- Domaine / DNS (A → IP VPS)
- Secrets hors git : `KANSO_MASTER_KEY`, `DATABASE_URL` (Supabase UE), `MISTRAL_API_KEY`, SMTP

## Choix machine (indicatif)

| Critère | Recommandation MVP |
|---------|-------------------|
| RAM | ≥ 2 Go (4 Go confort si LLM + worker) |
| Disque | ≥ 40 Go SSD |
| OS | Ubuntu LTS |
| Réseau | IPv4 publique ; firewall 22/80/443 |

## Étapes (manuel)

1. Créer instance + SSH key ; noter IP.
2. `ufw allow 22,80,443/tcp` ; fail2ban optionnel.
3. Installer Docker + Compose.
4. Cloner le repo (ou artefact CI) **sans** `.env` dans git.
5. Copier `infra/docker/compose.staging.yml` / prod compose ; renseigner env via fichier local ou secrets hôte.
6. Pointer `DATABASE_URL` vers **Supabase UE** (pas Postgres local en prod).
7. `docker compose up -d` (api + worker).
8. TLS : Caddy / nginx / OVH SSL devant `:3000`.
9. DNS A → IP ; smoke `curl https://API/health`.
10. Grafana Free ou `/health` + logs Docker (pas d’exigence M4).

## Checklist post-provision

- [ ] `/health` 200
- [ ] Worker heartbeat dans logs
- [ ] `KANSO_MASTER_KEY` ≥ 32 car. uniquement sur hôte
- [ ] Aucun secret dans images / git
- [ ] Backup / snapshot OVH planifié
- [ ] DPA OVH coché dans `docs/legal/dpa-subprocessors.md`

## Hors scope de ce doc

- Terraform / Ansible
- HA multi-VPS (`compose.ha.yml` = expérimental)
- SMTP : voir secret `alerts.intake_email` + slot `PARTNER_SMTP_*` dans `onboard-partner.sh`
