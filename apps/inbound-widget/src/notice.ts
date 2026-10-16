/** Visible AI disclosure fallback (the tenant's ai_notice is sent by the server on session start). */
export function widgetBootstrapNotice(locale: "fr" | "en" = "fr"): string {
  return locale === "en" ? "You are chatting with an automated assistant." : "Vous échangez avec un assistant automatisé.";
}
