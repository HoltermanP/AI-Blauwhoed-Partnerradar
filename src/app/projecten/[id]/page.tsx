// US-09/US-10 projectprofiel met eisen-editor; US-18 engagements van dit project.
import Link from "next/link";
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { ROL_LABEL, datum, datumTijd, euro, getal, hoofdletter } from "@/lib/format";
import { Badge, Definities, Kaart, Knop, PaginaKop } from "@/components/ui";
import EisenEditor from "@/components/projecten/EisenEditor";
import EngagementFormulier from "@/components/projecten/EngagementFormulier";
import ProjectClassificatie from "@/components/projecten/ProjectClassificatie";
import ProjectVerrijken from "@/components/projecten/ProjectVerrijken";
import { PROJECTBRON_LABEL } from "@/lib/domain/projectimport";

export default async function ProjectPagina({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [db, gebruiker] = await Promise.all([getDb(), huidigeGebruiker()]);
  const p = db.projecten.find((x) => x.id === id);
  if (!p) notFound();
  const magBewerken = heeftRecht(gebruiker.rol, "bewerken");
  const engagements = db.engagements.filter((e) => e.projectId === p.id).sort((a, b) => a.periode.van.localeCompare(b.periode.van));
  const runs = db.matchRuns.filter((r) => r.projectId === p.id);
  const bouwsysteem = db.factoren.find((f) => f.id === "bouwsysteem");
  const bouwsystemen = (bouwsysteem?.opties ?? []).filter((o) => o.actief);
  const profiel = p.gewichtsprofielId ? db.gewichtsprofielen.find((g) => g.id === p.gewichtsprofielId) : undefined;
  const v = p.verrijking;
  const laatsteRun = [...runs].sort((a, b) => b.gestartOp.localeCompare(a.gestartOp))[0];
  const looptijdMaanden = Math.max(0, Math.round((new Date(p.planning.eind).getTime() - new Date(p.planning.start).getTime()) / (30.44 * 24 * 3600 * 1000)));
  const host = (url: string) => { try { return new URL(url).host.replace(/^www\./, ""); } catch { return url; } };
  const partners = db.partners.filter((x) => x.status !== "geblokkeerd").map((x) => ({ id: x.id, naam: x.naam, rollen: x.rollen })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return (
    <>
      <PaginaKop
        eyebrow={p.projectnummer ? `Project ${p.projectnummer}` : "Project"}
        titel={p.naam}
        intro={p.omschrijving}
        acties={
          <>
            {magBewerken ? (
              <Knop href={`/projecten/${p.id}/bewerken`} variant="secundair">
                Bewerken
              </Knop>
            ) : null}
            <Knop href={`/projecten/${p.id}/match`} variant="secundair">
              Matching{runs.length ? ` (${runs.length})` : ""}
            </Knop>
            <Knop href={`/projecten/${p.id}/team`} variant="secundair">
              Team
            </Knop>
            <Knop href={`/projecten/${p.id}/evaluaties`} variant="secundair">
              Evaluaties
            </Knop>
          </>
        }
      />

      <div className="raster">
        <Kaart titel="Projectprofiel">
          <Definities
            items={[
              [
                "Type",
                <span key="type">
                  {hoofdletter(p.type)}{" "}
                  {(() => {
                    const c = p.correcties?.filter((x) => x.veld === "type").slice(-1)[0];
                    const h = p.herkomst?.find((x) => x.veld === "type");
                    return c ? (
                      <Badge kleur="blauw" titel={`Gecorrigeerd door ${c.door} op ${datum(c.op)}: ${c.reden} (was ${c.van})`}>gecorrigeerd</Badge>
                    ) : h ? (
                      <Badge kleur="geel" titel={`Uit projectdocument: „${h.citaat}” (betrouwbaarheid ${Math.round(h.betrouwbaarheid * 100)}%)`}>voorstel uit document</Badge>
                    ) : null;
                  })()}
                </span>
              ],
              ["Bron", <span key="bron">{PROJECTBRON_LABEL[p.bron ?? (p.herkomst?.length ? "web" : "handmatig")]}{p.ookWebbron ? " + webbron (samengevoegd)" : ""}{p.erpImportOp ? <span className="muted klein-tekst"> · ERP-import {datum(p.erpImportOp)}</span> : null}</span>],
              ["Verantwoordelijke ontwikkelaar", p.verantwoordelijke ?? "–"],
              ["Plaats", p.locatie.plaats],
              ["Woningen", getal(p.woningen)],
              ["Prijssegment", p.prijssegment.map(hoofdletter).join(", ") || "–"],
              ["Bouwstijl", hoofdletter(p.bouwstijl)],
              ["Ambitie duurzaamheid", `${p.ambitieDuurzaamheid}/5`],
              ["Planning", `${datum(p.planning.start)} – ${datum(p.planning.eind)}`],
              ["Fase", <Badge key="fase" kleur="blauw">{hoofdletter(p.fase)}</Badge>],
              ["Gewichtsprofiel", profiel ? `${profiel.naam} (v${profiel.versie})` : "handmatig"],
              ["Bijgewerkt", datumTijd(p.bijgewerktOp)]
            ]}
          />
          {magBewerken ? <ProjectClassificatie projectId={p.id} huidig={p.type} /> : null}
          {p.correcties?.length ? (
            <details className="uitklap">
              <summary>Correcties van classificaties ({p.correcties.length})</summary>
              <ul className="lijst klein-tekst">
                {p.correcties.map((c, i) => (
                  <li key={i}>
                    {c.veld}: {c.van} → <b>{c.naar}</b> door {c.door} op {datum(c.op)} — {c.reden}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
          {p.herkomst?.length ? (
            <details className="uitklap" style={{ marginTop: 12 }}>
              <summary>Herkomst uit projectdocument ({p.herkomst.length} velden)</summary>
              <ul className="lijst klein-tekst">
                {p.herkomst.map((h, i) => (
                  <li key={i}>
                    <b>{h.veld}</b> · betrouwbaarheid {Math.round(h.betrouwbaarheid * 100)}% · <span className="muted">„{h.citaat}”</span>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </Kaart>

        <Kaart titel="Over dit project">
          <Definities
            items={[
              ["Locatie", <span key="loc">{p.locatie.plaats}{p.locatie.adres ? `, ${p.locatie.adres}` : ""}{v?.adres && v.adres !== p.locatie.adres ? ` (bron: ${v.adres})` : ""} · <a href={`https://www.openstreetmap.org/?mlat=${p.locatie.lat}&mlon=${p.locatie.lng}#map=14/${p.locatie.lat}/${p.locatie.lng}`} target="_blank" rel="noreferrer">kaart</a></span>],
              ["Looptijd", looptijdMaanden ? `${looptijdMaanden} maanden (${datum(p.planning.start)} – ${datum(p.planning.eind)})` : "–"],
              ["Gemiddeld per jaar", looptijdMaanden >= 12 ? `${getal(Math.round(p.woningen / (looptijdMaanden / 12)))} woningen` : "–"],
              ["Betrokken partners in de database", `${engagements.length} (${new Set(engagements.map((e) => e.partnerId)).size} verschillende)`],
              ["Matching", laatsteRun ? <span key="m">{runs.length} run(s); laatste {datumTijd(laatsteRun.gestartOp)} — {laatsteRun.resultaat.map((r) => `${ROL_LABEL[r.rol]} ${r.kandidaten.length}`).join(", ")}</span> : "nog niet gedraaid"]
            ]}
          />
          {v?.samenvatting ? <p style={{ marginTop: 12 }}>{v.samenvatting}</p> : null}
          {v?.kenmerken.length ? (
            <>
              <h4 style={{ marginTop: 16 }}>Kenmerken uit de bronnen</h4>
              <ul className="lijst">
                {v.kenmerken.map((k, i) => (
                  <li key={i}>
                    <b>{k.label}:</b> {k.waarde}{" "}
                    <span className="muted klein-tekst" title={`Letterlijk uit de bron: „${k.citaat}”`}>
                      · <a href={k.bronUrl} target="_blank" rel="noreferrer">{host(k.bronUrl)}</a>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {v?.betrokkenPartijen.length ? (
            <>
              <h4 style={{ marginTop: 16 }}>Betrokken partijen volgens de bronnen</h4>
              <ul className="lijst">
                {v.betrokkenPartijen.map((b, i) => (
                  <li key={i}>
                    {b.partnerId ? <Link href={`/partners/${b.partnerId}`}>{b.naam}</Link> : b.naam} — {b.rol}{" "}
                    {b.partnerId ? <Badge kleur="groen" titel="Deze partij staat in de partnerdatabase">in database</Badge> : <Badge kleur="grijs" titel="Deze partij staat (nog) niet in de partnerdatabase">niet in database</Badge>}{" "}
                    <span className="muted klein-tekst" title={`Letterlijk uit de bron: „${b.citaat}”`}>
                      · <a href={b.bronUrl} target="_blank" rel="noreferrer">{host(b.bronUrl)}</a>
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
          {v ? (
            <p className="muted klein-tekst" style={{ marginTop: 12 }}>
              Verrijkt op {datumTijd(v.opgehaaldOp)} uit {v.bronnen.map((b, i) => <span key={b.url}>{i ? ", " : ""}<a href={b.url} target="_blank" rel="noreferrer">{host(b.url)}</a></span>)}. Alleen punten met een letterlijk citaat uit de bron zijn opgenomen{v.weggelaten ? ` (${v.weggelaten} weggelaten)` : ""}.
            </p>
          ) : (
            <p className="muted klein-tekst" style={{ marginTop: 12 }}>Nog niet verrijkt uit de bronpagina&apos;s van dit project.</p>
          )}
          {magBewerken ? <ProjectVerrijken projectId={p.id} heeftVerrijking={Boolean(v)} /> : null}
        </Kaart>

        <Kaart titel="Rollen, eisen en gewichten">
          <EisenEditor projectId={p.id} eisen={p.eisen} gewichtsprofielId={p.gewichtsprofielId ?? (p.eisen.length ? undefined : db.instellingen.standaardGewichtsprofielId)} profielen={db.gewichtsprofielen} factoren={db.factoren} magBewerken={magBewerken} />
        </Kaart>

        <Kaart titel="Betrokken partners" acties={magBewerken ? <Link href={`/projecten/${p.id}/evaluaties`} className="knop knop-tekst klein">Naar evaluaties</Link> : undefined}>
          {engagements.length ? (
            <div className="tabelWrap">
              <table className="tabel">
                <thead>
                  <tr>
                    <th>Partner</th>
                    <th>Rol</th>
                    <th className="num">Contractwaarde</th>
                    <th className="num">Eindafrekening</th>
                    <th>Periode</th>
                    <th>Oplevering (gepland / werkelijk)</th>
                    <th>Bouwsysteem</th>
                    <th>Bron</th>
                    <th>Evaluatie</th>
                  </tr>
                </thead>
                <tbody>
                  {engagements.map((e) => {
                    const partner = db.partners.find((x) => x.id === e.partnerId);
                    const ev = db.evaluaties.find((x) => x.engagementId === e.id);
                    return (
                      <tr key={e.id}>
                        <td>{partner ? <Link href={`/partners/${partner.id}`}>{partner.naam}</Link> : e.partnerId}</td>
                        <td>{ROL_LABEL[e.rol]}</td>
                        <td className="num">{euro(e.contractwaarde)}</td>
                        <td className="num">{euro(e.eindafrekening)}</td>
                        <td>
                          {datum(e.periode.van)} – {e.periode.tot ? datum(e.periode.tot) : "heden"}
                        </td>
                        <td>
                          {datum(e.geplandeOplevering)} / {datum(e.werkelijkeOplevering)}
                        </td>
                        <td>{bouwsystemen.find((o) => o.id === e.bouwsysteem)?.label ?? e.bouwsysteem ?? "–"}</td>
                        <td className="muted klein-tekst">{e.bron}</td>
                        <td>{ev ? <Badge kleur="groen">{((ev.kwaliteit + ev.planning + ev.budget + ev.samenwerking + ev.duurzaamheid) / 5).toFixed(1)}/5</Badge> : <Link href={`/projecten/${p.id}/evaluaties?engagement=${e.id}`}>invullen</Link>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="muted">Nog geen partners vastgelegd voor dit project.</p>
          )}
          <div style={{ marginTop: 12 }}>{magBewerken ? <EngagementFormulier projectId={p.id} partners={partners} bouwsystemen={bouwsystemen} /> : <span className="muted klein-tekst">Engagements toevoegen vereist recht &apos;bewerken&apos;.</span>}</div>
        </Kaart>
      </div>
    </>
  );
}
