"use client";
// Eis 2: beheerdersscherm voor het AI-maandbudget.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zetInstelling } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function AIKosten({ budget, magBeheren }: { budget: number; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [waarde, setWaarde] = useState(String(budget));
  const [fout, setFout] = useState<string | null>(null);

  const opslaan = () => {
    setFout(null);
    start(async () => {
      const r = await zetInstelling("aiBudgetUsdPerMaand", Number(waarde) || 0);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  };

  if (!magBeheren) return null;
  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="formulierActies">
        <label>
          Maandbudget (USD)
          <input type="number" min={0} value={waarde} onChange={(e) => setWaarde(e.target.value)} style={{ maxWidth: 120 }} />
        </label>
        <button type="button" className="knop klein" disabled={bezig} onClick={opslaan}>
          Budget opslaan
        </button>
      </div>
      <p className="muted klein-tekst">Bij 80% verschijnt een melding op het dashboard; boven 100% starten geplande verrijkingsrondes niet meer en houden interactieve functies (zoeken, chat, matchen, verrijken van één partner) voorrang.</p>
    </div>
  );
}
