"use client";
// US-33: eerder vastgelegde contactpersonen wissen, alleen op uitdrukkelijk verzoek van de beheerder.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { wisContactpersonen } from "@/lib/acties/beheer";
import { Melding } from "@/components/ui";

export default function ContactpersonenWissen({ aantal }: { aantal: number }) {
  const router = useRouter();
  const [bevestiging, setBevestiging] = useState("");
  const [melding, setMelding] = useState<{ soort: "succes" | "fout"; tekst: string } | null>(null);
  const [bezig, start] = useTransition();
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <div className="formulierActies">
        <input value={bevestiging} onChange={(e) => setBevestiging(e.target.value)} placeholder="Typ WISSEN" aria-label="Bevestiging" style={{ maxWidth: 160 }} />
        <button
          type="button"
          className="knop knop-gevaar klein"
          disabled={bezig || bevestiging !== "WISSEN"}
          onClick={() =>
            start(async () => {
              const r = await wisContactpersonen(bevestiging);
              if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
              setMelding({ soort: "succes", tekst: `${r.data ?? 0} contactperso(o)n(en) gewist.` });
              router.refresh();
            })
          }
        >
          {aantal} contactperso{aantal === 1 ? "on" : "nen"} definitief wissen
        </button>
      </div>
    </div>
  );
}
