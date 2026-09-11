// Epic 4: projecthistorie als bewijs (US-18 import, US-20 gedrag over projecten, US-22 samenwerkingsnetwerk).
import Link from "next/link";
import CsvImport from "@/components/historie/CsvImport";
import WachtrijRegel from "@/components/historie/WachtrijRegel";
import { Badge, Kaart, Knop, Leeg, PaginaKop } from "@/components/ui";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { collaborationEdges, leidFactorenAf } from "@/lib/domain/derive";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { datum, euro, getal, ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";

export default async function HistoriePagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const partnerVan = (id: string) => db.partners.find((p) => p.id === id);
  const projectVan = (id: string) => db.projecten.find((p) => p.id === id);
  const filterPartner = sp.partner ?? "";
  const filterProject = sp.project ?? "";
  const filterRol = ROLLEN.includes(sp.rol as Rol) ? (sp.rol as Rol) : "";

  const engagements = db.engagements
    .filter((e) => (!filterPartner || e.partnerId === filterPartner) && (!filterProject || e.projectId === filterProject) && (!filterRol || e.rol === filterRol))
    .sort((a, b) => b.periode.van.localeCompare(a.periode.van));

  const afwijking = (raming?: number, eind?: number) => (raming && eind ? ((eind - raming) / raming) * 100 : null);

  const edges = collaborationEdges(db).sort((a, b) => b.aantal - a.aantal || (b.gemiddeldeScore ?? 0) - (a.gemiddeldeScore ?? 0));

  const gedrag = db.partners
    .map((p) => ({ partner: p, stat: leidFactorenAf(p, db).statistieken }))
    .filter((x) => x.stat.aantalProjecten > 0)
    .sort((a, b) => b.stat.aantalProjecten - a.stat.aantalProjecten);

  return (
    <>
      <PaginaKop eyebrow="Epic 4" titel="Historie" intro="Projecthistorie is het bewijs boven zelfbeeld: engagements, kostenvastheid, planningsbetrouwbaarheid en samenwerkingsnetwerk." acties={<Knop href="/api/export/historie" variant="secundair">Export (CSV)</Knop>} />

      <Kaart titel={`Engagements (${engagements.length})`}>
        <form className="formulier historieFilters" method="get">
          <div className="rij">
            <label>
              Partner
              <select name="partner" defaultValue={filterPartner}>
                <option value="">Alle</option>
                {db.partners.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Project
              <select name="project" defaultValue={filterProject}>
                <option value="">Alle</option>
                {db.projecten.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Rol
              <select name="rol" defaultValue={filterRol}>
                <option value="">Alle</option>
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="formulierActies">
            <button className="knop knop-secundair klein" type="submit">
              Filteren
            </button>
            <Link href="/historie" className="knop knop-tekst klein">
              Wissen
            </Link>
          </div>
        </form>
        {engagements.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Project</th>
                  <th>Partner</th>
                  <th>Rol</th>
                  <th>Periode</th>
                  <th className="num">Contractwaarde</th>
                  <th className="num">Raming</th>
                  <th className="num">Eindafrekening</th>
                  <th className="num">Afwijking</th>
                  <th>Oplevering gepland / werkelijk</th>
                  <th>Bron</th>
                </tr>
              </thead>
              <tbody>
                {engagements.map((e) => {
                  const afw = afwijking(e.ramingBijStart, e.eindafrekening);
                  return (
                    <tr key={e.id}>
                      <td>
                        <Link href={`/projecten/${e.projectId}`}>{projectVan(e.projectId)?.naam ?? e.projectId}</Link>
                      </td>
                      <td>
                        <Link href={`/partners/${e.partnerId}`}>{partnerVan(e.partnerId)?.naam ?? e.partnerId}</Link>
                      </td>
                      <td>{ROL_LABEL[e.rol]}</td>
                      <td>
                        {datum(e.periode.van)} – {e.periode.tot ? datum(e.periode.tot) : "lopend"}
                      </td>
                      <td className="num">{euro(e.contractwaarde)}</td>
                      <td className="num">{euro(e.ramingBijStart)}</td>
                      <td className="num">{euro(e.eindafrekening)}</td>
                      <td className="num">{afw === null ? "–" : <span className={afw > 5 ? "negatief" : afw < 0 ? "positief" : ""}>{afw > 0 ? "+" : ""}{getal(afw, 1)}%</span>}</td>
                      <td>
                        {datum(e.geplandeOplevering)} / {datum(e.werkelijkeOplevering)}
                      </td>
                      <td>
                        <Badge kleur={e.bron === "csv-import" ? "blauw" : "grijs"}>{e.bron}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel="Geen engagements gevonden" tekst="Pas de filters aan of importeer de projectadministratie." />
        )}
      </Kaart>

      <div className="raster raster-2">
        <Kaart titel="CSV-import projectadministratie (US-18)">
          <CsvImport magBewerken={magBewerken} />
        </Kaart>
        <Kaart titel={`Controlewachtrij (${db.importWachtrij.length})`}>
          {db.importWachtrij.length ? (
            <ul className="lijst">
              {db.importWachtrij.map((w) => (
                <WachtrijRegel key={w.id} item={w} magBewerken={magBewerken} />
              ))}
            </ul>
          ) : (
            <p className="muted">Geen onherleidbare regels. Regels zonder match op KVK, crediteurnummer, project of rol komen hier terecht.</p>
          )}
        </Kaart>
      </div>

      <div className="raster raster-2">
        <Kaart titel="Gedrag over projecten (US-20)">
          {gedrag.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th className="num">Projecten</th>
                    <th className="num">Kostenafwijking</th>
                    <th className="num">Planningsbetrouwbaarheid</th>
                    <th className="num">Evaluatiescore</th>
                  </tr>
                </thead>
                <tbody>
                  {gedrag.map(({ partner, stat }) => (
                    <tr key={partner.id}>
                      <td>
                        <Link href={`/partners/${partner.id}`}>{partner.naam}</Link>
                      </td>
                      <td className="num">{stat.aantalProjecten}</td>
                      <td className="num">{stat.kostenvastheid === null ? "–" : `${getal(stat.kostenvastheid, 1)}%`}</td>
                      <td className="num">{stat.planningsbetrouwbaarheid === null ? "–" : `${getal(stat.planningsbetrouwbaarheid)}%`}</td>
                      <td className="num">{stat.evaluatiescore === null ? "–" : `${getal(stat.evaluatiescore, 1)} / 5 (${stat.aantalEvaluaties})`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nog geen partners met engagements.</p>
          )}
          <p className="muted">Bron: projecthistorie en evaluaties (betrouwbaarheid 0,9); recente projecten wegen zwaarder. Kostenafwijking = gemiddelde |eindafrekening − raming| / raming; planningsbetrouwbaarheid = aandeel opgeleverd binnen 30 dagen na plan.</p>
        </Kaart>
        <Kaart titel="Samenwerkingsnetwerk (US-22)">
          {edges.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Partner A</th>
                    <th>Partner B</th>
                    <th className="num">Gezamenlijke projecten</th>
                    <th className="num">Gem. samenwerkingsscore</th>
                  </tr>
                </thead>
                <tbody>
                  {edges.map((e) => (
                    <tr key={`${e.a}-${e.b}`}>
                      <td>
                        <Link href={`/partners/${e.a}`}>{partnerVan(e.a)?.naam ?? e.a}</Link>
                      </td>
                      <td>
                        <Link href={`/partners/${e.b}`}>{partnerVan(e.b)?.naam ?? e.b}</Link>
                      </td>
                      <td className="num">{e.aantal}</td>
                      <td className="num">{e.gemiddeldeScore === null ? "–" : `${getal(e.gemiddeldeScore, 1)} / 5`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nog geen partners die samen op een project zaten.</p>
          )}
        </Kaart>
      </div>
    </>
  );
}
