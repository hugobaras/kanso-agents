/** Centralised runtime settings (read lazily so tests can set process.env). */

export function isProd(): boolean {
  return (process.env.KANSO_ENV ?? "local") === "production";
}

/** Public URL of the web app (dashboard + marketing), used in e-mails and CORS. */
export function appUrl(): string {
  return (process.env.KANSO_APP_URL ?? "http://localhost:3001").replace(/\/$/, "");
}

/** Public URL of the Kanso Portail site (own domain in production). */
export function portailUrl(): string {
  return (process.env.KANSO_PORTAIL_URL ?? appUrl()).replace(/\/$/, "");
}

/** Public URL of this API (widget script + widget API). */
export function apiPublicUrl(): string {
  return (
    process.env.KANSO_PUBLIC_URL ?? `http://localhost:${process.env.PORT ?? 3000}`
  ).replace(/\/$/, "");
}

export function masterKey(): string {
  const k = process.env.KANSO_MASTER_KEY;
  if (!k) throw new Error("KANSO_MASTER_KEY required");
  return k;
}

/** Legacy /v1/:tenantId + /portal routes for pilotes (D-131). */
export function legacyWidgetEnabled(): boolean {
  return process.env.KANSO_LEGACY_WIDGET === "1";
}

export function devToolsEnabled(): boolean {
  return !isProd() && process.env.KANSO_DEV_TOOLS !== "0";
}
