# Kanso Solutions

Gamme de produits pour les professions du droit et du chiffre (avocats, experts-comptables, notaires), éditée par SHBT-STUDIO SAS.

| Produit             | Rôle                                                                                           | État                                                       |
| ------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| **Kanso Assistant** | Assistant d'accueil (qualification des demandes) + traitement de documents, en SaaS self-serve | Disponible                                                 |
| **Kanso Site**      | Création de sites sur mesure pour les cabinets                                                 | Vitrine + demande de devis ; prestation réalisée à la main |
| **Kanso Portail**   | Espace client sécurisé, autonome : inscription, connexion, espace cabinet et facturation sur son propre domaine | Disponible : essai 14 jours, Portail Essentiel 29 € / Cabinet 69 € HT par mois (`docs/portail-v1.md`) |

Une seule app Next.js (`apps/web`) sert les quatre sites : Kanso Solutions (ombrelle), Assistant, Site, Portail. En local : `/` (Kanso Solutions), `/assistant`, `/site`, `/portail` ; l'application d'Assistant reste à la racine (`/connexion`, `/inscription`, `/app`). En production : un domaine par site, voir `.env.example`.

- **Assistant d'accueil** : widget à intégrer sur le site du cabinet, qualifie les demandes (questions + score), alerte par e-mail / Slack, suivi dans l'espace.
- **Traitement des documents** : factures et devis (PDF, scans), extraction (texte PDF ou OCR Mistral UE), contrôles (totaux, doublons, IBAN, seuil), validation humaine, brouillon Pennylane / Sellsy.
- **Self-serve** : inscription, essai 14 jours, abonnements Stripe, équipe, intégrations, RGPD en libre-service, back-office staff.
- **Kanso Site** : demande de devis publique, ou depuis l'espace Assistant pour les cabinets sans site.

## Architecture

| Chemin                 | Rôle                                                                                                                                             |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `packages/portal`      | Kanso Portail : chiffrement enveloppe, stockage objet, antivirus (clamd), modèles de dossiers, étapes. |
| `apps/web`             | Next.js 16 : les 4 sites (Solutions, Assistant, Site, Portail), authentification, tableau de bord, back-office (`/admin`). Proxy `/api/*` → API. |
| `apps/inbound-api`     | API Hono (seul backend) : `/api/auth`, `/api/app/:workspace`, `/api/admin`, `/api/stripe/webhook`, `/v1/widget/*`, `/widget/kanso-widget.js`.    |
| `apps/inbound-widget`  | Widget embarqué (Shadow DOM, ~7 Ko gzip).                                                                                                        |
| `apps/document-worker` | File de documents (Postgres SKIP LOCKED) + tâches planifiées.                                                                                    |
| `apps/admin-cli`       | Opérations : membres, staff, offres, secrets, purge.                                                                                             |
| `packages/*`           | `config` (schémas + modèles métier), `inbound-engine`, `document-pipeline`, `llm`, `adapters`, `tenancy`, `billing`, `mailer`, `shared`.         |
| `supabase/migrations`  | Schéma Postgres (appliqué par `scripts/apply-migrations.sh`, suivi dans `schema_migrations`).                                                    |

## Démarrage local

Prérequis : Node 22+, pnpm 11, Docker, `psql`.

```bash
pnpm install
docker compose -f infra/docker/compose.yml up -d db
cp .env.example .env.local        # puis renseigner KANSO_MASTER_KEY (≥ 32 caractères)
DATABASE_URL=postgres://kanso:kanso@127.0.0.1:5433/kanso sh scripts/apply-migrations.sh
pnpm build
bash scripts/dev-api.sh           # API      http://localhost:3000
bash scripts/dev-worker.sh        # worker + tâches planifiées
pnpm --filter @kanso/web dev      # web      http://localhost:3001
```

Créer un compte sur `/inscription`. Sans SMTP, les e-mails (confirmation, liens, alertes) sont visibles via `GET /api/dev/mails`.
Accès back-office : `pnpm --filter @kanso/admin-cli exec node dist/index.js make-staff vous@exemple.fr`.

Stack complète en conteneurs :

```bash
docker compose -f infra/docker/compose.yml up -d --build
```

## Stripe (mode test)

```bash
STRIPE_SECRET_KEY=sk_test_… pnpm --filter @kanso/inbound-api stripe:seed
stripe listen --forward-to localhost:3000/api/stripe/webhook   # → STRIPE_WEBHOOK_SECRET
```

## Tests

```bash
pnpm test                      # unitaires + intégration API (si DATABASE_URL)
pnpm eval:inbound && pnpm eval:documents && pnpm eval:corpus
```

## Docs

[DECISIONS.md](DECISIONS.md) (journal), [docs/embed-widget.md](docs/embed-widget.md) (widget), `apps/web/content/legal/` (textes légaux — brouillons à faire valider), `scripts/brand/` (génération des logos SVG).
