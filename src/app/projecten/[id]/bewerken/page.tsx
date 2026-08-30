// US-08: project bewerken (zelfde formulier als nieuw).
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { PLAATSEN } from "@/lib/domain/geo";
import { hoofdletter } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import ProjectFormulier from "@/components/projecten/ProjectFormulier";

export default async function ProjectBewerkenPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const p = db.projecten.find((x) => x.id === id);
  if (!p) notFound();
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const plaatsen = Object.keys(PLAATSEN)
    .map((x) => x.split(" ").map(hoofdletter).join(" "))
    .sort((a, b) => a.localeCompare(b, "nl"));
  const plaats = plaatsen.find((x) => x.toLowerCase() === p.locatie.plaats.toLowerCase()) ?? p.locatie.plaats;

  return (
    <>
      <PaginaKop eyebrow="Projecten" titel={`Bewerken: ${p.naam}`} />
      {!magBewerken ? (
        <Kaart>
          <Melding soort="waarschuwing">U heeft geen recht &apos;bewerken&apos;.</Melding>
        </Kaart>
      ) : (
        <ProjectFormulier
          id={p.id}
          toonExtractie
          plaatsen={plaatsen}
          herkomstBestaand={p.herkomst}
          initieel={{ naam: p.naam, type: p.type, plaats, woningen: p.woningen, prijssegment: p.prijssegment, bouwstijl: p.bouwstijl, ambitieDuurzaamheid: p.ambitieDuurzaamheid, start: p.planning.start, eind: p.planning.eind, fase: p.fase, omschrijving: p.omschrijving }}
        />
      )}
    </>
  );
}
