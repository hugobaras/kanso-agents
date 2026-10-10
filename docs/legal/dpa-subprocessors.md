# Sous-traitants / DPA critiques — checklist pilote

**Brouillon interne.** Cocher avant premier pilote avec données réelles.

| Prestataire | Rôle | Région cible | DPA / contrat | Statut |
|-------------|------|--------------|---------------|--------|
| OVHcloud | Hébergement VPS / compute | UE (FR) | À joindre | ☐ |
| Supabase | Postgres managé (si cloud) | UE (ex. eu-west-3) | À joindre | ☐ |
| Mistral AI | LLM (qualification) | UE préférée (`api.eu…`) | À joindre | ☐ |
| Fournisseur e-mail (SMTP OVH / autre UE) | Alertes inbound | UE | À joindre | ☐ |
| Grafana Cloud (optionnel) | Métriques / logs | Vérifier localisation + DPA free | À joindre ou **désactiver** | ☐ |
| Slack (optionnel P1) | Alertes | Vérifier transfert | Hors MVP si non OK | ☐ |

## Règles

1. Pas de données clients sur un sous-traitant sans DPA / clause équivalente.  
2. Si Grafana Free : DPA + localisation OK, sinon repli healthchecks + logs locaux (phase 6).  
3. Mettre à jour ce tableau à chaque ajout ; notifier le design partner si material.
