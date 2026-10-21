import { getEntitlements } from "@kanso/billing";
import { getPool, requireTenantId } from "@kanso/tenancy";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { appUrl, isProd, portailUrl } from "../env.js";
import { isLocalOrigin } from "../cors-origins.js";
import { HttpError, forbidden } from "../http/errors.js";
import type { AppEnv, Role, SessionUser, WorkspaceContext } from "../http/types.js";
import { SESSION_COOKIE, resolveSession } from "./service.js";

const ROLE_RANK: Record<Role, number> = { member: 1, admin: 2, owner: 3 };

export function setSessionCookie(c: Context, rawToken: string, expiresAt: Date) {
  setCookie(c, SESSION_COOKIE, rawToken, {
    httpOnly: true,
    secure: isProd(),
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
}

export function clearSessionCookie(c: Context) {
  deleteCookie(c, SESSION_COOKIE, { path: "/" });
}

export function sessionToken(c: Context): string | undefined {
  return getCookie(c, SESSION_COOKIE);
}

/** Loads the user if a valid session cookie is present (never rejects). */
export const loadSession: MiddlewareHandler<AppEnv> = async (c, next) => {
  const user = await resolveSession(getPool(), sessionToken(c));
  if (user) c.set("user", user);
  await next();
};

export function currentUser(c: Context<AppEnv>): SessionUser {
  const u = c.get("user");
  if (!u) throw new HttpError(401, "unauthorized", "Connexion requise.");
  return u;
}

export const requireUser: MiddlewareHandler<AppEnv> = async (c, next) => {
  currentUser(c);
  await next();
};

export const requireStaff: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!currentUser(c).is_staff) throw forbidden("staff_only");
  await next();
};

/**
 * CSRF guard for cookie-authenticated mutations: the Origin (or Referer) must
 * be the app itself. SameSite=Lax already blocks most cross-site POSTs; this
 * closes the remaining gaps (subdomains, older browsers).
 */
export const csrfGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();
  const origin = c.req.header("origin") ?? refererOrigin(c.req.header("referer"));
  if (!origin) {
    // Same-origin server-to-server calls (Next.js server actions/route handlers)
    // forward cookies without Origin; accept only with the internal header.
    if (c.req.header("x-kanso-internal") === "1") return next();
    throw forbidden("csrf_origin_missing");
  }
  const allowed = [appUrl(), portailUrl(), ...(process.env.KANSO_CORS_ORIGINS ?? "").split(",")]
    .map((s) => s.trim().replace(/\/$/, ""))
    .filter(Boolean);
  const norm = origin.replace(/\/$/, "");
  if (allowed.includes(norm) || (!isProd() && isLocalOrigin(norm))) return next();
  throw forbidden("csrf_origin_mismatch");
};

function refererOrigin(ref: string | undefined): string | undefined {
  if (!ref) return undefined;
  try {
    return new URL(ref).origin;
  } catch {
    return undefined;
  }
}

/**
 * Resolves `:workspace` against the user's memberships (staff may access any
 * workspace read-only for support). Puts tenant + role + entitlements on ctx.
 */
export function requireWorkspace(minRole: Role = "member"): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = currentUser(c);
    const tenantId = requireTenantId(c.req.param("workspace"));
    const pool = getPool();
    const res = await pool.query<{ role: Role; display_name: string; profession: string | null; deleted_at: Date | null }>(
      `select m.role, t.display_name, t.profession, t.deleted_at
       from tenants t left join memberships m on m.tenant_id = t.tenant_id and m.user_id = $2
       where t.tenant_id = $1`,
      [tenantId, user.id],
    );
    const row = res.rows[0];
    // Same 404 for "missing" and "not a member" — no workspace enumeration.
    if (!row || (row.deleted_at && new Date(row.deleted_at).getTime() <= Date.now()) || (!row.role && !user.is_staff)) {
      throw new HttpError(404, "workspace_not_found");
    }
    if (!row.role && c.req.method !== "GET") {
      throw forbidden("support_read_only", "Accès support en lecture seule.");
    }
    const role: Role = row.role ?? "member";
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
      throw forbidden("insufficient_role", "Cette action est réservée aux administrateurs de l'espace.");
    }
    const ws: WorkspaceContext = {
      tenantId,
      displayName: row.display_name,
      role,
      profession: row.profession,
      entitlements: await getEntitlements(pool, tenantId),
    };
    c.set("workspace", ws);
    await next();
  };
}

export function currentWorkspace(c: Context<AppEnv>): WorkspaceContext {
  const ws = c.get("workspace");
  if (!ws) throw new Error("requireWorkspace middleware missing");
  return ws;
}

export function assertRole(c: Context<AppEnv>, minRole: Role) {
  if (ROLE_RANK[currentWorkspace(c).role] < ROLE_RANK[minRole]) {
    throw forbidden("insufficient_role", "Cette action est réservée aux administrateurs de l'espace.");
  }
}

export function assertModule(c: Context<AppEnv>, module: "inbound" | "document_to_action" | "portail") {
  if (!currentWorkspace(c).entitlements.modules[module]) {
    throw forbidden(
      "module_not_in_plan",
      module === "portail" ? "Kanso Portail n'est pas encore activé pour votre espace." : "Ce module n'est pas inclus dans votre offre.",
    );
  }
}

/** Mutations require an active subscription (read-only after trial expiry). */
export function assertActive(c: Context<AppEnv>) {
  if (!currentWorkspace(c).entitlements.active) {
    throw new HttpError(402, "subscription_inactive", "Votre essai est terminé : choisissez une offre pour continuer.");
  }
}

/**
 * Sessions support (staff connecté en tant qu'un client) : jamais de contenu de
 * pièces ni d'export, aucune action au nom du cabinet sur la facturation,
 * l'équipe, la confidentialité ou les dossiers du Portail. Le Portail n'est
 * visible que pour ses réglages : les dossiers relèvent du secret professionnel.
 * path est relatif à /api/app/:workspace.
 */
export function supportForbidden(method: string, path: string): boolean {
  if (/\/(file|export)(\/|$)|\/files\/|\.csv$/.test(path)) return true;
  if (/^\/portail(\/|$)/.test(path)) return !(method === "GET" && /^\/portail(\/(settings|templates))?\/?$/.test(path));
  if (method !== "GET" && /^\/(billing|team|settings\/(privacy|delete))(\/|$)/.test(path)) return true;
  return false;
}

export const supportGuard: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (c.get("user")?.impersonator_user_id) {
    const rest = c.req.path.replace(/^\/api\/app\/[^/]+/, "") || "/";
    if (supportForbidden(c.req.method, rest)) {
      throw forbidden("support_restricted", "Action indisponible en session support : elle reste réservée au cabinet.");
    }
  }
  await next();
};

export function actorLabel(c: Context<AppEnv>): string {
  const u = currentUser(c);
  return u.impersonator_user_id ? `support:${u.impersonator_user_id}→${u.email}` : u.email;
}
