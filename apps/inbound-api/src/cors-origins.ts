/**
 * KANSO_CORS_ORIGINS = comma-separated allowlist (e.g. https://www.cabinet.fr,http://127.0.0.1:3000).
 * Empty / unset → reflect request Origin (dev-friendly). Never return null for missing Origin on same-origin.
 */
export function resolveCorsOrigin(requestOrigin: string): string | undefined {
  const raw = process.env.KANSO_CORS_ORIGINS?.trim();
  if (!raw) {
    return requestOrigin || "*";
  }
  const allowed = raw
    .split(",")
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  if (!requestOrigin) return allowed[0] ?? "*";
  const norm = requestOrigin.replace(/\/$/, "");
  if (allowed.includes(norm) || allowed.includes("*")) return requestOrigin;
  return undefined;
}
