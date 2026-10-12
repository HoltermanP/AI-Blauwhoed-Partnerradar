"use client";
// Verrijk precies de partners in deze lijst (bijv. alle architecten zonder MPG-score) als hervatbare ronde.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startGerichteRonde } from "@/lib/acties/datakwaliteit";
import { Melding } from "@/components/ui";

export default function GerichteVerrijking({ ids, magBewerken, externeBronnen }: { ids: string[]; magBewerken: boolean; externeBronnen: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [melding, setMelding] = useState<{ soort: "succes" | "fout" | "info"; tekst: string } | null>(null);
  if (!magBewerken || !ids.length) return null;
  return (
    <div className="formulier">
      {melding ? <Melding soort={melding.soort}>{melding.tekst}{melding.soort !== "fout" ? <> · <Link href="/verrijking">Naar verrijking</Link></> : null}</Melding> : null}
      <div className="formulierActies">
        <button
          type="button"
          className="knop klein"
          disabled={bezig}
          onClick={() =>
            start(async () => {
              setMelding(null);
              const r = await startGerichteRonde(ids);
              if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
              const d = r.data!;
              setMelding({ soort: "succes", tekst: `${d.partners} partner(s) verrijkt, ${d.nieuw} nieuwe voorstellen${d.nogTeGaan ? `; nog ${d.nogTeGaan} te gaan (hervat de ronde op de verrijkingspagina)` : ""}.` });
              router.refresh();
            })
          }
        >
          {bezig ? "Verrijken…" : `Verrijk deze ${ids.length} partner(s)`}
        </button>
        <span className="muted klein-tekst">{externeBronnen ? "Leest website, registers en geconfigureerde bronnen; elke partner telt als één AI-bewerking. Per keer maximaal 20, daarna hervatten." : "Externe bronnen staan uit: alleen profieltekst en documenten worden gelezen."}</span>
      </div>
    </div>
  );
}
