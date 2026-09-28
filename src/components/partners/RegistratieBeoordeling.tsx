"use client";
// Controle van een AI-registratie door de beheerder: vrijgeven (als bekend of prospect) of afwijzen.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { beoordeelRegistratie } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function RegistratieBeoordeling({ partnerId, blokkades, dubbel }: { partnerId: string; blokkades: string[]; dubbel: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [status, setStatus] = useState<"bekend" | "prospect">("bekend");
  const [toelichting, setToelichting] = useState("");
  const [fout, setFout] = useState<string | null>(null);

  function besluit(b: "vrijgegeven" | "afgewezen") {
    setFout(null);
    if (b === "afgewezen" && !toelichting.trim()) return setFout("Geef een toelichting bij afwijzen.");
    if (b === "vrijgegeven" && dubbel && !toelichting.trim()) return setFout("Er is een mogelijke dubbel gesignaleerd; licht toe waarom dit een aparte partner is.");
    start(async () => {
      const r = await beoordeelRegistratie(partnerId, b, status, toelichting.trim());
      if (!r.ok) return setFout(r.fout);
      router.refresh();
    });
  }

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="rij">
        <label>
          Vrijgeven als
          <select value={status} onChange={(e) => setStatus(e.target.value as "bekend" | "prospect")}>
            <option value="bekend">Bekend</option>
            <option value="prospect">Prospect</option>
          </select>
        </label>
      </div>
      <label>
        Toelichting
        <textarea value={toelichting} onChange={(e) => setToelichting(e.target.value)} placeholder={dubbel ? "Verplicht: waarom is dit geen dubbel?" : "Optioneel bij vrijgeven, verplicht bij afwijzen; komt in het auditlog."} />
      </label>
      <div className="formulierActies">
        <button type="button" className="knop klein" disabled={bezig || blokkades.length > 0} onClick={() => besluit("vrijgegeven")} title={blokkades.join(" ")}>
          Vrijgeven
        </button>
        <button type="button" className="knop knop-gevaar klein" disabled={bezig} onClick={() => besluit("afgewezen")}>
          Afwijzen
        </button>
        {blokkades.length ? <span className="muted klein-tekst">Eerst aanvullen via Bewerken: {blokkades.join(" ")}</span> : null}
      </div>
    </div>
  );
}
