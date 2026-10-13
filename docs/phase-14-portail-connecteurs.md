# Phase 14 — Portail client : brancher / révoquer les envois

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — voir [p14-execution.md](./p14-execution.md)  
**Prérequis :** phase 13 (tenant + secrets + alertes email/slack déjà câblés côté API)  
**Écart D-021 :** le MVP excluait tout back-office client ; ici on ouvre **uniquement** la gestion des _destinations d’alerte_ (pas la publication de scoring / questions).

## Décisions retenues

| Sujet         | Choix                                                               | Source |
| ------------- | ------------------------------------------------------------------- | ------ |
| Auth          | Magic link e-mail lié à `tenant_id`                                 | Q1 = 1 |
| Slack MVP     | Incoming Webhook collé à la main                                    | Q2 = 1 |
| Config canaux | Portail écrit secrets **et** met à jour `alerts.channels` published | Q3 = 1 |
| Sur-mesure    | Formulaire → row DB + alerte ops                                    | Q4 = 1 |

## Constat

Aujourd’hui : `put-secret` + config `alerts.channels` = ops Kanso.  
Le client ne peut pas brancher Slack / mail ni couper un canal sans nous.  
Demande : **espace connecté** pour plug / revoke quand c’est possible, et **demande sur-mesure** sinon.

## Objectif

Cabinet se connecte → voit ses canaux d’alerte → active e-mail / Slack (ou révoque) → pour Teams, WhatsApp, custom CRM, etc. : formulaire « sur-mesure » qui crée une demande ops (pas d’intégration fake).

## Périmètre proposé

| ID     | Item                                                                                                                    |
| ------ | ----------------------------------------------------------------------------------------------------------------------- |
| P14-01 | Auth portail : magic link e-mail (ou Clerk) lié à `tenant_id` + rôle `owner`/`ops`                                      |
| P14-02 | UI `/portal` (ou sous-domaine) : liste canaux, statut connected / disconnected / pending_custom                         |
| P14-03 | **E-mail** self-serve : saisir `to` (+ optionnel SMTP) → écrit `alerts.intake_email` ; revoke = wipe secret + canal off |
| P14-04 | **Slack** self-serve : Incoming Webhook URL (MVP) → `alerts.intake_slack` ; revoke = wipe                               |
| P14-05 | Toggle enable/disable canal sans supprimer le secret (patch config published via API service)                           |
| P14-06 | **Sur-mesure** : ticket (`custom_integration_requests`) + e-mail ops Kanso ; pas d’OAuth inventé                        |
| P14-07 | Audit : qui a branché / révoqué (`audit_events`)                                                                        |
| P14-08 | Smoke + doc partenaire (lien portail dans pack onboard)                                                                 |

## Hors périmètre (sauf Q)

- Self-serve CRM / calendrier / D2A (HubSpot OAuth, Google…)
- Slack OAuth app install (plus tard si webhook insuffisant)
- Édition scoring / questions / branding
- Multi-users avancé (SSO cabinet)

## Modèle UX (1re vue)

```
Connecteurs d’alerte — Cabinet Durand
┌─────────────┬──────────────┬────────────┐
│ E-mail      │ Connecté     │ [Modifier] [Révoquer] │
│ Slack       │ Non branché  │ [Brancher]            │
│ Sur-mesure  │ Demander…    │ Teams / autre         │
└─────────────┴──────────────┴────────────┘
```

## Sécurité

- Jamais de secret en clair renvoyé à l’UI (masquage `****hook…`)
- Session portail ≠ widget anon ; cookie httpOnly + CSRF
- RLS / `tenant_id` sur toutes les routes
- Revoke immédiat : prochain `hot_lead` ne touche plus le canal

## Questions

**Q1 — Auth**

1. Magic link e-mail (Supabase Auth / table `portal_users`) — recommandé
2. Clerk (Marketplace)
3. Mot de passe partagé tenant (déconseillé)

**Q2 — Slack MVP**

1. Incoming Webhook collé à la main — recommandé
2. OAuth Slack App dès maintenant
3. Slack reporté ; e-mail + sur-mesure seulement

**Q3 — Config canaux**

1. Portail écrit secrets **et** met à jour `alerts.channels` published
2. Portail écrit secrets seulement ; canaux restent figés en config CLI
3. Canaux « catalogue » fixe (email+slack) activés par présence de secret

**Q4 — Sur-mesure**

1. Formulaire → row DB + alerte ops console/e-mail — recommandé
2. Formulaire → Linear/Notion seulement
3. Page « contactez-nous » sans ticket structuré

Exécuté — voir [p14-execution.md](./p14-execution.md).
