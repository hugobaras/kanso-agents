# Phase 1 — Structure du dépôt

**Produit :** Kanso Solutions (SHBT-STUDIO SAS)  
**Date :** 2026-10-10  
**Statut :** validé (2026-10-10)  
**Prérequis :** [phase-0-cadrage.md](./phase-0-cadrage.md)

## Objectif

Définir l’arborescence du mono-dépôt TypeScript, les conventions de nommage, la gestion de la configuration et des secrets, les environnements et la CI minimale — sans code applicatif (phase 7).

## Décisions retenues

| Sujet              | Choix                                                                     | Source |
| ------------------ | ------------------------------------------------------------------------- | ------ |
| Outil monorepo     | pnpm workspaces + Turborepo                                               | Q1 = 1 |
| Configs client     | Table Supabase + exemples / schémas dans le repo                          | Q2 = 2 |
| Secrets par tenant | Chiffrés côté Supabase (Vault ou colonne chiffrée) ; clés maîtres sur OVH | Q3 = 1 |
| Environnements     | `local` + `prod` ; `staging` au premier client pilote                     | Q4 = 3 |
| CI GitHub Actions  | lint + typecheck + unit tests sur chaque PR                               | Q5 = 1 |

## Arborescence commentée

Squelette cible (dossiers et fichiers de convention uniquement ; création réelle en phase 7).

```text
kanso/                          # racine mono-dépôt
├── apps/
│   ├── inbound-api/            # API HTTP du moteur Inbound (sessions, widget backend)
│   ├── inbound-widget/         # bundle JS marque blanche servi / embarqué
│   ├── document-worker/        # worker Document-to-Action (poll jobs Postgres)
│   └── admin-cli/              # CLI interne : provisionner un tenant, valider une config
├── packages/
│   ├── config/                 # schémas Zod/JSON Schema des configs produit + loader
│   ├── tenancy/                # résolution tenant_id, isolation, accès config versionnée
│   ├── llm/                    # abstraction provider (pas de modèle figé)
│   ├── adapters/               # interfaces CRM, agenda, alertes, docs, compta (+ stubs)
│   ├── inbound-engine/         # machine à états, scoring, sessions (logique pure)
│   ├── document-pipeline/      # étapes ingestion → action (logique pure)
│   └── shared/                 # types, erreurs, logging structuré, ids
├── config/
│   ├── examples/               # configs d’exemple (cabinet avocats, PME BTP) — pas de prod
│   └── schemas/                # copies ou exports des schémas versionnés (docs / CI)
├── supabase/
│   ├── migrations/             # SQL versionné (tenants, configs, jobs, audit, secrets méta)
│   └── seed/                   # données de démo local uniquement
├── infra/
│   ├── docker/
│   │   ├── Dockerfile.api
│   │   ├── Dockerfile.worker
│   │   └── compose.yml         # local : api + worker (+ optionnel studio)
│   └── ovh/                    # notes déploiement VPS (pas de secrets)
├── docs/                       # phases, ADR légers
├── .github/
│   └── workflows/
│       └── ci.yml              # lint, typecheck, unit tests
├── DECISIONS.md
├── package.json                # workspaces pnpm
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .env.example                # clés locales uniquement (jamais secrets clients)
└── README.md
```

### Rôles des apps

| App               | Responsabilité                                                            |
| ----------------- | ------------------------------------------------------------------------- |
| `inbound-api`     | Webhooks / REST widget, charge config tenant, appelle `inbound-engine`    |
| `inbound-widget`  | UI conversationnelle marque blanche ; parle uniquement à `inbound-api`    |
| `document-worker` | Poll `jobs`, exécute `document-pipeline`, écrit cibles via adapters       |
| `admin-cli`       | Opérations humaines : créer tenant, publier version de config, smoke test |

### Rôles des packages

| Package                                | Responsabilité                                              |
| -------------------------------------- | ----------------------------------------------------------- |
| `config`                               | Valider et versionner les schémas ; pas de secrets          |
| `tenancy`                              | `tenant_id` partout ; lecture config active depuis Supabase |
| `llm`                                  | Interface unique + validation sorties structurées           |
| `adapters`                             | Contrats + implémentations ; erreurs / retry (phase 4)      |
| `inbound-engine` / `document-pipeline` | Logique métier testable sans HTTP ni Docker                 |

## Conventions de nommage

