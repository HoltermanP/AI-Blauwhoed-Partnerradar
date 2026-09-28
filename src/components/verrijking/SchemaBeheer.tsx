"use client";
// US-56: frequentie, dag/tijd en omvang van de periodieke verrijking. Alleen de beheerder wijzigt.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { slaVerrijkingsschemaOp } from "@/lib/acties/beheer";
import { ROLLEN, type VerrijkingsSchema } from "@/lib/domain/types";
import { FREQUENTIE_LABEL, OMVANG_LABEL, WEEKDAGEN } from "@/lib/domain/schema";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

export default function SchemaBeheer({ schema, magBeheren }: { schema: VerrijkingsSchema; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [w, setW] = useState({ frequentie: schema.frequentie, dag: schema.dag, tijd: schema.tijd, omvang: schema.omvang, rollen: schema.rollen, maanden: schema.maanden });
  const [melding, setMelding] = useState<{ soort: "fout" | "succes"; tekst: string } | null>(null);
  const wekelijks = w.frequentie === "wekelijks" || w.frequentie === "tweewekelijks";
  const zet = (x: Partial<typeof w>) => setW({ ...w, ...x });
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="rij">
        <label>
          Frequentie
          <select value={w.frequentie} disabled={!magBeheren} onChange={(e) => zet({ frequentie: e.target.value as VerrijkingsSchema["frequentie"], dag: 1 })}>
            {(Object.keys(FREQUENTIE_LABEL) as Array<VerrijkingsSchema["frequentie"]>).map((f) => (
              <option key={f} value={f}>
                {FREQUENTIE_LABEL[f]}
              </option>
            ))}
          </select>
        </label>
        {w.frequentie !== "uit" ? (
          <>
            <label>
              {wekelijks ? "Dag" : "Dag van de maand"}
              {wekelijks ? (
                <select value={w.dag} disabled={!magBeheren} onChange={(e) => zet({ dag: Number(e.target.value) })}>
                  {WEEKDAGEN.slice(1).map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="number" min={1} max={28} value={w.dag} disabled={!magBeheren} onChange={(e) => zet({ dag: Number(e.target.value) })} />
              )}
            </label>
            <label>
              Tijd (Nederlandse tijd)
              <input type="time" value={w.tijd} disabled={!magBeheren} onChange={(e) => zet({ tijd: e.target.value })} />
            </label>
          </>
        ) : null}
      </div>
      <label>
        Omvang
        <select value={w.omvang} disabled={!magBeheren} onChange={(e) => zet({ omvang: e.target.value as VerrijkingsSchema["omvang"] })}>
          {(Object.keys(OMVANG_LABEL) as Array<VerrijkingsSchema["omvang"]>).map((o) => (
            <option key={o} value={o}>
              {OMVANG_LABEL[o]}
            </option>
          ))}
        </select>
      </label>
      {w.omvang === "partnertype" ? (
        <div className="vinkjes">
          {ROLLEN.map((r) => (
            <label key={r}>
              <input type="checkbox" disabled={!magBeheren} checked={w.rollen.includes(r)} onChange={(e) => zet({ rollen: e.target.checked ? [...w.rollen, r] : w.rollen.filter((x) => x !== r) })} />
              {ROL_LABEL[r]}
            </label>
          ))}
        </div>
      ) : null}
      {w.omvang === "niet_verrijkt_sinds" ? (
        <label>
          Niet verrijkt sinds (maanden)
          <input type="number" min={1} max={60} value={w.maanden} disabled={!magBeheren} onChange={(e) => zet({ maanden: Number(e.target.value) })} />
        </label>
      ) : null}
      {magBeheren ? (
        <div className="formulierActies">
          <button
            type="button"
            className="knop klein"
            disabled={bezig}
            onClick={() =>
              start(async () => {
                const r = await slaVerrijkingsschemaOp(w);
                setMelding(r.ok ? { soort: "succes", tekst: r.data ? `Schema opgeslagen. Volgende ronde: ${new Date(r.data).toLocaleString("nl-NL")}.` : "Schema opgeslagen: periodieke verrijking staat uit." } : { soort: "fout", tekst: r.fout });
                if (r.ok) router.refresh();
              })
            }
          >
            Schema opslaan
          </button>
        </div>
      ) : (
        <p className="muted klein-tekst">Alleen de beheerder wijzigt het verrijkingsschema.</p>
      )}
    </div>
  );
}
