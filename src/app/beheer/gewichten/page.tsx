// US-10 / US-44: gewichtsprofielen met versiebeheer.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { Melding, PaginaKop } from "@/components/ui";
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
        intro="Standaardgewichten per projecttype en rol. Gewogen factoren tellen per rol op tot 100%. Elke wijziging is een nieuwe versie met toelichting en is terug te draaien (US-44)."
      />
      {!magBeheren ? <Melding soort="waarschuwing">Alleen-lezen: rol {gebruiker.rol} heeft geen recht &lsquo;beheer&rsquo;.</Melding> : null}
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
