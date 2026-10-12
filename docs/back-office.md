# Back-office client (P2-06)

**Décision historique (D-021) :** pas de back-office client pour publier la config Inbound.

**Réouverture partielle (phase 14, livrée) :** portail `/portal` — brancher / révoquer e-mail & Slack, demande sur-mesure. Scoring, questions, branding restent CLI Kanso.

| Besoin | Où |
|--------|-----|
| Créer tenant / publier config | `admin-cli` |
| Inviter user portail | `kanso-admin invite-portal-user` |
| Secrets / canaux alerte | `/portal` (ou `put-secret` ops) |
| Sur-mesure | formulaire portail → `custom_integration_requests` |
| Suivi coûts | `usage_ledger` + Grafana squelette |
| Anomalies D2A | statut via CLI (phase 5) |
