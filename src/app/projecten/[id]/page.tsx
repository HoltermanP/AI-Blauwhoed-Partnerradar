// US-09/US-10 projectprofiel met eisen-editor; US-18 engagements van dit project.
import Link from "next/link";
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { ROL_LABEL, datum, datumTijd, euro, getal, hoofdletter } from "@/lib/format";
import { Badge, Definities, Kaart, Knop, PaginaKop } from "@/components/ui";
import EisenEditor from "@/components/projecten/EisenEditor";
import EngagementFormulier from "@/components/projecten/EngagementFormulier";

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
  const partners = db.partners.filter((x) => x.status !== "geblokkeerd").map((x) => ({ id: x.id, naam: x.naam, rollen: x.rollen })).sort((a, b) => a.naam.localeCompare(b.naam, "nl"));

  return (
    <>
      <PaginaKop
        eyebrow="Project"
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
        <Kaart titel="Projectprofiel (US-08)">
          <Definities
            items={[
              ["Type", hoofdletter(p.type)],
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
          {p.herkomst?.length ? (
            <details className="uitklap" style={{ marginTop: 12 }}>
              <summary>Herkomst uit projectdocument ({p.herkomst.length} velden, US-11)</summary>
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

        <Kaart titel="Rollen, eisen en gewichten (US-09, US-10)">
          <EisenEditor projectId={p.id} eisen={p.eisen} gewichtsprofielId={p.gewichtsprofielId} profielen={db.gewichtsprofielen} factoren={db.factoren} magBewerken={magBewerken} />
        </Kaart>

        <Kaart titel="Betrokken partners (US-18)" acties={magBewerken ? <Link href={`/projecten/${p.id}/evaluaties`} className="knop knop-tekst klein">Naar evaluaties</Link> : undefined}>
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
