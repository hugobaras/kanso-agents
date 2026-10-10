# Phase 8 — Protocole d’évaluation

**Produit :** Kanso Solutions (shbt studio SAS)  
**Date :** 2026-10-10  
**Statut :** validé (2026-10-10)  
**Prérequis :** [phase-7-squelette-code.md](./phase-7-squelette-code.md), phases 3 et 5

## Objectif

Définir comment mesurer la qualité et le coût des deux moteurs **avant** et **pendant** le pilote — sans promesse de résultat client. Ce livrable est un protocole ; le corpus gold n’est pas encore constitué.

## Décisions retenues

| Sujet | Choix | Source |
|-------|--------|--------|
| Jeu Inbound | 30 conversations scriptées | Q1 = 1 |
| Corpus docs | ≥ 100 anonymisés pour go/no-go ; viser 200 | Q2 = 1 |
| Source docs | Mix ~70 % interne / ~30 % pilote dès dispo | Q3 = 3 |
| Seuils D2A internes | ≥ 85 % champs critiques · ≤ 15 % anomalies · coût sous plafond | Q4 = 1 |
| Fréquence | Avant chaque release LLM/prompts/schémas + mensuel en pilote | Q5 = 1 |

**Rappel :** les seuils sont des **critères internes de mise en production / release**. Ils ne figurent pas comme engagement de résultat dans les contrats clients (moyens uniquement).

---

## 1. Principes

1. Séparer **évaluation mock** (CI phase 7, déterministe, 0 € LLM) et **évaluation gold live** (hors CI, tokens réels).
2. Versionner le protocole et le gold set (`eval/`, `schema_version`, `prompt_version`, `model_id`).
3. Anonymiser toute donnée réelle avant stockage repo ou partage (IBAN masqué, noms, SIRET, adresses).
4. Une run produit un rapport JSON + résumé markdown ; pas de « intuition » seule pour un go/no-go.
5. Coût = somme `usage_ledger` (ou équivalent run) / N items — *hypothèse* tarifs provider à jour dans une table locale.

---

## 2. Inbound — jeu de 30 conversations

### 2.1 Répartition cible

| Famille | Nb | Objectif |
|---------|----|----------|
| Happy path qualification complète | 8 | Score figé, alerte correcte (`hot` / `handoff`) |
| Abandon / timeout / bye | 4 | `ClosedAbandoned` ; pas d’alerte intempestive sauf contact partiel (H-013) |
| Hors sujet | 4 | Recentage → reprise question |
| Conseil juridique / comptable | 5 | Refus + capture contact ; pas de conseil de fond |
| Insistance après refus | 2 | Escalade |
| Demande humain explicite | 3 | Escalade |
| Hors horaires | 2 | Message hors créneaux + qualification continue |
| Tentative hallucination (prix/délais inventés) | 2 | Message sans affirmation hors config |

Total = 30. Secteurs couverts a minima : **avocats** (exemple phase 2) + **BTP / services TPE** générique.

### 2.2 Format d’un cas

```text
eval/inbound/cases/<id>.json
{
  "id": "inb-001",
  "family": "happy_path",
  "tenant_fixture": "cabinet-durand",
  "config_ref": "config/examples/inbound.avocats.example.json",
  "turns": [
    { "role": "user", "text": "..." }
  ],
  "expect": {
    "terminal_state": "ClosedComplete",
    "score_final_min": 70,
    "score_final_max": 100,
    "alert_event": "hot_lead",
    "must_not_contain": ["vous avez gagné", "conseil juridique :"],
    "must_refuse_advice": false
  }
}
```

Pour les cas conseil : `"must_refuse_advice": true` et absence de diagnostic juridique dans les messages assistant.

### 2.3 Métriques Inbound

| Métrique | Définition | Cible interne initiale (*hypothèse*) |
|----------|------------|--------------------------------------|
| `terminal_state_accuracy` | % cas dont l’état final ∈ attendu | ≥ 90 % |
| `policy_refuse_recall` | % cas conseil/interdit correctement refusés | 100 % |
| `hallucination_violations` | Nb messages avec affirmation prix/délai hors config | 0 |
| `alert_precision` | % alertes dont `event` attendu | ≥ 85 % |
| `cost_per_conversation_eur` | € LLM / conversation (médiane) | Soft cap fixé à l’activation (*H-027*) |
| `p95_turns` | Nombre de tours assistant | Monitoring (pas de seuil bloquant MVP) |

### 2.4 Procédure de run

1. Charger config fixture + mock ou live LLM (`KANSO_E2E_LIVE`).
2. Rejouer les tours (driver script — à coder post-validation phase 8 / backlog phase 9).
3. Comparer `expect` vs observé.
4. Écrire `eval/inbound/reports/<date>-<gitsha>.json`.

---

## 3. Document-to-Action — corpus 100–200

### 3.1 Composition

| Lot | Volume | Source |
|-----|--------|--------|
| A — interne | ~70 docs (puis croissance vers ~140) | Public / associés, anonymisés |
| B — pilote | ~30 docs (puis vers ~60) | Client sous DPA, anonymisés avant repo si partagés |
| **Go/no-go** | **≥ 100** docs labellisés | Lots A (+ B si dispo) |
| Cible confort | 200 | Quand disponible |

Types : `invoice` majoritaire, puis `quote`, `delivery_note` (refléter grille BTP + généraliste).

### 3.2 Anonymisation minimale (checklist)

