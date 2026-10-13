import { NextResponse, type NextRequest } from "next/server";

/**
 * Optimistic auth check only (no DB): send visitors without a session cookie
 * to the login page. Real authorization happens in the API on every call.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has("kanso_session")) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/connexion";
  url.search = `?suite=${encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/app/:path*", "/admin/:path*", "/compte/:path*"],
};
