# Kanso Portail — spécification v1

Produit de la gamme Kanso Solutions (SHBT-STUDIO SAS). Décisions issues des 48 questions de cadrage (octobre 2026).

## Périmètre

Un cabinet (avocat, expert-comptable, notaire) **ouvre un dossier**, liste les **pièces à fournir**, et son client (dirigeant de TPE ou particulier) les **dépose depuis son mobile, sans compte**, puis suit l'avancement. Le cabinet vérifie, accepte ou refuse chaque pièce.

| Sujet | Décision |
|---|---|
| Utilisable seul | oui ; pont depuis Kanso Assistant (une demande qualifiée → « Créer un dossier ») |
| Accès client | lien (valable 7 jours) **et** code à 6 chiffres, tous deux reçus par e-mail ; pas de compte ; renvoi du lien par le client ou le cabinet |
| Granularité | un lien par contact et par dossier ; plusieurs adresses par dossier ; pas de vue globale |
| Client voit | liste de pièces et leur état, étape du dossier, message du cabinet, message court au cabinet |
| Fichiers | PDF et images, 20 Mo, plusieurs fichiers par pièce ; remplaçables/supprimables tant que la pièce n'est pas acceptée |
| Sécurité | chiffrement applicatif AES-256-GCM (clé de fichier enveloppée par une clé dérivée par cabinet), antivirus ClamAV à l'envoi, stockage OVHcloud Object Storage (UE), accès tracé |
| Lecture automatique | aucune (hors antivirus) |
| Étapes | À compléter → En cours de vérification → Complet → Terminé ; libellés modifiables par cabinet |
| Cabinet | rôles propriétaire / administrateur / membre ; modèles par profession modifiables ; relances réglables ; validation pièce par pièce |
| Notifications cabinet | résumé quotidien + notification immédiate quand le dossier est complet |
| Conservation | réglable par cabinet (défaut : 90 jours après « Terminé »), avertissement 7 jours avant, export ZIP avant suppression |
| Marque | logo et couleur du cabinet, français seul, web responsive |
| Offre | pas de facturation en v1 : module activé par Kanso pour les cabinets pilotes (bêta fermée), plafond de dossiers actifs (défaut 20) |

## Hors v1 (décidé)

Signature électronique, paiement des honoraires, prise de rendez-vous, intégrations logiciels métier, lecture automatique des pièces, application mobile, domaine personnalisé, double facteur côté cabinet, SMS, vue globale côté client.

## Responsabilités RGPD

Le cabinet est responsable du traitement, Kanso sous-traitant (même accord de traitement qu'Assistant). Les pièces d'identité et justificatifs de particuliers sont des données sensibles en pratique : information claire du client au dépôt, accès tracé, durée de conservation courte par défaut.

## Architecture

- `packages/portal` : chiffrement enveloppe, stockage (fichiers locaux en dev, S3 compatible OVH en production), antivirus (clamd), modèles de dossiers par profession, règles d'étape.
- API (`apps/inbound-api`) : `/api/app/:workspace/portail/*` (cabinet) et `/api/portail/*` (client, session par cookie `kanso_portail`).
- Worker : relances, résumé quotidien, avertissement et purge de conservation, nettoyage des liens et codes.
- Web : `/app/[ws]/portail` (cabinet) et `/espace/[token]` (client, mobile d'abord).
