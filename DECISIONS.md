# Journal des décisions — Kanso Solutions

Format : date, décision, source, statut. Les hypothèses non validées sont listées séparément.

---

## 2026-10-10 — Phase 0 Cadrage

### Décisions

| ID    | Décision     | Détail                                                              | Source               | Statut  |
| ----- | ------------ | ------------------------------------------------------------------- | -------------------- | ------- |
| D-001 | Langage      | TypeScript (Node.js) pour API, widget, workers et packages partagés | Phase 0 Q1 = 1       | Validée |
| D-002 | Dépôts       | Mono-dépôt (apps + packages partagés)                               | Phase 0 Q2 = 1       | Validée |
| D-003 | Compute      | OVHcloud, région UE                                                 | Phase 0 Q3 = 2       | Validée |
| D-004 | Budget infra | &lt; 50 € / mois hors tokens LLM                                    | Phase 0 Q4 = 1       | Validée |
| D-005 | Socle outils | GitHub Actions, Docker/Compose, Postgres, Supabase                  | Phase 0 Q5 = A,B,C,F | Validée |
| D-006 | Données      | Postgres (+ storage si besoin) via Supabase région UE               | Composition Phase 0  | Validée |
| D-007 | Runtime      | 1 instance OVH + Docker Compose (API + worker)                      | Composition Phase 0  | Validée |
| D-008 | Jobs         | File via Postgres + polling worker ; pas de Redis au MVP            | Composition Phase 0  | Validée |
| D-009 | IA           | Abstraction provider ; aucun modèle figé dans l’archi               | Contrainte produit   | Validée |
| D-010 | CI initiale  | GitHub Actions : lint, typecheck, tests ; pas de CD complexe        | Composition Phase 0  | Validée |

### Hypothèses non validées

| ID    | Hypothèse                                                                                                  | À vérifier                        |
| ----- | ---------------------------------------------------------------------------------------------------------- | --------------------------------- |
| H-001 | Tarif OVH (instance + IP + snapshots + bande passante) tient dans le reste de budget après Supabase        | Grille OVH + devis réel           |
| H-002 | Projet Supabase en région UE avec DPA et backups localisés de façon acceptable pour Kanso / clients        | Console Supabase + contrat        |
| H-003 | Free tier ou pro léger Supabase suffit pour les premiers tenants + documents                               | Limites quotas vs scénario pilote |
| H-004 | Extraction multimodale via APIs cloud en TypeScript suffit (pas de Python ML local au démarrage)           | Phase 5 / 8 évaluation            |
| H-005 | Au moins un fournisseur LLM avec engagement UE utilisable pour le pilote (ex. Mistral `api.eu.mistral.ai`) | DPA + `models.list` endpoint EU   |

### Vérifications modèles (snapshot 2026-10-10)

Sources : docs publiques OpenAI, Anthropic, Mistral. Non contractuel ; revalider via API au moment du choix.

- OpenAI : GPT-6 Astra, GPT-6.1 Sol, GPT-6 Luna, famille GPT-5.6 (entre autres)
- Anthropic : mentions Opus 5, Opus/Sonnet 4.6, Haiku 4.5 (entre autres)
- Mistral : endpoint EU `api.eu.mistral.ai` ; Large 4, Medium 3.5, Small 4, Ministral 3, OCR (entre autres)

---

## 2026-10-10 — Phase 1 Structure du dépôt

### Décisions

| ID    | Décision         | Détail                                                                                                                                                        | Source                                 | Statut  |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-011 | Monorepo tooling | pnpm workspaces + Turborepo                                                                                                                                   | Phase 1 Q1 = 1                         | Validée |
| D-012 | Configs client   | Table Supabase + schémas/exemples dans le repo (pas de configs prod dans Git)                                                                                 | Phase 1 Q2 = 2                         | Validée |
| D-013 | Secrets tenant   | Supabase Vault ou colonne chiffrée ; clés maîtres sur OVH                                                                                                     | Phase 1 Q3 = 1                         | Validée |
| D-014 | Environnements   | `local` + `prod` ; `staging` au premier client pilote                                                                                                         | Phase 1 Q4 = 3                         | Validée |
| D-015 | CI MVP           | GitHub Actions : lint + typecheck + unit tests sur chaque PR                                                                                                  | Phase 1 Q5 = 1                         | Validée |
| D-016 | Arborescence     | `apps/*` (inbound-api, inbound-widget, document-worker, admin-cli) + `packages/*` (config, tenancy, llm, adapters, inbound-engine, document-pipeline, shared) | Livrable phase 1                       | Validée |
| D-017 | Nommage packages | Scope npm `@kanso/<name>` ; `tenant_id` slug ; `KANSO_*` pour env                                                                                             | Livrable phase 1                       | Validée |
| D-018 | Clôture phase 1  | Livrable structure dépôt accepté                                                                                                                              | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                                                               | À vérifier                                |
| ----- | ------------------------------------------------------------------------------------------------------- | ----------------------------------------- |
| H-006 | Supabase Vault disponible et suffisant sur le plan retenu ; sinon pgcrypto / chiffrement app équivalent | Docs + plan Supabase                      |
| H-007 | Cache Turborepo local suffisant pour 4 associés sans remote cache payant                                | Usage réel                                |
| H-008 | Un seul projet Supabase multi-tenant suffit jusqu’au premier pilote                                     | Phase 6 isolation                         |
| H-009 | Ajout de `staging` possible sans casser le budget &lt; 50 € / mois                                      | Tarifs OVH + Supabase au moment du pilote |

