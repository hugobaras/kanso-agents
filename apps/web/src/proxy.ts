import { NextResponse, type NextRequest } from "next/server";

/**
 * Routage multi-sites et contrôle de session.
 *
 * Chemins réels (dev et production) :
 *   /            Kanso Solutions        /assistant/…  Kanso Assistant (vitrine)
 *   /site/…      Kanso Site             /portail/…    Kanso Portail
 *   /app, /admin, /compte, /connexion, /inscription… : application Kanso Assistant
 *
 * En production chaque site a son domaine (KANSO_HOST_SOLUTIONS / _ASSISTANT /
 * _SITE / _PORTAIL, noms d'hôte sans schéma) : le domaine d'un site sert ses
 * pages à la racine (réécriture vers /site, /portail, /assistant) et refuse
 * celles des autres sites. Sans hôte reconnu (localhost), aucune réécriture.
 * Le Portail est autonome : son domaine sert aussi l'authentification et
 * l'espace cabinet (/app, /connexion, /inscription…), comme l'Assistant.
 * L'en-tête x-kanso-product indique au rendu quel produit habille l'authentification.
 */
type SiteId = "solutions" | "assistant" | "site" | "portail";

const HOSTS: Array<[SiteId, string | undefined]> = [
  ["solutions", process.env.KANSO_HOST_SOLUTIONS],
  ["assistant", process.env.KANSO_HOST_ASSISTANT],
  ["site", process.env.KANSO_HOST_SITE],
  ["portail", process.env.KANSO_HOST_PORTAIL],
];

const ASSET = /^\/(_next\/|api\/|brand\/|favicon\.svg$|robots\.txt$|sitemap\.xml$)/;
const APP_AREA = /^\/(app|admin|compte|connexion|inscription|mot-de-passe|mot-de-passe-oublie|verifier-email|invitation)(\/|$)/;
const SITE_PREFIX = /^\/(assistant|site|portail)(\/|$)/;
const ESPACE = /^\/espace(\/|$)/;
const AUTH_AREA = /^\/(app|admin|compte)(\/|$)/;

function siteForHost(host: string): SiteId | null {
  const h = host.toLowerCase().split(":")[0]!;
  for (const [id, value] of HOSTS) if (value && value.toLowerCase() === h) return id;
  return null;
}

const notFound = () => new NextResponse(null, { status: 404 });

const PROD = process.env.NODE_ENV === "production";
let csp: string | null = null;
/** CSP lue au runtime : le widget est servi par l'API publique (KANSO_PUBLIC_URL), autre origine possible. */
function contentSecurityPolicy(): string {
  if (csp) return csp;
  let widget = "";
  try {
    widget = new URL(process.env.KANSO_PUBLIC_URL ?? "http://localhost:3000").origin;
  } catch {
    // invalid URL: widget not allowed
  }
  // shortcut: 'unsafe-inline' scripts (Next inline bootstrap); move to nonces if XSS risk grows.
  csp = [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${PROD ? "" : " 'unsafe-eval'"} ${widget}`,
    "style-src 'self' 'unsafe-inline'",
    `img-src 'self' data: blob: ${widget}`,
    "font-src 'self' data:",
    `connect-src 'self' ${widget}${PROD ? "" : " ws:"}`,
    "frame-src 'self' blob:",
    "frame-ancestors 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(PROD ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  return csp;
}

function secured(res: NextResponse, pathname: string): NextResponse {
  if (pathname.startsWith("/api/")) return res;
  res.headers.set("Content-Security-Policy", contentSecurityPolicy());
  // Browsers ignore HSTS over plain http, so it is safe to always send in production.
  if (PROD) res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}

export function proxy(request: NextRequest) {
  return secured(route(request), request.nextUrl.pathname);
}

function route(request: NextRequest): NextResponse {
  const { pathname, search } = request.nextUrl;
  const site = siteForHost(request.headers.get("host") ?? "");

  if (site && !ASSET.test(pathname)) {
    if (ESPACE.test(pathname)) {
      // Espace client du Portail : uniquement sur le domaine du Portail (ou en local).
      if (site !== "portail") return notFound();
    } else if (site === "solutions") {
      if (SITE_PREFIX.test(pathname) || APP_AREA.test(pathname)) return notFound();
    } else if (site === "assistant") {
      if (SITE_PREFIX.test(pathname)) return notFound();
      if (!APP_AREA.test(pathname)) {
        const url = request.nextUrl.clone();
        url.pathname = `/assistant${pathname === "/" ? "" : pathname}`;
        return NextResponse.rewrite(url);
      }
    } else if (site === "portail" && APP_AREA.test(pathname)) {
      // Espace cabinet et authentification du Portail : servis tels quels.
    } else {
      if (SITE_PREFIX.test(pathname) || APP_AREA.test(pathname)) return notFound();
      const url = request.nextUrl.clone();
      url.pathname = `/${site}${pathname === "/" ? "" : pathname}`;
      return NextResponse.rewrite(url);
    }
  }

  const portailAuth = site === "portail" || request.nextUrl.searchParams.get("produit") === "portail";
  const headers = new Headers(request.headers);
  headers.set("x-kanso-product", portailAuth ? "portail" : "assistant");

  // Contrôle optimiste : l'autorisation réelle reste côté API à chaque appel.
  if (AUTH_AREA.test(pathname) && !request.cookies.has("kanso_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suite=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next({ request: { headers } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
