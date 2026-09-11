"use client";
// US-07 / US-34: statusbeheer. Preferred wordt door de action geweigerd zolang de kwalificatie niet volledig is.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { zetPartnerStatus } from "@/lib/actions";
import type { PartnerStatus } from "@/lib/domain/types";
import { STATUS_LABEL } from "@/lib/format";
import { Melding } from "@/components/ui";

const KEUZES: PartnerStatus[] = ["bekend", "preferred", "afgewezen", "geblokkeerd", "gearchiveerd"];

export default function StatusBeheer({ partnerId, huidig, reden, geblokkeerdTot, magBewerken, magPromoveren }: { partnerId: string; huidig: PartnerStatus; reden?: string; geblokkeerdTot?: string; magBewerken: boolean; magPromoveren: boolean }) {
  const router = useRouter();
  const [bezig, start] = useTransition();
  const [status, setStatus] = useState<PartnerStatus>(huidig === "prospect" ? "bekend" : huidig);
  const [nieuweReden, setReden] = useState(reden ?? "");
  const [tot, setTot] = useState(geblokkeerdTot ?? "");
  const [fout, setFout] = useState<string | null>(null);
  const [succes, setSucces] = useState<string | null>(null);

  const zwaar = status === "preferred" || status === "geblokkeerd";
  const geenRecht = !magBewerken || (zwaar && !magPromoveren);

  function verzend(e: React.FormEvent) {
    e.preventDefault();
    setFout(null);
    setSucces(null);
    if (status === "geblokkeerd" && !tot) {
      setFout("Geef een einddatum voor de blokkade.");
      return;
    }
    if (!nieuweReden.trim()) {
      setFout("Geef een reden op.");
      return;
    }
    start(async () => {
      const r = await zetPartnerStatus(partnerId, status, nieuweReden.trim(), status === "geblokkeerd" ? tot : undefined);
      if (!r.ok) {
        setFout(r.fout);
        return;
      }
      setSucces(`Status gezet op ${STATUS_LABEL[status]}.`);
      router.refresh();
    });
  }

  return (
    <form className="formulier" onSubmit={verzend}>
      {fout ? (
        <Melding soort="fout">
          {fout}{" "}
          {fout.startsWith("Preferred vereist") ? <Link href={`/partners/${partnerId}?tab=kwalificatie`}>Naar kwalificatie</Link> : null}
        </Melding>
      ) : null}
      {succes ? <Melding soort="succes">{succes}</Melding> : null}
      <div className="rij">
        <label>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as PartnerStatus)}>
            {KEUZES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        {status === "geblokkeerd" ? (
          <label>
            Geblokkeerd tot
            <input type="date" value={tot} onChange={(e) => setTot(e.target.value)} required />
          </label>
        ) : null}
      </div>
      <label>
        Reden
        <textarea value={nieuweReden} onChange={(e) => setReden(e.target.value)} placeholder="Verplicht; komt in het auditlog." />
      </label>
      <div className="formulierActies">
        <button type="submit" className="knop klein" disabled={bezig || geenRecht}>
          {bezig ? "Bezig…" : "Status opslaan"}
        </button>
        {!magBewerken ? <span className="muted klein-tekst">Uw rol mag geen partners bewerken.</span> : null}
        {magBewerken && zwaar && !magPromoveren ? <span className="muted klein-tekst">Preferred en geblokkeerd vereisen het recht prospect_promoveren (inkoper/beheerder).</span> : null}
        {status === "preferred" ? <span className="muted klein-tekst">Alleen mogelijk na volledige kwalificatie (US-34).</span> : null}
      </div>
    </form>
  );
}
