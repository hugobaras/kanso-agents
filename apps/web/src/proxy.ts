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

export function proxy(request: NextRequest) {
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
