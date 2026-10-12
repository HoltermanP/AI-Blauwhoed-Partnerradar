"use client";
// US-06: de classificatie van een project (projecttype) corrigeren, met reden. De correctie gaat voor op het AI-label.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { corrigeerProjecttype } from "@/lib/acties/waarden";
import type { Projecttype } from "@/lib/domain/types";
import { Melding } from "@/components/ui";

const TYPEN: Projecttype[] = ["grondgebonden", "appartementen", "hoogbouw", "transformatie", "zorgwonen", "gebiedsontwikkeling"];

export default function ProjectClassificatie({ projectId, huidig }: { projectId: string; huidig: Projecttype }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [naar, setNaar] = useState<Projecttype>(huidig);
  const [reden, setReden] = useState("");
  const [fout, setFout] = useState<string | null>(null);
  const [bezig, start] = useTransition();
  if (!open)
    return (
      <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(true)}>
        Classificatie corrigeren
      </button>
    );
  return (
    <div className="formulier inlineFormulier">
      {fout ? <Melding soort="fout">{fout}</Melding> : null}
      <div className="rij">
        <label>
          Juiste projecttype
          <select value={naar} onChange={(e) => setNaar(e.target.value as Projecttype)}>
            {TYPEN.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
        <label style={{ gridColumn: "span 2" }}>
          Reden (verplicht)
          <input value={reden} onChange={(e) => setReden(e.target.value)} placeholder="bijv. geen zorgwoningen: reguliere sociale huur" />
        </label>
      </div>
      <div className="formulierActies">
        <button
          type="button"
          className="knop klein"
          disabled={bezig || !reden.trim() || naar === huidig}
          onClick={() =>
            start(async () => {
              setFout(null);
              const r = await corrigeerProjecttype(projectId, naar, reden);
              if (!r.ok) return setFout(r.fout);
              setOpen(false);
              setReden("");
              router.refresh();
            })
          }
        >
          Correctie vastleggen
        </button>
        <button type="button" className="knop knop-tekst klein" onClick={() => setOpen(false)}>
          Annuleren
        </button>
      </div>
    </div>
  );
}
