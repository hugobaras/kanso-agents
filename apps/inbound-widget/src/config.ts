export type WidgetConfig = {
  tenantId: string;
  apiBase: string;
  primaryColor: string;
  title: string;
};

export function parseScriptConfig(script: HTMLScriptElement | null): WidgetConfig {
  const tenantId =
    script?.dataset.tenant ??
    new URLSearchParams(window.location.search).get("tenant") ??
    "";
  if (!tenantId) {
    throw new Error("Kanso widget: data-tenant is required");
  }
  return {
    tenantId,
    apiBase: (script?.dataset.api ?? "http://127.0.0.1:3000").replace(/\/$/, ""),
    primaryColor: script?.dataset.primaryColor ?? "#1B2A4A",
    title: script?.dataset.title ?? "Assistant",
  };
}