- [ ] Remplacer raisons sociales par libellés fictifs stables  
- [ ] Masquer IBAN (garder pays + 4 derniers si besoin de tests allowlist)  
- [ ] Supprimer logos / signatures / coordonnées personnelles  
- [ ] Pas de pièce d’identité / données santé  
- [ ] Journal : qui a anonymisé, date, source lot A/B  

### 3.3 Gold labels

```text
eval/documents/<id>/
  original.pdf          # ou .png — hors git si sensible ; sinon anonymisé
  label.json
```

`label.json` :

```json
{
  "id": "doc-001",
  "document_type": "invoice",
  "fields": {
    "vendor_name": "...",
    "invoice_number": "...",
    "total_ht": 100,
    "vat_amount": 20,
    "total_ttc": 120,
    "iban": "FR76************5555"
  },
  "critical_fields": ["invoice_number", "total_ttc", "iban"],
  "expected_outcome": "draft",
  "notes": optional
}
```

`expected_outcome` ∈ `draft` | `anomaly_low_confidence` | `anomaly_validation` | `anomaly_duplicate`.

### 3.4 Métriques Document-to-Action

| Métrique | Définition | Seuil go/no-go interne |
|----------|------------|-------------------------|
| `critical_field_accuracy` | % champs critiques exacts (normalisation nombre/date) | **≥ 85 %** |
| `anomaly_rate` | % jobs en `anomaly` | **≤ 15 %** (dont anomalies attendues gold) |
| `anomaly_precision` | Parmi anomalies, % justifiées vs gold | Monitoring ≥ 80 % (*hypothèse*) |
| `duplicate_recall` | Doublons gold détectés | ≥ 90 % (*hypothèse*) |
| `draft_write_success` | % destinés `draft` ayant `remote_id` (mock ou sandbox) | ≥ 95 % sur sous-ensemble non anomalie |
| `cost_per_document_eur` | € LLM médian / doc | ≤ plafond soft défini à l’activation |
| `p95_latency_s` | Durée ingest→act/anomaly | Monitoring |

**Normalisation :** montants arrondis à 2 décimales ; dates ISO ; strings trim + casefold pour noms.

### 3.5 Procédure de run

1. Fixer `model_id`, prompts, `schema_version` config.  
2. Pour chaque doc : pipeline réel (extract live) + validate ; `createDraft` **sandbox/mock** (pas prod client).  
3. Scorer vs `label.json`.  
4. Rapport `eval/documents/reports/<date>-<gitsha>.json` + tableau agrégé.

---

## 4. Critères go / no-go (internes)

### Document-to-Action (bloquant pilote prod écriture)

- Corpus labellisé **≥ 100**  
- `critical_field_accuracy` **≥ 0.85**  
- `anomaly_rate` **≤ 0.15**  
- `cost_per_document_eur` ≤ soft cap associés  
- Aucune écriture `final` dans les runs d’eval  

### Inbound (bloquant widget prod)

- 30/30 cas exécutés  
- `policy_refuse_recall` = **1.0**  
- `hallucination_violations` = **0**  
- `terminal_state_accuracy` ≥ **0.90**  
- Coût médian conversation ≤ soft cap  

Échec d’un critère → pas de « validé prod » ; plan d’actions (prompt, schéma, seuil confiance) + nouvelle run.

---

## 5. Fréquence et responsabilités

| Déclencheur | Action | Qui |
|-------------|--------|-----|
| PR touchant prompts / schémas extract / machine à états | Run gold live **avant merge** si changement LLM-facing | Associé technique |
| Release candidate pilote | Run complet Inbound 30 + D2A ≥ 100 | Binôme tech + métier |
| Mensuel en prod pilote | Run échantillon (subset 20 docs + 10 conv) + revue coûts | Rotation associés |
| CI GitHub | **Mocks uniquement** (phase 7) | Automatique |

Budget tokens : suivi via `usage_ledger` / rapport run ; alerte si run eval dépasse enveloppe mensuelle associée (*hypothèse* enveloppe à figer en phase 9).

---

## 6. Structure repo prévue (création progressive)

```text
eval/
  inbound/cases/
  inbound/reports/
  documents/          # peut rester hors git (LFS / store privé) si sensible
  documents/reports/
  README.md           # comment lancer une run
```

Phase 8 = protocole ; peuplement des cases/docs = chantier phase 9 / pré-pilote.

---

## 7. Hors périmètre

- Constitution complète des 100–200 fichiers dans ce commit  
- Fine-tuning / RAG (post-MVP, D-034)  
- Engagement contractuel sur les seuils  

## Ce qui reste incertain

- Soft caps € conversation / document (H-027)  
- Disponibilité réelle de 70 docs internes anonymisables rapidement  
- Définition exacte « champ critique exact » pour OCR bruité (tolérance caractère)  
- Sandbox Pennylane disponible pour draft réel vs mock adaptateur  

## Risques

| Risque | Impact | Mitigation |
|--------|--------|------------|
| Gold set trop propre | Sur-confiance | Inclure scans flous, multi-pages, langues mixtes |
| Eval live en CI | Coût / flakiness | Interdit ; mocks CI |
| Seuils pris pour SLA client | Risque commercial / juridique | Textes = moyens ; seuils = internes only |
| Fuite PII dans `eval/` | RGPD | Checklist anonymisation + review avant commit |

## Question de validation

Ce protocole (30 conv, 100–200 docs, seuils 85 % / 15 %, fréquence release+mensuel) vous convient-il ? Répondez **validé** pour ouvrir la phase 9 (plan de livraison 90 jours), ou indiquez les amendements.
