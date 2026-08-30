"use client";
// Waarde-invoer per factorschaal (US-03): waarden komen uit de schaal/waardenlijst, geen vrije invoer behalve bij tekst.
import type { Factor, FactorWaarde } from "@/lib/domain/types";

export function standaardWaarde(factor: Factor): FactorWaarde {
  const s = factor.schaal;
  switch (s.soort) {
    case "niveau":
      return 3;
    case "getal":
      return s.min ?? 0;
    case "percentage":
      return 0;
    case "bereik":
      return { min: 0, max: 0 };
    case "keuze":
      return s.meervoudig ? [] : (factor.opties?.find((o) => o.actief)?.id ?? "");
    case "boolean":
      return true;
    case "tekst":
      return "";
  }
}

export function FactorWaardeVeld({ factor, waarde, onChange }: { factor: Factor; waarde: FactorWaarde; onChange: (w: FactorWaarde) => void }) {
  const s = factor.schaal;
  if (s.soort === "niveau") {
    return (
      <select value={typeof waarde === "number" ? waarde : 0} onChange={(e) => onChange(Number(e.target.value))}>
        {[0, 1, 2, 3, 4, 5].map((n) => (
          <option key={n} value={n}>
            {n} – {NIVEAU_LABEL[n]}
          </option>
        ))}
      </select>
    );
  }
  if (s.soort === "getal" || s.soort === "percentage") {
    const min = s.soort === "percentage" ? 0 : s.min;
    const max = s.soort === "percentage" ? 100 : s.max;
    return (
      <span className="metEenheid">
        <input type="number" step="any" min={min} max={max} value={typeof waarde === "number" ? waarde : ""} onChange={(e) => onChange(Number(e.target.value))} />
        <small>{s.soort === "percentage" ? "%" : s.eenheid}</small>
      </span>
    );
  }
  if (s.soort === "boolean") {
    return (
      <select value={waarde === true ? "ja" : "nee"} onChange={(e) => onChange(e.target.value === "ja")}>
        <option value="ja">Ja</option>
        <option value="nee">Nee</option>
      </select>
    );
  }
  if (s.soort === "keuze") {
    const opties = (factor.opties ?? []).filter((o) => o.actief);
    if (s.meervoudig) {
      const huidig = Array.isArray(waarde) ? waarde : [];
      return (
        <span className="vinkjes">
          {opties.map((o) => (
            <label key={o.id}>
              <input type="checkbox" checked={huidig.includes(o.id)} onChange={(e) => onChange(e.target.checked ? [...huidig, o.id] : huidig.filter((x) => x !== o.id))} />
              {o.label}
            </label>
          ))}
        </span>
      );
    }
    return (
      <select value={typeof waarde === "string" ? waarde : ""} onChange={(e) => onChange(e.target.value)}>
        {opties.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }
  if (s.soort === "bereik") {
    const b = typeof waarde === "object" && waarde !== null && !Array.isArray(waarde) ? waarde : { min: 0, max: 0 };
    return (
      <span className="bereikVeld">
        <input type="number" value={b.min} onChange={(e) => onChange({ ...b, min: Number(e.target.value) })} aria-label="Minimum" />
        <span>–</span>
        <input type="number" value={b.max} onChange={(e) => onChange({ ...b, max: Number(e.target.value) })} aria-label="Maximum" />
        <small>{s.eenheid}</small>
      </span>
    );
  }
  return <textarea value={typeof waarde === "string" ? waarde : ""} onChange={(e) => onChange(e.target.value)} />;
}

export const NIVEAU_LABEL: Record<number, string> = {
  0: "geen ervaring",
  1: "beperkt",
  2: "enige ervaring",
  3: "ervaren",
  4: "ruime ervaring",
  5: "specialist"
};
