// Overzicht van alle factoren met schaal, waardenlijst, rollen en de grenswaarden die het systeem hanteert
// (harde drempels, gevraagde waarden per gewichtsprofiel, betrouwbaarheid per bron). Leesbaar voor elke rol; beheren via /beheer/factoren.
import Link from "next/link";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { CATEGORIEEN } from "@/lib/domain/factors";
import { DEKKING_WAARSCHUWING } from "@/lib/domain/matching";
import type { Factor, Gewichtsprofiel, Rol } from "@/lib/domain/types";
import { BRON_BETROUWBAARHEID, ROLLEN } from "@/lib/domain/types";
import { ROL_LABEL, waardeTekst } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Definities, Kaart, Knop, PaginaKop } from "@/components/ui";

function schaalTekst(f: Factor) {
  const s = f.schaal;
  switch (s.soort) {
    case "niveau":
      return "Ervaringsniveau 0–5 (hoger is beter; eis = minimaal gevraagd niveau)";
    case "getal":
      return `Getal in ${s.eenheid}${s.min !== undefined || s.max !== undefined ? `, bereik ${s.min ?? "…"}–${s.max ?? "…"}` : ""} (${s.lagerIsBeter ? "lager is beter" : "hoger is beter"})`;
    case "percentage":
      return `Percentage 0–100 (${s.lagerIsBeter ? "lager is beter" : "hoger is beter"})`;
    case "bereik":
      return `Bandbreedte min–max in ${s.eenheid}; projectwaarde moet erbinnen vallen`;
    case "keuze":
      return `Keuze uit waardenlijst${s.meervoudig ? " (meervoudig)" : ""}`;
    case "boolean":
      return "Ja / nee";
    case "tekst":
      return "Vrije tekst, alleen semantisch vergeleken";
  }
}

const TYPE_KLEUR = { hard: "rood", gewogen: "blauw", semantisch: "mint" } as const;

function drempelsUitProfielen(f: Factor, profielen: Gewichtsprofiel[]) {
  const regels: string[] = [];
  profielen.forEach((p) =>
    (Object.keys(p.perRol) as Rol[]).forEach((rol) => {
      p.perRol[rol]?.filter((e) => e.factorId === f.id).forEach((e) => {
        const optie = e.optieId ? f.opties?.find((o) => o.id === e.optieId)?.label : undefined;
        const richting = f.schaal.soort !== "niveau" && "lagerIsBeter" in f.schaal && f.schaal.lagerIsBeter ? "≤" : "≥";
        regels.push(`${p.naam} · ${ROL_LABEL[rol]}: ${optie ? `${optie} ` : ""}${richting} ${waardeTekst(e.gevraagd)} (${e.gewicht}%${e.minimumeis ? ", minimumeis" : ""})`);
      });
    })
  );
  return regels;
}

