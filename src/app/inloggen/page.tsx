// US-64: inlogpagina. Alleen medewerkers van Blauwhoed (toegestane e-maildomeinen) kunnen inloggen via Microsoft Entra ID.
import { redirect } from "next/navigation";
import { authGeconfigureerd, demoModus, toegestaneDomeinen } from "@/authjs";
import { inloggenMicrosoft } from "@/lib/acties/sessie";
import { Kaart, Melding } from "@/components/ui";

const FOUTEN: Record<string, string> = {
  domein: "Dit account hoort niet bij een toegestaan e-maildomein. Alleen medewerkers van Blauwhoed hebben toegang.",
  AccessDenied: "Toegang geweigerd: alleen medewerkers van Blauwhoed (toegestane e-maildomeinen) kunnen inloggen.",
  geblokkeerd: "Uw account is door een beheerder gedeactiveerd. Neem contact op met de beheerder van de partnerdatabase.",
  Configuration: "De inlogkoppeling is niet goed ingesteld. Neem contact op met de beheerder."
};

export default async function InlogPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  if (demoModus()) redirect("/");
  const fout = sp.fout ?? sp.error;
  return (
    <div className="inlogPagina">
      <Kaart titel="Inloggen">
        <p>De partnerdatabase is alleen toegankelijk voor medewerkers van Blauwhoed. Log in met uw Microsoft-account ({toegestaneDomeinen().map((d) => `@${d}`).join(", ")}).</p>
        {fout ? <Melding soort="fout">{FOUTEN[fout] ?? "Inloggen is niet gelukt. Probeer het opnieuw."}</Melding> : null}
        {authGeconfigureerd() ? (
          <form action={inloggenMicrosoft}>
            <button type="submit" className="knop">
              Inloggen met Microsoft
            </button>
          </form>
        ) : (
          <Melding soort="waarschuwing">
            Inloggen is nog niet geconfigureerd. Stel AUTH_SECRET, AUTH_MICROSOFT_ENTRA_ID_ID, AUTH_MICROSOFT_ENTRA_ID_SECRET en AUTH_MICROSOFT_ENTRA_ID_ISSUER in (zie README). Tot die tijd is de applicatie afgesloten.
          </Melding>
        )}
      </Kaart>
    </div>
  );
}