### Lien livrable

- [docs/phase-1-structure-depot.md](docs/phase-1-structure-depot.md)

---

## 2026-10-10 — Phase 2 Configuration client

### Décisions

| ID    | Décision                           | Détail                                                                                      | Source                                 | Statut  |
| ----- | ---------------------------------- | ------------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-019 | Schéma canonique                   | Zod source de vérité ; JSON Schema exporté                                                  | Phase 2 Q1 = 1                         | Validée |
| D-020 | Granularité config                 | Un JSON versionné par produit (`inbound` \| `document_to_action`)                           | Phase 2 Q2 = 1                         | Validée |
| D-021 | Publication config                 | Associés Kanso via `admin-cli` uniquement (pas de back-office client MVP)                   | Phase 2 Q3 = 1                         | Validée |
| D-022 | Inbound MVP obligatoire            | Identité/disclaimer, qualification+scoring, alertes, opérations (horaires/langues/escalade) | Phase 2 Q4 = A,B,E,F                   | Validée |
| D-023 | Inbound optionnel typé             | `integrations.calendar` et `integrations.crm` absents ou complets                           | Découlant Q4                           | Validée |
| D-024 | Document-to-Action MVP obligatoire | Sources, types+champs, règles validation, cible, alertes humaines                           | Phase 2 Q5 = A,B,C,D,E                 | Validée |
| D-025 | Conservation hors config tenant    | Durées de conservation = politique globale Kanso (phase 6), pas champ client v1             | Q5 sans F                              | Validée |
| D-026 | Action par défaut                  | `action.mode = draft` ; `final` seulement via CLI avec confirmation                         | Livrable phase 2                       | Validée |
| D-027 | Secrets dans config                | Uniquement `secret_ref`, jamais de secrets en clair dans JSON                               | Contrainte phase 1                     | Validée |
| D-028 | Clôture phase 2                    | Livrable configuration client accepté                                                       | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                                              | À vérifier            |
| ----- | -------------------------------------------------------------------------------------- | --------------------- |
| H-010 | Instanciation grille standard &lt; 1 journée associée                                  | Premier client pilote |
| H-011 | Topics système `conseil_juridique` / `conseil_comptable` non retirables par le client  | Phase 3 garde-fous    |
| H-012 | Sous-ensemble connecteurs MVP suffisant avec `email_inbox` + `upload_web` + 1–2 cibles | Phase 4               |

### Lien livrable

- [docs/phase-2-configuration-client.md](docs/phase-2-configuration-client.md)

---

## 2026-10-10 — Phase 3 Moteur Inbound

### Décisions

| ID    | Décision          | Détail                                                                                | Source                                 | Statut  |
| ----- | ----------------- | ------------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-029 | Pilotage états    | Hybride : code possède le funnel ; LLM = intention + reformulation dans l’état        | Phase 3 Q1 = 3                         | Validée |
| D-030 | Session           | Postgres `inbound_sessions` + `inbound_messages` ; TTL global                         | Phase 3 Q2 = 1                         | Validée |
| D-031 | Scoring runtime   | Recalcul `score_current` à chaque réponse ; `score_final` figé à `ScoreReady`         | Phase 3 Q3 = 3                         | Validée |
| D-032 | Politique conseil | Refus + capture contact ; escalation si insistance                                    | Phase 3 Q4 = 3                         | Validée |
| D-033 | Garde-fous MVP    | Sorties structurées validées ; question_id allowlist ; pas d’affirmations hors config | Phase 3 Q5 = A,B,C                     | Validée |
| D-034 | RAG               | Hors MVP ; prévu ultérieurement                                                       | Phase 3 Q5 complément                  | Validée |
| D-035 | Tools externes    | Déclenchés par le code sur transition ; pas d’appel libre LLM au MVP                  | Livrable phase 3                       | Validée |
| D-036 | Alertes hot       | Basées sur `score_final` (pas sur `score_current` seul)                               | Livrable phase 3                       | Validée |
| D-037 | Clôture phase 3   | Livrable moteur Inbound accepté                                                       | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                     | À vérifier           |
| ----- | ------------------------------------------------------------- | -------------------- |
| H-013 | Abandon avec contact partiel → alerte `new_lead`              | Choix produit pilote |
| H-014 | Truncation prompt aux N derniers tours suffisante sans résumé | Coût tokens phase 8  |
| H-015 | TTL inactivité session = 30 minutes (global)                  | Phase 6 / usage réel |
| H-016 | Ordre sync : alerte puis CRM/calendar best-effort             | Phase 4              |

### Lien livrable

- [docs/phase-3-moteur-inbound.md](docs/phase-3-moteur-inbound.md)

---

## 2026-10-10 — Phase 4 Adaptateurs

### Décisions

