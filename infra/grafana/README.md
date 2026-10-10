# Grafana Cloud Free — squelette Kanso

1. Créer un stack Grafana Cloud Free (vérifier DPA + région).  
2. Brancher une datasource **Postgres** (`DATABASE_URL` read-only) et/ou Loki pour logs JSON.  
3. Importer [`dashboard-kanso.json`](./dashboard-kanso.json).  
4. Ajouter un probe HTTP sur `GET /health` (Synthetic Monitoring ou blackbox).

**Repli si Free insuffisant :** healthchecks + logs stdout + alerte e-mail/Slack (phase 6).
