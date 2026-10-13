export const ANOMALY_LABEL: Record<string, string> = {
  low_confidence: "Lecture incertaine",
  missing_fields: "Champs manquants",
  totals_incoherent: "Totaux incohérents",
  iban_unknown: "IBAN inconnu",
  duplicate: "Doublon probable",
  unsupported_document_type: "Type non accepté",
  amount_above_threshold: "Montant au-dessus du seuil",
  empty_text: "Document illisible",
};

export const TYPE_LABEL: Record<string, string> = {
  invoice: "Facture",
  quote: "Devis",
  delivery_note: "Bon de livraison",
};

export const FIELD_LABEL: Record<string, string> = {
  vendor_name: "Fournisseur",
  vendor_siret: "SIRET",
  invoice_number: "N° de facture",
  invoice_date: "Date de facture",
  due_date: "Échéance",
  currency: "Devise",
  total_ht: "Total HT",
  vat_amount: "TVA",
  total_ttc: "Total TTC",
  iban: "IBAN",
  quote_number: "N° de devis",
  quote_date: "Date du devis",
  validity_date: "Validité",
  delivery_number: "N° de bon",
  delivery_date: "Date de livraison",
  site_reference: "Référence chantier",
  line_items_count: "Nombre de lignes",
};

export type DocState = { label: string; tone: "neutral" | "info" | "warning" | "danger" | "success" | "accent" };

export function documentState(d: { status: string; review_status: string | null; step: string; anomaly: string | null }): DocState {
  if (d.status === "pending" || d.status === "running") {
    return { label: d.step === "act" ? "Envoi en cours" : "Analyse en cours", tone: "info" };
  }
  if (d.review_status === "pending_review") {
    return d.step === "anomaly"
      ? { label: ANOMALY_LABEL[d.anomaly ?? ""] ?? "À vérifier", tone: "warning" }
      : { label: "Prêt à valider", tone: "accent" };
  }
  if (d.review_status === "rejected") return { label: "Rejeté", tone: "neutral" };
  if (d.status === "succeeded") return { label: "Brouillon créé", tone: "success" };
  if (d.status === "failed") return { label: "Échec", tone: "danger" };
  return { label: d.status, tone: "neutral" };
}
