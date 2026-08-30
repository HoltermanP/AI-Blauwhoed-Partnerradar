"use client";
// Demo resetten naar seed-data (recht beheer).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetDemo } from "@/lib/actions";
import { Melding } from "@/components/ui";

export function DemoReset({ magBeheren }: { magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState(false);
  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {klaar ? <Melding soort="succes">Demodata is teruggezet.</Melding> : null}
      <p className="muted klein-tekst">Zet alle gegevens terug naar de demodata. Alle wijzigingen, matchruns en auditregels gaan verloren (de reset zelf wordt gelogd).</p>
      <button
        type="button"
        className="knop knop-gevaar klein"
        disabled={!magBeheren || bezig}
        onClick={() => {
          if (!confirm("Weet u zeker dat u de demo wilt resetten? Alle wijzigingen gaan verloren.")) return;
          setFout(null);
          setKlaar(false);
          start(async () => {
            const r = await resetDemo();
            if (!r.ok) setFout(r.fout);
            else {
              setKlaar(true);
              router.refresh();
            }
          });
        }}
      >
        {bezig ? "Bezig…" : "Demo resetten"}
      </button>
      {!magBeheren ? <p className="muted klein-tekst">Alleen beschikbaar voor de rol beheerder.</p> : null}
    </div>
  );
}
