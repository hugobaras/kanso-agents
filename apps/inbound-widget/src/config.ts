export type WidgetConfig = {
  /** Publishable key (pk_live_… / pk_test_…). */
  key: string | null;
  /** Legacy pilot mode (KANSO_LEGACY_WIDGET): tenant slug instead of a key. */
  tenantId: string | null;
  apiBase: string;
  /** Open the panel on load (demo / dashboard test). */
  open: boolean;
  position: "right" | "left";
  /** Optional overrides when the public config cannot be fetched (legacy). */
  primaryColor: string | null;
  title: string | null;
};

function originOf(src: string | undefined): string | null {
  if (!src) return null;
  try {
    return new URL(src, window.location.href).origin;
  } catch {
    return null;
  }
}

export function parseScriptConfig(script: HTMLScriptElement | null): WidgetConfig {
  const ds = script?.dataset ?? {};
  const key = ds.key ?? null;
  const tenantId = ds.tenant ?? null;
  if (!key && !tenantId) {
    throw new Error("Kanso widget: data-key is required");
  }
  const apiBase = (ds.api ?? originOf(script?.src) ?? window.location.origin).replace(/\/$/, "");
  return {
    key,
    tenantId,
    apiBase,
    open: ds.open === "true",
    position: ds.position === "left" ? "left" : "right",
    primaryColor: ds.primaryColor ?? null,
    title: ds.title ?? null,
  };
}
