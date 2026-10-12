# Runbook incident — Kanso Inbound

**Fenêtre de 1re réaction :** 7j/7, 9h00–18h00 Europe/Paris  
**Hors fenêtre :** best effort, reprise au prochain créneau  
**Astreinte 24/7 :** non (MVP)

## Rota (placeholder M4 — à nommer avant pilote réel)

| Jour | Associé principal | Backup |
|------|-------------------|--------|
| Lun–Ven | Associé A *(TBD)* | Associé B *(TBD)* |
| Sam–Dim | Associé B *(TBD)* | Associé A *(TBD)* |

Canal : e-mail associés / Slack interne *(TBD)*  
Escalade S1 : les deux associés + avis juridique si données perso.

## Sévérités

| Sev | Exemples | Actions |
|-----|----------|---------|
| **S1** | Fuite données, clé maître exposée, cross-tenant | Contenir (revoke keys, disable tenant/public) → notifier associés → évaluer notification clients / autorités (*avis juridique*) |
| **S2** | API down, DB unreachable, alertes e-mail en panne > 15 min | Restart services, check Docker/OVH, bascule SMTP, com. partenaire si impact |
| **S3** | Soft cap dépassé, latence élevée, taux LLM erreurs > 5 % | Investiguer usage/provider, ajuster cap ou rate, pas de coupe auto MVP |

## Diagnostic rapide

```bash
curl -sS https://API/health
# Worker heartbeat (logs)
docker compose -f infra/docker/compose.yml ps
# Soft caps / audit
psql "$DATABASE_URL" -c "select * from audit_events where step='soft_cap' order by at desc limit 5;"
```

## Contournements

- **LLM down :** retirer `MISTRAL_API_KEY` → mock (démo only) ou message dégradé  
- **SMTP down :** secret sans `host` → console fallback  
- **Widget cassé :** servir ancien `kanso-widget.js` ; CORS / Origin  

## Post-mortem

Sous 5 jours ouvrés après S1/S2 : timeline, cause, correctifs, owner.
