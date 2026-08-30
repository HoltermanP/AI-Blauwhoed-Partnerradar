// US-01 / US-02 / US-05: partner bewerken.
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { PLAATSEN } from "@/lib/domain/geo";
import { getDb } from "@/lib/store";
import { Kaart, Knop, Melding, PaginaKop } from "@/components/ui";
import PartnerFormulier from "@/components/partners/PartnerFormulier";

export default async function BewerkPartnerPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const p = db.partners.find((x) => x.id === id);
  if (!p) notFound();
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  return (
    <>
      <PaginaKop eyebrow="Partners" titel={`${p.naam} bewerken`} acties={<Knop href={`/partners/${p.id}`} variant="secundair">Terug naar dossier</Knop>} />
      <Kaart>
        {magBewerken ? (
          <PartnerFormulier
            id={p.id}
            plaatsen={Object.keys(PLAATSEN)}
            begin={{
              naam: p.naam,
              kvk: p.kvk,
              rechtsvorm: p.rechtsvorm,
              vestigingsplaats: p.vestigingsplaats,
              adres: p.adres,
              werkgebiedKm: p.werkgebiedKm,
              rollen: p.rollen,
              website: p.website,
              omschrijving: p.omschrijving,
              referenties: p.referenties,
              omzet: p.omzet,
              medewerkers: p.medewerkers,
              maxGelijktijdigeProjecten: p.maxGelijktijdigeProjecten,
              typischeProjectomvang: p.typischeProjectomvang,
              tags: p.tags
            }}
          />
        ) : (
          <Melding soort="waarschuwing">Uw rol ({gebruiker.rol}) mag partners niet bewerken.</Melding>
        )}
      </Kaart>
    </>
  );
}