| Élément                  | Convention                           | Exemple                        |
| ------------------------ | ------------------------------------ | ------------------------------ |
| Packages                 | `@kanso/<name>`                      | `@kanso/llm`                   |
| Apps (dossiers)          | kebab-case                           | `inbound-api`                  |
| `tenant_id`              | slug minuscule stable                | `cabinet-dupont`               |
| Versions de config       | entier monotone par tenant + produit | `config_version = 3`           |
| Variables d’env globales | `KANSO_*`                            | `KANSO_ENV=local`              |
| Tables SQL               | snake_case pluriel                   | `tenant_configs`               |
| Fichiers exemples        | `<produit>.<profil>.example.json`    | `inbound.avocats.example.json` |

## Configuration et secrets

```text
Repo Git                    Supabase UE                         Instance OVH
────────                    ───────────                         ────────────
schémas + examples    →     tenant_configs (JSON validé)        KANSO_MASTER_KEY
                            tenant_secrets (chiffrés / Vault)   SUPABASE_SERVICE_ROLE
                            config_version, published_at        (pas de secrets clients en clair)
```

Règles :

1. **Aucune** clé API client (CRM, Slack, Pennylane…) dans Git.
2. Config métier versionnée en base (`tenant_configs`) ; le repo ne contient que schémas + exemples.
3. Secrets tenant : Supabase Vault ou colonne chiffrée ; déchiffrement avec clé(s) maître(s) uniquement sur OVH (`KANSO_MASTER_KEY` ou équivalent).
4. `.env` local dérivé de `.env.example` ; `.env*` client interdit au commit (gitignore).
5. _Hypothèse à vérifier :_ disponibilité et limites de Supabase Vault sur le plan choisi ; sinon colonne `bytea` / pgcrypto avec même modèle de clés.

## Environnements

| Env       | Usage                                | Infra                                                                       |
| --------- | ------------------------------------ | --------------------------------------------------------------------------- |
| `local`   | Dev associés                         | Docker Compose + projet Supabase local ou branche de dev                    |
| `prod`    | Clients réels                        | VPS OVH + projet Supabase UE                                                |
| `staging` | **Reporté** au premier client pilote | Miroir allégé de prod (_hypothèse à vérifier_ : coût dans budget &lt; 50 €) |

`KANSO_ENV` ∈ {`local`,`prod`,`staging`} ; pas d’autre environnement nommé au MVP.

## CI minimale

Fichier cible : `.github/workflows/ci.yml`

Sur chaque PR et sur `main` :

1. `pnpm install`
2. lint (ESLint ou oxlint — choix d’outil en phase 7)
3. `tsc` / typecheck via Turborepo
4. unit tests (`vitest` ou équivalent — choix en phase 7)

Hors CI MVP : build/push images Docker, déploiement auto, e2e navigateur.

## Turborepo (périmètre MVP)

Pipelines déclarés a minima : `lint`, `typecheck`, `test`, `build`.  
Pas de remote cache payant au démarrage (_hypothèse à vérifier_ : cache local suffisant pour 4 devs).

## Hors périmètre de cette phase

- Contenu des schémas client (phase 2)
- Machine à états / pipeline détaillés (phases 3 et 5)
- Contrats adaptateurs complets (phase 4)
- Création des dossiers et code qui compile (phase 7)

## Ce qui reste incertain

- API exacte Supabase Vault vs chiffrement applicatif maison
- Projet Supabase unique multi-tenant vs projets séparés (coût vs isolation) — tranché en phase 6 si besoin
- Coût d’un futur `staging` sous enveloppe &lt; 50 €
- Choix précis ESLint vs oxlint, Vitest vs autre (non bloquant pour l’arborescence)

## Risques

| Risque                                | Impact                                | Mitigation                                                            |
| ------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| Turborepo + trop de packages          | Complexité avant le premier client    | Packages listés ci-dessus uniquement ; pas de micro-packages inutiles |
| Configs en base sans process de revue | Régression silencieuse chez un client | `config_version` + publication explicite via `admin-cli`              |
| Clé maître perdue / fuitée            | Compromission multi-tenant            | Rotation documentée (phase 6) ; pas de clé dans Git                   |
| Staging absent                        | Surprises en prod au premier pilote   | Smoke tests + exemples ; staging dès le pilote                        |

## Question de validation

Ce livrable et les décisions D-011…D-015 vous conviennent-ils ? Répondez **validé** pour ouvrir la phase 2 (configuration client), ou indiquez les amendements.
