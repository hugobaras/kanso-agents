# Phase 10 — Mise en prod / fondations live

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-12  
**Statut :** rédigé — en attente de **validé** pour exécution complète  
**Prérequis :** phases 0–9 + backlogs P0–P3 code  
**Alignement :** jalons M1–M2 phase 9 (fondations live → Inbound MVP technique)

## Objectif

Passer du stack **local Docker** à un chemin **staging live** (LLM + SMTP réels), préparer **Supabase UE + apps** (VPS OVH plus tard), et ouvrir un **tenant démo interne** en parallèle de la chasse design partner — sans données tiers sans DPA.

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| Runtime apps | Staging Docker local / ordi d’abord ; OVH ensuite | Q1 = 2 |
| Postgres | Supabase cloud `kanso` (UE) **et** apps sur runtime (VPS plus tard) | Q2 = 3 |
| LLM pilote | Mistral EU (`MISTRAL_API_KEY`) dès maintenant | Q3 = 1 |
| Alertes | SMTP uniquement (OVH / Brevo UE) | Q4 = 1 |
| Données | Tenant démo interne live **+** chasse partenaire (DPA avant données réelles) | Q5 = 3 |
| Remote Git | GitHub | Q6 = 1 |

## Architecture cible (phase 10)

```text
[Poste / staging Docker]          [Plus tard]
  inbound-api ──┐                   VPS OVH
  document-worker┤                  inbound-api + worker
  Postgres local :5433 (dev)        │
                 │                  │
                 └──► Supabase UE (prod / staging partagé) ◄── apps
                 └──► Mistral EU
                 └──► SMTP UE
```

**Règle données :** tenant `demo-*` = données fictives OK ; tenant partenaire = DPA signé obligatoire.

## Plan d’exécution (ordre)

### Étape A — GitHub (immédiat)

- **Fait (2026-10-12) :** repo privé https://github.com/hugobaras/kanso-agents — `main` poussée, CI présente

### Étape B — Staging Docker local « live-ready »

- `compose.staging.yml` : env `staging`, soft cap, worker poll
- Fichier `.env.staging.example` : `DATABASE_URL`, `KANSO_MASTER_KEY`, `MISTRAL_API_KEY`, SMTP secrets via CLI
- Smoke : `/health`, session, upload document, `purge-retention --dry-run`

### Étape C — Supabase projet `kanso`

- Région UE (ex. `eu-west-3`)
- Appliquer migrations `supabase/migrations/*`
- Brancher `DATABASE_URL` staging/prod apps (quand VPS ou tunnel)
- RLS déjà dans le repo — smoke cross-tenant

### Étape D — Mistral live

- `MISTRAL_API_KEY` + endpoint EU
- Run smoke turn + sous-ensemble eval (pas 30 cas live en CI — coût)
- Comparer vs mock go/no-go (garder mock en CI)

### Étape E — SMTP live

- Secret `alerts.intake_email` avec host/from/to
- Smoke alerte sur conversation hot_lead
- Slack **hors** scope phase 10 (Q4 = SMTP only)

### Étape F — Tenant démo interne

- `create-tenant` / `publish-config` / secrets
- Widget `/demo` ou snippet sur page interne
- Pas de PII réelle

### Étape G — OVH (reporté, checklist)

- Provision VPS quand compte prêt
- Docker compose prod + reverse proxy
- Pointer apps vers Supabase

### Étape H — Design partner (parallèle, rôle D)

- Brief + DPA brouillon → signature
- Pas de données client avant case 1 de [ops-humain.md](./ops-humain.md)

## Critères de done phase 10

- [ ] Remote GitHub + CI verte sur `main`
- [ ] Staging local documenté ; smokes verts avec Mistral + SMTP (ou SMTP reporté si compte absent — noter)
- [ ] Projet Supabase `kanso` créé + migrations appliquées **ou** ticket bloquant si compte manquant
- [ ] Tenant démo interne opérationnel
- [ ] Checklist M1 partiellement cochée (OVH = reporté explicitement)
- [ ] Livrable exécution : `docs/p10-execution.md`

## Hors périmètre phase 10

- Données design partner sans DPA
- Slack, CRM, Calendar obligatoires
- Mode `final` comptable
- HA multi-instance prod

## Risques

| Risque | Mitigation |
|--------|------------|
| Pas de compte Supabase / Mistral / SMTP | Doc bloquants ; continuer staging mock pour le reste |
| Coût eval live | Sous-ensemble 3–5 cas, jamais CI |
| Confusion démo vs partenaire | Préfixe `demo-` ; DPA gate |

## Question de validation

Ce plan phase 10 vous convient-il ? Répondez **validé** pour lancer l’exécution (GitHub → staging → Supabase/Mistral/SMTP selon disponibilités), ou indiquez les amendements.
