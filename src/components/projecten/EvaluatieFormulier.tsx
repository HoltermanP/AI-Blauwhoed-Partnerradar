"use client";
// US-21: partner beoordelen op kwaliteit, planning, budget, samenwerking en duurzaamheidsprestatie.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaEvaluatieOp } from "@/lib/actions";
import type { Evaluatie } from "@/lib/domain/types";
import { Melding } from "@/components/ui";
import { afgeleideTotaalscore, TEVREDENHEID_UITLEG } from "@/lib/domain/tevredenheid";

const ASPECTEN: Array<{ id: "kwaliteit" | "planning" | "budget" | "samenwerking" | "duurzaamheid"; label: string }> = [
  { id: "kwaliteit", label: "Kwaliteit" },
  { id: "planning", label: "Planning" },
  { id: "budget", label: "Budget" },
  { id: "samenwerking", label: "Samenwerking" },
  { id: "duurzaamheid", label: "Duurzaamheidsprestatie" }
];

export default function EvaluatieFormulier({ engagementId, partnerId, projectId, bestaand: bestaandOplevering, tussentijds, magEvalueren, openStandaard, standaardMoment = "oplevering" }: { engagementId: string; partnerId: string; projectId: string; bestaand?: Evaluatie; tussentijds?: Evaluatie; magEvalueren: boolean; openStandaard: boolean; standaardMoment?: "tussentijds" | "oplevering" }) {
  const router = useRouter();
  // US-18: tussentijds of na oplevering; per moment één evaluatie per betrokkenheid.
  const [moment, setMoment] = useState<"tussentijds" | "oplevering">(bestaandOplevering ? "oplevering" : tussentijds ? "tussentijds" : standaardMoment);
  const bestaand = moment === "tussentijds" ? tussentijds : bestaandOplevering;
  const [open, setOpen] = useState(openStandaard || !bestaand);
  const [scores, setScores] = useState({ kwaliteit: bestaand?.kwaliteit ?? 3, planning: bestaand?.planning ?? 3, budget: bestaand?.budget ?? 3, samenwerking: bestaand?.samenwerking ?? 3, duurzaamheid: bestaand?.duurzaamheid ?? 3 });
  const [toelichting, setToelichting] = useState(bestaand?.toelichting ?? "");
  // US-63: totale tevredenheidsscore — standaard het gemiddelde van de vijf deelscores, handmatig bij te stellen met toelichting.
  const [bijstellen, setBijstellen] = useState(bestaand?.totaalscore !== undefined);
  const [totaal, setTotaal] = useState(String(bestaand?.totaalscore ?? ""));
  const [totaalToelichting, setTotaalToelichting] = useState(bestaand?.totaalToelichting ?? "");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState(false);
  const [bezig, start] = useTransition();

  function kiesMoment(m: "tussentijds" | "oplevering") {
    setMoment(m);
    const b = m === "tussentijds" ? tussentijds : bestaandOplevering;
    setScores({ kwaliteit: b?.kwaliteit ?? 3, planning: b?.planning ?? 3, budget: b?.budget ?? 3, samenwerking: b?.samenwerking ?? 3, duurzaamheid: b?.duurzaamheid ?? 3 });
    setToelichting(b?.toelichting ?? "");
    setBijstellen(b?.totaalscore !== undefined);
    setTotaal(String(b?.totaalscore ?? ""));
    setTotaalToelichting(b?.totaalToelichting ?? "");
  }

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
      const r = await slaEvaluatieOp({ engagementId, partnerId, projectId, moment, ...scores, toelichting, totaalscore: bijstellen && totaal ? Number(totaal.replace(",", ".")) : undefined, totaalToelichting: bijstellen ? totaalToelichting : undefined });
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
      <p className="muted klein-tekst">De evaluatie geldt voor de organisatie, nooit voor een persoon. Noem geen namen of contactgegevens.</p>
      <div className="radioRij" role="radiogroup" aria-label="Moment">
        <label>
          <input type="radio" name={`${engagementId}-moment`} checked={moment === "tussentijds"} onChange={() => kiesMoment("tussentijds")} /> Tussentijds
        </label>
        <label>
          <input type="radio" name={`${engagementId}-moment`} checked={moment === "oplevering"} onChange={() => kiesMoment("oplevering")} /> Na oplevering
        </label>
      </div>
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
      <div className="veld">
        Totale tevredenheidsscore: <b>{bijstellen && totaal ? totaal : afgeleideTotaalscore(scores).toLocaleString("nl-NL")}</b> <span className="muted klein-tekst">(gemiddelde deelscores: {afgeleideTotaalscore(scores).toLocaleString("nl-NL")})</span>
        <div className="vinkjes">
          <label>
            <input type="checkbox" checked={bijstellen} onChange={(e) => setBijstellen(e.target.checked)} /> Totaalscore handmatig bijstellen
          </label>
        </div>
      </div>
      {bijstellen ? (
        <div className="rij">
          <label>
            Totaalscore (1–5)
            <input type="number" min={1} max={5} step={0.1} value={totaal} onChange={(e) => setTotaal(e.target.value)} required />
          </label>
          <label>
            Toelichting bij de bijstelling (verplicht)
            <input value={totaalToelichting} onChange={(e) => setTotaalToelichting(e.target.value)} required placeholder="Waarom wijkt het totaal af van het gemiddelde?" />
          </label>
        </div>
      ) : null}
      <label>
        Ervaring in eigen woorden
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder="Wat niet in cijfers te vangen is: projectbegrip, kwaliteit van ideeën, hoe de organisatie meedacht. Wat ging goed, wat niet?" />
        <small className="muted">Deze tekst gebruiken de AI-chat en de matchonderbouwing bij volgende selecties (alleen als de evaluatie is geaccepteerd).</small>
      </label>
      <p className="muted klein-tekst">{TEVREDENHEID_UITLEG}</p>
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
