"use client";
// Verrijking vanuit de partnerpagina: website opzoeken en openbare pagina's lezen; resultaten komen als voorstellen terug.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { startVerrijking } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function PartnerVerrijken({ partnerId, magBewerken, externeBronnen, heeftWebsite }: { partnerId: string; magBewerken: boolean; externeBronnen: boolean; heeftWebsite: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [melding, setMelding] = useState<{ soort: "succes" | "fout" | "info"; tekst: string } | null>(null);
  if (!magBewerken) return null;

  const draai = () => {
    setMelding(null);
    start(async () => {
      const r = await startVerrijking(partnerId);
      if (!r.ok) return setMelding({ soort: "fout", tekst: r.fout });
      const u = r.data!;
      if (!u.voorstellen) return setMelding({ soort: "info", tekst: externeBronnen ? (heeftWebsite ? "Geen nieuwe gegevens gevonden op de website (of de site was niet bereikbaar)." : "Geen website gevonden voor deze naam. Vul de website in via Bewerken en probeer opnieuw.") : "Externe bronnen staan uit (Beheer); alleen de profieltekst is gebruikt." });
      setMelding({ soort: "succes", tekst: `${u.voorstellen} voorstel(len) gevonden, ${u.nieuw} nieuw${u.websitesGevonden ? " (website gevonden)" : ""}. Beoordeel ze hieronder of in de verrijkingswachtrij.` });
      router.refresh();
    });
  };

  return (
    <span className="partnerVerrijken">
      <button type="button" className="knop knop-secundair" disabled={bezig} onClick={draai} title="Zoekt de website op (als die ontbreekt) en leest openbare pagina's; niets wordt zonder controle overgenomen.">
        {bezig ? "Internet raadplegen…" : "Verrijken via internet"}
      </button>
      {melding ? (
        <Melding soort={melding.soort}>
          {melding.tekst} <Link href="/verrijking">Wachtrij</Link>
        </Melding>
      ) : null}
    </span>
  );
}
