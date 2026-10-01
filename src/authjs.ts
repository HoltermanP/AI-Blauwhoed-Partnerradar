// US-64: echte authenticatie met Auth.js (next-auth v5) en Microsoft Entra ID (Blauwhoed-tenant).
// Alleen e-mailadressen uit de toegestane domeinen (AUTH_TOEGESTANE_DOMEINEN, standaard blauwhoed.nl) kunnen inloggen.
// Sessies zijn JWT-cookies; gebruikers en rollen staan in de eigen database (src/lib/sessie.ts). Deze module importeert
// bewust niets uit de store, zodat hij ook in src/proxy.ts bruikbaar is.
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

/** Tenant-ID uit de issuer (https://login.microsoftonline.com/<tenant-id>/v2.0/). Zonder vaste tenant geen inloggen. */
export function tenantId() {
  const m = (process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER ?? "").match(/login\.microsoftonline\.com\/([0-9a-f-]{36})\//i);
  return m ? m[1].toLowerCase() : null;
}

export function authGeconfigureerd() {
  // De issuer met een echte tenant-ID is verplicht: zonder valt Entra terug op /common/ en kunnen accounts uit andere
  // tenants (met een zelfgekozen e-mailclaim) inloggen.
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET && tenantId());
}

/**
 * Testfase: zonder inloggen met de demo-rolwisselaar (gebruiker/beheerder).
 * - AUTH_DEMO_MODUS=1: altijd open, ook als Entra ID al is ingericht;
 * - AUTH_DEMO_MODUS=0: altijd dicht (alleen inloggen; zonder Entra-configuratie is de app afgesloten);
 * - niet gezet: open zolang Entra ID niet is ingericht, daarna alleen inloggen.
 */
export function demoModus() {
  if (process.env.AUTH_DEMO_MODUS === "1") return true;
  if (process.env.AUTH_DEMO_MODUS === "0") return false;
  return !authGeconfigureerd();
}

export function toegestaneDomeinen(): string[] {
  return (process.env.AUTH_TOEGESTANE_DOMEINEN ?? "blauwhoed.nl")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export function emailToegestaan(email: string | null | undefined) {
  const domein = email?.toLowerCase().split("@")[1];
  return Boolean(domein && toegestaneDomeinen().includes(domein));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    MicrosoftEntraID({
      clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
      clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
      issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
    })
  ],
  session: { strategy: "jwt", maxAge: 12 * 60 * 60 },
  pages: { signIn: "/inloggen", error: "/inloggen" },
  trustHost: true,
  callbacks: {
    // Alleen eigen medewerkers: het account moet uit de Blauwhoed-tenant komen én een e-mailadres uit een toegestaan domein hebben.
    signIn({ user, profile }) {
      const tid = String(profile?.tid ?? "").toLowerCase();
      if (!tid || tid !== tenantId()) return false;
      const email = user.email ?? (profile?.email as string | undefined) ?? (profile?.preferred_username as string | undefined);
      return emailToegestaan(email);
    },
    jwt({ token, user, profile }) {
      if (user?.email) token.email = user.email.toLowerCase();
      else if (!token.email && profile?.preferred_username) token.email = String(profile.preferred_username).toLowerCase();
      return token;
    },
    session({ session, token }) {
      if (token.email && session.user) session.user.email = String(token.email);
      return session;
    }
  }
});
