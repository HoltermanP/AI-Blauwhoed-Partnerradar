"use client";
// US-48: instellingen voor AI-verrijking en discovery. Alleen met recht beheer.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zetInstelling } from "@/lib/actions";
import type { Database } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

type Sleutel = "aiProvider" | "externeBronnenToegestaan" | "afgeschermdeOmgeving";

export function Instellingen({ instellingen, magBeheren }: { instellingen: Database["instellingen"]; magBeheren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const zet = (sleutel: Sleutel, waarde: string | boolean) => {
    setFout(null);
    setSucces(null);
    start(async () => {
      const r = await zetInstelling(sleutel, waarde);
      if (!r.ok) setFout(r.fout);
      else {
        setSucces(`Instelling '${sleutel}' opgeslagen.`);
        router.refresh();
      }
    });
  };

  return (
    <div className="formulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      {!magBeheren ? <Melding soort="info">Alleen een beheerder kan instellingen wijzigen; u ziet de huidige waarden.</Melding> : null}
      <label>
        AI-provider
        <select value={instellingen.aiProvider} disabled={!magBeheren || bezig} onChange={(e) => zet("aiProvider", e.target.value)}>
          <option value="uit">Uit (alleen lokale regels)</option>
          <option value="anthropic">Anthropic (zero-data-retention, nog niet aangesloten)</option>
        </select>
      </label>
      <div className="vinkjes">
        <label>
          <input type="checkbox" checked={instellingen.externeBronnenToegestaan} disabled={!magBeheren || bezig} onChange={(e) => zet("externeBronnenToegestaan", e.target.checked)} />
          Externe bronnen toegestaan (websites van partners ophalen voor verrijking)
        </label>
      </div>
      <div className="vinkjes">
        <label>
          <input type="checkbox" checked={instellingen.afgeschermdeOmgeving} disabled={!magBeheren || bezig} onChange={(e) => zet("afgeschermdeOmgeving", e.target.checked)} />
          Afgeschermde omgeving (verwerking blijft binnen de eigen omgeving)
        </label>
      </div>
      <p className="muted klein-tekst" style={{ margin: 0 }}>
        Laatste verrijking: {instellingen.laatsteVerrijking ? new Date(instellingen.laatsteVerrijking).toLocaleString("nl-NL") : "nog niet uitgevoerd"}.
      </p>
    </div>
  );
}
