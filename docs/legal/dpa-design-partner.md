# Accord de traitement des données — design partner (modèle)

**Brouillon — à faire valider juridiquement avant signature.**

## Parties

- **Responsable de traitement :** [Client / Cabinet — raison sociale, RCS, adresse]  
- **Sous-traitant :** shbt studio SAS (marque Kanso Solutions), [adresse], [SIRET]

## Objet

Mise à disposition du produit **Inbound** (widget + API de qualification) en pilote, incluant traitement de messages et métadonnées de session pour le compte du client.

## Durée

Du [date début] au [date fin] ou jusqu’à résiliation / fin de pilote, puis purge selon politique de conservation Kanso (90 j sessions, sauf instruction contraire écrite).

## Nature et finalité du traitement

- Qualification de contacts entrants via assistant automatisé  
- Transmission d’alertes (e-mail) aux destinataires configurés par le client  
- Journalisation technique, audit et mesure d’usage (tokens / € estimés)

## Catégories de personnes concernées

Prospects / visiteurs du site du client ; éventuellement collaborateurs destinataires des alertes.

## Catégories de données

Messages saisis, réponses de qualification, scores, e-mail de contact, identifiants techniques (`tenant_id`, `session_id`), logs sans corps de prompt en production.

## Instructions

Le sous-traitant ne traite les données que sur instruction documentée du responsable (config publiée, canaux d’alerte, secrets fournis). Pas d’utilisation des données clients pour entraîner des modèles tiers hors contrat.

## Sous-traitants ultérieurs

Liste initiale : voir [dpa-subprocessors.md](./dpa-subprocessors.md). Notification préalable en cas d’ajout material.

## Transferts hors UE

Interdits pour les données clients sauf mécanisme validé. Préférence endpoints UE (ex. Mistral EU) pour le pilote.

## Sécurité (moyens)

Isolation multi-tenant, secrets chiffrés, RLS, rétention/purge, accès limité associés Kanso, monitoring santé.

## Droits des personnes

Le client reste point de contact. Kanso assiste via procédure export / effacement tenant (`admin-cli`) sous délai de moyens (heures ouvrées élargies 7j/7 9–18 Europe/Paris).

## Sortie / restitution

À la fin : export raisonnable sur demande + purge selon politique, sauf obligation légale de conservation.

## Engagements

Obligations de **moyens** uniquement — pas de garantie de résultat métier (leads convertis, délais de rappel client, etc.).

## Signatures

| | Responsable | Sous-traitant |
|--|-------------|---------------|
| Nom | | |
| Date | | |
| Signature | | |
