// US-08 nieuw project; US-11 voorvullen uit projectdocument.
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { PLAATSEN } from "@/lib/domain/geo";
import { hoofdletter } from "@/lib/format";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import ProjectFormulier from "@/components/projecten/ProjectFormulier";

function plaatsLijst() {
  return Object.keys(PLAATSEN)
    .map((p) => p.split(" ").map(hoofdletter).join(" "))
    .sort((a, b) => a.localeCompare(b, "nl"));
}

export default async function NieuwProjectPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [gebruiker] = await Promise.all([huidigeGebruiker(), searchParams]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const vandaag = new Date();
  const start = new Date(vandaag.getFullYear() + 1, 0, 1).toISOString().slice(0, 10);
  const eind = new Date(vandaag.getFullYear() + 3, 11, 31).toISOString().slice(0, 10);

  return (
    <>
      <PaginaKop eyebrow="Projecten" titel="Nieuw project" intro="Leg het projectprofiel vast. Rollen, eisen en gewichten stelt u daarna in op de projectpagina." />
      {!magBewerken ? (
        <Kaart>
          <Melding soort="waarschuwing">U heeft geen recht &apos;bewerken&apos; en kunt geen project aanmaken.</Melding>
        </Kaart>
      ) : (
        <ProjectFormulier
          id={null}
          toonExtractie
          plaatsen={plaatsLijst()}
          initieel={{ naam: "", type: "appartementen", plaats: "", woningen: 50, prijssegment: ["middenhuur"], bouwstijl: "modern", ambitieDuurzaamheid: 3, start, eind, fase: "initiatief", omschrijving: "" }}
        />
      )}
    </>
  );
}
