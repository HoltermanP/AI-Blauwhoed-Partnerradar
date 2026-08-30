"use client";
// US-39: zoeken op meerdere kenmerken tegelijk. Elke regel = factor (+ optie) + minimumwaarde; alle regels moeten kloppen (EN).
// Wordt in het GET-formulier gecodeerd als k=factor:optie:min;factor:optie:min

import { useState } from "react";
import { Plus, X } from "lucide-react";
import type { Factor } from "@/lib/domain/types";

import { serialiseerKenmerken, type KenmerkEis } from "./kenmerken";

export default function KenmerkFilters({ factoren, initieel }: { factoren: Factor[]; initieel: KenmerkEis[] }) {
  const [eisen, setEisen] = useState<KenmerkEis[]>(initieel.length ? initieel : []);
  const update = (i: number, patch: Partial<KenmerkEis>) => setEisen((cur) => cur.map((e, j) => (j === i ? { ...e, ...patch } : e)));

  return (
    <div className="kenmerkFilters">
      <input type="hidden" name="k" value={serialiseerKenmerken(eisen)} />
      {eisen.map((e, i) => {
        const factor = factoren.find((f) => f.id === e.factorId);
        const schaal = factor?.schaal;
        const hint =
          schaal?.soort === "niveau" ? "niveau 0–5" : schaal?.soort === "percentage" ? "%" : schaal?.soort === "getal" ? schaal.eenheid : "";
        return (
          <div className="rij kenmerkRij" key={i}>
            <label>
              Kenmerk {i + 1}
              <select value={e.factorId} onChange={(ev) => update(i, { factorId: ev.target.value, optieId: "" })}>
                <option value="">Kies factor</option>
                {factoren.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.code} {f.naam}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Optie
              <select value={e.optieId} onChange={(ev) => update(i, { optieId: ev.target.value })} disabled={!factor?.opties?.length}>
                <option value="">{factor?.opties?.length ? "Elke optie" : "n.v.t."}</option>
                {factor?.opties
                  ?.filter((o) => o.actief)
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              {schaal && "lagerIsBeter" in schaal && schaal.lagerIsBeter ? "Maximaal" : "Minimaal"} {hint ? `(${hint})` : ""}
              <input type="number" step="any" value={e.min} onChange={(ev) => update(i, { min: ev.target.value })} placeholder="leeg = alleen aanwezig" />
            </label>
            <button type="button" className="knop knop-secundair klein kenmerkVerwijder" onClick={() => setEisen((cur) => cur.filter((_, j) => j !== i))} aria-label="Kenmerk verwijderen">
              <X size={14} />
            </button>
          </div>
        );
      })}
      <button type="button" className="knop knop-tekst klein" onClick={() => setEisen((cur) => [...cur, { factorId: "", optieId: "", min: "" }])}>
        <Plus size={14} /> Kenmerk toevoegen
      </button>
    </div>
  );
}
