// US-10 / US-44: gewichtsprofielen met versiebeheer.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Kaart, Melding, PaginaKop } from "@/components/ui";
import StandaardwegingEditor from "@/components/beheer/StandaardwegingEditor";
import { GewichtenEditor } from "@/components/beheer/GewichtenEditor";

export default async function GewichtenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { profiel } = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");
  const factoren = db.factoren;
  const gebruikInProjecten = (id: string) => db.projecten.filter((p) => p.gewichtsprofielId === id).length;

  return (
    <>
      <PaginaKop
        eyebrow="Beheer"
        titel="Gewichtsprofielen"
        intro="Standaardgewichten per projecttype en rol. Gewogen factoren tellen per rol op tot 100%. Elke wijziging is een nieuwe versie met toelichting en is terug te draaien."
      />
      {!magBeheren ? <Melding soort="waarschuwing">Alleen-lezen: rol {gebruiker.rol} heeft geen recht &lsquo;beheer&rsquo;.</Melding> : null}
      {/* US-17/US-21: standaardweging, inclusief eigen ervaring en samenwerkingsverbanden. */}
      <Kaart titel="Standaardweging">
        <StandaardwegingEditor
          eigenErvaring={db.instellingen.standaardweging?.eigenErvaring ?? 20}
          samenwerking={db.instellingen.standaardweging?.samenwerking ?? 25}
          profielId={db.instellingen.standaardGewichtsprofielId}
          dekkingDemping={db.instellingen.dekkingDemping !== false}
          profielen={db.gewichtsprofielen.map((g) => ({ id: g.id, naam: g.naam }))}
          magBeheren={magBeheren}
          vastgesteld={db.instellingen.standaardweging?.vastgesteldOp ? `Laatst vastgesteld door ${db.instellingen.standaardweging.vastgesteldDoor} op ${new Date(db.instellingen.standaardweging.vastgesteldOp).toLocaleDateString("nl-NL")}` : "Nog niet vastgesteld: de profielen gebruiken hun eigen startweging."}
        />
      </Kaart>
      <nav className="tabs" aria-label="Profielen">
        {db.gewichtsprofielen.map((gp) => (
          <Link key={gp.id} href={`/beheer/gewichten?profiel=${gp.id}`} className={(profiel ?? db.gewichtsprofielen[0]?.id) === gp.id ? "active" : ""} scroll={false}>
            {gp.naam}
            <span>v{gp.versie}</span>
          </Link>
        ))}
      </nav>
      {db.gewichtsprofielen
        .filter((gp) => gp.id === (profiel ?? db.gewichtsprofielen[0]?.id))
        .map((gp) => (
          <GewichtenEditor key={`${gp.id}-${gp.versie}`} profiel={gp} factoren={factoren} magBeheren={magBeheren} inProjecten={gebruikInProjecten(gp.id)} />
        ))}
    </>
  );
}
