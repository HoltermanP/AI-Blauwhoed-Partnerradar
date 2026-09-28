"use client";
// US-70: verbandanalyse (AI of regels). Signalen met bron, geen bevestigde samenwerking (art. 11.4).
import { useState, useTransition } from "react";
import { analyseerVerbanden, type VerbandAnalyseUitkomst } from "@/lib/acties/analyse";
import type { Rol } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export default function VerbandAnalyse({ rolA, rolB, aiActief }: { rolA?: Rol; rolB?: Rol; aiActief: boolean }) {
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [uit, setUit] = useState<VerbandAnalyseUitkomst | null>(null);
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="formulierActies">
        <button
          type="button"
          className="knop knop-secundair klein"
          disabled={bezig}
          onClick={() =>
            start(async () => {
              setFout(null);
              const r = await analyseerVerbanden(rolA, rolB);
              if (!r.ok) return setFout(r.fout);
              setUit(r.data);
            })
          }
        >
          {bezig ? "Bezig…" : aiActief ? "Patronen laten analyseren (AI, 1 bewerking)" : "Patronen analyseren"}
        </button>
      </div>
      {uit ? (
        <>
          <ul className="lijst">
            {uit.patronen.map((p) => (
              <li key={p.titel}>
                <b>{p.titel}</b>
                <p className="klein-tekst">{p.toelichting}</p>
                {p.bronnen.length ? <p className="muted klein-tekst">Bron: {p.bronnen.join("; ")}</p> : null}
              </li>
            ))}
          </ul>
          <p className="muted klein-tekst">
            {uit.kanttekeningen.join(" ")} Opgesteld door {uit.provider}.
          </p>
        </>
      ) : null}
    </div>
  );
}
