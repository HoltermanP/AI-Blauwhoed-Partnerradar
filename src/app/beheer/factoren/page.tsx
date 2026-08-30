// US-04: factoren beheren — toevoegen, hernoemen, type wijzigen, waardenlijst, samenvoegen, archiveren.
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { CATEGORIEEN } from "@/lib/domain/factors";
import { getDb } from "@/lib/store";
import { Melding, PaginaKop } from "@/components/ui";
import { FactorenBeheer, type FactorGebruik } from "@/components/beheer/FactorenBeheer";

export default async function FactorenPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBeheren = heeftRecht(gebruiker.rol, "beheer");

  const gebruik: Record<string, FactorGebruik> = {};
  db.factoren.forEach((f) => (gebruik[f.id] = { partners: 0, projecteisen: 0, profielen: 0 }));
  const tel = (id: string, veld: keyof FactorGebruik) => {
    if (!gebruik[id]) gebruik[id] = { partners: 0, projecteisen: 0, profielen: 0 };
    gebruik[id][veld] += 1;
  };
  db.partners.forEach((p) => new Set(p.factoren.map((pf) => pf.factorId)).forEach((id) => tel(id, "partners")));
  db.projecten.forEach((pr) => new Set(pr.eisen.flatMap((e) => e.eisen.map((rf) => rf.factorId))).forEach((id) => tel(id, "projecteisen")));
  db.gewichtsprofielen.forEach((gp) => new Set(Object.values(gp.perRol).flatMap((l) => (l ?? []).map((rf) => rf.factorId))).forEach((id) => tel(id, "profielen")));

  const categorieen = Array.from(new Set([...CATEGORIEEN, ...db.factoren.map((f) => f.categorie)]));

  return (
    <>
      <PaginaKop
        eyebrow="Beheer"
        titel="Factoren"
        intro="Het factorenmodel is configuratie: een nieuwe factor is een record, geen migratie. Archiveren haalt een factor uit nieuwe matchruns maar behoudt historie; samenvoegen hernoemt koppelingen en verwijdert niets."
      />
      {!magBeheren ? <Melding soort="waarschuwing">Alleen-lezen: rol {gebruiker.rol} heeft geen recht &lsquo;beheer&rsquo;.</Melding> : null}
      <FactorenBeheer factoren={db.factoren} categorieen={categorieen} gebruik={gebruik} magBeheren={magBeheren} />
    </>
  );
}
