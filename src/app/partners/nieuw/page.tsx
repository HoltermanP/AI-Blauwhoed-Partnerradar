// US-01 / US-02 / US-05: nieuwe partner vastleggen — handmatig, of laten registreren door AI (controle door beheerder vóór vrijgave).
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { aiBeschikbaar } from "@/lib/ai";
import { PLAATSEN } from "@/lib/domain/geo";
import { getDb } from "@/lib/store";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import PartnerFormulier from "@/components/partners/PartnerFormulier";
import AIRegistratie from "@/components/partners/AIRegistratie";

// Registratie door AI leest websites en roept het model aan; dat mag tot 60 s duren (Vercel).
export const maxDuration = 60;

export default async function NieuwePartnerPagina() {
  const [gebruiker, db] = await Promise.all([huidigeGebruiker(), getDb()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  return (
    <>
      <PaginaKop eyebrow="Partners" titel="Nieuwe partner" intro="KVK-nummer is de unieke sleutel; dubbele nummers worden geweigerd. Vestigingsplaats wordt gegeocodeerd voor het regiofilter." />
      {magBewerken ? (
        <>
          <Kaart titel="Laten registreren door AI">
            <AIRegistratie aiActief={aiBeschikbaar()} externeBronnen={db.instellingen.externeBronnenToegestaan} />
          </Kaart>
          <Kaart titel="Handmatig vastleggen">
            <PartnerFormulier id={null} plaatsen={Object.keys(PLAATSEN)} />
          </Kaart>
        </>
      ) : (
        <Kaart>
          <Melding soort="waarschuwing">Uw rol ({gebruiker.rol}) mag geen partners toevoegen.</Melding>
        </Kaart>
      )}
    </>
  );
}
