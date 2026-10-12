"use client";
// US-17/US-21: standaardweging — aandeel eigen ervaring (geaccepteerde evaluaties) tegenover openbare bronnen, aandeel
// samenwerkingsverbanden in de teamscore, het standaardprofiel en de correctie voor lage dekking.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaStandaardwegingOp } from "@/lib/acties/weging";
import { Melding } from "@/components/ui";

type Props = { eigenErvaring: number; samenwerking: number; profielId?: string; dekkingDemping: boolean; profielen: Array<{ id: string; naam: string }>; magBeheren: boolean; vastgesteld?: string };

export default function StandaardwegingEditor(p: Props) {
  const router = useRouter();
  const [ervaring, setErvaring] = useState(p.eigenErvaring);
  const [samen, setSamen] = useState(p.samenwerking);
  const [profiel, setProfiel] = useState(p.profielId ?? "");
  const [demping, setDemping] = useState(p.dekkingDemping);
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="rij">
        <label>
          Eigen ervaring: {ervaring}%
          <input type="range" min={0} max={50} step={5} value={ervaring} disabled={!p.magBeheren} onChange={(e) => setErvaring(Number(e.target.value))} />
          <small className="muted">Aandeel van eigen, geaccepteerde evaluaties in elke rol. Openbare bronnen en opgave (de overige criteria) delen {100 - ervaring}%.</small>
        </label>
        <label>
          Samenwerkingsverbanden: {samen}%
          <input type="range" min={0} max={50} step={5} value={samen} disabled={!p.magBeheren} onChange={(e) => setSamen(Number(e.target.value))} />
          <small className="muted">Aandeel eerdere samenwerking in de teamscore; kwaliteit, nabijheid en beschikbaarheid delen de rest.</small>
        </label>
        <label>
          Standaardprofiel bij nieuwe projecten
          <select value={profiel} disabled={!p.magBeheren} onChange={(e) => setProfiel(e.target.value)}>
            <option value="">– kies op projecttype –</option>
            {p.profielen.map((x) => (
              <option key={x.id} value={x.id}>
                {x.naam}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="vinkjes">
        <label>
          <input type="checkbox" checked={demping} disabled={!p.magBeheren} onChange={(e) => setDemping(e.target.checked)} /> Lage dekking drukt de rangschikking (ontbrekende criteria tellen als neutraal in plaats van weg te vallen)
        </label>
      </div>
      {p.magBeheren ? (
        <div className="formulierActies">
          <button
            type="button"
            className="knop"
            disabled={bezig}
            onClick={() =>
              start(async () => {
                setMelding(null);
                const r = await slaStandaardwegingOp({ eigenErvaring: ervaring, samenwerking: samen, profielId: profiel || undefined, dekkingDemping: demping });
                setMelding(r.ok ? { soort: "succes", tekst: "Standaardweging vastgesteld; de standaardprofielen hebben een nieuwe versie (terug te draaien per profiel). Geldt voor nieuwe matchruns." } : { soort: "fout", tekst: r.fout });
                if (r.ok) router.refresh();
              })
            }
          >
            {bezig ? "Opslaan…" : "Standaardweging vaststellen"}
          </button>
          {p.vastgesteld ? <span className="muted klein-tekst">{p.vastgesteld}</span> : null}
        </div>
      ) : (
        <p className="muted klein-tekst">Alleen de beheerder stelt de standaardweging vast.</p>
      )}
    </div>
  );
}
