"use client";
// AVG (eis 1): herkomst per partner exporteren (JSON-download) en verwijderen.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { exporteerHerkomst, wisHerkomstPartner } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function HerkomstActies({ partnerId, partnerNaam, magBeheren }: { partnerId: string; partnerNaam: string; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [melding, setMelding] = useState<{ soort: "fout" | "succes"; tekst: string } | null>(null);

  const exporteer = () => {
    setMelding(null);
    start(async () => {
      const r = await exporteerHerkomst(partnerId);
      if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      const blob = new Blob([JSON.stringify(r.data, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `herkomst-${partnerNaam.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMelding({ soort: "succes", tekst: "Herkomst geëxporteerd als JSON." });
    });
  };

  const wis = () => {
    if (!confirm("Alle herkomstinformatie van deze partner verwijderen (bronnen, bewijs, citaten, ruwe brondata)? De waarden zelf blijven staan. Dit is niet terug te draaien.")) return;
    setMelding(null);
    start(async () => {
      const r = await wisHerkomstPartner(partnerId);
      if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      setMelding({ soort: "succes", tekst: `${r.data ?? 0} herkomstgegevens verwijderd (gelogd in de audittrail).` });
      router.refresh();
    });
  };

  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
      <p className="muted klein-tekst">Elke waarde draagt bron, datum, betrouwbaarheid en status. De export bevat die herkomst per waarde; verwijderen (AVG) wist bron- en bewijsdetails maar laat de waarden staan.</p>
      <div className="formulierActies">
        <button type="button" className="knop knop-secundair klein" disabled={bezig} onClick={exporteer}>
          Herkomst exporteren (JSON)
        </button>
        {magBeheren ? (
          <button type="button" className="knop knop-gevaar klein" disabled={bezig} onClick={wis}>
            Herkomst verwijderen (AVG)
          </button>
        ) : null}
      </div>
    </div>
  );
}
