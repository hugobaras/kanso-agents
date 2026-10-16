# Demande à Mistral AI — non-conservation et cadre contractuel (brouillon)

**Statut :** brouillon interne, à envoyer par SHBT-STUDIO SAS après relecture. C'est le prérequis pour passer l'analyse IA du Portail de `simulated` à `KANSO_PORTAIL_AI_MODE=mistral`.

## Message à envoyer (support / équipe commerciale Mistral AI)

> **Objet :** API La Plateforme — demande de non-conservation (zero data retention) et DPA pour données de cabinets juridiques et comptables
>
> Bonjour,
>
> SHBT-STUDIO SAS édite Kanso Portail, un espace client sécurisé pour avocats, experts-comptables et notaires (France). Nous souhaitons utiliser l'API Mistral (endpoint UE `api.eu.mistral.ai`) pour :
> - l'OCR de pièces déposées par les clients de nos cabinets (`mistral-ocr-latest`) ;
> - l'analyse de ces pièces à la demande du cabinet (`mistral-small-latest`) : résumé, contrôle de cohérence, questions-réponses.
>
> Ces pièces relèvent du secret professionnel et peuvent contenir des données personnelles sensibles. Pourriez-vous nous confirmer, ou nous proposer par écrit :
> 1. l'activation de la **non-conservation** des requêtes et réponses sur notre organisation (aucun stockage au-delà du traitement, y compris pour la surveillance des abus), et ses conditions ;
> 2. votre **accord de traitement des données (article 28 RGPD)** et la liste de vos sous-traitants ultérieurs ;
> 3. que nos contenus ne sont **jamais utilisés pour l'entraînement** ou l'amélioration des modèles ;
> 4. la **localisation** du traitement et du stockage éventuel (UE uniquement) ;
> 5. votre délai de **notification en cas de violation** de données ;
> 6. vos certifications ou rapports de sécurité disponibles (ISO 27001, SOC 2…).
>
> Volume prévisionnel : quelques milliers de pages par mois au lancement.
>
> Merci d'avance,
> [Nom], SHBT-STUDIO SAS — [e-mail], [téléphone]

## Points de contrôle avant activation

| Point | Preuve attendue | Statut |
|---|---|---|
| Non-conservation activée sur l'organisation | Confirmation écrite + paramètre visible dans la console | ☐ |
| DPA Mistral signé | PDF signé archivé | ☐ |
| Pas d'entraînement sur nos contenus | Clause contractuelle | ☐ |
| Traitement dans l'UE | Clause ou documentation | ☐ |
| Notification de violation ≤ 48 h (cohérente avec notre DPA) | Clause | ☐ |
| Avenant « Analyse IA » validé par un avocat | `apps/web/content/legal/avenant-ia.md` relu, version figée | ☐ |
| Notice client relue | `apps/web/content/legal/confidentialite-portail.md` | ☐ |
| Registre des traitements mis à jour | `docs/legal/registre-traitements.md` | ☐ |
| Analyse d'impact (AIPD) menée | Données potentiellement sensibles et à grande échelle : AIPD recommandée | ☐ |
| Éval sur le modèle réel | `KANSO_PORTAIL_AI_MODE=mistral pnpm eval:portail` à 100 % | ☐ |

Si l'une des garanties manque, laisser la variable `KANSO_PORTAIL_AI_MODE` vide : l'analyse reste en mode simulation, sans aucun transfert.
