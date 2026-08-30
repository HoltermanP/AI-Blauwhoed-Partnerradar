"use client";
// US-12/US-16: matchrun uitvoeren en opslaan. US-15: vrije omschrijving voor semantische vergelijking.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voerMatchUit } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function MatchRunFormulier({ projectId, heeftEisen }: { projectId: string; heeftEisen: boolean }) {
  const router = useRouter();
  const [naam, setNaam] = useState("");
  const [omschrijving, setOmschrijving] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();

  function uitvoeren(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    start(async () => {
      const r = await voerMatchUit(projectId, naam.trim() || undefined, omschrijving.trim() || undefined);
      if (!r.ok) return setFout(r.fout);
      router.push(`/projecten/${projectId}/match?run=${r.data}`);
      router.refresh();
    });
  }

  return (
    <form className="formulier" onSubmit={uitvoeren}>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {!heeftEisen ? <Melding soort="waarschuwing">Dit project heeft nog geen rollen en eisen. Leg die eerst vast op de projectpagina.</Melding> : null}
      <div className="rij">
        <label>
          Naam van de run (optioneel)
          <input value={naam} onChange={(e) => setNaam(e.target.value)} placeholder="bijv. Eerste selectie architect" />
        </label>
        <label style={{ gridColumn: "span 2" }}>
          Vrije omschrijving voor semantische vergelijking (optioneel, US-15)
          <input value={omschrijving} onChange={(e) => setOmschrijving(e.target.value)} placeholder="bijv. architect met ervaring in houtbouw in binnenstedelijke context" />
        </label>
      </div>
      <div className="formulierActies">
        <button type="submit" className="knop" disabled={bezig || !heeftEisen}>
          {bezig ? "Matchen…" : "Matchrun uitvoeren"}
        </button>
        <span className="muted klein-tekst">Elke run wordt opgeslagen (US-16) zodat u later kunt zien of er nieuwe of betere kandidaten zijn.</span>
      </div>
    </form>
  );
}
