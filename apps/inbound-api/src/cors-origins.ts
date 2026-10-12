import { appUrl, isProd } from "./env.js";

function normalise(origin: string): string {
  return origin.trim().replace(/\/$/, "");
}

export function isLocalOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin);
    return (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname.endsWith(".localhost")
    );
  } catch {
    return false;
  }
}

/**
 * Dashboard / auth API CORS (credentialed). Allowed: KANSO_APP_URL, the
 * comma-separated KANSO_CORS_ORIGINS, and localhost outside production.
 * Never reflects arbitrary origins. The widget API has its own per-key check.
 */
export function resolveCorsOrigin(requestOrigin: string): string | undefined {
  if (!requestOrigin) return undefined;
  const norm = normalise(requestOrigin);
  const allowed = new Set(
    [appUrl(), ...(process.env.KANSO_CORS_ORIGINS ?? "").split(",")]
      .map(normalise)
      .filter(Boolean),
  );
  if (allowed.has(norm)) return requestOrigin;
  if (!isProd() && isLocalOrigin(norm)) return requestOrigin;
  return undefined;
}

/** Widget allowlist match: exact origin, or "*.domain.tld" wildcard. */
export function originMatches(origin: string, allowed: readonly string[]): boolean {
  const norm = normalise(origin).toLowerCase();
  let host = "";
  let protocol = "";
  try {
    const u = new URL(norm);
    host = u.host;
    protocol = u.protocol;
  } catch {
    return false;
  }
  return allowed.some((raw) => {
    const a = normalise(raw).toLowerCase();
    if (!a) return false;
    if (a === norm) return true;
    const m = /^(https?:\/\/)?\*\.(.+)$/.exec(a);
    if (m) {
      const proto = m[1];
      if (proto && `${protocol}//` !== proto) return false;
      return host.endsWith(`.${m[2]}`) || host === m[2];
    }
    return false;
  });
}
