// US-21: evaluaties per engagement van een project.
import Link from "next/link";
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import { ROL_LABEL, datum, euro } from "@/lib/format";
import { Badge, Kaart, Knop, Leeg, Melding, PaginaKop } from "@/components/ui";
import EvaluatieFormulier from "@/components/projecten/EvaluatieFormulier";
import { EVALUATIE_STATUS_LABEL } from "@/lib/domain/tevredenheid";

export default async function EvaluatiesPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp, db, gebruiker] = await Promise.all([params, searchParams, getDb(), huidigeGebruiker()]);
  const p = db.projecten.find((x) => x.id === id);
  if (!p) notFound();
  const magEvalueren = heeftRecht(gebruiker.rol, "evalueren");
  const engagements = db.engagements.filter((e) => e.projectId === p.id).sort((a, b) => (a.id === sp.engagement ? -1 : b.id === sp.engagement ? 1 : a.periode.van.localeCompare(b.periode.van)));
  const ontbrekend = engagements.filter((e) => !db.evaluaties.some((ev) => ev.engagementId === e.id && (ev.moment ?? "oplevering") === "oplevering"));
  const naOplevering = p.fase === "opgeleverd" || p.fase === "nazorg";

  return (
    <>
      <PaginaKop
        eyebrow={`Projecten / ${p.naam}`}
        titel={`Evaluaties: ${p.naam}`}
        intro="Beoordeel elke betrokken organisatie (nooit een persoon) tussentijds of na oplevering op kwaliteit, planning, budget, samenwerking en duurzaamheidsprestatie, met uw ervaring in eigen woorden. Na acceptatie door een beheerder voeden evaluaties de afgeleide factoren, de matching en de AI-chat."
        acties={
          <Knop href={`/projecten/${p.id}`} variant="secundair">
            Project
          </Knop>
        }
      />
      {naOplevering && ontbrekend.length ? (
        <Melding soort="waarschuwing">
          Project is {p.fase}; {ontbrekend.length} van {engagements.length} engagement(s) zijn nog niet geëvalueerd.
        </Melding>
      ) : null}
      {!naOplevering && engagements.length ? <Melding soort="info">Project is nog in fase &apos;{p.fase}&apos;. Beoordelen is bedoeld na oplevering, maar tussentijds vastleggen kan.</Melding> : null}
      {engagements.length ? (
        engagements.map((e) => {
          const partner = db.partners.find((x) => x.id === e.partnerId);
          const ev = db.evaluaties.find((x) => x.engagementId === e.id && (x.moment ?? "oplevering") === "oplevering") ?? db.evaluaties.find((x) => x.engagementId === e.id);
          const tussentijds = db.evaluaties.find((x) => x.engagementId === e.id && x.moment === "tussentijds");
          const gem = ev ? (ev.kwaliteit + ev.planning + ev.budget + ev.samenwerking + ev.duurzaamheid) / 5 : null;
          return (
            <Kaart
              key={e.id}
              id={`engagement-${e.id}`}
              titel={
                <>
                  {partner ? <Link href={`/partners/${partner.id}`}>{partner.naam}</Link> : e.partnerId} <span className="muted klein-tekst">{ROL_LABEL[e.rol]}</span>
                </>
              }
              acties={ev ? <Badge kleur={gem !== null && gem >= 4 ? "groen" : gem !== null && gem >= 3 ? "blauw" : "geel"}>Gemiddeld {gem?.toFixed(1)}/5</Badge> : <Badge kleur="geel">Nog niet beoordeeld</Badge>}
            >
              <p className="muted klein-tekst">
                {datum(e.periode.van)} – {e.periode.tot ? datum(e.periode.tot) : "heden"} · contractwaarde {euro(e.contractwaarde)}
                {e.eindafrekening ? ` · eindafrekening ${euro(e.eindafrekening)}` : ""}
                {e.geplandeOplevering ? ` · oplevering gepland ${datum(e.geplandeOplevering)}${e.werkelijkeOplevering ? `, werkelijk ${datum(e.werkelijkeOplevering)}` : ""}` : ""}
              </p>
              {ev ? (
                <div className="evaluatieScores">
                  {(
                    [
                      ["Kwaliteit", ev.kwaliteit],
                      ["Planning", ev.planning],
                      ["Budget", ev.budget],
                      ["Samenwerking", ev.samenwerking],
                      ["Duurzaamheid", ev.duurzaamheid]
                    ] as Array<[string, number]>
                  ).map(([label, score]) => (
                    <div key={label} className="evaluatieScore">
                      <small>{label}</small>
                      <b>{score}/5</b>
                    </div>
                  ))}
                  <p className="klein-tekst" style={{ gridColumn: "1 / -1" }}>
                    <Badge kleur="grijs">{ev.moment === "tussentijds" ? "tussentijds" : "na oplevering"}</Badge> <Badge kleur={(ev.status ?? "geaccepteerd") === "geaccepteerd" ? "groen" : ev.status === "afgewezen" ? "rood" : "geel"}>{EVALUATIE_STATUS_LABEL[ev.status ?? "geaccepteerd"]}</Badge>{" "}
                    {ev.toelichting || <span className="muted">Geen toelichting.</span>} <span className="muted">— {ev.door}, {datum(ev.datum)}</span>
                  </p>
                </div>
              ) : null}
              {tussentijds && ev !== tussentijds ? (
                <p className="klein-tekst">
                  <Badge kleur="grijs">tussentijds</Badge> <Badge kleur={(tussentijds.status ?? "geaccepteerd") === "geaccepteerd" ? "groen" : "geel"}>{EVALUATIE_STATUS_LABEL[tussentijds.status ?? "geaccepteerd"]}</Badge> gemiddeld {((tussentijds.kwaliteit + tussentijds.planning + tussentijds.budget + tussentijds.samenwerking + tussentijds.duurzaamheid) / 5).toFixed(1)}/5 — {tussentijds.toelichting || "geen toelichting"} <span className="muted">({tussentijds.door}, {datum(tussentijds.datum)})</span>
                </p>
              ) : null}
              <EvaluatieFormulier engagementId={e.id} partnerId={e.partnerId} projectId={p.id} bestaand={ev && (ev.moment ?? "oplevering") === "oplevering" ? ev : undefined} tussentijds={tussentijds} magEvalueren={magEvalueren} openStandaard={sp.engagement === e.id} standaardMoment={naOplevering ? "oplevering" : "tussentijds"} />
            </Kaart>
          );
        })
      ) : (
        <Kaart>
          <Leeg titel="Geen engagements" tekst="Leg eerst op de projectpagina vast welke partners betrokken zijn." actie={<Knop href={`/projecten/${p.id}`}>Naar project</Knop>} />
        </Kaart>
      )}
    </>
  );
}
