# Phase 13 — Design partner (M4) prêt à signer

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-12  
**Statut :** livré (2026-10-12) — voir [p13-execution.md](./p13-execution.md)  
**Prérequis :** phases 10–12 (staging, gold 30/30 + live 5/5, template partenaire)  
**Alignement :** jalon **M4** — DPA + brief config + tenant draft

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| Priorité | Onboard script **et** legal/ops checklists | Q1 = 3 |
| OVH | Doc provision seulement (pas de VPS) | Q2 = 2 |
| SMTP | Slot optionnel dans onboard (console par défaut) | Q3 = 2 |
| Garde DPA | Flag `dpa_signed` bloquant docs « réels » | Q4 = 2 |

## Constat

Côté code, onboarding template + smoke existent. M4 exige surtout du **packaging commercial/legal** et un parcours « nouveau cabinet » sans friction. OVH / SMTP réel restent optionnels (console ops OK).

## Objectif

Rendre possible : *cabinet signe DPA → on publie son tenant en &lt;1 h → widget sur son site (ou stub) → alerte console/SMTP*.

## Périmètre proposé

| ID | Item |
|----|------|
| P13-01 | Script `scripts/onboard-partner.sh` (tenant_id, nom, couleur, config path, secrets console) |
| P13-02 | Pack remise : PDF/MD one-pager + lien DPA + snippet widget généré |
| P13-03 | Tenant `partner-draft` isolé + garde-fou « pas de données réelles sans DPA flag » |
| P13-04 | Checklist M4 machine-readable (`docs/checklist-m4.md`) cochable |
| P13-05 | Runbook incident court + rota placeholder (P0-15) |
| P13-06 | (Opt) Grafana Free / health dashboard import — si Q = oui |

## Hors périmètre

- Signature DPA réelle (humain)
- OVH prod (sauf Q OVH = maintenant)
- Go/no-go seuils M5 complets
- Données client réelles

## Questions

**Q1 — Priorité**  
1. Onboarding script + pack remise  
2. Legal/ops checklists + runbook  
3. Les deux (recommandé)

**Q2 — OVH**  
1. Toujours reporter  
2. Commencer doc provision seulement  
3. Provisionner maintenant

**Q3 — SMTP partenaire**  
1. Console jusqu’à signature  
2. Prévoir slot credentials dans onboard script (sans forcer)  
3. Exiger SMTP dès draft

**Q4 — Flag DPA**  
1. Doc only (« ne pas charger de données »)  
2. Flag `tenant.meta.dpa_signed` bloquant upload docs réels  
3. Pas de garde technique

Répondez **go** pour lancer P13-01…P13-05 (+ doc OVH P13-06 light).
