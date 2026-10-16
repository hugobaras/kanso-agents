---
title: Avenant « Analyse IA des pièces » — Kanso Portail
updated: 2026-10-17
---

**Version 2026-10-ia-v1.** Projet à faire valider par un conseil avant mise en production. Il complète l'[accord de traitement des données](/legal/dpa) conclu entre le cabinet (« le Client ») et SHBT-STUDIO SAS (« Kanso »). En cas de contradiction, le présent avenant prévaut pour l'analyse IA uniquement.

## 1. Objet

Le présent avenant encadre la fonction facultative « Analyse IA des pièces » de Kanso Portail : extraction du texte des pièces déposées par les clients du cabinet, puis, à la demande d'un utilisateur du cabinet, résumé du dossier, contrôle des pièces reçues et réponses à des questions sur leur contenu.

La fonction est **désactivée par défaut**. Seul le propriétaire de l'espace peut l'activer, en acceptant le présent avenant. Il peut la désactiver à tout moment.

## 2. Rôles

Le Client reste **responsable de traitement**. Kanso agit en **sous-traitant**, sur instruction documentée du Client, l'activation de la fonction valant instruction. Mistral AI intervient en **sous-traitant ultérieur** (article 4).

## 3. Description du traitement

- **Données traitées :** contenu textuel des pièces déposées dans les dossiers non exclus (identité, coordonnées, données financières, fiscales, sociales ou juridiques selon les pièces demandées).
- **Personnes concernées :** les clients du cabinet et les tiers mentionnés dans leurs pièces.
- **Finalité :** aider le cabinet à vérifier et exploiter les pièces de ses propres dossiers. Aucune autre finalité, notamment aucun profilage, aucune prospection et **aucun entraînement de modèle**.
- **Périmètre :** chaque analyse porte sur **un seul dossier**. Aucune recherche transversale entre dossiers ou entre cabinets n'est possible.
- **Conservation :**
  - Le texte extrait est conservé **chiffré** tant que la fonction est active et que la pièce existe.
  - Il est effacé immédiatement si la fonction est désactivée, ou si le dossier ou la pièce est exclu ou supprimé.
  - Les résultats d'analyse (résumés, constats, réponses) **ne sont pas conservés** par Kanso.

## 4. Sous-traitant ultérieur : Mistral AI

L'extraction de texte des documents numérisés (OCR) et l'analyse sont réalisées par Mistral AI (Paris, France), via son API hébergée dans l'Union européenne.

Kanso s'engage à n'activer ce traitement qu'après avoir obtenu de Mistral AI, par écrit :

- un accord de traitement conforme à l'article 28 du RGPD ;
- la **non-conservation** des contenus transmis au-delà du temps de traitement (zero data retention) ;
- l'interdiction de les utiliser pour entraîner ou améliorer des modèles.

Tant que ces garanties ne sont pas réunies, la fonction s'exécute en mode simulation, sans aucun transfert vers Mistral AI.

## 5. Mesures de sécurité spécifiques

- Le texte extrait est chiffré (AES-256-GCM, clé propre au cabinet), lié cryptographiquement à la pièce et au dossier concernés.
- Aucun contenu de pièce, aucune question et aucune réponse n'est inscrit dans les journaux techniques. Le journal d'audit du cabinet enregistre qui a lancé quelle analyse, sur quel dossier, sans le contenu.
- Les sessions d'assistance de Kanso n'ont **pas accès** aux dossiers ni à l'analyse IA.
- L'analyse **n'exécute aucune action** : elle ne valide, ne refuse et ne modifie aucune pièce. Les instructions éventuellement contenues dans un document sont traitées comme des données, jamais comme des ordres.
- Chaque réponse cite la pièce et la page d'où elle provient. À défaut de source, la réponse indique que l'information n'a pas été trouvée.

## 6. Obligations du Client

Le Client :

1. **informe ses clients** de l'analyse automatique de leurs pièces. Un message est affiché dans leur espace et la [notice d'information](/legal/confidentialite-portail) est mise à jour en conséquence ;
2. **exclut** de l'analyse les dossiers ou pièces qui ne doivent pas en faire l'objet, notamment les données de santé et les autres catégories particulières de données (article 9 du RGPD), sauf base légale et garanties adaptées dont il est seul juge ;
3. apprécie la compatibilité de la fonction avec ses **obligations déontologiques** (secret professionnel de l'avocat, du notaire ou de l'expert-comptable) ;
4. **vérifie** toute suggestion avant usage. Les résultats sont des aides à la vérification, pas des conseils ni des décisions.

## 7. Limites

L'analyse peut être incomplète ou inexacte : lecture imparfaite des documents numérisés, pièces non encore analysées, quota mensuel atteint. Kanso est tenu à une obligation de moyens et n'est pas responsable des décisions prises sur la base des suggestions. Les limitations de responsabilité des [conditions générales d'utilisation](/legal/cgu) s'appliquent.

## 8. Quotas

La fonction est incluse dans l'offre Portail Cabinet, dans la limite de **300 pages analysées par mois**, et dans l'essai gratuit dans la limite de 30 pages. Au-delà, les nouvelles pièces ne sont pas analysées jusqu'au mois suivant. Aucun dépassement n'est facturé.

## 9. Durée et modification

Le présent avenant s'applique dès l'activation de la fonction et jusqu'à sa désactivation ou la fin du contrat. Toute nouvelle version est soumise à une nouvelle acceptation : d'ici là, la fonction est suspendue.
