"use client";
// US-20: eigenaarschap van het evaluatieproces vastleggen: wie bewaakt het proces en na hoeveel dagen volgt een herinnering.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaEvaluatieprocesOp } from "@/lib/acties/beheer";
import { Melding } from "@/components/ui";

export default function EvaluatieprocesEditor({ procesbewaker, herinneringDagen, magBeheren }: { procesbewaker?: string; herinneringDagen: number; magBeheren: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useState(procesbewaker ?? "");
  const [dagen, setDagen] = useState(String(herinneringDagen));
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <p className="muted klein-tekst">De verantwoordelijke ontwikkelaar per project levert de evaluaties (vast te leggen bij het project); de procesbewaker bewaakt dat ze binnenkomen. Na de herinneringstermijn verschijnt een herinnering op het dashboard.</p>
      <div className="rij">
        <label>
          Procesbewaker
          <input value={naam} disabled={!magBeheren} onChange={(e) => setNaam(e.target.value)} placeholder="naam" />
        </label>
        <label>
          Herinnering na (dagen na oplevering)
          <input type="number" min={1} max={180} value={dagen} disabled={!magBeheren} onChange={(e) => setDagen(e.target.value)} />
        </label>
      </div>
      {magBeheren ? (
        <div className="formulierActies">
          <button
            type="button"
            className="knop klein"
            disabled={bezig}
            onClick={() =>
              start(async () => {
                const r = await slaEvaluatieprocesOp({ procesbewaker: naam, herinneringDagen: Number(dagen) });
                setMelding(r.ok ? { soort: "succes", tekst: "Eigenaarschap vastgelegd." } : { soort: "fout", tekst: r.fout });
                if (r.ok) router.refresh();
              })
            }
          >
            Opslaan
          </button>
        </div>
      ) : null}
    </div>
  );
}