export default async function FactorenPagina() {
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const actief = db.factoren.filter((f) => f.actief);
  const gebruikt = (f: Factor) => db.partners.filter((p) => p.factoren.some((x) => x.factorId === f.id)).length;

  return (
    <>
      <PaginaKop
        eyebrow="Factorenmodel"
        titel="Factoren en grenswaarden"
        intro={`${actief.length} actieve factoren in ${CATEGORIEEN.length} categorieën. Hard = filter vooraf (afvallen met melding), gewogen = telt mee in de score 0–100 met instelbaar gewicht, semantisch = vergelijking op tekst en referenties.`}
        acties={heeftRecht(gebruiker.rol, "beheer") ? <Knop href="/beheer/factoren" variant="secundair">Factoren beheren</Knop> : null}
      />

      <div className="raster raster-2">
        <Kaart titel="Systeemgrenswaarden (harde drempels)">
          <Definities
            items={[
              ["Werkgebied", "Projectlocatie buiten de straal (km) van de partner → uitsluiting"],
              ["Projectomvang", "Buiten de bandbreedte: historie 0,5× kleinste – 2× grootste gerealiseerde omvang, opgave 0,5×–1,5× typische omvang (samengevoegd) → uitsluiting"],
              ["Gelijktijdige projecten", "Lopende projecten ≥ maximum gelijktijdig → uitsluiting"],
              ["Beschikbaarheid", "Periode 'niet beschikbaar' overlapt de projectplanning → uitsluiting"],
              ["Financieel risico", "Risicoklasse 'hoog' → uitsluiting; 'midden' → waarschuwing"],
              ["Status", "Geblokkeerd (tot einddatum) of afgewezen → uitsluiting; prospect → apart, nooit in het advies"],
              ["Certificaten", "Verlopen certificaat telt niet mee in de score; binnen 90 dagen verlopen → waarschuwing"],
              ["Dekkingsgraad", `Onder ${DEKKING_WAARSCHUWING}% van het gewicht op bekende data → waarschuwing bij de kandidaat; ontbrekende factoren tellen niet als 0 maar worden herverdeeld`],
              ["Afhankelijkheid", "Blauwhoed ≥ 30% van de jaaromzet → waarschuwing, ≥ 50% → kritiek"],
              ["Onmisbaarheid", "Eén partner > 60% van de contractwaarde van een project → signaal"],
              ["Planningsbetrouwbaarheid", "Opgeleverd binnen 30 dagen na de geplande datum telt als 'op tijd'"],
              ["Recentheid", "Projecten ≤ 2 jaar wegen 100%, aflopend naar 40% bij 5 jaar, daarna 25%"],
              ["Semantiek", "Semantische gelijkenis weegt maximaal 40% van de eindscore, standaard 15–20%"],
              ["Weging", "Vuistregel: niet meer dan zes factoren boven 10%; gewichten per rol tellen op tot 100%"]
            ]}
          />
        </Kaart>
        <Kaart titel="Betrouwbaarheid per bron (bewijs boven zelfbeeld)">
          <table className="tabel">
            <thead>
              <tr>
                <th>Bron</th>
                <th className="num">Standaard betrouwbaarheid</th>
                <th>Effect op de score</th>
              </tr>
            </thead>
            <tbody>
              {(Object.entries(BRON_BETROUWBAARHEID) as Array<[string, number]>)
                .sort((a, b) => b[1] - a[1])
                .map(([bron, b]) => (
                  <tr key={bron}>
                    <td>
                      <b>{bron}</b>
                    </td>
                    <td className="num">{Math.round(b * 100)}%</td>
                    <td className="muted klein-tekst">Fit wordt gedempt richting neutraal (50%) met factor {(0.5 + 0.5 * b).toFixed(2)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
          <p className="muted klein-tekst" style={{ marginTop: 12 }}>
            Afgeleide waarden uit projecthistorie en evaluaties winnen van een opgave, tenzij een beheerder de waarde expliciet overschrijft. Risicoklasse volgt uit kerncijfers: omzetdaling &gt; 20%, solvabiliteit &lt; 20/30%, deponering ouder dan 400 dagen, betalingsgedrag en negatief eigen vermogen tellen punten; ≥ 4 punten = hoog, ≥ 2 = midden.
          </p>
        </Kaart>
      </div>

      {CATEGORIEEN.map((cat) => {
        const lijst = actief.filter((f) => f.categorie === cat);
        if (!lijst.length) return null;
        return (
          <Kaart key={cat} titel={cat}>
            <div className="tabelWrap">
              <table className="tabel factorTabel">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>Factor</th>
                    <th>Type</th>
                    <th>Schaal</th>
                    <th>Waardenlijst</th>
                    <th>Rollen</th>
                    <th>Grenswaarden in gewichtsprofielen</th>
                    <th className="num">Partners met waarde</th>
                  </tr>
                </thead>
                <tbody>
                  {lijst.map((f) => {
                    const drempels = drempelsUitProfielen(f, db.gewichtsprofielen);
                    return (
                      <tr key={f.id}>
                        <td>
                          <b>{f.code}</b>
                        </td>
                        <td>
                          <b>{f.naam}</b>
                          <br />
                          <small className="muted">{f.omschrijving}</small>
                          {f.afgeleid ? (
                            <>
                              {" "}
                              <Badge kleur="groen">afgeleid uit historie</Badge>
                            </>
                          ) : null}
                        </td>
                        <td>
                          <Badge kleur={TYPE_KLEUR[f.type]}>{f.type}</Badge>
                        </td>
                        <td className="klein-tekst">{schaalTekst(f)}</td>
                        <td>{f.opties?.length ? f.opties.filter((o) => o.actief).map((o) => <span key={o.id} className="chip">{o.label}</span>) : <span className="muted">–</span>}</td>
                        <td className="klein-tekst">{f.rollen.length ? f.rollen.map((r) => ROL_LABEL[r]).join(", ") : "Alle rollen"}</td>
                        <td className="klein-tekst">
                          {drempels.length ? (
                            <ul className="lijst">
                              {drempels.map((d) => (
                                <li key={d}>{d}</li>
                              ))}
                            </ul>
                          ) : (
                            <span className="muted">Niet in standaardprofielen; per project instelbaar</span>
                          )}
                        </td>
                        <td className="num">
                          <Link href={`/partners?k=${f.id}::`}>{gebruikt(f)}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Kaart>
        );
      })}
      <p className="muted klein-tekst">
        Rollen: {ROLLEN.map((r) => ROL_LABEL[r]).join(", ")}. Gewichtsprofielen en hun versies: <Link href="/beheer/gewichten">Beheer → Gewichten</Link>.
      </p>
    </>
  );
}
