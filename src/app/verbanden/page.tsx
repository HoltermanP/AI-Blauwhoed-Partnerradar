// B7: verbanden tussen partijen en categorieën, altijd met bron en als signaal gepresenteerd.
import Link from "next/link";
import { bevestiging, filterOpRollen, leidVerbandenAf, teamCombinaties } from "@/lib/domain/verbanden";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import SamenwerkingBevestigen from "@/components/verbanden/SamenwerkingBevestigen";
import ExternProjectFormulier from "@/components/verbanden/ExternProjectFormulier";
import { ROLLEN, type Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { getDb } from "@/lib/store";
import { Badge, Disclaimer, Kaart, Leeg, PaginaKop } from "@/components/ui";
import VerbandAnalyse from "@/components/verbanden/VerbandAnalyse";
import { aiAan } from "@/lib/aiplatform";

const VERBAND_DISCLAIMER = "Verbanden zijn uit bronnen afgeleide signalen: een gedeeld project uit de eigen historie of een naamsvermelding op een openbare bron. Een signaal is geen bevestigde samenwerking; alleen een beheerder bevestigt een samenwerking, met de grond daarvoor. Niet bedoeld voor extern gebruik (art. 11.4). Bij elk verband staat de bron.";

export default async function VerbandenPagina({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const rolA = ROLLEN.includes(sp.rolA as Rol) ? (sp.rolA as Rol) : undefined;
  const rolB = ROLLEN.includes(sp.rolB as Rol) ? (sp.rolB as Rol) : undefined;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const magBevestigen = heeftRecht(gebruiker.rol, "beheer");
  const alle = leidVerbandenAf(db);
  const teams = teamCombinaties(db);
  const alleenExtern = sp.extern === "1";
  const gefilterd = filterOpRollen(alle, rolA, rolB).filter((v) => !alleenExtern || v.bronnen.some((b) => /extern project/.test(b.label)));
  const verbanden = gefilterd.slice(0, 500);

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
          <label className="vinkjes" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
            <input type="checkbox" name="extern" value="1" defaultChecked={alleenExtern} /> Alleen uit externe projecten
          </label>
          <button type="submit" className="knop klein">Filteren</button>
          {rolA || rolB || alleenExtern ? <Link href="/verbanden">Wissen</Link> : null}
        </form>
      </Kaart>
      <Kaart titel="Externe projecten als bron" acties={<span className="muted klein-tekst">{db.projecten.filter((p) => p.extern).length} vastgelegd</span>}>
        <p className="muted klein-tekst">Projecten buiten de eigen portefeuille (openbare projectpagina, persbericht, vakblad of een LinkedIn-bericht als bronvermelding) leveren samenwerkingssignalen op tussen de betrokken partijen, altijd met de bron. LinkedIn wordt niet automatisch gelezen.</p>
        {heeftRecht(gebruiker.rol, "bewerken") ? <ExternProjectFormulier partners={db.partners.filter((p) => p.status !== "concept" && p.status !== "gearchiveerd").map((p) => ({ id: p.id, naam: p.naam, rollen: p.rollen })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"))} /> : null}
      </Kaart>
      <Kaart titel={`Terugkerende teamcombinaties (${teams.length})`}>
        <p className="muted klein-tekst">Combinaties van architect, adviseur, installatie(adviseur) en constructeur die op minstens twee projecten samen voorkwamen, gerangschikt op het aantal gedeelde projecten en de (geaccepteerde) evaluaties daarvan.</p>
        {teams.length ? (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="num">Gedeelde projecten</th>
                  <th>Projecten</th>
                  <th className="num">Evaluatie</th>
                </tr>
              </thead>
              <tbody>
                {teams.map((t) => (
                  <tr key={t.sleutel}>
                    <td>
                      {t.leden.map((l, i) => (
                        <div key={l.id}>
                          {i ? "+ " : ""}
                          <Link href={`/partners/${l.id}`}>{l.naam}</Link> <span className="muted klein-tekst">{ROL_LABEL[l.rol]}</span>
                        </div>
                      ))}
                    </td>
                    <td className="num">
                      <b>{t.aantal}</b>
                    </td>
                    <td className="klein-tekst">
                      {t.projecten.map((p, i) => (
                        <span key={p.id}>
                          {i ? ", " : ""}
                          <Link href={`/projecten/${p.id}`}>{p.naam}</Link>
                          {p.extern ? <span className="muted"> (extern)</span> : null}
                        </span>
                      ))}
                    </td>
                    <td className="num">{t.evaluatie !== null ? `${t.evaluatie.toLocaleString("nl-NL")}/5` : <span className="muted">–</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Leeg titel="Nog geen terugkerende combinaties" tekst="Leg per project vast welke architect, adviseurs en constructeur betrokken waren; combinaties ontstaan zodra ze op twee of meer projecten samen voorkomen." />
        )}
      </Kaart>
      <Kaart titel="Patronen (analyse)">
        <Disclaimer>{VERBAND_DISCLAIMER}</Disclaimer>
        <VerbandAnalyse rolA={rolA} rolB={rolB} aiActief={aiAan()} />
      </Kaart>
      <Kaart>
        <Disclaimer>{VERBAND_DISCLAIMER}</Disclaimer>
        {verbanden.length === 0 ? (
          <Leeg titel="Geen verbanden gevonden" tekst="Leg projecthistorie vast of verrijk partners; verbanden worden daaruit afgeleid." />
        ) : (
          <div className="tabelWrap">
            <table className="tabel">
              <thead>
                <tr>
                  <th>Partij A</th>
                  <th>Partij B</th>
                  <th>Status</th>
                  <th>Bronnen</th>
                  {magBevestigen ? <th /> : null}
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
                    <td>
                      {(() => {
                        const b = bevestiging(db, v.a.id, v.b.id);
                        return b ? (
                          <Badge kleur="groen" titel={`Bevestigd door ${b.bevestigdDoor} op ${new Date(b.bevestigdOp).toLocaleDateString("nl-NL", { timeZone: "Europe/Amsterdam" })}: ${b.toelichting ?? ""}`}>bevestigde samenwerking</Badge>
                        ) : (
                          <Badge kleur="geel">signaal · {v.bronnen.length} bron{v.bronnen.length === 1 ? "" : "nen"}</Badge>
                        );
                      })()}
                    </td>
                    <td className="klein-tekst">
                      {v.bronnen.slice(0, 4).map((b, i) => (
                        <div key={i}>{b.soort === "project" ? <>Gedeeld project: <Link href={`/projecten/${b.ref}`}>{b.label}</Link></> : b.label}</div>
                      ))}
                      {v.bronnen.length > 4 ? <div className="muted">… en {v.bronnen.length - 4} meer</div> : null}
                      {bevestiging(db, v.a.id, v.b.id)?.toelichting ? <div className="muted">Bevestigd op grond van: {bevestiging(db, v.a.id, v.b.id)?.toelichting}</div> : null}
                    </td>
                    {magBevestigen ? (
                      <td>
                        <SamenwerkingBevestigen a={v.a.id} b={v.b.id} bevestigd={Boolean(bevestiging(db, v.a.id, v.b.id))} />
                      </td>
                    ) : null}
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
