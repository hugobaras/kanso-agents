# Jour J pilote — runbook 1 page

**Prérequis :** `pnpm m5` = GO technique + DPA signé (humain).

1. `invite-portal-user` + onboard partenaire (`pnpm onboard:partner`)  
2. Widget / stub live ; disclaimer visible  
3. Client branche e-mail (ou Slack) via `/portal`  
4. Smoke conversation → alerte console ou SMTP  
5. Soft cap / usage surveillés  
6. Canal incident = rota [runbooks/incident.md](./runbooks/incident.md)  
7. Pas de docs clients réels sans `set-dpa --signed`
