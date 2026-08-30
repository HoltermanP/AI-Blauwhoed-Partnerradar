"use client";
// US-21: partner beoordelen op kwaliteit, planning, budget, samenwerking en duurzaamheidsprestatie.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaEvaluatieOp } from "@/lib/actions";
import type { Evaluatie } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

const ASPECTEN: Array<{ id: "kwaliteit" | "planning" | "budget" | "samenwerking" | "duurzaamheid"; label: string }> = [
  { id: "kwaliteit", label: "Kwaliteit" },
  { id: "planning", label: "Planning" },
  { id: "budget", label: "Budget" },
  { id: "samenwerking", label: "Samenwerking" },
  { id: "duurzaamheid", label: "Duurzaamheidsprestatie" }
];

export default function EvaluatieFormulier({ engagementId, partnerId, projectId, bestaand, magEvalueren, openStandaard }: { engagementId: string; partnerId: string; projectId: string; bestaand?: Evaluatie; magEvalueren: boolean; openStandaard: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(openStandaard || !bestaand);
  const [scores, setScores] = useState({ kwaliteit: bestaand?.kwaliteit ?? 3, planning: bestaand?.planning ?? 3, budget: bestaand?.budget ?? 3, samenwerking: bestaand?.samenwerking ?? 3, duurzaamheid: bestaand?.duurzaamheid ?? 3 });
  const [toelichting, setToelichting] = useState(bestaand?.toelichting ?? "");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [bezig, start] = useTransition();

  if (!magEvalueren) return <p className="muted klein-tekst">U heeft geen recht &apos;evalueren&apos;.</p>;
  if (!open)
    return (
      <button type="button" className="knop knop-secundair klein" onClick={() => setOpen(true)}>
        Beoordeling {bestaand ? "aanpassen" : "invullen"}
      </button>
    );

  function opslaan(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    start(async () => {
      const r = await slaEvaluatieOp({ engagementId, partnerId, projectId, ...scores, toelichting });
      if (!r.ok) return setFout(r.fout);
      setSucces(true);
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <form className="formulier" onSubmit={opslaan}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">Beoordeling vastgelegd.</Melding> : null}
      <div className="rij">
        {ASPECTEN.map((a) => (
          <div key={a.id} className="veld">
            {a.label}
            <div className="radioRij" role="radiogroup" aria-label={a.label}>
              {[1, 2, 3, 4, 5].map((n) => (
                <label key={n}>
                  <input type="radio" name={`${engagementId}-${a.id}`} value={n} checked={scores[a.id] === n} onChange={() => setScores((s) => ({ ...s, [a.id]: n }))} />
                  {n}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
      <label>
        Toelichting
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder="Wat ging goed, wat niet; concrete voorbeelden" />
      </label>
      <div className="formulierActies">
        <button type="submit" className="knop" disabled={bezig}>
          {bezig ? "Opslaan…" : "Beoordeling opslaan"}
        </button>
        {bestaand ? (
          <button type="button" className="knop knop-tekst" onClick={() => setOpen(false)}>
            Annuleren
          </button>
        ) : null}
      </div>
    </form>
  );
}
