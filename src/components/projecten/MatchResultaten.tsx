"use client";
// US-16: weging per project of tender met schuifjes per criterium. Een wijziging rekent de rangschikking direct opnieuw uit
// (uit de fit per criterium in de run, zonder nieuwe run); vastleggen kan op het project of als eigen gewichtsprofiel.
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { slaWegingOpAlsProfiel, slaWegingOpProject } from "@/lib/acties/weging";
import { criteriumSleutel, herweegResultaat, wegingVanEis, type Weging } from "@/lib/domain/herweging";
import type { MatchFeedback, MatchRun, Rol } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";
import RolResultaatWeergave, { type RunOnderbouwing, type Verschil } from "./RolResultaatWeergave";

type Props = {
  run: MatchRun;
  projectId: string;
  feedback: MatchFeedback[];
  magFeedback: boolean;
  magBewerken: boolean;
  verschillen: Record<string, Verschil | undefined>;
  onderbouwingen: Record<string, RunOnderbouwing | undefined>;
  dekkingDrempel: number;
};

export default function MatchResultaten({ run, projectId, feedback, magFeedback, magBewerken, verschillen, onderbouwingen, dekkingDrempel }: Props) {
  const router = useRouter();
  const origineel = useMemo(() => Object.fromEntries(run.resultaat.map((r) => [r.rol, wegingVanEis(run.input.eisen.find((e) => e.rol === r.rol), r)])) as Record<Rol, Weging>, [run]);
  const [weging, setWeging] = useState<Record<Rol, Weging>>(origineel);
  const [open, setOpen] = useState(false);
  const [profielNaam, setProfielNaam] = useState("");
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  const gewijzigd = (rol: Rol) => JSON.stringify(weging[rol]) !== JSON.stringify(origineel[rol]);
  const ietsGewijzigd = run.resultaat.some((r) => gewijzigd(r.rol));
  const aangepast = () => Object.fromEntries(run.resultaat.filter((r) => gewijzigd(r.rol)).map((r) => [r.rol, weging[r.rol]]));

  const zet = (rol: Rol, sleutel: string, waarde: number) => setWeging((w) => ({ ...w, [rol]: { ...w[rol], gewichten: { ...w[rol].gewichten, [sleutel]: waarde } } }));
  const zetSem = (rol: Rol, waarde: number) => setWeging((w) => ({ ...w, [rol]: { ...w[rol], semantisch: waarde } }));

  const opslaanProject = () =>
    start(async () => {
      setMelding(null);
      const r = await slaWegingOpProject(projectId, run.id, aangepast());
      setMelding(r.ok ? { soort: "succes", tekst: "Weging vastgelegd op het project; de volgende matchrun gebruikt haar." } : { soort: "fout", tekst: r.fout });
      if (r.ok) router.refresh();
    });
  const opslaanProfiel = () =>
    start(async () => {
      setMelding(null);
      const r = await slaWegingOpAlsProfiel(run.id, profielNaam, "", Object.fromEntries(run.resultaat.map((x) => [x.rol, weging[x.rol]])));
      setMelding(r.ok ? { soort: "succes", tekst: `Profiel '${profielNaam}' opgeslagen; kies het bij een project als startpunt voor de weging.` } : { soort: "fout", tekst: r.fout });
      if (r.ok) setProfielNaam("");
    });

  return (
    <>
      <section className="kaart wegingPaneel geenPrint">
        <header className="kaartKop">
          <h2>Weging {ietsGewijzigd ? <span className="badge badge-geel">aangepast</span> : null}</h2>
          <button type="button" className="knop knop-secundair klein" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
            {open ? "Schuifjes verbergen" : "Weging aanpassen"}
          </button>
        </header>
        <p className="muted klein-tekst">Laat criteria zwaarder of lichter wegen, passend bij de selectieleidraad. De rangschikking hieronder verandert direct; harde eisen en uitsluitingen blijven gelijk.</p>
        {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
        {open ? (
          <>
            <div className="wegingRaster">
              {run.resultaat.map((r) => {
                const voorbeeld = r.kandidaten[0] ?? r.prospects[0];
                const w = weging[r.rol];
                if (!voorbeeld || !w) return null;
                const som = Object.values(w.gewichten).reduce((s, x) => s + x, 0);
                return (
                  <div key={r.rol} className="wegingRol">
                    <h3>
                      {ROL_LABEL[r.rol]} {gewijzigd(r.rol) ? <button type="button" className="knop knop-tekst klein" onClick={() => setWeging((x) => ({ ...x, [r.rol]: origineel[r.rol] }))}>terugzetten</button> : null}
                    </h3>
                    {voorbeeld.criteria.map((c) => {
                      const s = criteriumSleutel(c);
                      const v = w.gewichten[s] ?? 0;
                      return (
                        <label key={s} className="schuif">
                          <span>
                            {c.factorNaam} <b>{som ? Math.round((v / som) * 100) : 0}%</b>
                          </span>
                          <input type="range" min={0} max={60} step={1} value={v} onChange={(e) => zet(r.rol, s, Number(e.target.value))} />
                        </label>
                      );
                    })}
                    <label className="schuif">
                      <span>
                        Inhoudelijke gelijkenis (semantisch) <b>{w.semantisch}%</b>
                      </span>
                      <input type="range" min={0} max={40} step={1} value={w.semantisch} onChange={(e) => zetSem(r.rol, Number(e.target.value))} />
                    </label>
                  </div>
                );
              })}
            </div>
            {magBewerken ? (
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig || !ietsGewijzigd} onClick={opslaanProject}>
                  Vastleggen op project
                </button>
                <input value={profielNaam} onChange={(e) => setProfielNaam(e.target.value)} placeholder="Naam profiel, bijv. Tender EMVI duurzaamheid" aria-label="Naam profiel" style={{ maxWidth: 300 }} />
                <button type="button" className="knop knop-secundair klein" disabled={bezig || !profielNaam.trim()} onClick={opslaanProfiel}>
                  Opslaan als profiel
                </button>
                <button type="button" className="knop knop-tekst klein" disabled={!ietsGewijzigd} onClick={() => setWeging(origineel)}>
                  Alles terugzetten
                </button>
              </div>
            ) : null}
          </>
        ) : null}
      </section>
      {run.resultaat.map((r) => {
        const herwogen = gewijzigd(r.rol);
        return (
          <RolResultaatWeergave
            key={r.rol}
            resultaat={herwogen ? herweegResultaat(r, weging[r.rol]) : r}
            runId={run.id}
            projectId={projectId}
            feedback={feedback}
            magFeedback={magFeedback}
            verschil={verschillen[r.rol]}
            onderbouwing={onderbouwingen[r.rol]}
            dekkingDrempel={dekkingDrempel}
            herwogen={herwogen}
          />
        );
      })}
    </>
  );
}
