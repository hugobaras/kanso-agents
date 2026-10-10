# Exécution backlog P2

**Date :** 2026-10-10  
**Statut :** livré côté repo (sandbox par défaut ; HTTP live si credentials)

## P2-01 — HubSpot CRM

`HubSpotCrmAdapter` + `createHubSpotCrmAdapter` (mock sans `access_token`).  
Sync best-effort après alerte si `integrations.crm.provider=hubspot`.

## P2-02 — Google Calendar

`GoogleCalendarAdapter` — `listSlots` / `bookSlot`.  
Sync : `listSlots` après alerte si `integrations.calendar.provider=google_calendar`.

## P2-03 — Pennylane + email_inbox

- `PennylaneAccountingAdapter` (HTTP) + mock sandbox  
- `EmailInboxSourceAdapter` poll/ack + passage worker `processInboxOnce`  
- `UploadWebSourceAdapter` (no-op poll)

## P2-04 — Sellsy

- `SellsyCrmAdapter` + `SellsyAccountingAdapter` (credentials séparés)  
- Registry : `sellsy` / `sellsy_accounting`

## P2-05 — Calendly

`CalendlyAdapter` (hypothèse H-018 mapping slots) + sandbox.

## P2-06 — Back-office client

**Hors scope MVP** (phase 9 P2-06 / historique). Onboarding = `admin-cli` + brief design partner.

## Registry

```ts
getCrmAdapter(provider, auth)
getCalendarAdapter(provider, auth)
getDocumentSourceAdapter(provider)
getAccountingAdapter(provider, auth)
```

Secret HubSpot exemple :
```bash
put-secret demo-tenant crm.hubspot '{"access_token":"pat-..."}'
# sandbox : '{"sandbox":"true"}'
```
