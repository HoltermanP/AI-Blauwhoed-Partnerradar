"use client";
// US-69: definitief verwijderen op verzoek (AVG). Dubbele bevestiging: eerst openen, dan reden + naam typen en bevestigen.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { verwijderPartnerDefinitiefActie } from "@/lib/actions";
import { Melding } from "@/components/ui";

export default function DefinitiefVerwijderen({ partnerId, naam }: { partnerId: string; naam: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reden, setReden] = useState("");
  const [bevestiging, setBevestiging] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="knop knop-gevaar klein" onClick={() => setOpen(true)}>
        Definitief verwijderen (AVG)…
      </button>
    );
  return (
    <div className="bevestigDialoog formulier" role="alertdialog" aria-label="Definitief verwijderen">
      <p className="klein-tekst">
        <b>Let op:</b> dit wist de partner definitief, inclusief contactpersonen, documenten (ook de bestanden), herkomstgegevens, projecthistorie en beoordelingen van deze partner. Matchruns en discovery-kandidaten worden opgeschoond, teamvoorstellen geanonimiseerd. De auditlog bewaart alleen dát er verwijderd is. Dit is niet terug te draaien.
      </p>
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <label>
        Reden (verplicht, zonder persoonsgegevens)
        <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="bijv. verzoek Blauwhoed d.d. 28-09-2026" />
      </label>
      <label>
        Typ ter bevestiging de naam: <b>{naam}</b>
        <input value={bevestiging} onChange={(e) => setBevestiging(e.target.value)} autoComplete="off" />
      </label>
      <div className="formulierActies">
        <button
          type="button"
          className="knop knop-gevaar klein"
          disabled={bezig || !reden.trim() || bevestiging.trim() !== naam.trim()}
          onClick={() => {
            if (!confirm(`'${naam}' definitief verwijderen? Dit kan niet ongedaan worden gemaakt.`)) return;
            setFout(null);
            start(async () => {
              const r = await verwijderPartnerDefinitiefActie(partnerId, reden, bevestiging);
              if (!r.ok) return setFout(r.fout);
              router.push("/partners?verwijderd=1");
              router.refresh();
            });
          }}
        >
          {bezig ? "Verwijderen…" : "Definitief verwijderen"}
        </button>
        <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(false)}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