| ID    | Décision                 | Détail                                                            | Source                                 | Statut  |
| ----- | ------------------------ | ----------------------------------------------------------------- | -------------------------------------- | ------- |
| D-038 | Contrats adaptateurs     | Interfaces TS par catégorie + `AdapterResult` ok/retryable/fatal  | Phase 4 Q1 = 1                         | Validée |
| D-039 | Retry                    | Max 3, backoff exponentiel + jitter ; puis dead letter / anomalie | Phase 4 Q2 = 1                         | Validée |
| D-040 | Priorité connecteurs     | Grille TPE/PME FR                                                 | Phase 4 Q3 = 1                         | Validée |
| D-041 | Secrets adaptateurs      | `AuthContext` injecté ; résolution `secret_ref` dans tenancy      | Phase 4 Q4 = 1                         | Validée |
| D-042 | Rate limit               | Par `(tenant_id, provider)` via Postgres                          | Phase 4 Q5 = 2                         | Validée |
| D-043 | Alertes rang 1–2         | `email` puis `slack`                                              | Livrable phase 4                       | Validée |
| D-044 | CRM rang 1–2             | `hubspot` puis `sellsy`                                           | Livrable phase 4                       | Validée |
| D-045 | Agenda rang 1–2          | `google_calendar` puis `calendly`                                 | Livrable phase 4                       | Validée |
| D-046 | Sources docs rang 1–2    | `email_inbox` puis `upload_web`                                   | Livrable phase 4                       | Validée |
| D-047 | Cibles écriture rang 1–2 | `pennylane` puis `sellsy`                                         | Livrable phase 4                       | Validée |
| D-048 | Clôture phase 4          | Livrable adaptateurs accepté                                      | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                               | À vérifier                      |
| ----- | ----------------------------------------------------------------------- | ------------------------------- |
| H-017 | Compteurs rate-limit en Postgres (fenêtre ~1 min) suffisants sans Redis | Charge pilote                   |
| H-018 | Calendly mappe correctement listSlots/bookSlot                          | Docs API Calendly               |
| H-019 | Provider e-mail transactionnel UE tenable &lt; budget restant           | Choix Brevo / SES eu / SMTP OVH |
| H-020 | APIs d’écriture supportent une clé d’idempotence ou équivalent métier   | Docs HubSpot, Pennylane, Sellsy |

### Lien livrable

- [docs/phase-4-adaptateurs.md](docs/phase-4-adaptateurs.md)

---

## 2026-10-10 — Phase 5 Pipeline Document-to-Action

### Décisions

| ID    | Décision        | Détail                                                                      | Source                                 | Statut  |
| ----- | --------------- | --------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-049 | Granularité job | 1 job = 1 document ; étapes = statuts du même enregistrement                | Phase 5 Q1 = 1                         | Validée |
| D-050 | Doublons        | Clés métier configurables + SHA-256 fichier                                 | Phase 5 Q2 = 1                         | Validée |
| D-051 | Confiance       | Score par champ ; blocage si champ critique &lt; min_confidence             | Phase 5 Q3 = 2                         | Validée |
| D-052 | Anomalies       | Notif client ; résolution statut via admin-cli Kanso au MVP                 | Phase 5 Q4 = 1                         | Validée |
| D-053 | Audit           | Une entrée par transition d’étape + summary ; pas de fichier/prompt en prod | Phase 5 Q5 = 1                         | Validée |
| D-054 | Écriture        | Mode draft par défaut ; final sous garde-fou                                | Alignement phase 2                     | Validée |
| D-055 | Worker          | Poll Postgres SKIP LOCKED ; un process sur OVH                              | Livrable phase 5                       | Validée |
| D-056 | Clôture phase 5 | Livrable pipeline Document-to-Action accepté                                | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                                           | À vérifier                     |
| ----- | ----------------------------------------------------------------------------------- | ------------------------------ |
| H-021 | Défauts champs critiques (ex. invoice : total_ttc, invoice_number, iban si demandé) | Revue métier pilote            |
| H-022 | Champs non critiques sous seuil ne bloquent pas seuls                               | Phase 8 faux positifs/négatifs |
| H-023 | FOR UPDATE SKIP LOCKED adapté au volume pré-pilote                                  | Charge réelle                  |
| H-024 | Fenêtre anti-doublon alignée sur conservation phase 6                               | Phase 6                        |

### Lien livrable

- [docs/phase-5-pipeline-document-to-action.md](docs/phase-5-pipeline-document-to-action.md)

---

## 2026-10-10 — Phase 6 Sécurité, RGPD et exploitation

### Décisions

