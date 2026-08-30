"use client";
// Database leegmaken of (voor een demonstratie) de fictieve demoset laden (recht beheer).
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { resetDemo } from "@/lib/actions";
import { Melding } from "@/components/ui";

export function DemoReset({ magBeheren }: { magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [klaar, setKlaar] = useState<string | null>(null);

  const voer = (modus: "leeg" | "demo") => {
    const vraag = modus === "leeg" ? "Alle partners, projecten, historie, matchruns en kandidaten worden verwijderd. Factorenmodel en gewichtsprofielen blijven. Doorgaan?" : "De fictieve demoset vervangt alle huidige gegevens. Doorgaan?";
    if (!confirm(vraag)) return;
    setFout(null);
    setKlaar(null);
    start(async () => {
      const r = await resetDemo(modus);
      if (!r.ok) setFout(r.fout);
      else {
        setKlaar(modus === "leeg" ? "Database is leeggemaakt." : "Demodata is geladen.");
        router.refresh();
      }
    });
  };

  return (
    <div>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {klaar ? <Melding soort="succes">{klaar}</Melding> : null}
      <p className="muted klein-tekst">Leegmaken verwijdert alle bedrijfs- en projectgegevens (de actie wordt gelogd). De demoset is uitsluitend bedoeld voor demonstraties en bevat fictieve bedrijven.</p>
      <div className="formulierActies">
        <button type="button" className="knop knop-gevaar klein" disabled={!magBeheren || bezig} onClick={() => voer("leeg")}>
          {bezig ? "Bezig…" : "Database leegmaken"}
        </button>
        <button type="button" className="knop knop-secundair klein" disabled={!magBeheren || bezig} onClick={() => voer("demo")}>
          Demodata laden (fictief)
        </button>
      </div>
      {!magBeheren ? <p className="muted klein-tekst">Alleen beschikbaar voor de rol beheerder.</p> : null}
    </div>
  );
}
