"use client";
// US-70: onderbouwing van een matchrun in gewone taal (AI of regels), met de verplichte kanttekening (art. 11.3).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { onderbouwMatchrun } from "@/lib/acties/analyse";
import type { MatchRun } from "@/lib/domain/types";
import { ROL_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

export default function MatchOnderbouwing({ run, namen, aiActief }: { run: MatchRun; namen: Record<string, string>; aiActief: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const o = run.onderbouwing;
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {o ? (
        <>
          <p className="muted klein-tekst">
            Opgesteld door {o.provider} op verzoek van {o.door} ({new Date(o.op).toLocaleString("nl-NL")}).
          </p>
          {o.perRol.map((r) => (
            <section key={r.rol} className="onderbouwingRol">
              <h3>{ROL_LABEL[r.rol]}</h3>
              <p>{r.samenvatting}</p>
              <ul className="lijst klein-tekst">
                {r.perKandidaat.map((k) => (
                  <li key={k.partnerId}>
                    <b>{namen[k.partnerId] ?? k.partnerId}</b>: {k.onderbouwing}
                    {k.aandachtspunten.length ? <div className="muted">Aandachtspunten: {k.aandachtspunten.join("; ")}</div> : null}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      ) : (
        <p className="muted klein-tekst">Nog geen onderbouwing voor deze run.</p>
      )}
      <div className="formulierActies">
        <button
          type="button"
          className="knop knop-secundair klein"
          disabled={bezig}
          onClick={() =>
            start(async () => {
              setFout(null);
              const r = await onderbouwMatchrun(run.id);
              if (!r.ok) return setFout(r.fout);
              router.refresh();
            })
          }
        >
          {bezig ? "Bezig…" : o ? "Onderbouwing opnieuw opstellen" : aiActief ? "Onderbouwing laten opstellen (AI, 1 bewerking)" : "Onderbouwing opstellen"}
        </button>
      </div>
    </div>
  );
}
