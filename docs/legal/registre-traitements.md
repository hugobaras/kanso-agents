# Registre des traitements — Kanso Solutions (interne)

**Brouillon art. 30 RGPD (sous-traitant + activités propres).** À compléter / valider DPO ou conseil.

## T1 — Inbound pilote (pour le compte du client)

| Champ | Contenu |
|-------|---------|
| Finalité | Qualification de contacts + alertes équipe client |
| Base (côté client) | Intérêt légitime / mesures précontractuelles — *à confirmer par le client* |
| Rôle Kanso | Sous-traitant |
| Données | Messages, réponses, score, e-mail contact, IDs techniques |
| Destinataires | Client (alertes) ; sous-traitants listés |
| Transferts | UE préféré |
| Durées | Sessions/messages 90 j ; audit/usage 365 j ; logs appli 30 j |
| Mesures | Chiffrement secrets, RLS, purge, disclaimer IA |

## T2 — Document-to-Action (futur / hors go Inbound)

| Champ | Contenu |
|-------|---------|
| Finalité | Extraction / validation / brouillon écriture comptable |
| Rôle Kanso | Sous-traitant |
| Données | Fichiers docs, champs extraits, confiance, anomalies |
| Durées | Fichiers 90 j ; audit 365 j |
| Statut | Pas de prod écriture finale sans seuils D2A |

## T3 — Exploitation Kanso (propre)

| Champ | Contenu |
|-------|---------|
| Finalité | Facturation interne estimée, supervision, sécurité |
| Données | `usage_ledger`, health, audit résumé (sans prompts prod) |
| Conserv. | usage/audit 365 j ; logs 30 j |

## Contacts

- Responsable registre : [associé]  
- Dernière mise à jour : 2026-10-10
