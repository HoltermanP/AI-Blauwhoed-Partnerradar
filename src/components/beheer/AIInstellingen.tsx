"use client";
// US-58/US-59: budget in bewerkingen en euro, rekenprijzen en het model per functie.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaAIBudgetOp, slaModellenOp } from "@/lib/acties/beheer";
import type { AIBudget, AIFunctie } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export function AIBudgetEditor({ budget, magBeheren }: { budget: AIBudget; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [waarden, setWaarden] = useState({ ...budget });
  const [melding, setMelding] = useState<{ soort: "fout" | "succes"; tekst: string } | null>(null);
  const veld = (k: keyof AIBudget, label: string, stap = "1") => (
    <label>
      {label}
      <input type="number" min={0} step={stap} value={waarden[k]} disabled={!magBeheren} onChange={(e) => setWaarden({ ...waarden, [k]: Number(e.target.value) })} />
    </label>
  );
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="rij">
        {veld("bewerkingenPerMaand", "Maandbudget (AI-bewerkingen)")}
        {veld("tokenbudgetEur", "Tokenbudget per maand (€)", "0.5")}
        {veld("prijsInvoerPerMTok", "Rekenprijs input (€ per miljoen tokens)", "0.01")}
        {veld("prijsUitvoerPerMTok", "Rekenprijs output (€ per miljoen tokens)", "0.01")}
      </div>
      {magBeheren ? (
        <div className="formulierActies">
          <button
            type="button"
            className="knop klein"
            disabled={bezig}
            onClick={() =>
              start(async () => {
                const r = await slaAIBudgetOp(waarden);
                setMelding(r.ok ? { soort: "succes", tekst: "Budget opgeslagen." } : { soort: "fout", tekst: r.fout });
                if (r.ok) router.refresh();
              })
            }
          >
            Budget opslaan
          </button>
        </div>
      ) : null}
      <p className="muted klein-tekst">Bij 80% van het maandbudget (bewerkingen of tokenbudget) krijgt de beheerder een signaal; vanaf 100% starten geplande rondes niet meer en gaan interactieve functies voor. Boven 125% in een maand of gemiddeld boven 110% over een kwartaal volgt een apart signaal (art. 8).</p>
    </div>
  );
}

export function ModellenEditor({ modellen, functies, opties, magBeheren }: { modellen: Record<AIFunctie, string>; functies: Array<{ id: AIFunctie; label: string }>; opties: Array<{ id: string; label: string }>; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [keuze, setKeuze] = useState({ ...modellen });
  const [melding, setMelding] = useState<{ soort: "fout" | "succes"; tekst: string } | null>(null);
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="rij">
        {functies.map((f) => (
          <label key={f.id}>
            {f.label}
            <select value={keuze[f.id]} disabled={!magBeheren} onChange={(e) => setKeuze({ ...keuze, [f.id]: e.target.value })}>
              {opties.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
      {magBeheren ? (
        <div className="formulierActies">
          <button
            type="button"
            className="knop klein"
            disabled={bezig}
            onClick={() =>
              start(async () => {
                const r = await slaModellenOp(keuze);
                setMelding(r.ok ? { soort: "succes", tekst: "Modelkeuze opgeslagen." } : { soort: "fout", tekst: r.fout });
                if (r.ok) router.refresh();
              })
            }
          >
            Modelkeuze opslaan
          </button>
        </div>
      ) : null}
    </div>
  );
}
