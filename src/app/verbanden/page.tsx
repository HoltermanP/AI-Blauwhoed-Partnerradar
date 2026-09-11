// B7: verbanden tussen partijen en categorieën, altijd met bron en als signaal gepresenteerd.
import Link from "next/link";
import { filterOpRollen, leidVerbandenAf } from "@/lib/domain/verbanden";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Kaart, Leeg, Melding, PaginaKop } from "@/components/ui";

export default async function VerbandenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rolA = ROLLEN.includes(sp.rolA as Rol) ? (sp.rolA as Rol) : undefined;
  const rolB = ROLLEN.includes(sp.rolB as Rol) ? (sp.rolB as Rol) : undefined;
  const db = await getDb();
  const alle = leidVerbandenAf(db);
  const verbanden = filterOpRollen(alle, rolA, rolB).slice(0, 150);

  return (
    <>
      <PaginaKop eyebrow="Onderdeel 7" titel="Verbanden tussen partijen" intro={`${alle.length} afgeleide verbanden uit projecthistorie en openbare vermeldingen. Een verband is een signaal met bron — geen bevestigde samenwerking.`} />
      <Kaart titel="Filter op rolcombinatie">
        <form method="get" className="formulierActies">
          {(["rolA", "rolB"] as const).map((veld) => (
            <label key={veld}>
              {veld === "rolA" ? "Categorie A" : "Categorie B"}
              <select name={veld} defaultValue={(veld === "rolA" ? rolA : rolB) ?? ""}>
                <option value="">Alle rollen</option>
                {ROLLEN.map((r) => (
                  <option key={r} value={r}>
                    {ROL_LABEL[r]}
                  </option>
                ))}
              </select>
            </label>
          ))}
          <button type="submit" className="knop klein">Filteren</button>
          {rolA || rolB ? <Link href="/verbanden">Wissen</Link> : null}
        </form>
      </Kaart>
      <Kaart>
        <Melding soort="info">Elk verband is automatisch afgeleid (signaal) en toont de bron: een gedeeld project uit de eigen historie, of een naamsvermelding op een openbare bron. Beoordeel het zelf voordat je er conclusies aan verbindt.</Melding>
        {verbanden.length === 0 ? (
          <Leeg titel="Geen verbanden gevonden" tekst="Leg projecthistorie vast of verrijk partners; verbanden worden daaruit afgeleid." />
        ) : (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Partij A</th>
                  <th>Partij B</th>
                  <th>Soort</th>
                  <th>Bronnen</th>
                </tr>
              </thead>
              <tbody>
                {verbanden.map((v) => (
                  <tr key={`${v.a.id}-${v.b.id}`}>
                    <td>
                      <Link href={`/partners/${v.a.id}`}><b>{v.a.naam}</b></Link>
                      <div className="muted klein-tekst">{v.a.rollen.map((r) => ROL_LABEL[r]).join(", ")}</div>
                    </td>
                    <td>
                      <Link href={`/partners/${v.b.id}`}><b>{v.b.naam}</b></Link>
                      <div className="muted klein-tekst">{v.b.rollen.map((r) => ROL_LABEL[r]).join(", ")}</div>
                    </td>
                    <td><Badge kleur="geel">signaal · {v.bronnen.length} bron{v.bronnen.length === 1 ? "" : "nen"}</Badge></td>
                    <td className="klein-tekst">
                      {v.bronnen.slice(0, 4).map((b, i) => (
                        <div key={i}>{b.soort === "project" ? <>Gedeeld project: <Link href={`/projecten/${b.ref}`}>{b.label}</Link></> : b.label}</div>
                      ))}
                      {v.bronnen.length > 4 ? <div className="muted">… en {v.bronnen.length - 4} meer</div> : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Kaart>
    </>
  );
}
