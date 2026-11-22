// VE-04: tab Partners op de projectpagina (voorheen /projecten/[id]/match). US-12 t/m US-17, US-42, US-04b.
import Link from "next/link";
import type { Database, Kandidaat, MatchRun, Rol } from "@/lib/domain/types";
import { ROL_LABEL, datumTijd } from "@/lib/format";
import { Disclaimer, Kaart, Knop } from "@/components/ui";
import MatchOnderbouwing from "@/components/projecten/MatchOnderbouwing";
import { MATCH_DISCLAIMER } from "@/lib/domain/export";
import MatchRunFormulier from "@/components/projecten/MatchRunFormulier";
import ZoekPartnersKnop from "@/components/projecten/ZoekPartnersKnop";
import { type RunOnderbouwing, type Verschil } from "@/components/projecten/RolResultaatWeergave";
import MatchResultaten from "@/components/projecten/MatchResultaten";
import { STANDAARD_DEKKING_DREMPEL } from "@/lib/domain/herweging";
import { aiAan } from "@/lib/aiplatform";

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

/** AI-toelichting per kandidaat uit de run; een regelgebaseerde run-onderbouwing staat al bij elke kandidaat. */
function runOnderbouwing(run: MatchRun, rol: Rol): RunOnderbouwing | undefined {
  const o = run.onderbouwing;
  const r = o?.perRol.find((x) => x.rol === rol);
  if (!o || !r || o.provider.startsWith("regels")) return undefined;
  return { provider: o.provider, perKandidaat: Object.fromEntries(r.perKandidaat.map((k) => [k.partnerId, { onderbouwing: k.onderbouwing, aandachtspunten: k.aandachtspunten }])) };
}

export default function PartnersTab({ db, projectId, runId, magFeedback }: { db: Database; projectId: string; runId?: string; magFeedback: boolean }) {
  const p = db.projecten.find((x) => x.id === projectId)!;
  const runs = db.matchRuns.filter((r) => r.projectId === p.id).sort((a, b) => b.gestartOp.localeCompare(a.gestartOp));
  const run = runs.find((r) => r.id === runId) ?? runs[0];
  const vorige = run?.vorigeRunId ? db.matchRuns.find((r) => r.id === run.vorigeRunId) : undefined;
  const feedback = run ? db.feedback.filter((f) => f.matchRunId === run.id) : [];
  const diff = run ? verschillen(run, vorige) : {};
  const basis = `/projecten/${p.id}?tab=partners`;

  if (!run) {
    return (
      <Kaart titel="Geschikte partners">
        <p className="muted">Voor dit project is nog niet gezocht. Het zoeken gebruikt de rollen en eisen van het project (tab Beschrijving) en slaat het resultaat op.</p>
        <ZoekPartnersKnop projectId={p.id} heeftEisen={p.eisen.length > 0} />
      </Kaart>
    );
  }

  return (
    <>
      <Kaart
        titel={`Geschikte partners: ${run.naam}`}
        acties={
          <>
            <Knop href={`/api/export/match/${run.id}`} variant="secundair" klein>
              Export (Excel)
            </Knop>
          </>
        }
      >
        <p className="muted klein-tekst">
          Uitgevoerd {datumTijd(run.gestartOp)} door {run.door}
          {run.input.vrijeOmschrijving ? ` · vrije omschrijving: „${run.input.vrijeOmschrijving}”` : ""}
          {vorige ? ` · vergeleken met „${vorige.naam}” (${datumTijd(vorige.gestartOp)})` : ""}
        </p>
        {!magFeedback ? <p className="muted klein-tekst">Feedback op de ranking vereist recht &apos;bewerken&apos;.</p> : null}
        <Disclaimer>{MATCH_DISCLAIMER}</Disclaimer>
        <MatchOnderbouwing run={run} namen={Object.fromEntries(run.resultaat.flatMap((r) => [...r.kandidaten, ...r.prospects].map((k) => [k.partnerId, k.partnerNaam])))} aiActief={aiAan()} />
      </Kaart>
      <MatchResultaten
        run={run}
        projectId={p.id}
        feedback={feedback}
        magFeedback={magFeedback}
        magBewerken={magFeedback}
        verschillen={vorige ? diff : {}}
        onderbouwingen={Object.fromEntries(run.resultaat.map((r) => [r.rol, runOnderbouwing(run, r.rol)]))}
        dekkingDrempel={db.instellingen.dekkingDrempel ?? STANDAARD_DEKKING_DREMPEL}
      />
      <Kaart titel="Opnieuw zoeken">
        <details className="uitklap">
          <summary>Nieuwe run met eigen naam of omschrijving</summary>
          <MatchRunFormulier projectId={p.id} heeftEisen={p.eisen.length > 0} />
        </details>
      </Kaart>
      {runs.length > 1 ? (
        <Kaart titel={`Eerdere runs (${runs.length})`}>
          <ul className="lijst klein-tekst">
            {runs.map((r) => (
              <li key={r.id}>
                <Link href={`${basis}&run=${r.id}`} style={{ fontWeight: r.id === run.id ? 700 : 400 }}>
                  {r.naam}
                </Link>
                <br />
                <span className="muted">
                  {datumTijd(r.gestartOp)} · {r.door} · {r.resultaat.map((x) => `${ROL_LABEL[x.rol]} ${x.kandidaten.length}`).join(", ")}
                </span>
              </li>
            ))}
          </ul>
        </Kaart>
      ) : null}
    </>
  );
}
