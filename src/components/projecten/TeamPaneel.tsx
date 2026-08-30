"use client";
// US-35 teamvoorstel, US-37 alternatief, US-38 exporteren als PDF (printvriendelijke layout via window.print()).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { maakTeamvoorstel } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function TeamPaneel({ runId, heeftVoorkeur }: { runId: string; heeftVoorkeur: boolean }) {
  const router = useRouter();
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();

  function maak(variant: "voorkeur" | "alternatief") {
    setFout(null);
    start(async () => {
      const r = await maakTeamvoorstel(runId, variant);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  }

  return (
    <div className="geenPrint">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="formulierActies">
        <button type="button" className="knop" disabled={bezig} onClick={() => maak("voorkeur")}>
          {bezig ? "Bezig…" : "Teamvoorstel genereren"}
        </button>
        <button type="button" className="knop knop-secundair" disabled={bezig} onClick={() => maak("alternatief")} title={heeftVoorkeur ? "Wijkt bewust af van het voorkeursteam" : "Genereer eerst een voorkeursteam voor een echt afwijkend alternatief"}>
          Alternatief team
        </button>
        <button type="button" className="knop knop-secundair" onClick={() => window.print()}>
          Exporteren als PDF
        </button>
      </div>
    </div>
  );
}
