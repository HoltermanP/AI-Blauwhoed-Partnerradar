import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import NavLinks from "@/components/NavLinks";
import RolWisselaar from "@/components/RolWisselaar";
import { DEMO_GEBRUIKERS, GEBRUIKERSROL_LABEL, huidigeGebruiker } from "@/lib/auth";
import { demoModus } from "@/authjs";
import { uitloggen } from "@/lib/acties/sessie";
import { headers } from "next/headers";

export const metadata: Metadata = {
  title: "Blauwhoed Partnerdatabase",
  description: "Slimme partnerdatabase: factorenmodel, uitlegbare matching, historie als bewijs, discovery en teamsamenstelling."
};

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // De inlogpagina draait zonder sessie; alle andere pagina's worden door src/proxy.ts afgeschermd.
  const opInlogpagina = (await headers()).get("x-pr-pad")?.startsWith("/inloggen");
  const gebruiker = opInlogpagina ? null : await huidigeGebruiker();
  const demo = demoModus();
  return (
    <html lang="nl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@300;400;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <header className="topbar">
          <Link href="/" className="brandMark" aria-label="Blauwhoed">
            <img src="/brand/logo.png" alt="Blauwhoed" width={188} height={20} />
            <em>Partnerdatabase</em>
          </Link>
          {gebruiker ? <NavLinks beheerder={gebruiker.rol === "beheerder"} /> : null}
          {gebruiker && demo ? <RolWisselaar gebruikers={DEMO_GEBRUIKERS} huidig={gebruiker} /> : null}
          {gebruiker && !demo ? (
            <form action={uitloggen} className="gebruikerMenu">
              <span title={gebruiker.email}>
                {gebruiker.naam} · {GEBRUIKERSROL_LABEL[gebruiker.rol]}
              </span>
              <button type="submit" className="knop knop-tekst klein">
                Uitloggen
              </button>
            </form>
          ) : null}
        </header>
        <main className="pagina">{children}</main>
        <section className="footerBand" aria-label="Over Blauwhoed">
          <div>
            <p className="eyebrow">Samen ontwikkelen</p>
            <h2>Wij ontwikkelen buurten waar mensen graag wonen.</h2>
            <p>De partnerdatabase helpt projectteams om per opgave snel de juiste bouwers, architecten en adviseurs te vinden en actueel te houden.</p>
          </div>
          <a href="https://www.blauwhoed.nl" target="_blank" rel="noreferrer">
            Meer over Blauwhoed
          </a>
        </section>
        <footer className="voet">
          <img src="/brand/logo.png" alt="Blauwhoed" width={188} height={20} />
          <span>AI legt uit, AI beslist niet. Prospects komen nooit zonder menselijke goedkeuring in een advies.</span>
          <span>Alleen bedrijfsgegevens · AI-verrijking draait lokaal in een afgeschermde omgeving</span>
        </footer>
      </body>
    </html>
  );
}
