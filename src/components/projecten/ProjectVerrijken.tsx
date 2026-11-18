"use client";
// Project verrijken uit zijn bronpagina's: kenmerken en betrokken partijen, elk met een citaat uit de bron.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verrijkProject } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function ProjectVerrijken({ projectId, heeftVerrijking }: { projectId: string; heeftVerrijking: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [melding, setMelding] = useState<{ soort: "succes" | "fout" | "info"; tekst: string } | null>(null);

  const draai = () => {
    setMelding(null);
    start(async () => {
      const r = await verrijkProject(projectId);
      if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      const u = r.data!;
      setMelding({ soort: u.kenmerken || u.partijen ? "succes" : "info", tekst: `${u.kenmerken} kenmerk(en) en ${u.partijen} betrokken partij(en) uit ${u.bronnen} bron(nen)${u.weggelaten ? `; ${u.weggelaten} punt(en) weggelaten omdat het citaat niet in de bron stond` : ""}.` });
      router.refresh();
    });
  };

  return (
    <div className="formulierActies">
      <button type="button" className="knop knop-secundair" disabled={bezig} onClick={draai} title="Leest de bronpagina's van dit project en haalt er kenmerken en betrokken partijen uit; alleen wat letterlijk in de bron staat wordt opgenomen.">
        {bezig ? "Bronnen lezen…" : heeftVerrijking ? "Opnieuw verrijken uit bronnen" : "Verrijken uit bronnen"}
      </button>
      {melding ? <Melding soort={melding.soort}>{melding.tekst}</Melding> : null}
    </div>
  );
}
