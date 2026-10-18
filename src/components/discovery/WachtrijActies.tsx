"use client";
// Bulkopruiming van de wachtrij: verwijder in één keer alle kandidaten met de huidige status.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verwijderKandidatenMetStatus } from "@/lib/actions";
import type { DiscoveryStatus } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

export default function WachtrijActies({ status, label, aantal }: { status: DiscoveryStatus; label: string; aantal: number }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  if (!aantal) return null;

  const verwijderAlle = () => {
    setFout(null);
    if (!confirm(`Alle ${aantal} kandidaten met status '${label}' definitief verwijderen?`)) return;
    start(async () => {
      const r = await verwijderKandidatenMetStatus(status);
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  };

  return (
    <>
      <button type="button" className="knop knop-tekst klein verwijderTekst" onClick={verwijderAlle} disabled={bezig} title={`Verwijdert alle ${aantal} kandidaten met status '${label}'`}>
        Verwijder alle ({aantal})
      </button>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
    </>
  );
}
