// US-01 / US-02 / US-05: nieuwe partner vastleggen.
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { PLAATSEN } from "@/lib/domain/geo";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import PartnerFormulier from "@/components/partners/PartnerFormulier";

export default async function NieuwePartnerPagina() {
  const gebruiker = await huidigeGebruiker();
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  return (
    <>
      <PaginaKop eyebrow="Partners" titel="Nieuwe partner" intro="KVK-nummer is de unieke sleutel; dubbele nummers worden geweigerd. Vestigingsplaats wordt gegeocodeerd voor het regiofilter." />
      <Kaart>
        {magBewerken ? <PartnerFormulier id={null} plaatsen={Object.keys(PLAATSEN)} /> : <Melding soort="waarschuwing">Uw rol ({gebruiker.rol}) mag geen partners toevoegen.</Melding>}
      </Kaart>
    </>
  );
}
