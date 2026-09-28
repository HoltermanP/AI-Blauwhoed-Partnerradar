// US-64: alleen ingelogde medewerkers. Next.js 16 'proxy' (voorheen middleware) schermt alle pagina's en API's af, behalve
// de inlogpagina, de Auth.js-routes, de cron-route (eigen CRON_SECRET) en de Blob-uploadroute (eigen controle + webhook).
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { auth, authGeconfigureerd, demoModus } from "@/authjs";

const OPENBAAR = [/^\/inloggen(\/|$)/, /^\/api\/auth\//, /^\/api\/verrijking\/run$/, /^\/api\/blob\/upload$/];

function isOpenbaar(pad: string) {
  return OPENBAAR.some((r) => r.test(pad));
}

/** Geef het pad door aan de layout (die op de inlogpagina geen gebruiker ophaalt). */
function door(req: NextRequest) {
  const h = new Headers(req.headers);
  h.set("x-pr-pad", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: h } });
}

function naarInloggen(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/api/")) return NextResponse.json({ fout: "Niet ingelogd." }, { status: 401 });
  const url = new URL("/inloggen", req.url);
  if (req.nextUrl.pathname !== "/") url.searchParams.set("terug", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

const metAuth = auth((req) => (isOpenbaar(req.nextUrl.pathname) || req.auth?.user ? door(req) : naarInloggen(req)));

export default async function proxy(req: NextRequest, ev: NextFetchEvent) {
  if (!authGeconfigureerd()) {
    // Zonder inlogconfiguratie: alleen in ontwikkel-/demomodus open; in productie is de app dicht.
    if (demoModus() || isOpenbaar(req.nextUrl.pathname)) return door(req);
    return naarInloggen(req);
  }
  return (metAuth as unknown as (r: NextRequest, e: NextFetchEvent) => Promise<Response>)(req, ev);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|brand/).*)"]
};
