// Epic 3: matching per project. US-12 t/m US-17, US-42, US-04b.
import Link from "next/link";
import { notFound } from "next/navigation";
import { heeftRecht, huidigeGebruiker } from "@/lib/auth";
import { getDb } from "@/lib/store";
import type { Kandidaat, MatchRun } from "@/lib/domain/types";
import { ROL_LABEL, datumTijd } from "@/lib/format";
import { Kaart, Knop, Leeg, PaginaKop } from "@/components/ui";
import MatchRunFormulier from "@/components/projecten/MatchRunFormulier";
import RolResultaatWeergave, { type Verschil } from "@/components/projecten/RolResultaatWeergave";

/** US-16: verschillen per rol t.o.v. de vorige run: nieuw, scorewijziging >= 5, weggevallen. */
function verschillen(run: MatchRun, vorige: MatchRun | undefined): Record<string, Verschil> {
  const uit: Record<string, Verschil> = {};
  if (!vorige) return uit;
  run.resultaat.forEach((r) => {
    const v = vorige.resultaat.find((x) => x.rol === r.rol);
    if (!v) return;
    const alle = (x: typeof r) => [...x.kandidaten, ...x.prospects];
    const nu = new Map(alle(r).map((k) => [k.partnerId, k]));
    const oud = new Map(alle(v).map((k) => [k.partnerId, k]));
    const d: Verschil = { nieuw: [], weg: [], gewijzigd: [] };
    nu.forEach((k, id) => {
      const o = oud.get(id);
      if (!o) d.nieuw.push(k.partnerNaam);
      else if (Math.abs(o.score - k.score) >= 5) d.gewijzigd.push({ naam: k.partnerNaam, van: o.score, naar: k.score });
    });
    oud.forEach((k: Kandidaat, id) => {
      if (!nu.has(id)) d.weg.push(k.partnerNaam);
    });
    uit[r.rol] = d;
  });
  return uit;
}

export default async function MatchPagina({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const [{ id }, sp, db, gebruiker] = await Promise.all([params, searchParams, getDb(), huidigeGebruiker()]);
  const p = db.projecten.find((x) => x.id === id);
  if (!p) notFound();
  const runs = db.matchRuns.filter((r) => r.projectId === p.id).sort((a, b) => b.gestartOp.localeCompare(a.gestartOp));
  const run = runs.find((r) => r.id === sp.run) ?? runs[0];
  const vorige = run?.vorigeRunId ? db.matchRuns.find((r) => r.id === run.vorigeRunId) : undefined;
  const feedback = run ? db.feedback.filter((f) => f.matchRunId === run.id) : [];
  const magFeedback = heeftRecht(gebruiker.rol, "bewerken");
  const diff = run ? verschillen(run, vorige) : {};

  return (
    <>
      <PaginaKop
        eyebrow={`Projecten / ${p.naam}`}
        titel={`Matching: ${p.naam}`}
        intro="Harde filters, gewogen score en semantische gelijkenis. AI legt uit, AI beslist niet."
        acties={
          <>
            <Knop href={`/projecten/${p.id}`} variant="secundair">
              Project
            </Knop>
            <Knop href={`/projecten/${p.id}/team${run ? `?run=${run.id}` : ""}`} variant="secundair">
              Teamsamenstelling
            </Knop>
          </>
        }
      />

      <div className="raster raster-zij">
        <Kaart titel="Matchrun uitvoeren">
          <MatchRunFormulier projectId={p.id} heeftEisen={p.eisen.length > 0} />
        </Kaart>
        <Kaart titel={`Opgeslagen runs (${runs.length})`}>
          {runs.length ? (
            <ul className="lijst klein-tekst">
              {runs.map((r) => (
                <li key={r.id}>
                  <Link href={`/projecten/${p.id}/match?run=${r.id}`} style={{ fontWeight: r.id === run?.id ? 700 : 400 }}>
                    {r.naam}
                  </Link>
                  <br />
                  <span className="muted">
                    {datumTijd(r.gestartOp)} · {r.door} · {r.resultaat.map((x) => `${ROL_LABEL[x.rol]} ${x.kandidaten.length}`).join(", ")}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted klein-tekst">Nog geen runs.</p>
          )}
        </Kaart>
      </div>

      {run ? (
        <>
          <Kaart titel={`Resultaat: ${run.naam}`}>
            <p className="muted klein-tekst">
              Uitgevoerd {datumTijd(run.gestartOp)} door {run.door}
              {run.input.vrijeOmschrijving ? ` · vrije omschrijving: „${run.input.vrijeOmschrijving}”` : ""}
              {vorige ? ` · vergeleken met „${vorige.naam}” (${datumTijd(vorige.gestartOp)})` : ""}
            </p>
            {!magFeedback ? <p className="muted klein-tekst">Feedback op de ranking (US-42) vereist recht &apos;bewerken&apos;.</p> : null}
          </Kaart>
          {run.resultaat.map((r) => (
            <RolResultaatWeergave key={r.rol} resultaat={r} runId={run.id} projectId={p.id} feedback={feedback} magFeedback={magFeedback} verschil={vorige ? diff[r.rol] : undefined} />
          ))}
        </>
      ) : (
        <Kaart>
          <Leeg titel="Nog geen matchrun" tekst="Voer hierboven een matchrun uit; het resultaat wordt opgeslagen." />
        </Kaart>
      )}
    </>
  );
}
