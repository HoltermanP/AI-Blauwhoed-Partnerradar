import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import Zijbalk, { type Tellers } from "@/components/NavLinks";
import { getDb } from "@/lib/store";
import RolWisselaar from "@/components/RolWisselaar";
import TabelLabels from "@/components/TabelLabels";
import { DEMO_GEBRUIKERS, GEBRUIKERSROL_LABEL, huidigeGebruiker } from "@/lib/auth";
import { demoModus } from "@/authjs";
import { uitloggen } from "@/lib/acties/sessie";
import { headers } from "next/headers";
import { bepaalOmgeving, databaseAanduiding, OMGEVING_LABEL } from "@/lib/domain/omgeving";

export function generateMetadata(): Metadata {
  const omgeving = bepaalOmgeving();
  const productie = omgeving === "productie";
  return {
    title: productie ? "Blauwhoed Partnerdatabase" : `[${OMGEVING_LABEL[omgeving]}] Blauwhoed Partnerdatabase`,
    description: "Slimme partnerdatabase: factorenmodel, uitlegbare matching, historie als bewijs, discovery en teamsamenstelling.",
    // Test- en acceptatieomgevingen horen niet in zoekmachines.
    ...(productie ? {} : { robots: { index: false, follow: false } })
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // De inlogpagina draait zonder sessie; alle andere pagina's worden door src/proxy.ts afgeschermd.
  const opInlogpagina = (await headers()).get("x-pr-pad")?.startsWith("/inloggen");
  const gebruiker = opInlogpagina ? null : await huidigeGebruiker();
  const demo = demoModus();
  const omgeving = bepaalOmgeving();
  // Tellers in het menu: openstaand werk (de database staat in het geheugen, dit kost niets extra).
  let tellers: Tellers = {};
  if (gebruiker) {
    const db = await getDb();
    tellers = {
      voorstellen: db.verrijkingsvoorstellen.filter((v) => v.status === "open").length,
      kandidaten: db.kandidaten.filter((k) => k.status === "nieuw").length,
      vrijgave: db.partners.filter((p) => p.status === "concept").length + db.evaluaties.filter((e) => e.status === "ingediend").length
    };
  }
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
        <div className={gebruiker ? "appShell" : "appShell zonderMenu"}>
          {gebruiker ? (
            <Zijbalk
              beheerder={gebruiker.rol === "beheerder"}
              tellers={tellers}
              gebruiker={
                demo ? (
                  <RolWisselaar gebruikers={DEMO_GEBRUIKERS} huidig={gebruiker} />
                ) : (
                  <form action={uitloggen} className="gebruikerMenu">
                    <span title={gebruiker.email}>
                      <b>{gebruiker.naam}</b>
                      <small>{GEBRUIKERSROL_LABEL[gebruiker.rol]}</small>
                    </span>
                    <button type="submit" className="knop knop-tekst klein">
                      Uitloggen
                    </button>
                  </form>
                )
              }
            />
          ) : null}
          <div className="appInhoud">
            {omgeving !== "productie" ? (
              <div className={`omgevingBalk omgeving-${omgeving}`} role="note">
                <b>{OMGEVING_LABEL[omgeving]}omgeving</b>
                <span>Niet de echte partnerdatabase: wijzigingen hier komen niet in productie.</span>
                <span className="omgevingDb">database: {databaseAanduiding(process.env.DATABASE_URL)}</span>
              </div>
            ) : null}
            <main className="pagina">{children}</main>
            <footer className="voet">
              <span>AI legt uit, AI beslist niet. Prospects komen nooit zonder menselijke goedkeuring in een advies.</span>
              <span>
                Alleen bedrijfsgegevens, geen contactpersonen · <Link href="/privacy">Verwerking en privacy</Link> · <a href="https://www.blauwhoed.nl" target="_blank" rel="noreferrer">blauwhoed.nl</a>
              </span>
            </footer>
          </div>
        </div>
        <TabelLabels />
      </body>
    </html>
  );
}