| ID    | Décision             | Détail                                                                             | Source                                 | Statut  |
| ----- | -------------------- | ---------------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-057 | Isolation            | DB partagée + `tenant_id` ; RLS si utile                                           | Phase 6 Q1 = 1                         | Validée |
| D-058 | Conservation         | Sessions 90 j ; fichiers 90 j ; audit 365 j ; logs appli 30 j                      | Phase 6 Q2 = 1                         | Validée |
| D-059 | Coûts LLM            | `usage_ledger` tokens + € estimé / tenant                                          | Phase 6 Q3 = 1                         | Validée |
| D-060 | Supervision          | Grafana Cloud Free tant que gratuit/quotas OK ; sinon healthchecks + logs + alerte | Phase 6 Q4 = 2 si gratuit              | Validée |
| D-061 | Réponse incident     | Best effort 7j/7 9h–18h Europe/Paris ; pas d’astreinte nuit                        | Phase 6 Q5 = 3                         | Validée |
| D-062 | Monitoring payant    | Interdit au MVP s’il casse le budget infra &lt; 50 €                               | Livrable phase 6                       | Validée |
| D-063 | Fenêtre anti-doublon | Alignée sur conservation fichiers (90 j) au MVP                                    | H-024 tranché                          | Validée |
| D-064 | Clôture phase 6      | Livrable sécurité / RGPD / exploitation accepté                                    | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                                                 | À vérifier                    |
| ----- | ----------------------------------------------------------------------------------------- | ----------------------------- |
| H-025 | Durées 90/90/365/30 acceptables juridiquement pour Kanso sous-traitant                    | Conseil / DPO                 |
| H-026 | Grafana Cloud Free : DPA + localisation télémétrie acceptables ; quotas suffisants pilote | Inscription + contrat Grafana |
| H-027 | Soft caps €/tenant définis à l’activation du premier pilote                               | Décision associés             |
| H-028 | Chiffrement au repos défaut OVH + Supabase suffisant sans KMS dédié                       | Docs offres retenues          |

### Vérification monitoring (2026-10-10)

- Grafana Cloud Free : offre à 0 $ documentée (grafana.com/pricing) ; rétention télémétrie free indiquée à 14 jours ; limites d’usage (ex. métriques / logs) à revalider à l’inscription.

### Lien livrable

- [docs/phase-6-securite-rgpd-exploitation.md](docs/phase-6-securite-rgpd-exploitation.md)

---

## 2026-10-10 — Phase 7 Squelette de code

### Décisions

| ID    | Décision        | Détail                                                             | Source                                 | Statut  |
| ----- | --------------- | ------------------------------------------------------------------ | -------------------------------------- | ------- |
| D-065 | HTTP            | Hono pour `inbound-api`                                            | Phase 7 Q1 = 1                         | Validée |
| D-066 | Tests           | Vitest                                                             | Phase 7 Q2 = 1                         | Validée |
| D-067 | E2E skeleton    | Inbound + Document-to-Action avec mocks                            | Phase 7 Q3 = 1                         | Validée |
| D-068 | LLM tests       | Mock par défaut ; live opt-in `KANSO_E2E_LIVE=1`                   | Phase 7 Q4 = 3                         | Validée |
| D-069 | SQL             | Migrations Supabase fichiers locaux ; pas d’apply cloud en phase 7 | Phase 7 Q5 = 1                         | Validée |
| D-070 | Clôture phase 7 | Squelette code accepté (build/test locaux OK)                      | Validation orale « validé » 2026-10-10 | Validée |

### Lien livrable

- [docs/phase-7-squelette-code.md](docs/phase-7-squelette-code.md)

---

## 2026-10-10 — Phase 8 Évaluation

### Décisions

| ID    | Décision                | Détail                                                                 | Source                                 | Statut  |
| ----- | ----------------------- | ---------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-071 | Jeu Inbound             | 30 conversations scriptées multi-familles                              | Phase 8 Q1 = 1                         | Validée |
| D-072 | Corpus D2A              | ≥ 100 docs pour go/no-go ; cible 200                                   | Phase 8 Q2 = 1                         | Validée |
| D-073 | Source corpus           | Mix ~70 % interne / ~30 % pilote                                       | Phase 8 Q3 = 3                         | Validée |
| D-074 | Seuils D2A internes     | critical_field_accuracy ≥ 85 % ; anomaly_rate ≤ 15 % ; coût ≤ soft cap | Phase 8 Q4 = 1                         | Validée |
| D-075 | Fréquence eval          | Avant release LLM-facing + mensuel pilote ; CI = mocks                 | Phase 8 Q5 = 1                         | Validée |
| D-076 | Seuils non contractuels | Critères internes only ; contrats = moyens                             | Livrable phase 8                       | Validée |
| D-077 | Clôture phase 8         | Protocole d’évaluation accepté                                         | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                                                    | À vérifier        |
| ----- | ---------------------------------------------------------------------------- | ----------------- |
| H-029 | 70 documents internes anonymisables disponibles sous 30 j                    | Collecte associés |
| H-030 | anomaly_precision ≥ 80 % et duplicate_recall ≥ 90 % comme cibles secondaires | Première run gold |
| H-031 | Soft caps €/conv et €/doc figés en phase 9                                   | Décision associés |

### Lien livrable

- [docs/phase-8-evaluation.md](docs/phase-8-evaluation.md)

---

## 2026-10-10 — Phase 9 Plan de livraison

### Décisions

| ID    | Décision                   | Détail                                                                    | Source                                 | Statut  |
| ----- | -------------------------- | ------------------------------------------------------------------------- | -------------------------------------- | ------- |
| D-078 | Priorité 90 j              | Inbound d’abord ; D2A parallèle non bloquant                              | Phase 9 Q1 = 1                         | Validée |
| D-079 | Rôles                      | A moteurs · B adaptateurs/infra · C éval/données · D commercial/legal/ops | Phase 9 Q2 = 1                         | Validée |
| D-080 | Cible pilote               | J+90 ≈ 2027-01-08                                                         | Phase 9 Q3 = 2                         | Validée |
| D-081 | Connecteurs pilote Inbound | E-mail (+ Slack si prêt) ; CRM/agenda non requis                          | Phase 9 Q4 = 1                         | Validée |
| D-082 | Entrée pilote              | Design partner sous DPA puis conversion devis                             | Phase 9 Q5 = 2                         | Validée |
| D-083 | Backlog P0                 | Items P0-01…P0-16 bloquants pilote Inbound                                | Livrable phase 9                       | Validée |
| D-084 | Clôture cadrage            | Phases 0–9 acceptées ; exécution backlog autorisée                        | Validation orale « validé » 2026-10-10 | Validée |

