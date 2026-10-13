import { NextResponse, type NextRequest } from "next/server";

/**
 * 1. Routage multi-sites : en production chaque site a son domaine
 *    (KANSO_HOST_SOLUTIONS / _SITE / _PORTAIL, noms d'hôte sans schéma).
 *    Une requête sur ce domaine est réécrite vers /sites/<site>/… ; le domaine
 *    de Kanso Assistant (et tout hôte inconnu) sert la racine de l'app.
 * 2. Contrôle optimiste de session pour /app, /admin, /compte (l'autorisation
 *    réelle reste côté API à chaque appel).
 */
const HOSTS: Array<[envValue: string | undefined, prefix: string]> = [
  [process.env.KANSO_HOST_SOLUTIONS, "/sites/solutions"],
  [process.env.KANSO_HOST_SITE, "/sites/site"],
  [process.env.KANSO_HOST_PORTAIL, "/sites/portail"],
];

const PASSTHROUGH = /^\/(_next\/|api\/|brand\/|sites\/|favicon\.svg|robots\.txt|sitemap\.xml)/;

function siteFor(host: string): string | null {
  const h = host.toLowerCase().split(":")[0]!;
  for (const [value, prefix] of HOSTS) {
    if (value && value.toLowerCase() === h) return prefix;
  }
  return null;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  const prefix = siteFor(request.headers.get("host") ?? "");
  if (prefix && !PASSTHROUGH.test(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}${pathname === "/" ? "" : pathname}`;
    return NextResponse.rewrite(url);
  }
  // Les chemins /sites/* ne sont pas exposés tels quels sur un domaine de site.
  if (prefix && pathname.startsWith("/sites/")) return new NextResponse(null, { status: 404 });

  const protectedArea = /^\/(app|admin|compte)(\/|$)/.test(pathname);
  if (protectedArea && !request.cookies.has("kanso_session")) {
    const url = request.nextUrl.clone();
    url.pathname = "/connexion";
    url.search = `?suite=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
