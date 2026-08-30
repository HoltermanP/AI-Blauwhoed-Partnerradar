import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import RolWisselaar from "@/components/RolWisselaar";
import { GEBRUIKERS, huidigeGebruiker } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Blauwhoed Partnerdatabase",
  description: "Slimme partnerdatabase: factorenmodel, uitlegbare matching, historie als bewijs, discovery en teamsamenstelling."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const gebruiker = await huidigeGebruiker();
  return (
    <html lang="nl">
      <body>
        <header className="topbar">
          <Link href="/" className="brandMark" aria-label="Blauwhoed">
            <span />
            Blauwhoed <em>Partnerdatabase</em>
          </Link>
          <NavLinks />
          <RolWisselaar gebruikers={GEBRUIKERS} huidig={gebruiker} />
        </header>
        <main className="pagina">{children}</main>
        <footer className="voet">
          <span>AI legt uit, AI beslist niet. Prospects komen nooit zonder menselijke goedkeuring in een advies.</span>
          <span>Alleen bedrijfsgegevens · AI-verrijking draait lokaal in een afgeschermde omgeving</span>
        </footer>
      </body>
    </html>
  );
}