### Hypothèses non validées (ajout)

| ID    | Hypothèse                                    | À vérifier            |
| ----- | -------------------------------------------- | --------------------- |
| H-032 | Design partner identifiable avant 2026-12-12 | Pipeline commercial D |
| H-033 | Mapping prénoms → rôles A/B/C/D sous 7 j     | Réunion associés      |

### Lien livrable

- [docs/phase-9-plan-livraison.md](docs/phase-9-plan-livraison.md)

---

## 2026-10-12 — Phase 10 Mise en prod / fondations live

### Décisions

| ID    | Décision     | Détail                                                            | Source          | Statut   |
| ----- | ------------ | ----------------------------------------------------------------- | --------------- | -------- |
| D-085 | Runtime apps | Staging Docker local d’abord ; OVH ensuite                        | Phase 10 Q1 = 2 | Proposée |
| D-086 | Postgres     | Supabase UE `kanso` + apps (VPS plus tard)                        | Phase 10 Q2 = 3 | Proposée |
| D-087 | LLM          | Mistral EU live dès phase 10                                      | Phase 10 Q3 = 1 | Proposée |
| D-088 | Alertes      | SMTP UE uniquement (pas Slack obligatoire)                        | Phase 10 Q4 = 1 | Proposée |
| D-089 | Données      | Démo interne live + chasse partenaire ; DPA avant données réelles | Phase 10 Q5 = 3 | Proposée |
| D-090 | Remote Git   | GitHub `hugobaras/kanso-agents` (privé)                           | Phase 10 Q6 = 1 | Exécutée |

### Lien livrable

- [docs/phase-10-mise-en-prod.md](docs/phase-10-mise-en-prod.md)

---

## 2026-10-12 — Phase 11 Inbound riche (M2)

### Décisions

| ID    | Décision       | Détail                                                          | Source          | Statut  |
| ----- | -------------- | --------------------------------------------------------------- | --------------- | ------- |
| D-091 | Priorité P11   | LLM-first (contexte + retries) **et** chips widget en parallèle | Phase 11 Q1 = 3 | Validée |
| D-092 | Handoff        | Synthèse LLM contrainte + template code si LLM down             | Phase 11 Q2 = 3 | Validée |
| D-093 | Heuristique    | Filet uniquement après retries Mistral                          | Phase 11 Q3 = 2 | Validée |
| D-094 | SMTP P11       | Reporter (console OK)                                           | Phase 11 Q4 = 2 | Validée |
| D-095 | Modèle Mistral | Choix agent après smoke quota                                   | Phase 11 Q5 = 3 | Validée |

### Lien livrable

- [docs/phase-11-inbound-riche.md](docs/phase-11-inbound-riche.md)

---

## 2026-10-12 — Phase 12 Gold + packaging

### Décisions

| ID    | Décision       | Détail                                                  | Source          | Statut  |
| ----- | -------------- | ------------------------------------------------------- | --------------- | ------- |
| D-096 | Priorité P12   | Eval gold **et** packaging démo/partenaire en parallèle | Phase 12 Q1 = 3 | Validée |
| D-097 | Eval live      | 3–5 cas Mistral hors CI dès P12                         | Phase 12 Q2 = 1 | Validée |
| D-098 | Design partner | Template tenant + smoke (pas chasse DPA dans le code)   | Phase 12 Q3 = 2 | Validée |
| D-099 | SMTP           | Console démo OK jusqu’au pilote                         | Phase 12 Q4 = 3 | Validée |

### Lien livrable

- [docs/phase-12-gold-et-packaging.md](docs/phase-12-gold-et-packaging.md)

---

## 2026-10-12 — Phase 13 Design partner M4

### Décisions

| ID    | Décision     | Détail                                      | Source          | Statut  |
| ----- | ------------ | ------------------------------------------- | --------------- | ------- |
| D-100 | Priorité P13 | Onboard script **et** legal/ops             | Phase 13 Q1 = 3 | Validée |
| D-101 | OVH          | Doc provision seulement                     | Phase 13 Q2 = 2 | Validée |
| D-102 | SMTP onboard | Slot optionnel ; console par défaut         | Phase 13 Q3 = 2 | Validée |
| D-103 | Garde DPA    | Flag `dpa_signed` bloque uploads docs réels | Phase 13 Q4 = 2 | Validée |

### Lien livrable

- [docs/phase-13-design-partner-m4.md](docs/phase-13-design-partner-m4.md)
- [docs/p13-execution.md](docs/p13-execution.md)

---

## 2026-10-12 — Phase 14 Portail connecteurs

### Décisions

