// US-64: echte authenticatie met Auth.js (next-auth v5) en Microsoft Entra ID (Blauwhoed-tenant).
// Alleen e-mailadressen uit de toegestane domeinen (AUTH_TOEGESTANE_DOMEINEN, standaard blauwhoed.nl) kunnen inloggen.
// Sessies zijn JWT-cookies; gebruikers en rollen staan in de eigen database (src/lib/sessie.ts). Deze module importeert
// bewust niets uit de store, zodat hij ook in src/proxy.ts bruikbaar is.
import NextAuth from "next-auth";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";

export function authGeconfigureerd() {
  return Boolean(process.env.AUTH_SECRET && process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET);
}

/** Demo-rolwisselaar zonder inloggen: alleen in ontwikkelmodus, of expliciet met AUTH_DEMO_MODUS=1 (nooit standaard in productie). */
export function demoModus() {
  if (authGeconfigureerd()) return false;
  return process.env.NODE_ENV !== "production" || process.env.AUTH_DEMO_MODUS === "1";
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
    // Alleen eigen medewerkers: e-mail moet uit een toegestaan domein komen.
    signIn({ user, profile }) {
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
