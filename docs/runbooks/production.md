# Mise en production

Un serveur (VPS OVH, Ubuntu LTS, 4 Go de RAM minimum car l'antivirus en consomme environ 1,5 Go), Docker, et la stack `infra/docker/compose.prod.yml` : Caddy (HTTPS automatique), web, API, worker, antivirus, base PostgreSQL et sauvegarde nocturne.

## 1. Avant le serveur (associés)

| À faire | Où | Pourquoi |
|---|---|---|
| Acheter les 4 domaines | OVH | Solutions, Assistant, Site, Portail ; l'API utilise `api.<domaine Assistant>` |
| Créer deux buckets S3 (pièces, sauvegardes) avec **versioning** | OVH Public Cloud > Object Storage | Pièces du Portail ; copie hors serveur des sauvegardes |
| Choisir un prestataire SMTP UE | OVH (Zimbra / e-mail pro), Brevo, Scaleway TEM | Liens de connexion, codes du Portail, alertes |
| Valider le compte Stripe en mode live | Stripe | Paiement réel |
| Générer `KANSO_MASTER_KEY`, `KANSO_BACKUP_KEY`, `POSTGRES_PASSWORD` (`openssl rand -base64 48`) | Gestionnaire de mots de passe partagé | Sans la clé maître, les pièces sont illisibles : ne jamais la perdre |

## 2. DNS

Pour chaque domaine : un enregistrement `A` (et `AAAA` si IPv6) vers l'IP du serveur, plus `www`. Ajouter `api.<domaine Assistant>`.

Pour le domaine d'envoi des e-mails (celui de `KANSO_MAIL_FROM`), sans quoi les e-mails arrivent en spam :

| Type | Nom | Valeur |
|---|---|---|
| TXT | `@` | `v=spf1 include:<domaine SPF du prestataire> -all` |
| TXT / CNAME | `<sélecteur>._domainkey` | clé DKIM fournie par le prestataire |
| TXT | `_dmarc` | `v=DMARC1; p=quarantine; rua=mailto:dmarc@<domaine>` |

Vérifier avec un e-mail de test vers mail-tester.com : viser 9/10 ou plus.

## 3. Serveur

```bash
ufw allow 22/tcp && ufw allow 80/tcp && ufw allow 443/tcp && ufw enable
# Docker + compose (docs.docker.com/engine/install/ubuntu)
git clone git@github.com:hugobaras/kanso-agents.git /srv/kanso && cd /srv/kanso
cp .env.prod.example .env.prod && chmod 600 .env.prod   # remplir toutes les valeurs
docker compose -f infra/docker/compose.prod.yml --env-file .env.prod up -d --build
```

Seul Caddy publie des ports (80, 443). La base, l'API et l'antivirus ne sont joignables que depuis le réseau Docker interne.

## 4. Stripe live

Depuis un poste avec le dépôt installé (crée les produits et prix live, idempotent) :

```bash
STRIPE_SECRET_KEY=sk_live_… KANSO_STRIPE_ALLOW_LIVE=1 pnpm --filter @kanso/inbound-api stripe:seed
```

Puis, dans Stripe :
- Webhook vers `https://api.<domaine Assistant>/api/stripe/webhook` avec les événements `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed` ; copier le secret dans `STRIPE_WEBHOOK_SECRET`.
- Portail client Stripe : changement d'offre et résiliation activés.
- Stripe Tax activé (`STRIPE_AUTOMATIC_TAX=1`).

## 5. Premier compte staff

Créer d'abord le compte normalement sur le site (inscription), puis :

```bash
docker compose -f infra/docker/compose.prod.yml --env-file .env.prod exec db psql -U kanso -c "update users set is_staff = true where email = 'vous@kanso.fr'"
```

Puis activer la double authentification sur ce compte (Mon compte > Sécurité) : le back-office l'exige.

## 6. Surveillance

- Créer une sonde externe (UptimeRobot, Better Stack ou OVH) sur `https://api.<domaine Assistant>/health` toutes les 5 minutes, avec le mot-clé `"worker":{"ok":true` : elle alerte si l'API, la base ou le worker tombe.
- Une seconde sonde sur chaque domaine de site (code 200).
- Journaux : `docker compose … logs -f inbound-api document-worker` (JSON, une ligne par événement ; chercher `"level":"error"`).

## 7. Après la mise en ligne

- Lancer la preuve de restauration (`docs/runbooks/sauvegardes.md`) et noter la date.
- Créer un compte de test sur chaque produit, payer avec une vraie carte, résilier, vérifier les e-mails reçus.
- Mettre à jour le système chaque mois : `apt upgrade`, puis `git pull && docker compose … up -d --build`.
