# Actions humaines restantes (hors agent)

Le code / eval mock sont en place. Ces points nécessitent comptes, signatures ou données réelles.

| # | Action | Owner | Doc |
|---|--------|-------|-----|
| 1 | Signer DPA design partner + sous-traitants | Associés + conseil | [legal/](./legal/README.md) |
| 2 | Remplir rota incident | Associés | [runbooks/incident.md](./runbooks/incident.md) |
| 3 | Signer [checklist pilote](./checklist-pilote.md) | Associés | — |
| 4 | Provision VPS OVH + DNS | Associé infra | P0-02 |
| 5 | Créer projet Supabase `kanso` (optionnel) | Associé | P0-01 |
| 6 | `MISTRAL_API_KEY` + run eval live | Tech | go-nogo |
| 7 | SMTP réel (secret `alerts.intake_email`) | Tech | P0-07 |
| 8 | Remplacer corpus synthétique par docs pilote anonymisés (lot B) | Métier | corpus/ |
| 9 | Grafana Cloud Free + import dashboard | Tech | infra/grafana/ |
| 10 | Soft caps € figés (H-027/H-031) | Associés | `.env` |

Quand 1–3 + 6–7 sont OK → smoke conversation réelle + alerte SMTP avant prod données client.
