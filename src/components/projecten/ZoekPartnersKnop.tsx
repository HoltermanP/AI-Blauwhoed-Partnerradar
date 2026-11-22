"use client";
// VE-04: start direct een matchrun als er nog geen is.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { voerMatchUit } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function ZoekPartnersKnop({ projectId, heeftEisen }: { projectId: string; heeftEisen: boolean }) {
  const router = useRouter();
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();

  function zoek() {
    setFout(null);
    start(async () => {
      const r = await voerMatchUit(projectId);
      if (!r.ok) return setFout(r.fout);
      router.push(`/projecten/${projectId}?tab=partners&run=${r.data}`);
      router.refresh();
    });
  }

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {!heeftEisen ? <Melding soort="waarschuwing">Dit project heeft nog geen rollen en eisen. Leg die eerst vast in de tab Beschrijving.</Melding> : null}
      <div className="formulierActies">
        <button type="button" className="knop" onClick={zoek} disabled={bezig || !heeftEisen}>
          {bezig ? "Zoeken…" : "Zoek geschikte partners"}
        </button>
      </div>
    </div>
  );
}