| ID    | Décision       | Détail                                                        | Source          | Statut  |
| ----- | -------------- | ------------------------------------------------------------- | --------------- | ------- |
| D-104 | Auth portail   | Magic link e-mail → `portal_users` / session liée `tenant_id` | Phase 14 Q1 = 1 | Validée |
| D-105 | Slack MVP      | Incoming Webhook collé (pas OAuth)                            | Phase 14 Q2 = 1 | Validée |
| D-106 | Canaux         | Portail écrit secrets **et** republie `alerts.channels`       | Phase 14 Q3 = 1 | Validée |
| D-107 | Sur-mesure     | Formulaire → `custom_integration_requests` + alerte ops       | Phase 14 Q4 = 1 | Validée |
| D-108 | Scope vs D-021 | Portail = alertes seulement ; scoring/questions restent CLI   | Phase 14        | Validée |

### Lien livrable

- [docs/phase-14-portail-connecteurs.md](docs/phase-14-portail-connecteurs.md)
- [docs/p14-execution.md](docs/p14-execution.md)

---

## 2026-10-12 — Phase 15 M5 go/no-go

### Décisions

| ID    | Décision     | Détail                            | Source          | Statut  |
| ----- | ------------ | --------------------------------- | --------------- | ------- |
| D-109 | Priorité P15 | Pack M5 script + checklists       | Phase 15 Q1 = 1 | Validée |
| D-110 | SMTP         | Console jusqu’à credentials       | Phase 15 Q2 = 1 | Validée |
| D-111 | Live LLM     | Rejouer eval live + figer go-nogo | Phase 15 Q3 = 1 | Validée |
| D-112 | Portail P15  | Aucune feature portail            | Phase 15 Q4 = 3 | Validée |

### Lien livrable

- [docs/phase-15-m5-go-nogo.md](docs/phase-15-m5-go-nogo.md)
- [docs/p15-execution.md](docs/p15-execution.md)

---

## 2026-10-12 — Phase 16 M6 pilote prod

### Décisions

| ID    | Décision      | Détail                                  | Source          | Statut  |
| ----- | ------------- | --------------------------------------- | --------------- | ------- |
| D-113 | Priorité P16  | Kit embed + checklist M6                | Phase 16 Q1 = 1 | Validée |
| D-114 | Observabilité | Enrichir `/health` (+ worker heartbeat) | Phase 16 Q2 = 2 | Validée |
| D-115 | SMTP          | Console jusqu’à credentials             | Phase 16 Q3 = 1 | Validée |
| D-116 | Tenant pilote | Slot `pilote-<slug>` + freeze config    | Phase 16 Q4 = 2 | Validée |

### Lien livrable

- [docs/phase-16-m6-pilote-prod.md](docs/phase-16-m6-pilote-prod.md)
- [docs/p16-execution.md](docs/p16-execution.md)

---

## 2026-10-12 — Phase 17 P1 Inbound (hors-horaires)

### Décisions

| ID    | Décision      | Détail                                 | Source          | Statut   |
| ----- | ------------- | -------------------------------------- | --------------- | -------- |
| D-117 | Priorité P17  | Hors-horaires widget (P1-02) seulement | Phase 17 Q1 = 1 | Validée  |
| D-118 | Hors-horaires | Bloquer nouveaux messages hors plage   | Phase 17 Q2 = 2 | Validée  |
| D-119 | Soft-cap UI   | Lecture seule — reporté (pas dans Q1)  | Phase 17 Q3 = 1 | Différée |
| D-120 | D2A P17       | Hors scope                             | Phase 17 Q4 = 1 | Validée  |

### Lien livrable

- [docs/phase-17-p1-inbound.md](docs/phase-17-p1-inbound.md)
- [docs/p17-execution.md](docs/p17-execution.md)

---

## 2026-10-12 — Phase 18 Portail usage / soft-cap

### Décisions

| ID    | Décision      | Détail                                                      | Source            | Statut  |
| ----- | ------------- | ----------------------------------------------------------- | ----------------- | ------- |
| D-121 | Priorité P18  | Usage/soft-cap lecture seule dans `/portal`                 | Phase 18 Q1 = 1   | Validée |
| D-122 | Fenêtre usage | Jour calendaire Europe/Paris + `KANSO_SOFT_CAP_EUR_PER_DAY` | Phase 18 Q2 = 1   | Validée |
| D-123 | Breach UX     | Badge + aide (pas de coupe widget)                          | Phase 18 Q3 = 1   | Validée |
| D-124 | Suite         | Phase 19 = D2A M7 light                                     | Phase 18 Q4 = 2   | Validée |
| D-119 | Soft-cap UI   | Confirmée / exécutée via P18                                | Phase 17 Q3 → P18 | Validée |

### Lien livrable

- [docs/phase-18-portail-usage.md](docs/phase-18-portail-usage.md)
- [docs/p18-execution.md](docs/p18-execution.md)

---

## 2026-10-12 — Phase 19 D2A M7 light

### Décisions

| ID    | Décision     | Détail                                            | Source                 | Statut  |
| ----- | ------------ | ------------------------------------------------- | ---------------------- | ------- |
| D-125 | Niveau M7    | Pack `pnpm m7` + checklist ; seuils 85/15 stretch | Phase 19 Q1 = 1        | Validée |
| D-126 | Smoke upload | Non — corpus eval only                            | Phase 19 Q2 = 3        | Validée |
| D-127 | Extract      | Mock / heuristique                                | Phase 19 Q3 défaut = 1 | Validée |
| D-128 | Après M7     | Pause phases ; focus humain                       | Phase 19 Q4 = 1        | Validée |

