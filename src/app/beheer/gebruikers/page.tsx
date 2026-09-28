// US-64/65: gebruikersbeheer. Twee rollen (gebruiker, beheerder); onbeperkt aantal gebruikers. Accounts ontstaan bij de eerste
// inlog via Microsoft Entra ID of worden vooraf aangemeld door de beheerder.
import Link from "next/link";
import { authGeconfigureerd, demoModus, toegestaneDomeinen } from "@/authjs";
import GebruikersBeheer from "@/components/beheer/GebruikersBeheer";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { eersteBeheerder } from "@/lib/sessie";
import { getDb } from "@/lib/store";

export default async function GebruikersPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const mag = heeftRecht(gebruiker.rol, "gebruikers_beheren");
  const lijst = [...(db.gebruikers ?? [])].sort((a, b) => (a.rol === b.rol ? a.naam.localeCompare(b.naam) : a.rol === "beheerder" ? -1 : 1));
  return (
    <>
      <PaginaKop eyebrow="Beheer" titel="Gebruikers" intro="Alleen medewerkers van Blauwhoed loggen in (Microsoft Entra ID). Het aantal gebruikers is onbeperkt; het budget gaat over AI-bewerkingen, niet over accounts." acties={<Link href="/beheer" className="knop knop-secundair">Terug naar beheer</Link>} />
      {!mag ? <Melding soort="waarschuwing">Alleen de beheerder beheert gebruikers.</Melding> : null}
      {demoModus() ? <Melding soort="info">Ontwikkelmodus zonder inlogconfiguratie: de demo-rolwisselaar is actief. In productie loggen medewerkers in via Microsoft Entra ID.</Melding> : null}
      <Kaart titel="Instellingen">
        <dl className="definities">
          <div><dt>Inloggen</dt><dd>{authGeconfigureerd() ? "Microsoft Entra ID (actief)" : "niet geconfigureerd"}</dd></div>
          <div><dt>Toegestane domeinen</dt><dd>{toegestaneDomeinen().map((d) => `@${d}`).join(", ")} (AUTH_TOEGESTANE_DOMEINEN)</dd></div>
          <div><dt>Eerste beheerder</dt><dd>{eersteBeheerder() || "niet ingesteld (EERSTE_BEHEERDER_EMAIL)"}</dd></div>
        </dl>
      </Kaart>
      <Kaart titel={`Gebruikers (${lijst.length})`}>
        <GebruikersBeheer gebruikers={lijst} mag={mag} eigenId={gebruiker.id} />
      </Kaart>
    </>
  );
}
