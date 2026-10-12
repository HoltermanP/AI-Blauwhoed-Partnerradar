"use client";
// US-21: ingediende evaluaties accepteren of afwijzen. Alleen geaccepteerde evaluaties tellen mee in matching en onderbouwing.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelEvaluatie } from "@/lib/actions";
import type { Evaluatie } from "@/lib/domain/types";
import { afgeleideTotaalscore } from "@/lib/domain/tevredenheid";
import { datum } from "@/lib/format";
import { Badge, Melding } from "@/components/ui";

type Item = Evaluatie & { partnerNaam: string; projectNaam: string };

export default function EvaluatieAcceptatie({ evaluaties, magAccepteren }: { evaluaties: Item[]; magAccepteren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [reden, setReden] = useState<Record<string, string>>({});
  const beslis = (id: string, b: "geaccepteerd" | "afgewezen") =>
    start(async () => {
      setFout(null);
      const r = await beoordeelEvaluatie(id, b, reden[id]);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <ul className="lijst">
        {evaluaties.map((e) => (
          <li key={e.id} className="evaluatieItem">
            <div>
              <Link href={`/partners/${e.partnerId}?tab=historie`}>
                <b>{e.partnerNaam}</b>
              </Link>{" "}
              · <Link href={`/projecten/${e.projectId}/evaluaties`}>{e.projectNaam}</Link> <Badge kleur="grijs">{e.moment === "tussentijds" ? "tussentijds" : "na oplevering"}</Badge>{" "}
              <span className="muted klein-tekst">
                door {e.door}, {datum(e.datum)}
              </span>
            </div>
            <div className="klein-tekst">
              Kwaliteit {e.kwaliteit} · planning {e.planning} · budget {e.budget} · samenwerking {e.samenwerking} · duurzaamheid {e.duurzaamheid} · <b>totaal {(e.totaalscore ?? afgeleideTotaalscore(e)).toLocaleString("nl-NL")}</b>
            </div>
            {e.toelichting ? <blockquote className="zoekCitaat">{e.toelichting}</blockquote> : null}
            {magAccepteren ? (
              <div className="formulierActies">
                <button type="button" className="knop klein" disabled={bezig} onClick={() => beslis(e.id, "geaccepteerd")}>
                  Accepteren
                </button>
                <input value={reden[e.id] ?? ""} onChange={(x) => setReden((r) => ({ ...r, [e.id]: x.target.value }))} placeholder="Reden bij afwijzen" style={{ maxWidth: 260 }} />
                <button type="button" className="knop knop-secundair klein" disabled={bezig || !(reden[e.id] ?? "").trim()} onClick={() => beslis(e.id, "afgewezen")}>
                  Afwijzen
                </button>
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