### Lien livrable

- [docs/phase-19-d2a-m7-light.md](docs/phase-19-d2a-m7-light.md)
- [docs/p19-execution.md](docs/p19-execution.md)

---

## Suite

Phases 0–19 livrées — **GO_M7_LIGHT** (+ stretch mock GO).  
**Pause produit** (D-128). Focus humain : DPA signé, OVH, rota, SMTP.

### 2026-10-10 — Exécution P0 (en cours)

| ID       | Item                                     | Statut                                                                               |
| -------- | ---------------------------------------- | ------------------------------------------------------------------------------------ |
| P0-01    | Migrations + RLS                         | Appliqué sur Postgres Docker local (port **5433**)                                   |
| P0-02    | Compose Docker + env                     | DB up ; VPS OVH non provisionné                                                      |
| P0-03    | Secrets chiffrés + admin-cli             | Smoke OK (`demo-tenant`)                                                             |
| P0-04    | Sessions Postgres + TTL + POST /sessions | Smoke OK (`demo-tenant` → state Qualify)                                             |
| P0-05    | Orchestration hybride + validation LLM   | Fait (`orchestrateTurn`, messages API, tests OK)                                     |
| P0-06    | LLM Mistral UE                           | `MistralLlmClient` + factory ; défaut `mistral-small-latest` sur `api.eu.mistral.ai` |
| P0-07    | Alertes e-mail                           | SMTP (nodemailer) + console fallback ; retry ×3 ; branché sur messages API           |
| P0-08    | Widget JS                                | Bundle IIFE marque blanche + disclaimer ; servi via `/widget` et `/demo`             |
| P0-09    | Coûts LLM                                | `usage_ledger` + soft cap journalier (`KANSO_SOFT_CAP_EUR_PER_DAY`, défaut 5 €)      |
| P0-10    | Rétention                                | Purge 90/90/365/30 via `purge-retention` (dry-run par défaut)                        |
| P0-11    | Eval Inbound                             | 30 cas mock + `pnpm eval:inbound` ; 30/30 OK (2026-10-10)                            |
| P0-12    | Go/no-go Inbound                         | GO technique mock ; live + juridique encore ouverts                                  |
| P0-13    | Legal templates                          | Brouillons DPA / registre / textes moyens dans `docs/legal/`                         |
| P0-14    | Design partner                           | Brief + smoke `smoke-design-partner.mts`                                             |
| P0-15    | Ops incident                             | Runbook S1–S3 + rota template                                                        |
| P0-16    | Checklist pilote                         | `docs/checklist-pilote.md` (signatures associées ouvertes)                           |
| P1-01    | Slack alerts                             | Webhook + console ; multi-canal avec e-mail                                          |
| P1-02    | Hors horaires                            | Flag `after_hours` API + notice + bandeau widget                                     |
| P1-03    | Grafana                                  | Dashboard JSON squelette `infra/grafana/`                                            |
| P1-05    | D2A pipeline                             | Étapes extract→validate→draft + worker mock once                                     |
| P1-04    | Corpus D2A                               | 100 labels synthétiques lot A + `pnpm eval:corpus`                                   |
| P1-06    | Eval D2A                                 | `pnpm eval:documents` (échantillon mock)                                             |
| P1-07    | Staging                                  | `compose.staging.yml` overlay allégé                                                 |
| P2-01…05 | Connecteurs                              | HubSpot, GCal, Pennylane+inbox, Sellsy, Calendly (sandbox/HTTP)                      |
| P2-06    | Back-office                              | Hors scope — voir `docs/back-office.md`                                              |
| P3-01    | RAG Inbound                              | Opt-in `KANSO_RAG_ENABLED` + retriever mémoire                                       |
| P3-02    | Drive/Dropbox                            | Sources document `google_drive` / `dropbox`                                          |
| P3-03    | Mode final                               | Gated `KANSO_ALLOW_FINAL` + CLI confirm                                              |
| P3-04    | HA                                       | `compose.ha.yml` + nginx, scale API ×2                                               |
| Jobs PG  | D2A runtime                              | `upload_web` API + `claimNextJob` SKIP LOCKED + storage `.data/`                     |

**Ne pas** migrer sur le projet Supabase `shapemax`. Projet cloud `kanso` optionnel (confirmation requise).

| ID    | Hypothèse liée P0-06                                            | À vérifier                        |
| ----- | --------------------------------------------------------------- | --------------------------------- |
| H-034 | Alias `mistral-small-latest` disponible sur `api.eu.mistral.ai` | `GET /v1/models` avec la clé prod |

---

## 2026-10-14 — Refonte SaaS commercialisable

| ID    | Décision         | Détail                                                                                                                                                                                                                         | Statut                |
| ----- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------- |
| D-130 | Modèle de vente  | Self-serve : inscription, essai 14 j sans carte, abonnements Stripe (Essentiel 49 €, Cabinet 129 €, Expert 290 € HT/mois ; annuel = 10 mois). Remplace D-021 (pas de back-office client) et D-082.                             | Validée (utilisateur) |
| D-131 | Widget           | Clé publique `pk_live_…` + liste d'origines par clé ; API `/v1/widget/*`. L'ancienne API `/v1/:tenantId` n'est servie qu'avec `KANSO_LEGACY_WIDGET=1`. Portail `/portal` supprimé (comptes migrés vers `users`/`memberships`). | Validée               |
| D-132 | Front            | Nouvelle app `apps/web` (Next.js 16 + Tailwind 4). Hono reste le seul backend ; `/api/*` proxifié pour cookie first-party.                                                                                                     | Validée (utilisateur) |
| D-133 | Quotas           | Compteurs mensuels atomiques (`usage_counters`). Conversation décomptée au premier message du visiteur. Aucun dépassement facturé : blocage poli. Le soft cap € reste un suivi de coût interne.                                | Validée               |
| D-134 | Auth             | Maison : scrypt (N=2^17), cookie httpOnly `kanso_session` 30 j glissants, magic link, vérification e-mail, CSRF par Origin, rate limits Postgres. Rôles owner/admin/member vérifiés côté serveur.                              | Validée               |
| D-135 | Documents        | Texte réel envoyé au LLM (unpdf ; OCR Mistral pour scans) ; règles pilotées par la config ; revue humaine par défaut (`require_review`) ; mode `sandbox` par défaut tant que la cible comptable n'est pas connectée.           | Validée               |
| D-136 | Garde-fous LLM   | Messages en texte brut, jamais de promesse de délai (remplacée par « C'est noté. »), message de clôture déterministe par défaut (`KANSO_LLM_HANDOFF=1` pour l'opt-in), score interne jamais montré au visiteur.                | Validée               |
| D-137 | RGPD             | DPA accepté en ligne (`dpa_acceptances`, version 2026-10), export JSON et suppression (grâce 30 j) en libre-service, tâches planifiées (rétention, purge).                                                                     | Validée               |
| D-138 | Création de site | Offre Kanso Solutions « site sur devis » proposée aux cabinets sans site (onboarding, Installation, `/site-internet`) ; demande → e-mail `KANSO_SALES_EMAIL` + back-office. Prestation hors abonnement.                        | Validée (utilisateur) |

### Hypothèses / actions humaines ouvertes

| ID    | Sujet         | À faire                                                                                                                               |
| ----- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| H-040 | Textes légaux | CGU, CGV, DPA, confidentialité, mentions (`apps/web/content/legal/`) : relecture par un avocat ; compléter SIRET / adresse / capital. |
| H-041 | Stripe live   | Compte, Stripe Tax, portail client, webhook prod ; lancer `stripe:seed` en live.                                                      |
| H-042 | Hébergement   | Les pages marketing annoncent OVHcloud + base UE : à aligner avec l'infra réellement provisionnée.                                    |
| H-043 | SMTP          | Fournisseur UE transactionnel (`KANSO_SMTP_URL`), SPF/DKIM/DMARC sur le domaine d'envoi.                                              |

---

## 2026-10-15 — Gamme et sites Kanso Solutions

| ID    | Décision               | Détail                                                                                                                                                                                                                                                                                      | Statut                |
| ----- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| D-139 | Architecture de marque | SHBT-STUDIO SAS (société) → Kanso Solutions (gamme) → produits : **Kanso Assistant** (ce SaaS), **Kanso Site** (création de sites sur mesure), **Kanso Portail** (espace client). Cible : avocats, experts-comptables, notaires.                                                            | Validée (utilisateur) |
| D-140 | Sites                  | Une app Next.js sert 4 sites (Solutions, Assistant, Site, Portail) ; en production un domaine par site, routé par nom d'hôte (`proxy.ts`), en local par chemin (`/` Solutions, `/assistant`, `/site`, `/portail`). Thème par produit (couleur d'accent), logo ensō commun, point aux couleurs du produit.                         | Validée               |
| D-141 | Formulaires publics    | `POST /api/public/contact` (contact, devis Kanso Site, liste d'attente Kanso Portail) : consentement obligatoire, piège à robots, limite de débit, une demande par jour et par adresse, e-mail interne + accusé, conservation 3 ans (purge planifiée). Aucun cookie sur les sites vitrines. | Validée               |
| D-142 | Kanso Portail          | Vitrine uniquement (aucun produit, aucune date annoncée, aperçu marqué « conceptuel »).                                                                                                                                                                                                     | Validée (utilisateur) |
| D-143 | Kanso Site             | Prestation sur devis, sans prix affiché ; pas de réalisations factices ; propriété du site et délais précisés au devis.                                                                                                                                                                     | Validée               |

### Actions ouvertes

| ID    | Sujet            | À faire                                                                                                                                             |
| ----- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| H-044 | Noms et domaines | Recherche INPI (classes 9, 35, 42) pour « Kanso » et les trois produits ; réserver les domaines et renseigner `NEXT_PUBLIC_URL_*` / `KANSO_HOST_*`. |
| H-045 | Offre Kanso Site | Définir formules et prix indicatifs, conditions de cession, maintenance ; sinon la page reste « sur devis ».                                        |
| H-046 | Textes légaux    | Mentions légales et confidentialité Kanso Solutions (`apps/web/content/legal/`) : compléter SIRET, adresse, capital ; relecture juridique.          |
